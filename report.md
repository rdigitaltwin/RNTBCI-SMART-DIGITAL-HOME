# RNTBCI Latency Report

**Project:** RNTBCI Smart Home Digital Twin  
**Environment:** Production (`rntbci-project-production.up.railway.app`)  
**Region (observed edge):** Railway `sin1` (Singapore)  
**Measurement date:** 29 September 2026  
**Client vantage point:** India (UTC+5:30)  
**Method:** Client-side HTTP timing (`curl` / Python `urllib`), 10–20 samples per endpoint  

---

## 1. Executive Summary

End-to-end API latency from India to the production service is typically **~530–580 ms (p50)** for both lightweight health checks and database-backed endpoints. Network RTT to the Singapore edge accounts for most of that budget; server-side work for simple routes appears small by comparison.

| Metric | Value | Assessment |
|--------|-------|------------|
| Typical API latency (p50) | **~570–575 ms** | Dominated by client ↔ Singapore network path |
| Health check p95 | **~1,046 ms** | Occasional connection / edge spikes |
| Rooms API p95 | **~640 ms** | Stable under light load |
| Dashboard-reported API / WS latency | **4.2 ms / 2.1 ms (placeholders)** | Not real instrumentation — backend fields stay at `0` |
| Production health | Healthy; Redis up; simulation running at 1.0× | Confirmed via `/health` |

**Bottom line:** Users in India will feel ~0.5–1 s responsiveness on REST calls until either (a) the service is moved closer to users, or (b) the UI relies more on WebSocket / local cache so REST is not on the critical path. Server-side simulation and per-tick Redis/DB work remain the main risks for *internal* latency and realtime fan-out as device count grows.

---

## 2. Scope & Measurement Notes

### In scope
- Production HTTP latency for public and auth-gated routes
- Comparison of network vs application contribution
- Architecture review of simulation, Redis pub/sub, DB, and frontend polling
- Prioritized recommendations to reduce perceived and actual latency

### Out of scope / limitations
- Authenticated deep-path timings (device control, HEMS analyze, energy history) — those routes returned `403` without a token; timing still useful as “auth-reject path”
- WebSocket round-trip (RTT) was not instrumented end-to-end in this run
- Server-side middleware logs request duration but those logs were not sampled from the live host
- Dashboard `api_latency_ms` / `ws_latency_ms` are **not populated** by the simulation engine today

### Latency components included in client totals
```
DNS → TCP connect → TLS handshake → server processing → response transfer
```

---

## 3. Latency Results

### 3.1 Percentile summary (client → production)

| Endpoint | Samples | Status | Min | Avg | p50 | p95 | p99 | Max |
|----------|---------|--------|-----|-----|-----|-----|-----|-----|
| `GET /health` | 20 | 200 | 544 ms | 695 ms | **575 ms** | **1,046 ms** | 1,457 ms | 1,560 ms |
| `GET /api/v1/rooms` | 15 | 200 | 529 ms | 579 ms | **573 ms** | **640 ms** | 680 ms | 689 ms |
| `GET /docs` | 10 | 200 | 527 ms | 570 ms | **566 ms** | **620 ms** | 641 ms | 646 ms |

### 3.2 Spot samples (`curl`, 5 runs each)

| Endpoint | Typical total | Typical TTFB | Typical TCP connect | Notes |
|----------|---------------|--------------|---------------------|-------|
| `GET /` | 470–546 ms | ≈ total | 87–168 ms | Returns 404 JSON (no root handler) |
| `GET /health` | 449–536 ms | ≈ total | 100–118 ms | Healthy payload (~126 B) |
| `GET /docs` | 539–713 ms | ≈ total | 136–146 ms | Swagger UI HTML |
| `GET /openapi.json` | 447–542 ms | ≈ total | 82–152 ms | **HTTP 500** (broken OpenAPI generation) |
| `GET /api/v1/rooms` | 536–610 ms | ≈ total | 114–194 ms | DB-backed public rooms list |
| `GET /api/v1/devices` | 452–502 ms | ≈ total | 91–130 ms | 403 (auth required) |
| `GET /api/v1/simulation/metrics` | 506–767 ms | ≈ total | 126–206 ms | 403 (auth required) |
| `GET /api/v1/hems/status` | 449–491 ms (spike 1,795 ms) | ≈ total | 99–113 ms (spike ~1.1 s) | 403; rare connect spike |

### 3.3 Network budget (first warm request breakdown)

Example from a measured call to `/`:

| Phase | Time |
|-------|------|
| DNS lookup | ~4 ms |
| TCP connect | ~103 ms |
| TLS (`time_appconnect`) | ~211 ms (~108 ms handshake after TCP) |
| Time to first byte (TTFB) | ~495 ms |
| Transfer | negligible for small JSON |

**Interpretation:** For small responses, **~400–500 ms is network floor** from this client to `sin1`. Application processing for `/health` and even `/api/v1/rooms` is likely on the order of tens of milliseconds; the rooms list is not materially slower than health at p50, which supports that conclusion.

### 3.4 In-product metrics (dashboard vs backend)

| Source | API latency | WS latency | Reliability |
|--------|-------------|------------|-------------|
| Frontend metrics UI fallback | 4.2 ms | 2.1 ms | **Placeholder defaults** when metrics are missing |
| Backend `device_simulator.metrics` | `api_latency_ms: 0` | `ws_latency_ms: 0` | Fields exist but are **never updated** in the simulation loop |

Do **not** use the dashboard 4.2 ms / 2.1 ms figures for SLOs or stakeholder reporting until real instrumentation is wired.

---

## 4. Latency Targets (Recommended SLOs)

| Path | Target (p50) | Target (p95) | Rationale |
|------|--------------|--------------|-----------|
| `GET /health` (same region) | &lt; 20 ms | &lt; 50 ms | Liveness / readiness |
| Public read APIs (same region) | &lt; 50 ms | &lt; 150 ms | Rooms / device list |
| Authenticated control APIs | &lt; 80 ms | &lt; 250 ms | Matter/device commands |
| WebSocket event delivery (publish → client) | &lt; 50 ms | &lt; 150 ms | Realtime twin / telemetry |
| Client India → current Singapore deploy | ~500–600 ms | &lt; 1,000 ms | Acceptable interim network floor |

Current production from India **misses same-region targets** by design (geography). It roughly meets an interim “&lt; 1 s p95 for reads” bar except when connection spikes push health toward ~1.5 s.

---

## 5. Root Causes & Bottlenecks

### 5.1 Geographic / edge latency (primary for REST UX)
- Service edge observed as **Singapore (`sin1`)** while primary users appear to be in **India**.
- TLS + RTT alone consume most of the ~570 ms p50.

### 5.2 Missing latency instrumentation
- Middleware logs `duration` per request but values are not aggregated into metrics, percentiles, or the dashboard.
- `api_latency_ms` / `ws_latency_ms` in simulation metrics are stubs.

### 5.3 Simulation tick path (internal / realtime risk)
Each live tick approximately:
1. Opens a DB session and **loads all devices**
2. Updates per-device state / power
3. **Publishes Redis messages per device** (telemetry) plus events/metrics
4. Commits history / energy rows on interval
5. Sleeps to enforce tick rate

As device count grows, tick duration rises linearly with Redis publishes and DB writes, which increases WebSocket fan-out delay and can starve the event loop shared with HTTP handlers.

### 5.4 Frontend polling on top of WebSocket
Several dashboard views poll on intervals (1 s or 15 s) even though a WebSocket client already exists. Duplicate REST traffic adds load and perceived wait without improving freshness if WS is healthy.

### 5.5 Cache policy
API responses set `Cache-Control: no-store`. Correct for live control data, but static or slowly changing reads (rooms layout, device catalog metadata) cannot benefit from CDN / browser cache.

### 5.6 Other observations
- `/openapi.json` returns **500** — hurts tooling and may add failed-request load during client generation.
- Auth-gated routes correctly reject quickly (403), but still pay full network RTT.
- Occasional **1+ second connect spikes** suggest cold connections, edge variability, or idle connection teardown.

---

## 6. How to Improve Latency

### Priority 1 — Quick wins (days)

| Action | Expected impact | Notes |
|--------|-----------------|-------|
| **Instrument real latency** | Visibility first | Rolling avg / histogram for HTTP (middleware → Redis/`system:metrics`) and WS ping/pong RTT; remove UI placeholders |
| **Prefer WebSocket for live UI** | Large drop in *perceived* latency | Drive twin, metrics, power gauges from WS; reserve REST for mutations and initial hydrate |
| **Reduce duplicate polling** | Lower backend load | Gate 1 s intervals behind “WS disconnected” fallback only |
| **HTTP keep-alive / connection reuse** on clients | Save ~100–200 ms per call | Avoid full TCP+TLS handshake on every request |
| **Fix `/openapi.json` 500** | Reliability | Stops noisy failed fetches from tools |

### Priority 2 — Architecture (1–2 sprints)

| Action | Expected impact | Notes |
|--------|-----------------|-------|
| **Batch Redis publishes** per tick | Lower tick time & WS lag | One `system:telemetry_batch` (or pipeline) instead of N `publish_device_update` calls |
| **Cache device list in memory** between ticks | Less DB load | Invalidate on create/update/delete; avoid full `SELECT` every second |
| **Bulk DB inserts** for history | Faster commits | `add_all` / `executemany` for `DevicePowerHistory` rows |
| **Selective cache for read-mostly APIs** | Faster repeats | Short TTL (5–30 s) for rooms / device catalog; keep commands uncached |
| **DB indexes & query shape** | Stable p95 | Ensure filters used by list/energy/events endpoints are indexed; avoid count+list double scans where possible |
| **Offload ML inference** | Protect API latency | Run LSTM / anomaly jobs in a worker process or queue so they never block the FastAPI event loop |

### Priority 3 — Platform / geography

| Action | Expected impact | Notes |
|--------|-----------------|-------|
| **Deploy closer to users** (e.g. Mumbai / India region if available) | **−300 to −450 ms** on REST from India | Highest ROI for absolute client latency |
| **Edge / CDN for static frontend** | Faster first paint | Keep API regional; serve Next.js assets at the edge |
| **Right-size Railway instances / avoid cold starts** | Fewer p95/p99 spikes | Persistent min instances; watch memory under simulation + Redis |
| **Regional Redis & Postgres co-located with API** | Lower internal hop latency | Avoid cross-region DB/Redis if split |

### Priority 4 — Product / UX patterns

| Action | Expected impact | Notes |
|--------|-----------------|-------|
| Optimistic UI for device commands | Instant feel | Confirm/reconcile via WS event |
| Skeleton / stale-while-revalidate on dashboards | Hides network RTT | Show last-known twin state immediately |
| Compress large history payloads | Faster energy / time-travel views | Pagination already exists — enforce sensible `per_page` defaults |

---

## 7. Suggested Implementation Plan

```
Week 1
  ├─ Wire request-duration histogram into system:metrics
  ├─ Add WS ping/pong latency measurement
  ├─ Replace dashboard placeholders with live values
  └─ Disable redundant 1s REST polls when WS is connected

Week 2
  ├─ Batch simulation Redis publishes
  ├─ In-memory device snapshot for the sim loop
  └─ Fix OpenAPI 500

Week 3–4
  ├─ Evaluate India-region (or nearer) Railway deploy
  ├─ CDN for frontend assets
  └─ Worker process for ML inference
```

---

## 8. Monitoring Checklist

To keep this report honest going forward:

1. Export **p50 / p95 / p99** for key routes: `/health`, `/api/v1/rooms`, `/api/v1/devices`, device command POSTs, HEMS status.
2. Track **simulation tick duration** and **events published per second**.
3. Track **WebSocket connected clients** and **publish → deliver** lag.
4. Alert when p95 REST (same-region synthetic check) exceeds SLO, separate from client-geography checks.
5. Run a lightweight synthetic probe from **India** and from **Singapore** so network vs app regressions are distinguishable.

---

## 9. Conclusion

Production latency from India is **~570 ms median** and usually under **~650–1,050 ms at p95**, with rare multi-second connect spikes. That profile is consistent with a **Singapore-hosted** FastAPI service rather than a slow application core for simple reads.

**Highest-impact improvements:**
1. Treat WebSocket as the primary realtime path and stop redundant REST polling.  
2. Instrument and display real API / WS latency (current dashboard numbers are placeholders).  
3. Batch simulation Redis/DB work so tick latency stays flat as devices scale.  
4. Move compute (or add an edge) closer to Indian users if absolute REST latency must drop below ~200 ms.

---

*Generated for internal team sharing. Figures are client-observed against production on 29 Sep 2026; re-measure after deploy or region changes.*
