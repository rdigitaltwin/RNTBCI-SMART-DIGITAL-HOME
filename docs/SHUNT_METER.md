# Modbus Shunt Meter integration

Additive metering for the Digital Twin. Existing device Matter routes, tables,
and seeds are unchanged. The simulator reads device on/off state and writes only
the new metering tables.

## Architecture

| Category | Meter type | Devices | Storage |
|---|---|---|---|
| 1 | Internal (`device_epm`) | Switch, Heat Pump (HVAC), Water Heater, Light | `{ deviceId, meterType: "Internal", epm: { voltage, current, power } }` |
| 2 | Shunt (`shunt_meters`) | Dishwasher, Washing Machine, Solar Panel, Nebulizer, EVSE | `{ deviceId, meterType: "Shunt", meterId, measurements }` |
| 3 | None | Door Lock, Garage Door, Camera, EV | Unchanged. `GET /devices/{id}/metering` returns 404 |

`GRID001` is a shunt meter with `role=grid` and no `device_id`. Its power is the
sum of Category 1 EPM power plus Category 2 device-shunt power. Solar generation
is excluded from that sum (it is not a load).

Units: volts, amperes, watts.

## Control logic (on → values, off → blocked)

Load values are tied to the device power switch with no exception for Category 1 and 2:

| Device power | Voltage | Current | Power | POST non-zero current/power |
|---|---|---|---|---|
| **ON** | readable | readable (live) | readable, must equal `voltage × current` | accepted |
| **OFF** | readable on the shunt bus | **409** not accessible | **409** not accessible | **409** rejected |
| GRID001 | always readable | always readable | always readable | accepted |

Full GET payloads while OFF still return JSON, but `available: false` and `current`/`power` are forced to **0**. Single-field `GET .../current` and `GET .../power` return HTTP 409 with:

```json
{ "detail": "Device is off. Turn the device on before reading or writing current/power. ..." }
```

Turn the device on with the existing API:

`PATCH /api/v1/devices/{id}/state` `{ "status": "ON" }`

## Endpoints

All under `/api/v1`. Same auth as other device routes (`Authorization: Bearer`).

### Shunt

| Method | Path | Notes |
|---|---|---|
| GET | `/shunt` | All meters |
| GET | `/shunt/{meterId}` | Full reading |
| GET | `/shunt/{meterId}/voltage` | `{ meterId, voltage }` |
| GET | `/shunt/{meterId}/current` | `{ meterId, current }` |
| GET | `/shunt/{meterId}/power` | `{ meterId, power }` |
| POST | `/shunt/{meterId}/measurements` | Body `{ voltage, current, power? }` |

Sample GET `/shunt/SHUNT001`:

```json
{
  "meterId": "SHUNT001",
  "meterType": "Shunt",
  "deviceId": "f75d41ea-91a3-460c-8020-9a5e15bd5354",
  "role": "device",
  "measurements": { "voltage": 230.1, "current": 7.82, "power": 1799.4 },
  "updatedAt": "2026-10-29T11:00:00+00:00"
}
```

If `power` is omitted on POST, it is `voltage * current`. A real POST is held
for 30 seconds so the simulator will not overwrite ESP32 data.

### Internal meter (Category 1)

| Method | Path |
|---|---|
| GET | `/devices/{id}/epm` |
| GET | `/devices/{id}/epm/voltage` |
| GET | `/devices/{id}/epm/current` |
| GET | `/devices/{id}/epm/power` |
| POST | `/devices/{id}/epm` |

`{id}` is the device UUID or the name used elsewhere (`Water_Heater`).

Sample GET `/devices/{water_heater}/epm`:

```json
{
  "deviceId": "5dd8cce9-6033-46ff-8be1-25c1b5078dc7",
  "meterType": "Internal",
  "epm": { "voltage": 230.0, "current": 8.7, "power": 2001.0 },
  "updatedAt": "2026-10-29T11:00:00+00:00"
}
```

### Convenience

`GET /devices/{id}/metering` returns the Category 1 or 2 payload. Category 2
devices also have `GET /devices/{id}/shunt` (the diagram path: device → its
shunt meter). Category 3 and unmapped devices return 404 and must use the
existing control API.

`GET /api/v1/metering/catalog` lists every device, its category, whether load
values are available right now, and the exact URLs to call.

Validation errors use HTTP 400 `{ "detail": "..." }` like the rest of the API.
Unknown meter/device/field: 404.

## Database schema

New tables only:

**device_metering_categories**
- `device_id` PK, FK `devices.id`
- `category` integer 1/2/3
- `meter_type` `Internal` / `Shunt` / `None`

**shunt_meters**
- `meter_id` PK (`SHUNT001` … `GRID001`)
- `device_id` nullable FK
- `role` `device` | `grid`
- `voltage`, `current`, `power` (default 0)
- `updated_at`, `last_posted_at` (nullable)

**device_epm**
- `device_id` PK, FK
- `voltage`, `current`, `power`
- `updated_at`, `last_posted_at`

Migration: `alembic/versions/f8d4a6b91c10_add_shunt_meter_tables.py`  
Revises `e5b7c91d4a02`. Downgrade drops the three tables.

## Seed

Idempotent. Does not duplicate meters or overwrite readings.

```bash
python -m backend.utils.seed_shunt_meters
```

The Alembic upgrade also runs this seed (`INSERT … WHERE NOT EXISTS`).

Assigned meters:

| meter_id | device |
|---|---|
| SHUNT001 | Dishwasher |
| SHUNT002 | Washing Machine |
| SHUNT003 | Solar Panel Array |
| SHUNT004 | Nebulizer |
| SHUNT005 | EV Charger |
| GRID001 | grid (no device) |

EPM rows are created for every Category 1 device that already exists (Water
Heater, Switch, HVAC/heat pump, Lights).

## Simulator

Env:

- `METERING_SIMULATOR=off` disables it
- `METERING_INTERVAL_MS=5000` (default)

Every tick: voltage `230 ± 2` V; current = rated/230 with ±5% noise when the
device `power_state` is `on`, else 0; power = voltage × current.

Rated watts: dishwasher 1800, washing machine 500, water heater 2000, light 15,
switch 1.5, HVAC 2500, nebulizer 40, EVSE 7400, solar 4690.

Ticks that fail are logged and do not stop the API process.

## ESP32 POST

```http
POST /api/v1/shunt/SHUNT001/measurements
Authorization: Bearer <token>
Content-Type: application/json

{ "voltage": 230.2, "current": 7.8 }
```

Power is computed when omitted. Repeat within 30 seconds as needed; the
simulator will skip that meter until the hold expires.

## Tests and demo

```bash
python -m pytest tests/test_shunt_meter.py tests/test_reference_urls.py tests/test_device_attribute_routes.py -q
python scripts/demo_shunt.py   # requires ACCESS_TOKEN, optional BASE_URL
```

Postman: `postman/Shunt_Meter_Integration.postman_collection.json` (new file;
existing collection folders were not modified).

## Assumptions

1. HVAC devices (Bedroom AC, Living Room AC) are Category 1 heat-pump substitutes.
   There is no separate `HEAT_PUMP` row in the current database.
2. Garage Door is stored as `DOOR_LOCK`, so it is Category 3.
3. Refrigerator, smart plug, and other unmapped types have no metering (404).
4. Measurement units are V, A, W (not the millivolt/milliamp Matter attributes).
5. `GRID001` sums loads only; solar shunt power is not added to the grid total.
6. Device lookup accepts UUID or the existing underscore-name form (`Water_Heater`).
7. If Dishwasher or Water Heater were missing, the Python seed would create them
   by copying an existing room. Both already exist, so no extra device is created.
8. Known historical Postman 404/405 on washer `status` / `labellist` / washer
   mode are out of scope for this work and were not “fixed” here.

## Rollback

1. Stop the new simulator: `METERING_SIMULATOR=off` or revert `backend/main.py`.
2. Unmount routes: remove the two `include_router` lines in `backend/api/router.py`.
3. Downgrade:

```bash
alembic downgrade e5b7c91d4a02
```

That drops `device_epm`, `shunt_meters`, and `device_metering_categories` only.
Existing `devices` rows and Matter routes are untouched.
