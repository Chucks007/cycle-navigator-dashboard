from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from . import config
from .routers import stocks, macro, sentiment, comparison, risk, crypto

logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(stocks.router)
app.include_router(macro.router)
app.include_router(sentiment.router)
app.include_router(comparison.router)
app.include_router(risk.router)
app.include_router(crypto.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
