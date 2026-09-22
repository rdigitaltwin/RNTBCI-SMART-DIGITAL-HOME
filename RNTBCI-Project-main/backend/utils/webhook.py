import logging
import httpx
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

async def dispatch_webhook(url: str, payload: dict) -> None:
    """Dispatches a webhook payload to the given URL asynchronously."""
    if not url:
        return
        
    try:
        payload["timestamp"] = datetime.now(timezone.utc).isoformat()
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            logger.info(f"Webhook successfully dispatched to {url}")
    except Exception as e:
        logger.error(f"Failed to dispatch webhook to {url}: {e}")
