from __future__ import annotations

from typing import Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from intelligence.api.health.endpoints import router as health_router
from intelligence.api.routes.config import router as config_router
from intelligence.api.routes.observability import router as observability_router
from intelligence.api.routes.evaluation import router as evaluation_router
from intelligence.api.routes.artifacts import router as artifacts_router
from intelligence.api.middleware.auth import AuthMiddleware
from intelligence.api.middleware.logging import LoggingMiddleware
from intelligence.api.middleware.rate_limit import RateLimitMiddleware
from intelligence.config.settings import Settings, get_settings

_app_instance: Optional[FastAPI] = None


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    global _app_instance
    if _app_instance is not None:
        return _app_instance

    if settings is None:
        settings = get_settings()

    app = FastAPI(
        title="Kairos Intelligence API",
        version="1.0.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
    )

    app.add_middleware(LoggingMiddleware)
    app.add_middleware(
        RateLimitMiddleware,
        rate_per_minute=settings.api_rate_limit,
        burst=settings.api_rate_limit_burst,
    )
    if settings.api_secret:
        app.add_middleware(AuthMiddleware)

    allowed_origins = settings.api_cors_origins or ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router, prefix="/health", tags=["Health"])
    app.include_router(config_router, prefix="/api/v1/config", tags=["Configuration"])
    app.include_router(
        observability_router, prefix="/api/v1/observability", tags=["Observability"]
    )
    app.include_router(
        evaluation_router, prefix="/api/v1/evaluation", tags=["Evaluation"]
    )
    app.include_router(artifacts_router, prefix="/api/v1/artifacts", tags=["Artifacts"])

    _app_instance = app
    return app


def get_app() -> FastAPI:
    if _app_instance is None:
        return create_app()
    return _app_instance


def run_api(settings: Optional[Settings] = None) -> None:
    if settings is None:
        settings = get_settings()
    app = create_app(settings)
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        workers=settings.api_workers,
        log_level=settings.log_level.lower(),
    )
