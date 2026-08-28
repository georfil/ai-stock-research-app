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

class CompanyInfo(SQLModel):
    ticker: str
    name: str
    industry: str | None
    exchanges: list[str | None]



#Chatbot
class ChatSessionOut(SQLModel):
    id: str
    stock_id: str
    created_at: datetime

class MessageIn(SQLModel):
    content: str

class MessageOut(SQLModel):
    content: str
    role: ChatRole