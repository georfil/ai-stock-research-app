from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from yfinance.exceptions import YFRateLimitError
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

@app.exception_handler(YFRateLimitError)
async def yfinance_rate_limited(request: Request, exc: YFRateLimitError):
    """Answer Yahoo's throttling with 503 rather than an unhandled 500.

    Yahoo rate limits by IP, so on a single shared instance one burst locks
    out every user at once — a routine condition, not a server fault, and
    worth saying so. As an unhandled exception it also escaped the CORS
    middleware's response path, so the browser reported a CORS failure and
    hid the real cause. Retry-After gives the frontend something concrete to
    wait on.
    """
    return JSONResponse(
        status_code=503,
        content={"detail": "Market data is rate limited right now. Try again in a minute."},
        headers={"Retry-After": "60"},
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


