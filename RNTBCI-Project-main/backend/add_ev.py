import asyncio
from backend.main import _ensure_ev_charger_exists

if __name__ == "__main__":
    asyncio.run(_ensure_ev_charger_exists())
