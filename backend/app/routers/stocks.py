from fastapi import APIRouter, HTTPException

from app.services.stock_data import get_price_history, search_stocks
from app.services.financial_data import get_financial_statement
from app.services.company_data import get_company_info

from app.schemas import PriceBar, PriceRange
from app.core.deps import SessionDep, StockDep
from app.models import FinancialStatement
from app.services.filings_data import get_business_summary

router = APIRouter(prefix="/stocks", tags=["Stocks"])

@router.get("")
def get_stocks(query: str):
    """Returns a list of n stocks based on user's query"""
    results = search_stocks(query)
    return {
        "results":results
    }


@router.get("/{ticker}/prices")
def get_prices(ticker: str, range: PriceRange = PriceRange.ONE_YEAR) -> list[PriceBar]:
    """Returns historical price bars for a ticker over the given range"""
    return get_price_history(ticker, range)


@router.get("/{ticker}/overview")
def get_stock_overview(stock: StockDep, session: SessionDep):
    """Returns company overview information for a stock"""
    return get_company_info(stock)

@router.get("/{ticker}/statements/{financial_statement}")
def get_stock_financials(stock: StockDep, financial_statement: FinancialStatement, session: SessionDep):
    """Returns the requested financial statement for a stock"""
    return get_financial_statement(stock, financial_statement, session)

@router.get("/{ticker}/summary")
def get_stock_summary(stock: StockDep, session: SessionDep):
    """Returns an AI-generated summary of a stock's business description"""
    summary = get_business_summary(stock, session)
    if not summary:
        raise HTTPException(status_code=404, detail="No business section available to summarize")

    return {"summary": summary}

