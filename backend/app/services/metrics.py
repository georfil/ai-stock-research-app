# Computes financial ratios/metrics for a stock on top of the cached
# statements from financial_data.py.
#
# Statement flattens a stock's income statement, balance sheet, and cash flow
# into a single concept×period lookup, keyed by standard XBRL concept (not
# the raw label) so a metric's formula works the same regardless of how a
# given company phrases its line items.
#
# A Metric pairs a formula (fn) with the description/use_case/formula text
# shown to the model — new metrics are added to the METRICS catalog, each fn
# built from safe_div so missing data or a zero denominator resolves to None
# rather than raising.
#
# Two LangChain tools are exposed to the financial analyst worker:
# - list_metrics lists the catalog (name, description, use case, formula) so
#   the model can look up what's available without guessing metric names.
# - get_metrics computes named metrics across recent periods for a ticker,
#   reporting unrecognized names back rather than guessing what was meant —
#   the model is expected to call list_metrics first if it isn't sure.

from dataclasses import dataclass
from typing import Callable

from sqlmodel import Session
from langchain_core.tools import tool

from app.services.financial_data import get_financial_statement
from app.models import Stock, FinancialStatement
from app.crud import get_or_create_stock
from app.core.database import session_scope


# =============================================================================
# Statement snapshot — flattens the 3 statements into a concept×period lookup
# =============================================================================
CONCEPTS = {
    # ---- income statement -------------------------------------------------
    "revenue":                "Revenue",
    "cogs":                   "CostOfGoodsAndServicesSold",
    "gross_profit":           "GrossProfit",
    "ebit":                   "OperatingIncomeLoss",        # operating income = EBIT
    "interest_expense":       "InterestExpense",
    "pretax_income":          "PretaxIncomeLoss",
    "income_tax_expense":     "IncomeTaxes",
    "net_income":             "NetIncome",
    "shares_diluted":         "SharesFullyDilutedAverage",
    # ---- balance sheet ----------------------------------------------------
    "current_assets":         "CurrentAssetsTotal",
    "current_liabilities":    "CurrentLiabilitiesTotal",
    "cash_and_equivalents":   "CashAndCashEquivalents",
    "short_term_investments": "ShortTermInvestments",
    "inventory":              "Inventories",
    "accounts_receivable":    "TradeReceivables",
    "accounts_payable":       "TradePayables",
    "total_assets":           "Assets",
    "total_liabilities":      "Liabilities",
    "total_equity":           "AllEquityBalance",           # total equity balance (all components)
    "net_ppe":                "PlantPropertyEquipmentNet",
    # ---- cash flow statement ----------------------------------------------
    "operating_cash_flow":    "NetCashFromOperatingActivities",
    "capex":                  "CapitalExpenses",
    # ---- synthesized in __init__ (no single label — see below) -----------
    "depreciation_amortization": "_SYNTH_DA",
    "total_debt":                "_SYNTH_TOTAL_DEBT",
    "eps_diluted":               "_SYNTH_EPS",
}


class Statement:

    def __init__(self, stock: Stock, session: Session) -> None:

        #Get all 3 financial statements
        statements = [
            get_financial_statement(stock, FinancialStatement.INCOME_STATEMENT, session),
            get_financial_statement(stock, FinancialStatement.BALANCE_SHEET, session),
            get_financial_statement(stock, FinancialStatement.CASH_FLOW, session),
        ]

        self._index: dict[tuple[str, int], float | None] = {}  # eg ("CurrentAssetsTotal", 2026): 1.000.000
        periods: set = set()

        #Flatten them into a single dict
        for stmt in statements:

            if not stmt: #if stmt doesnt exist, continue
                continue

            for line in stmt:
                if line.period and line.standard_label: #if both period and label exist, index it
                    self._index[line.standard_label, line.period] = line.value
                    periods.add(line.period)

        self._periods = sorted(periods, reverse=True)

        #Synthesize the figures with no single source label
        for period in self._periods:

            # D&A = depreciation + intangible amortization (sum, not one or the other)
            da = self._sum_raw(["DepreciationExpense", "AmortizationOfIntangibles"], period)
            if da is not None:
                self._index["_SYNTH_DA", period] = da

            # total debt = long-term + current portion of LT + short-term
            debt = self._sum_raw(
                ["LongTermDebt", "CurrentPortionOfLongTermDebt", "ShortTermDebt"], period)
            if debt is not None:
                self._index["_SYNTH_TOTAL_DEBT", period] = debt

            # diluted EPS = income to common / diluted shares (income-to-common nets out preferred)
            nic = self._index.get(("NetIncomeToCommonShareholders", period))
            sh  = self._index.get(("SharesFullyDilutedAverage", period))
            if nic is not None and sh:  # `sh` truthy guards both None and zero
                self._index["_SYNTH_EPS", period] = nic / sh


    def _sum_raw(self, labels: list[str], period: int) -> float | None:
        """Sum whichever component labels are present for the period.
        Returns None only if ALL are missing -> value() then nulls cleanly."""
        parts = [self._index.get((lbl, period)) for lbl in labels]
        present = [p for p in parts if p is not None]
        return sum(present) if present else None

    
    @property
    def n_periods(self) -> int:
        """Number of distinct reporting periods available."""
        return len(self._periods)

    @property
    def periods(self) -> list[int]:
        """Reporting periods (years), most recent first."""
        return self._periods

    def value(self, concept: str, period: int) -> float | None:
        """Look up a concept's value for a period, or None if it isn't available.

        None (rather than raising) covers both an unmapped/not-yet-cataloged
        concept and a period further back than what's been fetched — growth
        and CAGR metrics deliberately look past the requested window (period
        + 1, +3, +5...), so that has to be a normal "not available" outcome,
        not a crash.
        """
        standard_concept = CONCEPTS.get(concept, None)
        if not standard_concept:
            return None

        if period < 0 or period >= len(self._periods):
            return None

        year = self._periods[period]
        return self._index.get((standard_concept, year), None)


# =============================================================================
# Metric catalog
# =============================================================================

def _safe_div(a: float | None, b: float | None) -> float | None:
    """Divide a by b, or None if either operand is missing or b is zero."""
    if a is None or b is None or b == 0:
        return None
    return a / b


def _safe_add(a: float | None, b: float | None) -> float | None:
    """Add a and b, or None if either operand is missing."""
    return None if a is None or b is None else a + b


def _safe_sub(a: float | None, b: float | None) -> float | None:
    """Subtract b from a, or None if either operand is missing."""
    return None if a is None or b is None else a - b


def _safe_mul(a: float | None, k: float) -> float | None:
    """Scale a by the constant k, or None if a is missing."""
    return None if a is None else a * k


def _growth(current: float | None, previous: float | None) -> float | None:
    """(current / previous) - 1, or None if either is missing, previous is zero,
    or current and previous have opposite signs.

    A sign flip (e.g. a net loss turning into a profit) makes the percentage
    meaningless as a growth rate — it's a change in kind, not degree — so
    it's reported as not computable rather than as a number that would
    mislead (e.g. -10 -> 5 comes out to -250%, which reads as a huge decline
    when the opposite happened).
    """
    if current is not None and previous is not None and current * previous < 0:
        return None
    ratio = _safe_div(current, previous)
    return None if ratio is None else ratio - 1


def _cagr(end: float | None, start: float | None, years: int) -> float | None:
    """Compound annual growth rate from start to end over `years` years.

    None if either value is missing or non-positive — a non-positive base
    makes the fractional exponent undefined.
    """
    if end is None or start is None or start <= 0 or end <= 0:
        return None
    return (end / start) ** (1 / years) - 1


def _roic(s: "Statement", p: int) -> float | None:
    """After-tax operating profit (NOPAT) over invested capital (debt + equity)."""
    ebit = s.value("ebit", p)
    tax_rate = _safe_div(s.value("income_tax_expense", p), s.value("pretax_income", p))
    if ebit is None or tax_rate is None:
        return None

    invested_capital = _safe_add(s.value("total_debt", p), s.value("total_equity", p))
    return _safe_div(ebit * (1 - tax_rate), invested_capital)


def _cash_conversion_cycle(s: "Statement", p: int) -> float | None:
    """Days from paying for inventory to collecting cash from its sale (DIO + DSO - DPO)."""
    dio = _safe_mul(_safe_div(s.value("inventory", p), s.value("cogs", p)), 365)
    dso = _safe_mul(_safe_div(s.value("accounts_receivable", p), s.value("revenue", p)), 365)
    dpo = _safe_mul(_safe_div(s.value("accounts_payable", p), s.value("cogs", p)), 365)
    return _safe_sub(_safe_add(dio, dso), dpo)


def _ebitda_growth(s: "Statement", p: int) -> float | None:
    """Year-over-year growth in EBITDA (ebit + depreciation & amortization)."""
    ebitda_now = _safe_add(s.value("ebit", p), s.value("depreciation_amortization", p))
    ebitda_prev = _safe_add(s.value("ebit", p + 1), s.value("depreciation_amortization", p + 1))
    return _growth(ebitda_now, ebitda_prev)


def _fcf_growth(s: "Statement", p: int) -> float | None:
    """Year-over-year growth in free cash flow (operating cash flow - capex)."""
    fcf_now = _safe_sub(s.value("operating_cash_flow", p), s.value("capex", p))
    fcf_prev = _safe_sub(s.value("operating_cash_flow", p + 1), s.value("capex", p + 1))
    return _growth(fcf_now, fcf_prev)


@dataclass(frozen=True)
class Metric:
    fn: Callable[[Statement, int], float | None]
    description: str                    # what it measures — shown to the model in the schema
    formula: str                         # human-readable formula, returned for audit
    use_case: str                        # when an analyst would reach for it — shown to the model in the schema
    unit: str                            # how fn()'s raw return should be displayed — see _fmt_metric


# ==============================================================================
# THE REGISTRY
# ==============================================================================
METRICS: dict[str, Metric] = {
 
    # ---------------------------------------------------------------- LIQUIDITY
    "current_ratio": Metric(
        fn=lambda s, p: _safe_div(s.value("current_assets", p), s.value("current_liabilities", p)),
        description="Dollars of current assets per dollar of current liabilities.",
        formula="current_assets / current_liabilities",
        use_case="Assessing short-term solvency, or comparing working-capital health across firms.",
        unit="x",
    ),
    "quick_ratio": Metric(
        fn=lambda s, p: _safe_div(
            _safe_sub(s.value("current_assets", p), s.value("inventory", p)),
            s.value("current_liabilities", p),
        ),
        description="Acid test: liquidity excluding inventory, which is slowest to convert to cash.",
        formula="(current_assets - inventory) / current_liabilities",
        use_case="Stress-testing liquidity for firms where inventory may be hard to sell quickly.",
        unit="x",
    ),
    "cash_ratio": Metric(
        fn=lambda s, p: _safe_div(
            _safe_add(s.value("cash_and_equivalents", p), s.value("short_term_investments", p)),
            s.value("current_liabilities", p),
        ),
        description="Most conservative liquidity view: only cash and marketable securities.",
        formula="(cash_and_equivalents + short_term_investments) / current_liabilities",
        use_case="Worst-case liquidity check — can the firm cover current bills from cash alone.",
        unit="x",
    ),
    "working_capital": Metric(
        fn=lambda s, p: _safe_sub(s.value("current_assets", p), s.value("current_liabilities", p)),
        description="Absolute buffer of current assets over current liabilities (currency).",
        formula="current_assets - current_liabilities",
        use_case="Sizing the operating cushion; negative values can signal a funding squeeze.",
        unit="$",
    ),
    "working_capital_to_revenue": Metric(
        fn=lambda s, p: _safe_div(
            _safe_sub(s.value("current_assets", p), s.value("current_liabilities", p)),
            s.value("revenue", p),
        ),
        description="Working capital as a share of revenue — how capital-intensive operations are.",
        formula="(current_assets - current_liabilities) / revenue",
        use_case="Comparing operating efficiency across companies of different sizes.",
        unit="%",
    ),
 
    # ----------------------------------------------------------------- LEVERAGE
    "debt_to_equity": Metric(
        fn=lambda s, p: _safe_div(s.value("total_debt", p), s.value("total_equity", p)),
        description="Total debt relative to shareholders' equity — capital-structure leverage.",
        formula="total_debt / total_equity",
        use_case="Gauging financial risk and reliance on borrowing vs owner funding.",
        unit="x",
    ),
    "debt_to_assets": Metric(
        fn=lambda s, p: _safe_div(s.value("total_debt", p), s.value("total_assets", p)),
        description="Share of the asset base financed by debt.",
        formula="total_debt / total_assets",
        use_case="Simple leverage comparison that is robust to negative-equity firms.",
        unit="%",
    ),
    "debt_to_ebitda": Metric(
        fn=lambda s, p: _safe_div(
            s.value("total_debt", p),
            _safe_add(s.value("ebit", p), s.value("depreciation_amortization", p)),
        ),
        description="Debt measured in years of EBITDA — the standard credit leverage gauge.",
        formula="total_debt / (ebit + depreciation_amortization)",
        use_case="Credit analysis and covenant checks; how many years of cash earnings to repay debt.",
        unit="x",
    ),
    "net_debt": Metric(
        fn=lambda s, p: _safe_sub(s.value("total_debt", p), s.value("cash_and_equivalents", p)),
        description="Debt net of cash on hand (currency).",
        formula="total_debt - cash_and_equivalents",
        use_case="True indebtedness for firms carrying large cash balances.",
        unit="$",
    ),
    "net_debt_to_ebitda": Metric(
        fn=lambda s, p: _safe_div(
            _safe_sub(s.value("total_debt", p), s.value("cash_and_equivalents", p)),
            _safe_add(s.value("ebit", p), s.value("depreciation_amortization", p)),
        ),
        description="Cash-adjusted leverage in years of EBITDA.",
        formula="(total_debt - cash_and_equivalents) / (ebit + depreciation_amortization)",
        use_case="The leverage metric most credit desks actually anchor on.",
        unit="x",
    ),
    "equity_multiplier": Metric(
        fn=lambda s, p: _safe_div(s.value("total_assets", p), s.value("total_equity", p)),
        description="Assets per dollar of equity — the leverage component of DuPont ROE.",
        formula="total_assets / total_equity",
        use_case="Decomposing ROE into margin x turnover x leverage.",
        unit="x",
    ),
    "capitalization_ratio": Metric(
        fn=lambda s, p: _safe_div(
            s.value("total_debt", p),
            _safe_add(s.value("total_debt", p), s.value("total_equity", p)),
        ),
        description="Debt as a share of total capitalization (debt + equity).",
        formula="total_debt / (total_debt + total_equity)",
        use_case="Bounded 0-1 leverage measure, easier to compare than debt/equity.",
        unit="%",
    ),
    "interest_coverage": Metric(
        fn=lambda s, p: _safe_div(s.value("ebit", p), s.value("interest_expense", p)),
        description="How many times operating profit covers interest expense.",
        formula="ebit / interest_expense",
        use_case="Solvency and default-risk screening; sub-2x is typically a red flag.",
        unit="x",
    ),
    "ebitda_interest_coverage": Metric(
        fn=lambda s, p: _safe_div(
            _safe_add(s.value("ebit", p), s.value("depreciation_amortization", p)),
            s.value("interest_expense", p),
        ),
        description="Interest coverage on a cash-earnings (EBITDA) basis.",
        formula="(ebit + depreciation_amortization) / interest_expense",
        use_case="Coverage view preferred for capital-intensive, high-D&A businesses.",
        unit="x",
    ),
    "cash_flow_to_debt": Metric(
        fn=lambda s, p: _safe_div(s.value("operating_cash_flow", p), s.value("total_debt", p)),
        description="Operating cash flow relative to total debt — cash-based deleveraging capacity.",
        formula="operating_cash_flow / total_debt",
        use_case="How fast the business could repay debt from actual cash generation.",
        unit="x",
    ),
 
    # ------------------------------------------------------------ PROFITABILITY
    "gross_margin": Metric(
        fn=lambda s, p: _safe_div(s.value("gross_profit", p), s.value("revenue", p)),
        description="Profit after direct cost of goods, as a share of revenue.",
        formula="gross_profit / revenue",
        use_case="Pricing power and unit economics; trend signals competitive position.",
        unit="%",
    ),
    "operating_margin": Metric(
        fn=lambda s, p: _safe_div(s.value("ebit", p), s.value("revenue", p)),
        description="Operating profit (EBIT) as a share of revenue.",
        formula="ebit / revenue",
        use_case="Core operating efficiency before financing and tax effects.",
        unit="%",
    ),
    "ebitda_margin": Metric(
        fn=lambda s, p: _safe_div(
            _safe_add(s.value("ebit", p), s.value("depreciation_amortization", p)),
            s.value("revenue", p),
        ),
        description="Cash operating profitability as a share of revenue.",
        formula="(ebit + depreciation_amortization) / revenue",
        use_case="Comparing operating profitability across firms with different capital intensity.",
        unit="%",
    ),
    "pretax_margin": Metric(
        fn=lambda s, p: _safe_div(s.value("pretax_income", p), s.value("revenue", p)),
        description="Profit before tax as a share of revenue.",
        formula="pretax_income / revenue",
        use_case="Profitability isolating the effect of the tax regime.",
        unit="%",
    ),
    "net_margin": Metric(
        fn=lambda s, p: _safe_div(s.value("net_income", p), s.value("revenue", p)),
        description="Bottom-line profit as a share of revenue.",
        formula="net_income / revenue",
        use_case="Overall profitability after all costs, interest, and tax.",
        unit="%",
    ),
    "roa": Metric(
        fn=lambda s, p: _safe_div(s.value("net_income", p), s.value("total_assets", p)),
        description="Return on assets — profit generated per dollar of assets.",
        formula="net_income / total_assets",
        use_case="Asset efficiency; useful across asset-heavy vs asset-light peers.",
        unit="%",
    ),
    "roe": Metric(
        fn=lambda s, p: _safe_div(s.value("net_income", p), s.value("total_equity", p)),
        description="Return on equity — profit generated per dollar of shareholder capital.",
        formula="net_income / total_equity",
        use_case="Headline return-to-owners metric; decompose via DuPont for drivers.",
        unit="%",
    ),
    "roic": Metric(
        fn=_roic,
        description="After-tax operating return on all invested capital (debt + equity).",
        formula="ebit * (1 - income_tax_expense/pretax_income) / (total_debt + total_equity)",
        use_case="Value-creation test: compare ROIC vs cost of capital.",
        unit="%",
    ),
    "roce": Metric(
        fn=lambda s, p: _safe_div(
            s.value("ebit", p),
            _safe_sub(s.value("total_assets", p), s.value("current_liabilities", p)),
        ),
        description="Return on capital employed — EBIT over long-term capital base.",
        formula="ebit / (total_assets - current_liabilities)",
        use_case="Cross-firm operating-return comparison independent of capital structure.",
        unit="%",
    ),
    "effective_tax_rate": Metric(
        fn=lambda s, p: _safe_div(s.value("income_tax_expense", p), s.value("pretax_income", p)),
        description="Income tax as a share of pretax profit.",
        formula="income_tax_expense / pretax_income",
        use_case="Spotting tax tailwinds/headwinds and normalizing earnings quality.",
        unit="%",
    ),
 
    # --------------------------------------------------------------- CASH FLOW
    "free_cash_flow": Metric(
        fn=lambda s, p: _safe_sub(s.value("operating_cash_flow", p), s.value("capex", p)),
        description="Cash left after sustaining and growing the asset base (currency).",
        formula="operating_cash_flow - capex",
        use_case="The cash actually available to repay debt, buy back stock, or pay dividends.",
        unit="$",
    ),
    "fcf_margin": Metric(
        fn=lambda s, p: _safe_div(
            _safe_sub(s.value("operating_cash_flow", p), s.value("capex", p)),
            s.value("revenue", p),
        ),
        description="Free cash flow as a share of revenue.",
        formula="(operating_cash_flow - capex) / revenue",
        use_case="Cash profitability — often more telling than accounting net margin.",
        unit="%",
    ),
    "fcf_conversion": Metric(
        fn=lambda s, p: _safe_div(
            _safe_sub(s.value("operating_cash_flow", p), s.value("capex", p)),
            s.value("net_income", p),
        ),
        description="How much reported profit converts into free cash flow.",
        formula="(operating_cash_flow - capex) / net_income",
        use_case="Earnings-quality check; persistent sub-1.0 hints at aggressive accruals.",
        unit="%",
    ),
    "ocf_margin": Metric(
        fn=lambda s, p: _safe_div(s.value("operating_cash_flow", p), s.value("revenue", p)),
        description="Operating cash flow as a share of revenue.",
        formula="operating_cash_flow / revenue",
        use_case="Cash generation before capex decisions.",
        unit="%",
    ),
    "capex_to_revenue": Metric(
        fn=lambda s, p: _safe_div(s.value("capex", p), s.value("revenue", p)),
        description="Capital spending intensity relative to sales.",
        formula="capex / revenue",
        use_case="Judging reinvestment needs and how capital-hungry the model is.",
        unit="%",
    ),
    "capex_to_ocf": Metric(
        fn=lambda s, p: _safe_div(s.value("capex", p), s.value("operating_cash_flow", p)),
        description="Share of operating cash flow consumed by capital spending.",
        formula="capex / operating_cash_flow",
        use_case="How much internally generated cash is eaten by maintenance/growth capex.",
        unit="%",
    ),
    "ocf_to_current_liabilities": Metric(
        fn=lambda s, p: _safe_div(s.value("operating_cash_flow", p), s.value("current_liabilities", p)),
        description="Operating cash flow against near-term obligations.",
        formula="operating_cash_flow / current_liabilities",
        use_case="Cash-based liquidity coverage, complementing the current ratio.",
        unit="x",
    ),
    "dividend_payout_ratio": Metric(
        fn=lambda s, p: _safe_div(s.value("dividends_paid", p), s.value("net_income", p)),
        description="Share of earnings paid out as dividends.",
        formula="dividends_paid / net_income",
        use_case="Dividend sustainability and reinvestment vs distribution policy.",
        unit="%",
    ),
    "dividend_coverage": Metric(
        fn=lambda s, p: _safe_div(
            _safe_sub(s.value("operating_cash_flow", p), s.value("capex", p)),
            s.value("dividends_paid", p),
        ),
        description="How many times free cash flow covers the dividend.",
        formula="(operating_cash_flow - capex) / dividends_paid",
        use_case="Whether the dividend is comfortably funded by cash, not borrowing.",
        unit="x",
    ),
 
    # ------------------------------------------------------- EFFICIENCY / ACTIVITY
    "asset_turnover": Metric(
        fn=lambda s, p: _safe_div(s.value("revenue", p), s.value("total_assets", p)),
        description="Revenue generated per dollar of assets.",
        formula="revenue / total_assets",
        use_case="Asset productivity; the turnover leg of DuPont ROE.",
        unit="x",
    ),
    "fixed_asset_turnover": Metric(
        fn=lambda s, p: _safe_div(s.value("revenue", p), s.value("net_ppe", p)),
        description="Revenue generated per dollar of property, plant & equipment.",
        formula="revenue / net_ppe",
        use_case="Capacity utilization for manufacturing/infrastructure-heavy firms.",
        unit="x",
    ),
    "inventory_turnover": Metric(
        fn=lambda s, p: _safe_div(s.value("cogs", p), s.value("inventory", p)),
        description="How many times inventory is sold and replaced in the period.",
        formula="cogs / inventory",
        use_case="Inventory efficiency; low turns tie up cash and risk obsolescence.",
        unit="x",
    ),
    "receivables_turnover": Metric(
        fn=lambda s, p: _safe_div(s.value("revenue", p), s.value("accounts_receivable", p)),
        description="How many times receivables are collected in the period.",
        formula="revenue / accounts_receivable",
        use_case="Collection efficiency and credit-policy tightness.",
        unit="x",
    ),
    "payables_turnover": Metric(
        fn=lambda s, p: _safe_div(s.value("cogs", p), s.value("accounts_payable", p)),
        description="How quickly the firm pays its suppliers.",
        formula="cogs / accounts_payable",
        use_case="Supplier-financing behaviour; low turns can mean stretching payables for cash.",
        unit="x",
    ),
    "days_inventory_outstanding": Metric(
        fn=lambda s, p: _safe_mul(_safe_div(s.value("inventory", p), s.value("cogs", p)), 365),
        description="Average days inventory sits before being sold.",
        formula="365 * inventory / cogs",
        use_case="Working-capital cycle analysis (the 'DIO' leg).",
        unit="days",
    ),
    "days_sales_outstanding": Metric(
        fn=lambda s, p: _safe_mul(_safe_div(s.value("accounts_receivable", p), s.value("revenue", p)), 365),
        description="Average days to collect cash after a sale.",
        formula="365 * accounts_receivable / revenue",
        use_case="Collection speed and receivables risk (the 'DSO' leg).",
        unit="days",
    ),
    "days_payables_outstanding": Metric(
        fn=lambda s, p: _safe_mul(_safe_div(s.value("accounts_payable", p), s.value("cogs", p)), 365),
        description="Average days the firm takes to pay suppliers.",
        formula="365 * accounts_payable / cogs",
        use_case="Supplier terms and cash-conservation via payables (the 'DPO' leg).",
        unit="days",
    ),
    "cash_conversion_cycle": Metric(
        fn=_cash_conversion_cycle,
        description="Days from paying for inventory to collecting cash from its sale (DIO + DSO - DPO).",
        formula="365*inventory/cogs + 365*receivables/revenue - 365*payables/cogs",
        use_case="Net working-capital efficiency; negative CCC means suppliers fund the business.",
        unit="days",
    ),
    "working_capital_turnover": Metric(
        fn=lambda s, p: _safe_div(
            s.value("revenue", p),
            _safe_sub(s.value("current_assets", p), s.value("current_liabilities", p)),
        ),
        description="Revenue generated per dollar of working capital.",
        formula="revenue / (current_assets - current_liabilities)",
        use_case="How hard working capital is being worked to produce sales.",
        unit="x",
    ),

    # ------------------------------------------------------------------- GROWTH
    "revenue_growth": Metric(
        fn=lambda s, p: _growth(s.value("revenue", p), s.value("revenue", p + 1)),
        description="Year-over-year revenue growth vs the prior period.",
        formula="revenue[t] / revenue[t-1] - 1",
        use_case="Top-line momentum, the first read on demand trajectory.",
        unit="%",
    ),
    "revenue_cagr_3y": Metric(
        fn=lambda s, p: _cagr(s.value("revenue", p), s.value("revenue", p + 3), 3),
        description="3-year compound annual revenue growth ending at the period.",
        formula="(revenue[t] / revenue[t-3]) ** (1/3) - 1",
        use_case="Smoothing out single-year noise to see the growth trend.",
        unit="%",
    ),
    "revenue_cagr_5y": Metric(
        fn=lambda s, p: _cagr(s.value("revenue", p), s.value("revenue", p + 5), 5),
        description="5-year compound annual revenue growth ending at the period.",
        formula="(revenue[t] / revenue[t-5]) ** (1/5) - 1",
        use_case="Long-run growth durability across a full cycle.",
        unit="%",
    ),
    "net_income_growth": Metric(
        fn=lambda s, p: _growth(s.value("net_income", p), s.value("net_income", p + 1)),
        description="Year-over-year growth in bottom-line profit.",
        formula="net_income[t] / net_income[t-1] - 1",
        use_case="Earnings momentum; compare against revenue growth for margin direction.",
        unit="%",
    ),
    "eps_growth": Metric(
        fn=lambda s, p: _growth(s.value("eps_diluted", p), s.value("eps_diluted", p + 1)),
        description="Year-over-year growth in diluted earnings per share.",
        formula="eps_diluted[t] / eps_diluted[t-1] - 1",
        use_case="Per-share earnings momentum, net of share-count changes.",
        unit="%",
    ),
    "ebit_growth": Metric(
        fn=lambda s, p: _growth(s.value("ebit", p), s.value("ebit", p + 1)),
        description="Year-over-year growth in operating profit.",
        formula="ebit[t] / ebit[t-1] - 1",
        use_case="Operating momentum, insulated from financing and tax swings.",
        unit="%",
    ),
    "ebitda_growth": Metric(
        fn=_ebitda_growth,
        description="Year-over-year growth in cash operating profit.",
        formula="ebitda[t] / ebitda[t-1] - 1",
        use_case="Cash-earnings momentum for capital-intensive names.",
        unit="%",
    ),
    "fcf_growth": Metric(
        fn=_fcf_growth,
        description="Year-over-year growth in free cash flow.",
        formula="fcf[t] / fcf[t-1] - 1",
        use_case="Trajectory of the cash that ultimately drives value.",
        unit="%",
    ),
    "total_assets_growth": Metric(
        fn=lambda s, p: _growth(s.value("total_assets", p), s.value("total_assets", p + 1)),
        description="Year-over-year growth in the asset base.",
        formula="total_assets[t] / total_assets[t-1] - 1",
        use_case="Balance-sheet expansion; pair with ROA to see if growth is productive.",
        unit="%",
    ),
    "equity_growth": Metric(
        fn=lambda s, p: _growth(s.value("total_equity", p), s.value("total_equity", p + 1)),
        description="Year-over-year growth in shareholders' equity (book value).",
        formula="total_equity[t] / total_equity[t-1] - 1",
        use_case="Book-value compounding, a proxy for retained value creation.",
        unit="%",
    ),
 
    # ---------------------------------------------------------------- PER-SHARE
    "earnings_per_share": Metric(
        fn=lambda s, p: _safe_div(s.value("net_income", p), s.value("shares_diluted", p)),
        description="Net income attributable to each diluted share.",
        formula="net_income / shares_diluted",
        use_case="Reconstructed EPS when you want it consistent with your own net-income definition.",
        unit="$/share",
    ),
    "book_value_per_share": Metric(
        fn=lambda s, p: _safe_div(s.value("total_equity", p), s.value("shares_diluted", p)),
        description="Shareholders' equity per diluted share.",
        formula="total_equity / shares_diluted",
        use_case="Per-share net asset value; the 'B' in price-to-book.",
        unit="$/share",
    ),
    "revenue_per_share": Metric(
        fn=lambda s, p: _safe_div(s.value("revenue", p), s.value("shares_diluted", p)),
        description="Revenue attributable to each diluted share.",
        formula="revenue / shares_diluted",
        use_case="Top line on a per-share basis, useful for pre-profit companies.",
        unit="$/share",
    ),
    "fcf_per_share": Metric(
        fn=lambda s, p: _safe_div(
            _safe_sub(s.value("operating_cash_flow", p), s.value("capex", p)),
            s.value("shares_diluted", p),
        ),
        description="Free cash flow attributable to each diluted share.",
        formula="(operating_cash_flow - capex) / shares_diluted",
        use_case="Per-share cash generation; pairs with price for an FCF yield.",
        unit="$/share",
    ),
    "cash_per_share": Metric(
        fn=lambda s, p: _safe_div(s.value("cash_and_equivalents", p), s.value("shares_diluted", p)),
        description="Cash and equivalents per diluted share.",
        formula="cash_and_equivalents / shares_diluted",
        use_case="Balance-sheet cushion per share; relevant for downside/liquidation views.",
        unit="$/share",
    ),
}

# =============================================================================
# Tools exposed to the financial analyst worker
# =============================================================================

@tool
def get_metrics(ticker: str, metrics: list[str], periods: int = 3) -> str:
    """Compute financial metrics for a stock from its normalized SEC filings.

    Args:
        ticker: Stock ticker symbol, e.g. "AAPL". Case-insensitive.
        metrics: Which metrics to compute, e.g. "current_ratio". Call `list_metrics`
            first if you're unsure which names are supported. Unknown names are
            reported back rather than computed.
        periods: How many recent reporting periods to compute, most recent first.
            Defaults to 3. Capped at the number of periods the filing provides."""
    with session_scope() as session:
        #Get Stock
        stock = get_or_create_stock(session, ticker.upper())
        if not stock:
            return f"No stock found for ticker {ticker!r}."

        #Initialise fin. statements
        statement = Statement(stock, session)
        if statement.n_periods == 0:
            return f"No financial data available for {ticker}."

        known = [m for m in metrics if m in METRICS] # will be calculated
        unknown = [m for m in metrics if m not in METRICS] # will be returned as unknown

        periods = min(periods, statement.n_periods) #Periods cant exceed the exising periods that were fetched

        rows: list[tuple[str, list[float | None]]] = []
        for metric in known:
            values = [METRICS[metric].fn(statement, p) for p in range(periods)]
            rows.append((metric, values))

        output = []
        #Format Response
        if rows:
            header = "| Metric | " + " | ".join(str(y) for y in statement.periods[:periods]) + " |"
            sep = "|" + "---|" * (periods + 1)
            output += [header, sep]
            for metric, values in rows:
                unit = METRICS[metric].unit
                output.append(f"| {metric} | " + " | ".join(_fmt_metric(v, unit) for v in values) + " |")
        else:
            output.append("No valid metrics were requested.")

        if unknown:
            output.append("")
            output.append("Unknown metric(s):")
            for m in unknown:
                output.append(f"- {m!r}")

        return "\n".join(output)


def _fmt_metric(value: float | None, unit: str) -> str:
    """Format a computed metric value per its unit, 'N/A' for missing/uncomputable.

    `fn`s return raw ratios (e.g. 4.79 for +479% growth, not 4.79%) — this is
    the one place that turns that into what the unit says it should look
    like, so nothing downstream has to guess whether to multiply by 100.
    """
    if value is None:
        return "N/A"
    if unit == "%":
        return f"{value * 100:.2f}%"
    if unit == "x":
        return f"{value:.2f}x"
    if unit == "days":
        return f"{value:.1f} days"
    if unit == "$/share":
        return f"-${-value:,.2f}" if value < 0 else f"${value:,.2f}"
    if unit == "$":
        return f"-${-value:,.0f}" if value < 0 else f"${value:,.0f}"
    return f"{value:.2f}"


@tool
def list_metrics() -> str:
    """List the financial metrics available to `get_metrics`, with what each measures,
    when an analyst would use it, and how it's calculated.

    Call this before `get_metrics` if you're unsure which metric names are supported.
    """
    output = ["| Metric | Description | Use case | Formula | Unit |", "|---|---|---|---|---|"]
    for name, metric in METRICS.items():
        output.append(f"| {name} | {metric.description} | {metric.use_case} | {metric.formula} | {metric.unit} |")

    return "\n".join(output)
