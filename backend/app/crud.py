
from sqlmodel import Session, select

from app.models import BusinessSummary, FilingSection, Financials, Stock, ChatSession, User
from app.services.company_data import get_stock_name


def get_or_create_stock(session: Session, ticker: str) -> Stock | None:
    """Returns a stock based on ticker (if stock doesnt exist in db it creates it first)"""
    stock = session.exec(select(Stock).where(Stock.ticker == ticker)).first()
    if stock:
        return stock

    name = get_stock_name(ticker)
    if not name:
        return None

    stock = Stock(ticker=ticker, name=name)
    session.add(stock)
    session.commit()
    session.refresh(stock)
    return stock


def upsert_financial_statement(session: Session, financial_statement: Financials):

    #get existing statement
    existing = session.exec(
            select(Financials).where(
                Financials.stock_id == financial_statement.stock_id,
                Financials.financial_statement == financial_statement.financial_statement,
            )
        ).first()

    #delete existing statement, if exists
    if existing:
        session.delete(existing)
        session.flush()

    session.add(financial_statement)
    session.commit()
    session.refresh(financial_statement)

def upsert_business_summary(session: Session, business_summary: BusinessSummary):

    #get existing summary
    existing = session.exec(
            select(BusinessSummary).where(
                BusinessSummary.stock_id == business_summary.stock_id,
            )
        ).first()

    #delete existing summary, if exists
    if existing:
        session.delete(existing)
        session.flush()

    session.add(business_summary)
    session.commit()
    session.refresh(business_summary)

def upsert_filing_sections(session: Session, sections: list[FilingSection], stock_id: str):

    #get sections of a stock
    existing = session.exec(
            select(FilingSection).where(
                FilingSection.stock_id == stock_id,
            )
        ).first()

    #delete existing sections, if exist
    if existing:
        session.delete(existing)
        session.flush()

    for section in sections:
        session.add(section)

    session.commit()

    for section in sections:
        session.refresh(section)

def get_all_conversations(user_id: str, stock_id: str, session: Session) -> list[ChatSession]:
    return session.exec(
        select(ChatSession)
        .where(ChatSession.user_id == user_id, ChatSession.stock_id == stock_id)
        .order_by(ChatSession.last_message_at.desc())
    ).all()

def delete_chat_session(chat_session: ChatSession, session: Session) -> None:
    session.delete(chat_session)
    session.commit()
