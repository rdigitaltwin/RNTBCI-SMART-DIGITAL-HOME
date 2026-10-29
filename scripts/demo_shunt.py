#!/usr/bin/env python3
"""3-device shunt meter demo: Dishwasher, Washing Machine, Water Heater.

Turns a device on with the EXISTING PATCH /devices/{id}/state API, then reads
the new shunt/EPM and grid endpoints. Never prints tokens.

  BASE_URL=https://rntbci-project-production.up.railway.app/api/v1 \\
  ACCESS_TOKEN=... python scripts/demo_shunt.py
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
TOKEN = os.environ.get("ACCESS_TOKEN", "")

DISHWASHER = os.environ.get("DISHWASHER_ID", "f75d41ea-91a3-460c-8020-9a5e15bd5354")
WASHER = os.environ.get("WASHER_ID", "bf431833-e422-49ea-8235-da09454d02b4")
HEATER = os.environ.get("HEATER_ID", "5dd8cce9-6033-46ff-8be1-25c1b5078dc7")


def _request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{BASE}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise SystemExit(f"{method} {path} -> {exc.code} {detail}") from exc


def _show(label: str, payload: dict) -> None:
    print(f"\n== {label} ==")
    print(json.dumps(payload, indent=2))


def main() -> None:
    if not TOKEN:
        print("Set ACCESS_TOKEN (from POST /api/v1/auth/login). BASE_URL is optional.", file=sys.stderr)
    print(f"Base URL: {BASE}")

    _show("SHUNT001 (Dishwasher) before", _request("GET", "/shunt/SHUNT001"))
    _show("SHUNT002 (Washing Machine) before", _request("GET", "/shunt/SHUNT002"))
    _show("Water Heater EPM before", _request("GET", f"/devices/{HEATER}/epm"))
    _show("GRID001 before", _request("GET", "/shunt/GRID001"))

    print("\nTurning Washing Machine ON via existing /devices/{id}/state ...")
    _request("PATCH", f"/devices/{WASHER}/state", {"status": "ON"})
    print("Waiting 6s for the metering simulator tick...")
    time.sleep(6)

    after_on = {
        "washer": _request("GET", "/shunt/SHUNT002"),
        "grid": _request("GET", "/shunt/GRID001"),
    }
    _show("SHUNT002 after ON", after_on["washer"])
    _show("GRID001 after ON", after_on["grid"])
    washer_power = after_on["washer"]["measurements"]["power"]
    grid_power = after_on["grid"]["measurements"]["power"]
    print(f"\nWasher power={washer_power} W, grid power={grid_power} W (grid should be >= washer)")

    print("\nTurning Washing Machine OFF ...")
    _request("PATCH", f"/devices/{WASHER}/state", {"status": "OFF"})
    print("Waiting 6s ...")
    time.sleep(6)
    after_off = _request("GET", "/shunt/SHUNT002")
    _show("SHUNT002 after OFF", after_off)
    print(f"Washer power now {after_off['measurements']['power']} W (should fall toward 0)")

    _show("Dishwasher SHUNT001 (unchanged device)", _request("GET", f"/devices/{DISHWASHER}/metering"))
    _show("Water Heater EPM", _request("GET", f"/devices/{HEATER}/epm"))


if __name__ == "__main__":
    main()
