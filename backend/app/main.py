from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import stocks, users, auth, chatbot
from app.core.logging_config import configure_logging
from app.core.config import get_config
from edgar import set_identity

config = get_config()
configure_logging(config.log_level)
set_identity("georfilippou@gmail.com")

app = FastAPI(
    title="yuRi Research App"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
def health():
    """Liveness probe.

    Deliberately holds no database session and calls nothing external — every
    other route in this app reaches yfinance or EDGAR, which would add seconds
    of their own and blur the one signal this exists to give. A spun-down
    Render instance doesn't answer a request with "starting"; its router holds
    the connection open until the container is up. So the frontend can only
    tell a cold start from a warm one by how long this takes to reply, and
    that measurement is only meaningful if the handler itself is free.
    """
    return {"status": "ok"}


app.include_router(stocks.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(chatbot.router)


