import logging
from edgar import Company, CompanyNotFoundError
from edgar.entity import EntityFiling

logger = logging.getLogger(__name__)

def get_company(ticker: str) -> Company | None:
    try:
        return Company(ticker)
    except CompanyNotFoundError:
        logger.warning("Ticker not found in EDGAR: %s", ticker)
        return None

def get_latest_annual_filing(company: Company) -> EntityFiling | None:
    annual_types = ["10-K", "20-F"]
    latest_annual = company.get_filings(form=annual_types, amendments=False).latest()
    return latest_annual

