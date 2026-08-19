# EVSE (Electric Vehicle Supply Equipment) - API Reference

> **Base URL:** `https://rntbci-project-production.up.railway.app/api/v1`  
> **EVSE Device ID:** `9d79ff82-7ef0-4a45-89d5-fb5dc789b056`

---

## 🟢 GET Requests

---

### 1. Get EVSE Device Details (Full Matter Spec)

```
GET https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1
```

---

### 2. Get State Of Charge

```
GET https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/EnergyEVSE/stateofcharge
```

**Response:**
```json
{
  "StateOfCharge": 62
}
```

---

### 3. Get Active Power

```
GET https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/activepower
```

**Response:**
```json
{
  "ActivePower": 11000000
}
```
> Value in milliwatts (11000000 = 11 kW)

---

### 4. Get Voltage

```
GET https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/voltage
```

**Response:**
```json
{
  "Voltage": 400000
}
```
> Value in millivolts (400000 = 400V)

---

### 5. Get Active Current

```
GET https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/activecurrent
```

**Response:**
```json
{
  "ActiveCurrent": 16000
}
```
> Value in milliamps (16000 = 16A)

---

### 6. Get Current Session Energy

```
GET https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/EnergyEVSE/currentsessionenergy
```

**Response:**
```json
{
  "CurrentSessionEnergy": 16500000
}
```
> Value in milliwatt-hours (16500000 = 16.5 kWh)

---

### 7. Get Charging Targets

```
GET https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/EnergyEVSE/gettargets
```

**Response:**
```json
{
  "commandId": "0x06",
  "command": "GetTargets",
  "chargingTargetSchedules": []
}
```

---

## 🔵 POST Requests

---

### 1. Enable Charging

```
POST https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/0x009B/enable
```

**Body:**
```json
{
  "commandId": "0x01",
  "command": "EnableCharging"
}
```

**Response:**
```json
{
  "status": "success",
  "commandId": "0x01",
  "command": "EnableCharging",
  "cluster": "0x009B",
  "endpoint": 1,
  "response": {
    "State": "ChargingEnabled",
    "SupplyState": "ChargingEnabled"
  }
}
```

---

### 2. Disable EVSE

```
POST https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/0x009B/disable
```

**Body:**
```json
{
  "commandId": "0x02",
  "command": "Disable"
}
```

**Response:**
```json
{
  "status": "success",
  "commandId": "0x02",
  "command": "Disable",
  "cluster": "0x009B",
  "endpoint": 1,
  "response": {
    "State": "Disabled",
    "SupplyState": "Disabled"
  }
}
```

---

### 3. Set Charging Targets

```
POST https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/0x009B/settarget
```

**Body:**
```json
{
  "commandId": "0x05",
  "command": "SetTargets",
  "chargingTargetSchedules": [
    {
      "dayOfWeekForSequence": 127,
      "chargingTargets": [
        {
          "targetTimeMinutesPastMidnight": 420,
          "targetSoC": 80,
          "addedEnergy": 0
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "commandId": "0x05",
  "command": "SetTargets",
  "cluster": "0x009B",
  "endpoint": 1,
  "chargingTargetSchedules": [...]
}
```

---

### 4. Clear Charging Targets

```
POST https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/EnergyEVSE/cleartargets
```

**Body:**
```json
{
  "commandId": "0x07",
  "command": "ClearTargets"
}
```

**Response:**
```json
{
  "status": "success",
  "cluster": "EnergyEVSE",
  "endpoint": 1
}
```

---

### 5. Trigger Identify Effect

```
POST https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/Identify/triggereffect
```

**Body:**
```json
{
  "name": "TriggerEffect"
}
```

**Response:**
```json
{
  "id": "0x0040",
  "name": "TriggerEffect"
}
```

---

### 6. Set Active Power

```
POST https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/setactivepower
```

**Body:**
```json
{
  "ActivePower": 7400000
}
```
> Value in milliwatts (7400000 = 7.4 kW)

**Response:**
```json
{
  "status": "success",
  "cluster": "ElectricalPowerMeasurement",
  "endpoint": 1,
  "ActivePower": 7400000
}
```

---

### 7. Set Voltage

```
POST https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/setvoltage
```

**Body:**
```json
{
  "Voltage": 230000
}
```
> Value in millivolts (230000 = 230V)

**Response:**
```json
{
  "status": "success",
  "cluster": "ElectricalPowerMeasurement",
  "endpoint": 1,
  "Voltage": 230000
}
```

---

### 8. Set Active Current

```
POST https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/setactivecurrent
```

**Body:**
```json
{
  "ActiveCurrent": 32000
}
```
> Value in milliamps (32000 = 32A)

**Response:**
```json
{
  "status": "success",
  "cluster": "ElectricalPowerMeasurement",
  "endpoint": 1,
  "ActiveCurrent": 32000
}
```

---

## 🧪 Quick Test (curl commands)

```bash
# GET - State of Charge
curl "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/EnergyEVSE/stateofcharge"

# GET - Active Power
curl "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/activepower"

# GET - Voltage
curl "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/voltage"

# GET - Active Current
curl "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/activecurrent"

# GET - Session Energy
curl "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/EnergyEVSE/currentsessionenergy"

# GET - Charging Targets
curl "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/EnergyEVSE/gettargets"

# POST - Enable Charging
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/0x009B/enable" \
  -H "Content-Type: application/json" \
  -d '{"commandId":"0x01","command":"EnableCharging"}'

# POST - Disable EVSE
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/0x009B/disable" \
  -H "Content-Type: application/json" \
  -d '{"commandId":"0x02","command":"Disable"}'

# POST - Set Charging Targets
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/0x009B/settarget" \
  -H "Content-Type: application/json" \
  -d '{"commandId":"0x05","command":"SetTargets","chargingTargetSchedules":[{"dayOfWeekForSequence":127,"chargingTargets":[{"targetTimeMinutesPastMidnight":420,"targetSoC":80,"addedEnergy":0}]}]}'

# POST - Clear Targets
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/EnergyEVSE/cleartargets" \
  -H "Content-Type: application/json" \
  -d '{"commandId":"0x07","command":"ClearTargets"}'

# POST - Trigger Identify
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/Identify/triggereffect" \
  -H "Content-Type: application/json" \
  -d '{"name":"TriggerEffect"}'

# POST - Set Active Power (7.4 kW)
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/setactivepower" \
  -H "Content-Type: application/json" \
  -d '{"ActivePower":7400000}'

# POST - Set Voltage (230V)
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/setvoltage" \
  -H "Content-Type: application/json" \
  -d '{"Voltage":230000}'

# POST - Set Active Current (32A)
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/9d79ff82-7ef0-4a45-89d5-fb5dc789b056/endpoint/1/cluster/ElectricalPowerMeasurement/setactivecurrent" \
  -H "Content-Type: application/json" \
  -d '{"ActiveCurrent":32000}'
```
