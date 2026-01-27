import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .health import health_service
from .routers import comparison, config as config_router, crypto, macro, risk, sentiment, stocks

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Cycle Navigator Dashboard API",
    description="Financial data API for macro analysis and ticker research",
    version="0.1.0",
)

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
app.include_router(config_router.router)


@app.on_event("startup")
async def startup_event():
    """
    Validate critical services and configuration on startup.
    
    Performs fail-fast validation to catch configuration issues early.
    Logs warnings for non-critical issues, errors for critical failures.
    """
    health_service.log_startup_checks()


@app.get("/health")
def health_check():
    """Basic health check endpoint."""
    return {"status": "ok"}


@app.get("/health/detailed")
def detailed_health_check():
    """
    Detailed health check with database, Redis, and table validation.
    
    Returns status of all critical services.
    """
    return health_service.run_all_checks()
