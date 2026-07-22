"""RNTBCI Smart Home Digital Twin - Security Middleware.

Implements rate limiting, security headers, and CORS configuration.
"""

import logging
import time

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


def setup_middleware(app: FastAPI) -> None:
    """Configure all middleware for the application."""

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS - explicit origins only (no wildcards)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_allowed_origins_list(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        max_age=600,
    )

    # Security headers middleware
    @app.middleware("http")
    async def request_logging_and_headers(request: Request, call_next) -> Response:
        start_time = time.time()
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} - {process_time:.4f}s")
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"{request.method} {request.url.path} - 500 - {process_time:.4f}s - Error: {e}")
            raise

        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' ws: wss:; "
            "object-src 'none'; "
            "frame-ancestors 'none';"
        )

        # Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Clickjacking protection
        response.headers["X-Frame-Options"] = "DENY"

        # Disable unused browser features
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Cache control for API responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        return response

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next) -> Response:
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        logger.info(
            "request_completed method=%s path=%s status=%d duration=%.3fs",
            request.method,
            request.url.path,
            response.status_code,
            duration,
        )

        return response
