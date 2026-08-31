from sqlmodel import Session

from app.services.edgar_client import get_company
from app.services.stock_data import get_logo_url
from app.models import Stock
from app.schemas import CompanyInfo

def get_company_info(stock: Stock):
    """Returns general information about a stock"""
    company = get_company(stock.ticker)
    return CompanyInfo(
        ticker    = stock.ticker,
        name      = stock.name,
        industry  = company.industry,
        exchanges = company.get_exchanges(),
        img       = get_logo_url(stock.ticker),
    )
