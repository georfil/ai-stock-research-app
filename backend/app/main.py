from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import stocks, users, auth, chatbot
from app.core.logging_config import configure_logging
from app.core.config import get_config
from edgar import set_identity

configure_logging(get_config().log_level)
set_identity("georfilippou@gmail.com")

app = FastAPI(
    title="Stock Research App"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(chatbot.router)


