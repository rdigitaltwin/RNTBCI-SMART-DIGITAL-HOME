import os
import uvicorn
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    # Get PORT from environment, default to 8000
    try:
        port = int(os.getenv("PORT", 8000))
    except ValueError:
        logger.warning(f"Invalid PORT environment variable '{os.getenv('PORT')}'. Defaulting to 8000.")
        port = 8000

    # Ensure the HOST is correctly bound for PaaS providers
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting Uvicorn server on {host}:{port}")

    # Run the application
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*"
    )
