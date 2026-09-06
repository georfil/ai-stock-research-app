from app.models import UserBase, ChatRole

from sqlmodel import SQLModel, Field
from enum import StrEnum
from datetime import date, datetime


# User

class UserCreate(UserBase):
    raw_password: str = Field(min_length=8)

class UserLogin(SQLModel):
    username: str
    password: str

class UserOut(SQLModel):
    username: str



# Stock

class StockSearchResult(SQLModel):
    ticker: str
    name: str | None = None
    img: str | None = None


class PriceRange(StrEnum):
    ONE_MONTH = "1m"
    SIX_MONTHS = "6m"
    ONE_YEAR = "1y"
    FIVE_YEARS = "5y"
    MAX = "max"

class PriceBar(SQLModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int

class NewsArticle(SQLModel):
    title: str
    link: str | None
    img: str | None
    summary: str | None
    date: datetime

class CompanyInfo(SQLModel):
    ticker: str
    name: str
    industry: str | None
    exchanges: list[str | None]
    img: str | None = None
    suggested_questions: list[str]
    day_low: float
    day_high: float
    year_low: float
    year_high: float
    market_cap: float
    shares: int
    price: float
    change: float
    change_percent: float
    analyst_target_low: float | None
    analyst_target_high: float | None
    analyst_target_mean: float | None



#Chatbot
class ChatSessionOut(SQLModel):
    id: str
    stock_id: str
    created_at: datetime
    title: str | None
    last_message_at: datetime
    message_count: int

class MessageIn(SQLModel):
    content: str

class MessageOut(SQLModel):
    content: str
    role: ChatRole

class FinancialLineOut(SQLModel):
    period: int
    label: str
    value: float | None
    unit: str | None
    highlight: bool #highlights key items