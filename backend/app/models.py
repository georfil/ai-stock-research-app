from enum import StrEnum

from sqlmodel import SQLModel, Field, Relationship
from uuid import uuid4
from datetime import datetime, date, timedelta
from datetime import timezone
from sqlalchemy import Column, DateTime, Text



class Watchlist(SQLModel, table=True):
    user_id: str = Field(foreign_key="user.id", primary_key=True)
    stock_id: str = Field(foreign_key="stock.id", primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))

class Stock(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    ticker: str
    name: str
    financials: list["Financials"] = Relationship(back_populates="stock")
    sections: list["FilingSection"] = Relationship(back_populates="stock")
    business_summary: "BusinessSummary" = Relationship(back_populates="stock")
    chat_sessions: list["ChatSession"] = Relationship(back_populates="stock")

class UserBase(SQLModel):
    username: str = Field(min_length=3, max_length=32)

class User(UserBase, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    hashed_password: str
    daily_message_counter: int = Field(default=0)
    limit_resets_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=1), sa_column=Column(DateTime(timezone=True)))
    is_admin: bool = False
    
    watchlisted_stocks: list[Stock] = Relationship(link_model=Watchlist)


class StockReport(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    content: str #Markdown 


class FinancialStatement(StrEnum):
    BALANCE_SHEET = "balance_sheet"
    INCOME_STATEMENT = "income_statement"
    CASH_FLOW = "cash_flows"
    
class Financials(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    stock_id: str = Field(foreign_key="stock.id")
    financial_statement: FinancialStatement
    accession_number: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))

    stock: "Stock" = Relationship(back_populates="financials")
    lines: list["FinancialLine"] = Relationship(back_populates="financials", cascade_delete=True)

class FinancialLine(SQLModel, table=True):
    financial_id: str | None = Field(default=None, foreign_key="financials.id", primary_key=True)
    label: str  = Field(primary_key=True)
    period: int = Field(primary_key=True)
    standard_label: str | None
    unit: str | None
    value: float | None

    financials: "Financials" = Relationship(back_populates="lines")

class FilingSectionTypes(StrEnum):
    BUSINESS = "business"
    MDA = "mda" #Management Discussion
    RISKS = "risks"

class FilingSection(SQLModel, table=True):
    stock_id: str = Field(primary_key=True, foreign_key="stock.id")
    accession_number: str
    section: FilingSectionTypes = Field(primary_key=True)
    content: str = Field(sa_column=Column(Text, nullable=False))

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))

    stock: "Stock" = Relationship(back_populates="sections")

class BusinessSummary(SQLModel, table=True):
    stock_id: str = Field(primary_key=True, foreign_key="stock.id")
    accession_number: str
    content: str  

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))

    stock: "Stock" = Relationship(back_populates="business_summary")


class ChatSession(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.id")
    stock_id: str = Field(foreign_key="stock.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))

    # Set once, on the first turn, from an AI-generated summary of the
    # question — not just the raw question text.
    title: str | None = Field(default=None)
    # Updated on every turn, so listing sessions is a plain indexed query
    # instead of walking each session's messages to derive these.
    last_message_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
    message_count: int = Field(default=0)

    messages: list["ChatMessage"] = Relationship(
        back_populates="session",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "ChatMessage.created_at"},
    )
    stock: Stock = Relationship(back_populates="chat_sessions")
    
class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class ChatMessage(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    chat_session_id: str = Field(foreign_key="chatsession.id")
    role: ChatRole          
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))

    session: "ChatSession" = Relationship(back_populates="messages")