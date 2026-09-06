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

app.include_router(stocks.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(chatbot.router)


