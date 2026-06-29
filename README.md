<p align="center">
  <img src="https://img.shields.io/badge/RNTBCI-NEXUS_CORE-00E5FF?style=for-the-badge&labelColor=050816" />
  <img src="https://img.shields.io/badge/version-1.0.0-6366F1?style=for-the-badge&labelColor=050816" />
  <img src="https://img.shields.io/badge/status-ACTIVE-00FF9D?style=for-the-badge&labelColor=050816" />
</p>

<h1 align="center">RNTBCI Smart Home Digital Twin</h1>

<p align="center">
  <strong>Enterprise-Grade Smart Home Digital Twin Platform</strong><br/>
  Real-time 3D visualization · Intelligent simulation · Energy management · Immersive automation
</p>
---

## Overview

RNTBCI is a **full-stack enterprise digital twin platform** that creates a synchronized, explorable 3D replica of a smart home with real-time device simulation, energy analytics, historical replay, intelligent automation, and immersive visualization.

This is **not** a CRUD dashboard or IoT prototype — it is an industrial-grade simulation platform with:

- **Physically accurate device simulation** with state machines and realistic power curves
- **Explorable 3D digital twin** with procedural device models, glass walls, and dynamic lighting
- **Home Energy Management System (HEMS)** with tariff-aware optimization
- **Time Travel mode** to replay the home's entire history
- **Scenario-based automation** (Morning Routine, Vacation Mode, Emergency Mode, etc.)
- **Location-based automation** with geofencing and ETA prediction
- **Data analysis pipeline** with anomaly detection and reward-based optimization

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 15)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ 3D Twin  │  │Dashboard │  │ Energy   │  │ Time Travel│  │
│  │ (R3F)    │  │ (Recharts│  │ Analytics│  │ (Replay)   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │              │              │               │        │
│       └──────────────┴──────────────┴───────────────┘        │
│                           │                                  │
│              ┌────────────┴────────────┐                     │
│              │  Zustand + WebSocket    │                     │
│              └────────────┬────────────┘                     │
└───────────────────────────┼──────────────────────────────────┘
                            │ REST / WebSocket
┌───────────────────────────┼──────────────────────────────────┐
│                      BACKEND (FastAPI)                       │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ Auth     │  │ Controller   │  │ Simulation Engine   │    │
│  │ (JWT+    │  │ Hub          │  │ (State Machines,    │    │
│  │  RBAC)   │  │ (6 Adapters) │  │  Load Profiles)     │    │
│  └──────────┘  └──────────────┘  └─────────────────────┘    │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ HEMS     │  │ Scenario     │  │ Data Pipeline       │    │
│  │ (Energy  │  │ Manager      │  │ (Analytics +        │    │
│  │  Mgmt)   │  │ (6 Built-in) │  │  Optimization)      │    │
│  └──────────┘  └──────────────┘  └─────────────────────┘    │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ Location │  │ WebSocket    │  │ MQTT Bridge         │    │
│  │ Engine   │  │ Manager      │  │ (Optional)          │    │
│  └──────────┘  └──────────────┘  └─────────────────────┘    │
│                           │                                  │
│              ┌────────────┴────────────┐                     │
│              │  Redis PubSub (Bus)     │                     │
│              └────────────┬────────────┘                     │
│              ┌────────────┴────────────┐                     │
│              │  PostgreSQL (Async)     │                     │
│              └─────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **Next.js 15** (App Router) | Framework with server components |
| **React 19** | UI library |
| **TypeScript** | Type safety |
| **TailwindCSS v4** | Utility-first CSS |
| **Three.js / React Three Fiber** | 3D digital twin rendering |
| **@react-three/drei** | 3D helpers (OrbitControls, Stars, Float, Html) |
| **@react-three/postprocessing** | Bloom, Vignette, Chromatic Aberration |
| **Zustand** | State management (auth, devices, UI, simulation, events) |
| **Recharts** | Data visualization (area, bar, line, pie charts) |
| **Lucide React** | Icon system |
| **Framer Motion** | Animations |
| **GSAP** | Advanced animations |

### Backend

| Technology | Purpose |
|---|---|
| **FastAPI** | Async API framework |
| **SQLAlchemy 2.0** | Async ORM with PostgreSQL |
| **Alembic** | Database migrations |
| **Pydantic v2** | Schema validation |
| **PostgreSQL** | Primary database (12 tables) |
| **Redis** | PubSub message bus + state caching |
| **WebSockets** | Real-time bidirectional communication |
| **MQTT** (optional) | IoT device protocol bridge |
| **Argon2** | Password hashing |
| **JWT** | Authentication with algorithm enforcement |
| **SlowAPI** | Rate limiting |

---

## Enterprise Modules

### 1. Simulation Engine
Physically accurate device simulation with per-device state machines:

| Device | States | Power Range |
|---|---|---|
| Refrigerator | Idle → Compressor ON → Cooling → Compressor OFF | 40W – 180W |
| Washing Machine | Idle → Pre-Wash → Wash → Spin → Drain → Complete | 5W – 800W |
| Dishwasher | Idle → Prewash → Wash → Dry → Complete | 3W – 1800W |
| HVAC | Idle → Cooling/Heating → Fan Only → Defrost | 50W – 3000W |
| All 14 types | Full load profiles with realistic noise | Type-specific |

Controls: `play()` · `pause()` · `reset()` · `seek(time)` · `changeSpeed(1x, 2x, 5x, 10x)`

### 2. Scenario Manager
Six built-in scenarios + custom scenario support:
- 🌅 **Morning Routine** — Lights, AC, water heater, media
- 🌙 **Night Routine** — Locks, cameras, dim lights, sleep AC
- ✈️ **Vacation Mode** — Random light toggling, locked doors, eco AC
- 🚨 **Emergency Mode** — All lights on, doors unlocked, cameras active
- 🔋 **Energy Saver** — Dim lights, fan-only AC, lower temps
- 🎬 **Movie Night** — Purple ambiance, TV on, quiet AC

### 3. HEMS (Home Energy Management System)
- Time-of-use tariff awareness (off-peak $0.08, mid-peak $0.12, on-peak $0.18)
- Device priority load shedding
- Consumption prediction (1h, 2h, 4h, 8h, 24h)
- Peak load management with automatic optimization
- Daily cost tracking and monthly estimation

### 4. Controller Hub Abstraction
Central command routing through 6 adapters:
- **REST** — Primary internal API
- **MQTT** — IoT protocol bridge
- **Alexa** — Amazon Smart Home Skill format
- **Google Home** — Google Actions format
- **HomeAssistant** — HA service call format
- **HEMS** — Energy-aware commands

### 5. 3D Digital Twin
- Procedural models for all 14 device types
- Glass walls with neon edge highlighting
- Device-specific animations (AC air particles, nebulizer mist, router signal waves)
- Iron Man-style HUD overlay on device selection
- Orbit / Zoom / Pan camera controls
- Bloom + Vignette post-processing
- Stars background with particle field

### 6. Time Travel / Historical Replay
- Replay the entire home from any point in history
- Preset ranges: Yesterday, Last 24h, Last Week, Last Month, Custom
- Speed control: 1x, 2x, 5x, 10x
- Synchronized: Dashboard, 3D Twin, Event Logs, Energy Charts

### 7. Location-Based Automation
- Geofencing with Haversine distance calculation
- ETA prediction based on speed and distance
- Tiered triggers: 10min before (AC + water heater), 5min (lights), arrival (garage + unlock + camera)
- Departure rules: lock doors, close garage, eco mode

### 8. Data Analysis Pipeline
```
Monitoring → Data Acquisition → Processing → Analysis →
Optimization → Reward Calculation → Decision → Actions
```
- Trend detection (increasing / decreasing / stable)
- Anomaly detection via z-score (2σ threshold)
- Power/cost/comfort reward signals
- Automated optimization decisions

### 9. Simulation Metrics Dashboard
Animated gauges and real-time counters for:
- Simulation FPS, 3D Render FPS
- Total Power, Peak Power
- API Latency, WebSocket Latency
- Redis Throughput, Events/Second
- Network Quality, Electricity Cost

### 10. Future Device Extensibility
Architecture supports adding (DB + API + 3D abstraction + state model ready):
- EV / EV Charger / Battery Storage / Solar Panel
- Smart Meter / Air Purifier / Water Leakage Sensor
- Smoke Detector / Motion Sensor

---

## Supported Devices (14 Types)

| # | Device | Emoji | Simulation |
|---|---|---|---|
| 1 | Smart Light | 💡 | Brightness, color temp, auto-dim |
| 2 | Smart Switch | 🔌 | On/off toggle |
| 3 | Smart Plug | 🔌 | Connected load monitoring |
| 4 | Door Lock | 🔒 | Lock state, auto-lock, tamper detection |
| 5 | Garage Door | 🚗 | Open/close with motor simulation |
| 6 | HVAC | ❄️ | Temperature convergence, fan speeds, cooling cycles |
| 7 | Washing Machine | 🧺 | 6-state wash cycle with power curves |
| 8 | Dishwasher | 🍽️ | 5-state cycle with heated dry |
| 9 | Refrigerator | 🧊 | Compressor cycles, temperature regulation |
| 10 | Water Heater | 🔥 | Heating/maintaining with temperature target |
| 11 | Nebulizer | 💨 | Mist intensity levels |
| 12 | Router | 📡 | Upload/download, clients, packet loss, signal |
| 13 | Camera | 📷 | Recording, motion detection, night vision |
| 14 | Smart TV | 📺 | Volume, input source, screen glow |

---

## Database Schema (12 Tables)

```
roles ──┐
         ├── users ──── notifications
permissions ┘     │
                  ├── devices ──── device_events
rooms ────────────┘     │
                        ├── energy_history
                        ├── alerts
                        └── device_states
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login (JWT) |
| POST | `/api/v1/auth/refresh` | Refresh tokens |
| GET | `/api/v1/auth/me` | Current user profile |

### Devices
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/devices` | List devices (filterable) |
| GET | `/api/v1/devices/:id` | Get device detail |
| POST | `/api/v1/devices` | Create device |
| PATCH | `/api/v1/devices/:id` | Update device |
| PATCH | `/api/v1/devices/:id/power` | Toggle power |
| PATCH | `/api/v1/devices/:id/control` | Send command |
| GET | `/api/v1/devices/:id/energy` | Energy history |

### Dashboard & Energy
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/dashboard/realtime` | Real-time aggregation |
| GET | `/api/v1/energy/summary` | Energy analytics (day/week/month) |

### Enterprise Modules
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/simulation/status` | Simulation engine status |
| POST | `/api/v1/simulation/control` | Play/Pause/Reset/Speed |
| POST | `/api/v1/simulation/replay` | Start historical replay |
| GET | `/api/v1/scenarios` | List all scenarios |
| POST | `/api/v1/scenarios/activate` | Activate scenario |
| GET | `/api/v1/hems/status` | HEMS status |
| GET | `/api/v1/hems/analyze` | Run energy analysis |
| POST | `/api/v1/hems/optimize` | Run optimization |
| GET | `/api/v1/hub/adapters` | List Controller Hub adapters |
| POST | `/api/v1/hub/command` | Send command via adapter |
| GET | `/api/v1/timetravel/presets` | Time travel presets |
| POST | `/api/v1/timetravel/start` | Start time travel |
| GET | `/api/v1/pipeline/run` | Run data pipeline cycle |

### WebSocket
```
ws://localhost:8000/api/v1/ws?token=<JWT>

Channels:
  device:updates    — Real-time device telemetry
  events:stream     — Live event feed
  system:alerts     — Alert notifications
  system:metrics    — Simulation metrics
  system:hems       — HEMS analysis updates
  system:replay     — Time travel position
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **PostgreSQL** ≥ 15
- **Redis** ≥ 7

### 1. Clone & Environment

```bash
git clone https://github.com/your-org/RNTBCI_FINAL.git
cd RNTBCI_FINAL
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

### 2. Backend Setup

From the root directory (`RNTBCI_FINAL`), create and activate a virtual environment for the backend:

```bash
python -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# Database setup (PostgreSQL must be running)
# Tables are auto-created on startup via SQLAlchemy

# Start the API server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will:
- Create all database tables
- Seed 3 users, 7 rooms, 22 devices, and 30 days of historical data
- Start the simulation engine (1-second tick intervals)
- Connect to Redis PubSub
- Open WebSocket connections

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the cinematic landing page.

### 4. Mobile App Setup (Flutter)

```bash
cd mobile_app
flutter pub get
flutter run
```

Ensure you have a device connected or an emulator/simulator running.

### 5. Default Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@rntbci.io` | `Admin@12345` |
| User | `user@rntbci.io` | `User@12345` |
| Guest | `guest@rntbci.io` | `Guest@12345` |

---

## Project Structure

```
RNTBCI_FINAL/
├── backend/
│   ├── api/
│   │   ├── router.py              # API router assembly
│   │   └── v1/
│   │       ├── auth.py            # Auth endpoints
│   │       ├── devices.py         # Device CRUD + control
│   │       ├── dashboard.py       # Dashboard + Energy analytics
│   │       ├── events.py          # Events + Alerts
│   │       └── enterprise.py      # Simulation, Scenarios, HEMS, Hub, Location, Pipeline, Time Travel
│   ├── auth/
│   │   ├── jwt_handler.py         # JWT + Argon2
│   │   └── dependencies.py        # Auth dependencies
│   ├── database/
│   │   └── connection.py          # Async SQLAlchemy
│   ├── middleware/
│   │   └── security.py            # CORS, CSP, rate limiting
│   ├── models/
│   │   └── models.py              # 12 SQLAlchemy tables
│   ├── schemas/
│   │   └── schemas.py             # Pydantic v2 schemas
│   ├── redis/
│   │   └── client.py              # Redis PubSub client
│   ├── mqtt/
│   │   └── client.py              # MQTT bridge (optional)
│   ├── websockets/
│   │   └── manager.py             # WebSocket connection manager
│   ├── services/
│   │   ├── simulation.py          # Simulation engine (state machines, load profiles)
│   │   ├── scenarios.py           # Scenario manager (6 built-in)
│   │   ├── hems.py                # Home Energy Management System
│   │   ├── controller_hub.py      # Controller Hub (6 adapters)
│   │   ├── location.py            # Location-based automation
│   │   └── pipeline.py            # Data analysis pipeline
│   ├── utils/
│   │   └── seed.py                # Database seeder
│   ├── config.py                  # App configuration
│   ├── main.py                    # FastAPI entry point
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Cinematic landing page (3D)
│   │   ├── globals.css            # Cyberpunk design system
│   │   └── dashboard/
│   │       ├── layout.tsx         # App shell (sidebar, topbar, event footer)
│   │       ├── page.tsx           # Home overview dashboard
│   │       ├── devices/page.tsx   # Device inventory grid
│   │       ├── twin/page.tsx      # 3D Digital Twin
│   │       ├── energy/page.tsx    # Energy analytics
│   │       ├── events/page.tsx    # Event stream
│   │       ├── scenarios/page.tsx # Scenario manager
│   │       ├── timetravel/page.tsx# Time Travel interface
│   │       ├── metrics/page.tsx   # Simulation metrics
│   │       └── settings/page.tsx  # Settings
│   ├── store/
│   │   └── index.ts               # Zustand stores
│   ├── services/
│   │   ├── api.ts                 # REST API client
│   │   └── websocket.ts           # WebSocket client
│   ├── package.json
│   └── tsconfig.json
│
├── .env.example                   # Environment template
└── README.md                      # This file
```

---

## Security

- **JWT** with strict algorithm enforcement (no `none` algorithm)
- **Argon2** password hashing
- **RBAC** (Admin / User / Guest) with resource-level permissions
- **CORS** configured with explicit origins (no wildcards)
- **CSP** headers (Content Security Policy)
- **Rate limiting** on all endpoints via SlowAPI
- **Input validation** via Pydantic v2
- **SQL injection protection** via SQLAlchemy parameterized queries

---

## Performance

- **Async everywhere** — FastAPI, SQLAlchemy 2.0, Redis, WebSocket
- **1-second simulation ticks** with accurate timing
- **Redis PubSub** as message bus for real-time fan-out
- **WebSocket** deduplication and heartbeat
- **Three.js** with `Bloom` + `Vignette` post-processing at 60fps
- **Zustand** for zero-overhead state management

---

<p align="center">
  <sub>Built with precision by RNTBCI · Nexus Core v1.0.0</sub>
</p>
