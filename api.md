# RNTBCI Full Device API Catalog

> **Base URL:** `https://rntbci-project-production.up.railway.app`  
> **API prefix:** `https://rntbci-project-production.up.railway.app/api/v1`  
> **Status:** Production-verified after metering seed (GRID001 + SHUNT001–005 + Category 1 EPM).  
> **Rule:** Only routes that return success with the documented method/body are listed.  
> Category 3 has **no** `/epm` or `/shunt` routes (by design).

---

## Shared control (every device)

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/api/v1/devices` | — | List all devices |
| `GET` | `/api/v1/devices/{id}` | — | Device record |
| `GET` | `/api/v1/devices/{id}/state` | — | Latest state |
| `GET` | `/api/v1/devices/{id}/endpoint/1` | — | Full Matter map |
| `PATCH` | `/api/v1/devices/{id}/power` | see below | Power on/off/standby |
| `PATCH` | `/api/v1/devices/{id}/control` | see below | Named control command |
| `GET` | `/api/v1/metering/catalog` | — | Category + access map |
| `POST` | `/api/v1/metering/seed` | `{}` | Idempotent re-seed (deploy required for this route) |

### PATCH `/power` body

```json
{ "power_state": "on" }
```

Allowed: `"on"` | `"off"` | `"standby"`.

### PATCH `/control` body

```json
{ "command": "turn_on", "parameters": {} }
```

Common commands: `turn_on`, `turn_off`, `on`, `off`, `enable`, `disable`, `start`, `stop`.

---

## Category 1 — Internal EPM (Smart devices)

**Architecture JSON**

```json
{
  "deviceId": "<uuid>",
  "meterType": "Internal",
  "epm": { "voltage": 230, "current": 5, "power": 1150 }
}
```

### Metering (always use these for power JSON)

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/v1/devices/{id}/epm` | — |
| `GET` | `/api/v1/devices/{id}/epm/voltage` | — |
| `GET` | `/api/v1/devices/{id}/epm/current` | — |
| `GET` | `/api/v1/devices/{id}/epm/power` | — |
| `GET` | `/api/v1/devices/{id}/metering` | — | resolves to EPM |
| `POST` | `/api/v1/devices/{id}/epm` | `{ "voltage": 230, "current": 0.05, "power": 11.5 }` | `power` optional (= V×A) |

> Prefer full object reads (`GET /epm`, `GET /shunt/{id}`) — always `200`; load is `0` while the device is off.
> Field `/current` and `/power` routes need the device **on** until the next backend deploy (soft zero-read). `/voltage` is always readable.

### Bathroom Light (`smart_light`)

- **UUID:** `4f21774d-cac5-43b8-b5b5-502bc4ad6dd3`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1/cluster/0x0008/CurrentLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1/cluster/0x0008/MaxLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1/cluster/0x0008/MinLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/endpoint/1/cluster/0x0406/Occupancy`

### Bedroom AC (`hvac`)

- **UUID:** `83cd6514-1ece-4f0c-b6a5-5044967e45e2`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0041/Label`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0090/Power`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0091/Energy`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0201/CurrentTemperature`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0201/Mode`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0201/RunningState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0201/TargetTemperature`

### Bedroom Light (`smart_light`)

- **UUID:** `3584a47b-370f-48bd-b59e-445dddb479e1`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1/cluster/0x0008/CurrentLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1/cluster/0x0008/MaxLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1/cluster/0x0008/MinLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/3584a47b-370f-48bd-b59e-445dddb479e1/endpoint/1/cluster/0x0406/Occupancy`

### Hallway Light (`smart_light`)

- **UUID:** `cc393520-bff6-4783-b1c8-0fdee742ed8b`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1/cluster/0x0008/CurrentLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1/cluster/0x0008/MaxLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1/cluster/0x0008/MinLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/endpoint/1/cluster/0x0406/Occupancy`

### Kitchen Light (`smart_light`)

- **UUID:** `e4cf6b01-3642-4962-ad15-ebe908c7b2f8`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1/cluster/0x0008/CurrentLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1/cluster/0x0008/MaxLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1/cluster/0x0008/MinLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/endpoint/1/cluster/0x0406/Occupancy`

### Living Room AC (`hvac`)

- **UUID:** `47cc8ab0-ab1e-43c0-9571-d3bc2478e88c`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0041/Label`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0090/Power`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0091/Energy`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0201/CurrentTemperature`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0201/Mode`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0201/RunningState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/endpoint/1/cluster/0x0201/TargetTemperature`

### Living Room Main Light (`smart_light`)

- **UUID:** `36f2c08c-5789-4c05-8a43-18f0365973f7`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1/cluster/0x0008/CurrentLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1/cluster/0x0008/MaxLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1/cluster/0x0008/MinLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/endpoint/1/cluster/0x0406/Occupancy`

### Living Room Switch (`smart_switch`)

- **UUID:** `c39bf632-f112-4b64-a294-1f93cbf65584`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1/cluster/0x0006/PowerState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1/cluster/0x0090/Voltage`

### Utility Light (`smart_light`)

- **UUID:** `636cbfb9-f65a-44a1-addf-e37722083ec7`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1/cluster/0x0008/CurrentLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1/cluster/0x0008/MaxLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1/cluster/0x0008/MinLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/endpoint/1/cluster/0x0406/Occupancy`

### Water Heater (`water_heater`)

- **UUID:** `5dd8cce9-6033-46ff-8be1-25c1b5078dc7`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/power`
  ```json
  { "power_state": "on" }
  ```
- **EPM:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/epm`
- **EPM fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/epm/voltage` · `.../current` · `.../power`
- **Write EPM:** `POST https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/epm`
  ```json
  { "voltage": 230, "current": 0.05, "power": 11.5 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0090/Power`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0091/Energy`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0094/BoostState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0094/HeatDemand`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0094/HeaterTypes`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0201/CurrentTemperature`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0201/TargetTemperature`

---

## Category 2 — Modbus Shunt (Legacy devices)

**Architecture JSON**

```json
{
  "deviceId": "<uuid>",
  "meterType": "Shunt",
  "meterId": "SHUNT001",
  "measurements": { "voltage": 230, "current": 5, "power": 1150 }
}
```

### House feed + shunt meters

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/v1/shunt` | — |
| `GET` | `/api/v1/shunt/GRID001` | — |
| `GET` | `/api/v1/shunt/GRID001/voltage` | — |
| `GET` | `/api/v1/shunt/GRID001/current` | — |
| `GET` | `/api/v1/shunt/GRID001/power` | — |
| `POST` | `/api/v1/shunt/GRID001/measurements` | `{ "voltage": 230, "current": 10, "power": 2300 }` |
| `GET` | `/api/v1/shunt/SHUNT001` | — |
| `GET` | `/api/v1/shunt/SHUNT001/voltage` | — |
| `GET` | `/api/v1/shunt/SHUNT001/current` | — |
| `GET` | `/api/v1/shunt/SHUNT001/power` | — |
| `POST` | `/api/v1/shunt/SHUNT001/measurements` | `{ "voltage": 230, "current": 5, "power": 1150 }` |
| `GET` | `/api/v1/shunt/SHUNT002` | — |
| `GET` | `/api/v1/shunt/SHUNT002/voltage` | — |
| `GET` | `/api/v1/shunt/SHUNT002/current` | — |
| `GET` | `/api/v1/shunt/SHUNT002/power` | — |
| `POST` | `/api/v1/shunt/SHUNT002/measurements` | `{ "voltage": 230, "current": 5, "power": 1150 }` |
| `GET` | `/api/v1/shunt/SHUNT003` | — |
| `GET` | `/api/v1/shunt/SHUNT003/voltage` | — |
| `GET` | `/api/v1/shunt/SHUNT003/current` | — |
| `GET` | `/api/v1/shunt/SHUNT003/power` | — |
| `POST` | `/api/v1/shunt/SHUNT003/measurements` | `{ "voltage": 230, "current": 5, "power": 1150 }` |
| `GET` | `/api/v1/shunt/SHUNT004` | — |
| `GET` | `/api/v1/shunt/SHUNT004/voltage` | — |
| `GET` | `/api/v1/shunt/SHUNT004/current` | — |
| `GET` | `/api/v1/shunt/SHUNT004/power` | — |
| `POST` | `/api/v1/shunt/SHUNT004/measurements` | `{ "voltage": 230, "current": 5, "power": 1150 }` |
| `GET` | `/api/v1/shunt/SHUNT005` | — |
| `GET` | `/api/v1/shunt/SHUNT005/voltage` | — |
| `GET` | `/api/v1/shunt/SHUNT005/current` | — |
| `GET` | `/api/v1/shunt/SHUNT005/power` | — |
| `POST` | `/api/v1/shunt/SHUNT005/measurements` | `{ "voltage": 230, "current": 5, "power": 1150 }` |

### Dishwasher (`dishwasher` / `SHUNT001`)

- **UUID:** `f75d41ea-91a3-460c-8020-9a5e15bd5354`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/power`
  ```json
  { "power_state": "on" }
  ```
- **Shunt:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT001`
- **Shunt fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT001/voltage` · `.../current` · `.../power`
- **Via device:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/shunt`
- **Resolver:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/metering`
- **Write shunt:** `POST https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT001/measurements`
  ```json
  { "voltage": 230, "current": 5, "power": 1150 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0006/PowerState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0056/SelectedTemperatureLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0056/TemperatureSetpoint`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0059/CurrentMode`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x005D/AlarmStatus`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0060/CurrentState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0090/Voltage`

### EV Charger (`energy_evse` / `SHUNT005`)

- **UUID:** `b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/power`
  ```json
  { "power_state": "on" }
  ```
- **Shunt:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT005`
- **Shunt fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT005/voltage` · `.../current` · `.../power`
- **Via device:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/shunt`
- **Resolver:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/metering`
- **Write shunt:** `POST https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT005/measurements`
  ```json
  { "voltage": 230, "current": 5, "power": 1150 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0090/Frequency`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0090/PowerFactor`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0090/PowerMode`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0091/CumulativeEnergyExported`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0091/CumulativeEnergyImported`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0091/PeriodicEnergyExported`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0091/PeriodicEnergyImported`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/ChargingEnabledUntil`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/FaultState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/MaximumChargeCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/MinimumChargeCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/NextChargeRequiredEnergy`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/NextChargeStartTime`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/NextChargeTargetSoC`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/NextChargeTargetTime`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/SessionDuration`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/SessionEnergyCharged`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/State`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/StateOfCharge`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/SupplyState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x0099/UserMaximumChargeCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x009D/CurrentMode`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x009D/SupportedModes`
- **EVSE POST commands:**
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/enable`
    ```json
    { "commandId": "0x01", "command": "EnableCharging" }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/disable`
    ```json
    { "commandId": "0x02", "command": "Disable" }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/settarget`
    ```json
    {
      "commandId": "0x05",
      "command": "SetTargets",
      "chargingTargetSchedules": [
        {
          "dayOfWeekForSequence": 127,
          "chargingTargets": [
            { "targetTimeMinutesPastMidnight": 420, "targetSoC": 80, "addedEnergy": 0 }
          ]
        }
      ]
    }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/cleartargets`
    ```json
    { "commandId": "0x07", "command": "ClearTargets" }
    ```
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/stateofcharge`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/gettargets`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/currentsessionenergy`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/activepower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/activecurrent`
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/setactivepower`
    ```json
    { "ActivePower": 7400000 }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/setvoltage`
    ```json
    { "Voltage": 400000 }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/setactivecurrent`
    ```json
    { "ActiveCurrent": 16000 }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/Identify/triggereffect`
    ```json
    { "name": "TriggerEffect" }
    ```

### Nebulizer (`nebulizer` / `SHUNT004`)

- **UUID:** `ed3367d0-60b2-480f-acbd-cf4a2000a865`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ed3367d0-60b2-480f-acbd-cf4a2000a865/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/ed3367d0-60b2-480f-acbd-cf4a2000a865/power`
  ```json
  { "power_state": "on" }
  ```
- **Shunt:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT004`
- **Shunt fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT004/voltage` · `.../current` · `.../power`
- **Via device:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ed3367d0-60b2-480f-acbd-cf4a2000a865/shunt`
- **Resolver:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ed3367d0-60b2-480f-acbd-cf4a2000a865/metering`
- **Write shunt:** `POST https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT004/measurements`
  ```json
  { "voltage": 230, "current": 5, "power": 1150 }
  ```
- **Nebulizer POST commands:**
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/ed3367d0-60b2-480f-acbd-cf4a2000a865/endpoint/1/cluster/NebulizerControl/command` (StartSession)
    ```json
    { "command": "StartSession" }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/ed3367d0-60b2-480f-acbd-cf4a2000a865/endpoint/1/cluster/NebulizerControl/command` (PauseSession)
    ```json
    { "command": "PauseSession" }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/ed3367d0-60b2-480f-acbd-cf4a2000a865/endpoint/1/cluster/NebulizerControl/command` (StopSession)
    ```json
    { "command": "StopSession" }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/ed3367d0-60b2-480f-acbd-cf4a2000a865/endpoint/1/cluster/NebulizerControl/command` (SetMistLevel)
    ```json
    { "command": "SetMistLevel", "level": "High" }
    ```

### Solar Panel Array (`solar_pv` / `SHUNT003`)

- **UUID:** `1ec2d468-1d91-4a34-9d55-5049b6e41ea0`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/power`
  ```json
  { "power_state": "on" }
  ```
- **Shunt:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT003`
- **Shunt fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT003/voltage` · `.../current` · `.../power`
- **Via device:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/shunt`
- **Resolver:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/metering`
- **Write shunt:** `POST https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT003/measurements`
  ```json
  { "voltage": 230, "current": 5, "power": 1150 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0041/LabelList`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0090/CumulativeEnergyExported`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0b04/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0b04/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0b04/Frequency`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0b04/PowerFactor`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0b04/Voltage`
- **Solar routes:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/ElectricalPowerMeasurement/activepower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/ElectricalPowerMeasurement/voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/ElectricalPowerMeasurement/activecurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/ElectricalPowerMeasurement/frequency`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/ElectricalPowerMeasurement/powerfactor`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/ElectricalEnergyMeasurement/cumulativeenergyexported`

### Washing Machine (`washing_machine` / `SHUNT002`)

- **UUID:** `bf431833-e422-49ea-8235-da09454d02b4`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/power`
  ```json
  { "power_state": "on" }
  ```
- **Shunt:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT002`
- **Shunt fields:** `GET https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT002/voltage` · `.../current` · `.../power`
- **Via device:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/shunt`
- **Resolver:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/metering`
- **Write shunt:** `POST https://rntbci-project-production.up.railway.app/api/v1/shunt/SHUNT002/measurements`
  ```json
  { "voltage": 230, "current": 5, "power": 1150 }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0006/PowerState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0051/CurrentMode`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0051/SupportedModes`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0053/NumberOfRinses`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0053/SpinSpeedCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0053/SpinSpeeds`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0053/SupportedRinses`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0056/SelectedTemperatureLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0056/TemperatureSetpoint`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0060/CurrentState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0090/Voltage`

---

## Category 3 — Battery / control-only

No `/epm`, `/shunt`, or `/metering` routes. Use Matter control only.

### Door Lock (`door_lock`)

- **UUID:** `30eb3d26-9c82-46b3-8170-187d74985c09`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1`
- **State:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/state`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/power`
  ```json
  { "power_state": "on" }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/0x0101/ActuatorEnabled`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/0x0101/LockState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/0x0101/LockType`
- **Lock / Unlock POST:**
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/DoorLock/command`
    ```json
    { "command": "LockDoor" }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/DoorLock/command`
    ```json
    { "command": "UnlockDoor" }
    ```

### EV Vehicle (`ev_vehicle`)

- **UUID:** `fb338bef-0060-4626-93a6-ef7df4ac3bcb`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1`
- **State:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/state`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/power`
  ```json
  { "power_state": "on" }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/0x0099/AuxBatVoltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/0x0099/AvgSpeed`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/0x0099/HVBATVoltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/0x0099/HVSoC`
- **EV Vehicle routes:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/hvsoc`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/hvbatvoltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/auxbatvoltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/avgspeed`
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/enable`
    ```json
    {}
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/disable`
    ```json
    {}
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/hvsoc`
    ```json
    { "value": 80 }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/hvbatvoltage`
    ```json
    { "value": 400 }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/auxbatvoltage`
    ```json
    { "value": 12 }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/avgspeed`
    ```json
    { "value": 40 }
    ```

### Front Door Lock (`door_lock`)

- **UUID:** `5514a0c1-cad7-408a-9928-1852e4c6eb35`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1`
- **State:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/state`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/power`
  ```json
  { "power_state": "on" }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x0101/ActuatorEnabled`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x0101/LockState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x0101/LockType`
- **Lock / Unlock POST:**
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/DoorLock/command`
    ```json
    { "command": "LockDoor" }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/DoorLock/command`
    ```json
    { "command": "UnlockDoor" }
    ```

### Garage Door (`door_lock`)

- **UUID:** `e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1`
- **State:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/state`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/power`
  ```json
  { "power_state": "on" }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1/cluster/0x0101/ActuatorEnabled`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1/cluster/0x0101/LockState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1/cluster/0x0101/LockType`
- **Lock / Unlock POST:**
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1/cluster/DoorLock/command`
    ```json
    { "command": "LockDoor" }
    ```
  - `POST https://rntbci-project-production.up.railway.app/api/v1/devices/e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd/endpoint/1/cluster/DoorLock/command`
    ```json
    { "command": "UnlockDoor" }
    ```

### Security Camera (`camera`)

- **UUID:** `ef1dcda2-0119-4db9-85fd-e24ac85e1096`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1`
- **State:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/state`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/power`
  ```json
  { "power_state": "on" }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0090/Voltage`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/CurrentFrameRate`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/MaxNetworkBandwidth`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/MicrophoneMuted`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/RecordingPrivacyMode`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/SpeakerVolume`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0801/MaxClientCertificates`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0801/MaxRootCertificates`

---

## Uncategorized inventory devices (Matter control only)

### Refrigerator (`refrigerator`)

- **UUID:** `ae1107cc-cceb-49aa-bf30-45a31c503bf1`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ae1107cc-cceb-49aa-bf30-45a31c503bf1/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/ae1107cc-cceb-49aa-bf30-45a31c503bf1/power`
  ```json
  { "power_state": "on" }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ae1107cc-cceb-49aa-bf30-45a31c503bf1/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ae1107cc-cceb-49aa-bf30-45a31c503bf1/endpoint/1/cluster/0x0056/SelectedTemperatureLevel`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ae1107cc-cceb-49aa-bf30-45a31c503bf1/endpoint/1/cluster/0x0056/TemperatureSetpoint`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ae1107cc-cceb-49aa-bf30-45a31c503bf1/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ae1107cc-cceb-49aa-bf30-45a31c503bf1/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/ae1107cc-cceb-49aa-bf30-45a31c503bf1/endpoint/1/cluster/0x0090/Voltage`

### Smart Plug - Dryer (`smart_plug`)

- **UUID:** `39429d3d-7f5a-405c-9e63-1812836e8c9b`
- **Endpoint map:** `GET https://rntbci-project-production.up.railway.app/api/v1/devices/39429d3d-7f5a-405c-9e63-1812836e8c9b/endpoint/1`
- **Power:** `PATCH https://rntbci-project-production.up.railway.app/api/v1/devices/39429d3d-7f5a-405c-9e63-1812836e8c9b/power`
  ```json
  { "power_state": "on" }
  ```
- **Matter attribute GETs:**
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/39429d3d-7f5a-405c-9e63-1812836e8c9b/endpoint/1/cluster/0x0006/OnOff`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/39429d3d-7f5a-405c-9e63-1812836e8c9b/endpoint/1/cluster/0x0006/PowerState`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/39429d3d-7f5a-405c-9e63-1812836e8c9b/endpoint/1/cluster/0x0090/ActiveCurrent`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/39429d3d-7f5a-405c-9e63-1812836e8c9b/endpoint/1/cluster/0x0090/ActivePower`
  - `GET https://rntbci-project-production.up.railway.app/api/v1/devices/39429d3d-7f5a-405c-9e63-1812836e8c9b/endpoint/1/cluster/0x0090/Voltage`

---

## Quick index — production UUIDs

| Cat | Device | UUID | Power source |
|---|---|---|---|
| 1 | Bathroom Light | `4f21774d-cac5-43b8-b5b5-502bc4ad6dd3` | `/devices/4f21774d-cac5-43b8-b5b5-502bc4ad6dd3/epm` |
| 1 | Bedroom AC | `83cd6514-1ece-4f0c-b6a5-5044967e45e2` | `/devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/epm` |
| 1 | Bedroom Light | `3584a47b-370f-48bd-b59e-445dddb479e1` | `/devices/3584a47b-370f-48bd-b59e-445dddb479e1/epm` |
| 2 | Dishwasher | `f75d41ea-91a3-460c-8020-9a5e15bd5354` | `/shunt/SHUNT001` |
| 3 | Door Lock | `30eb3d26-9c82-46b3-8170-187d74985c09` | Matter /endpoint/1 only |
| 2 | EV Charger | `b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e` | `/shunt/SHUNT005` |
| 3 | EV Vehicle | `fb338bef-0060-4626-93a6-ef7df4ac3bcb` | Matter /endpoint/1 only |
| 3 | Front Door Lock | `5514a0c1-cad7-408a-9928-1852e4c6eb35` | Matter /endpoint/1 only |
| 3 | Garage Door | `e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd` | Matter /endpoint/1 only |
| 1 | Hallway Light | `cc393520-bff6-4783-b1c8-0fdee742ed8b` | `/devices/cc393520-bff6-4783-b1c8-0fdee742ed8b/epm` |
| 1 | Kitchen Light | `e4cf6b01-3642-4962-ad15-ebe908c7b2f8` | `/devices/e4cf6b01-3642-4962-ad15-ebe908c7b2f8/epm` |
| 1 | Living Room AC | `47cc8ab0-ab1e-43c0-9571-d3bc2478e88c` | `/devices/47cc8ab0-ab1e-43c0-9571-d3bc2478e88c/epm` |
| 1 | Living Room Main Light | `36f2c08c-5789-4c05-8a43-18f0365973f7` | `/devices/36f2c08c-5789-4c05-8a43-18f0365973f7/epm` |
| 1 | Living Room Switch | `c39bf632-f112-4b64-a294-1f93cbf65584` | `/devices/c39bf632-f112-4b64-a294-1f93cbf65584/epm` |
| 2 | Nebulizer | `ed3367d0-60b2-480f-acbd-cf4a2000a865` | `/shunt/SHUNT004` |
| — | Refrigerator | `ae1107cc-cceb-49aa-bf30-45a31c503bf1` | Matter /endpoint/1 only |
| 3 | Security Camera | `ef1dcda2-0119-4db9-85fd-e24ac85e1096` | Matter /endpoint/1 only |
| — | Smart Plug - Dryer | `39429d3d-7f5a-405c-9e63-1812836e8c9b` | Matter /endpoint/1 only |
| 2 | Solar Panel Array | `1ec2d468-1d91-4a34-9d55-5049b6e41ea0` | `/shunt/SHUNT003` |
| 1 | Utility Light | `636cbfb9-f65a-44a1-addf-e37722083ec7` | `/devices/636cbfb9-f65a-44a1-addf-e37722083ec7/epm` |
| 2 | Washing Machine | `bf431833-e422-49ea-8235-da09454d02b4` | `/shunt/SHUNT002` |
| 1 | Water Heater | `5dd8cce9-6033-46ff-8be1-25c1b5078dc7` | `/devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/epm` |
| grid | House feed | `GRID001` | `/shunt/GRID001` |

---

## Notes

1. Do **not** `GET` `/devices/{id}/power` — that route is **`PATCH` only** (GET returns 405).
2. Do **not** `GET` `.../DoorLock/command` — commands are **`POST`** with a JSON body.
3. Stale UUID `9d79ff82-7ef0-4a45-89d5-fb5dc789b056` is invalid; use live UUIDs above.
4. Matter electrical units: Voltage mV, ActiveCurrent mA, ActivePower mW (÷1000 → V/A/W).
5. Architecture EPM/shunt units are already V / A / W.

