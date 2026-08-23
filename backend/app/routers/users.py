from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.models import User, Stock, Watchlist
from app.core.deps import SessionDep, CurrentUser, StockDep

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me")
def me(user: CurrentUser, session: SessionDep):
    """Return the currently authenticated user."""
    return user


@router.post("/me/watchlist/{ticker}", status_code=status.HTTP_201_CREATED)
def add_to_watchlist(stock: StockDep, session: SessionDep, user: CurrentUser):
    """Add a stock to the current user's watchlist."""
    # If item already exists in watchlist, raise, else add the item
    if session.get(Watchlist, (user.id, stock.id)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock already in watchlist")

    session.add(Watchlist(
        user_id=user.id,
        stock_id=stock.id
    ))
    session.commit()


@router.delete("/me/watchlist/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_watchlist(stock: StockDep, session: SessionDep, user: CurrentUser):
    """Remove a stock from the current user's watchlist."""
    row = session.get(Watchlist, (user.id, stock.id))
    # If item doesn't exist in watchlist, throw error
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock doesn't exist in watchlist")

    session.delete(row)
    session.commit()


@router.get("/me/watchlist")
def get_watchlist(user: CurrentUser, session: SessionDep):
    """Return the current user's watchlisted stocks."""
    return user.watchlisted_stocks
