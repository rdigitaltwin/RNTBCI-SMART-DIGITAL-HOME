"""Matter cluster/attribute catalog and tolerant path lookup.

Cluster and attribute names are matched case-insensitively. Hex cluster ids
(0x0041) and a small alias map are accepted. Nothing here writes the database.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import unquote

from backend.utils.device_logger import DeviceLogger

# Postgres stores DeviceType member names (WASHING_MACHINE), not values.
DEVICE_TYPE_BUILDERS: dict[str, str] = {
    "SMART_LIGHT": "_schema_light",
    "SMART_SWITCH": "_schema_switch",
    "SMART_PLUG": "_schema_plug",
    "DOOR_LOCK": "_schema_doorlock",
    "HVAC": "_schema_heatpump",
    "WASHING_MACHINE": "_schema_washer",
    "DISHWASHER": "_schema_dishwasher",
    "REFRIGERATOR": "_schema_refrigerator",
    "WATER_HEATER": "_schema_waterheater",
    "CAMERA": "_schema_camera",
    "MICROWAVE": "_schema_microwave",
    "SMART_METER": "_schema_meter",
    "HEAT_PUMP": "_schema_heatpump",
    "AIR_CONDITIONER": "_schema_heatpump",
    "BASE_LOAD": "_schema_meter",
    "ENERGY_EVSE": "_schema_evse",
    "SOLAR_PV": "_schema_solar",
    "BATTERY_STORAGE": "_schema_battery",
    "MCB": "_schema_plug",
    "EV_VEHICLE": "_schema_ev_vehicle",
}

# Normalized alias -> normalized canonical attribute name.
ATTRIBUTE_ALIASES: dict[str, str] = {
    "status": "onoff",
    "labellist": "labellist",
    "labellists": "labellist",
    "mode": "currentmode",
    "washermode": "currentmode",
    "washermodes": "currentmode",
    "getwashermodes": "currentmode",
    "rinse": "numberofrinses",
}

# Attributes a POST may write. Everything else that resolves is GET-only.
WRITABLE_ATTRIBUTES = {
    "onoff",
    "powerstate",
    "labellist",
    "label",
    "currentmode",
    "spinspeedcurrent",
    "numberofrinses",
    "temperaturesetpoint",
    "selectedtemperaturelevel",
}

WASHER_MODES = ["normal", "delicate", "heavy", "quick"]
WASHER_SPIN_SPEEDS = [0, 400, 800, 1000, 1200]
WASHER_RINSES = [0, 1, 2, 3]


def normalize_token(value: str) -> str:
    text = unquote(value or "").strip().lower()
    text = text.replace("_", "").replace("-", "").replace(" ", "")
    if text.startswith("get") and len(text) > 3:
        text = text[3:]
    return text


def canonical_device_type(dtype: Any) -> str:
    if dtype is None:
        return ""
    name = getattr(dtype, "name", None)
    if isinstance(name, str) and name in DEVICE_TYPE_BUILDERS:
        return name
    raw = getattr(dtype, "value", dtype)
    raw_s = str(raw)
    if raw_s in DEVICE_TYPE_BUILDERS:
        return raw_s
    upper = raw_s.upper()
    if upper in DEVICE_TYPE_BUILDERS:
        return upper
    return raw_s


def _parse_cluster_hex(token: str) -> Optional[int]:
    text = unquote(token or "").strip().lower()
    if not text.startswith("0x"):
        return None
    try:
        return int(text, 16)
    except ValueError:
        return None


_ELECTRICAL_ATTRIBUTES = ("Voltage", "ActivePower", "ActiveCurrent")


def clusters_for_device_type(device_type: Any) -> list[dict]:
    key = canonical_device_type(device_type)
    method = DEVICE_TYPE_BUILDERS.get(key)
    if not method:
        return []
    schema = getattr(DeviceLogger, method)("catalog", "catalog")
    endpoints = schema.get("deviceType", {}).get("endpoints") or []
    clusters: list[dict] = []
    for endpoint in endpoints:
        endpoint_id = int(endpoint.get("endpointId") or 1)
        for cluster in endpoint.get("clusters") or []:
            item = dict(cluster)
            item["endpointId"] = endpoint_id
            item["attributes"] = [dict(attr) for attr in (cluster.get("attributes") or [])]
            clusters.append(item)
    present = {
        normalize_token(str(attr.get("name") or ""))
        for cluster in clusters
        for attr in cluster["attributes"]
    }
    missing = [name for name in _ELECTRICAL_ATTRIBUTES if normalize_token(name) not in present]
    if missing:
        host = next(
            (
                cluster for cluster in clusters
                if normalize_token(str(cluster.get("name") or "")) == "electricalpowermeasurement"
                or _parse_cluster_hex(str(cluster.get("clusterId") or "")) == 0x90
            ),
            None,
        )
        extra = [{"name": name} for name in missing]
        if host is not None:
            host["attributes"].extend(extra)
        else:
            clusters.append({
                "clusterId": "0x0090",
                "name": "ElectricalPowerMeasurement",
                "side": "server",
                "endpointId": 1,
                "attributes": extra,
            })
    return clusters


def iter_catalog_rows() -> list[dict]:
    """Rows for matter_device_clusters and matter_cluster_attributes."""
    cluster_rows: list[dict] = []
    attribute_rows: list[dict] = []
    seen_clusters: set[tuple] = set()
    seen_attrs: set[tuple] = set()
    for device_type in DEVICE_TYPE_BUILDERS:
        for cluster in clusters_for_device_type(device_type):
            endpoint_id = cluster["endpointId"]
            cluster_id = str(cluster.get("clusterId") or "")
            cluster_name = str(cluster.get("name") or "")
            ckey = (device_type, endpoint_id, cluster_id.lower())
            if ckey not in seen_clusters:
                seen_clusters.add(ckey)
                cluster_rows.append({
                    "device_type": device_type,
                    "endpoint_id": endpoint_id,
                    "cluster_id": cluster_id,
                    "cluster_name": cluster_name,
                })
            for attr in cluster.get("attributes") or []:
                attr_name = str(attr.get("name") or "").strip()
                if not attr_name:
                    continue
                akey = (device_type, endpoint_id, cluster_id.lower(), normalize_token(attr_name))
                if akey in seen_attrs:
                    continue
                seen_attrs.add(akey)
                attribute_rows.append({
                    "device_type": device_type,
                    "endpoint_id": endpoint_id,
                    "cluster_id": cluster_id,
                    "attribute_name": attr_name,
                })
    return cluster_rows, attribute_rows  # type: ignore[return-value]


@dataclass
class ResolvedAttribute:
    cluster_id: str
    cluster_name: str
    attribute_name: str
    endpoint_id: int
    writable: bool
    valid_attributes: list[str]
    valid_clusters: list[str]


@dataclass
class ResolveError:
    status_code: int
    detail: str


def _cluster_matches(cluster: dict, token: str) -> bool:
    if normalize_token(cluster.get("name") or "") == normalize_token(token):
        return True
    wanted = _parse_cluster_hex(token)
    if wanted is None:
        return False
    found = _parse_cluster_hex(str(cluster.get("clusterId") or ""))
    return found is not None and found == wanted


def _attribute_names(cluster: dict) -> list[str]:
    names = []
    for attr in cluster.get("attributes") or []:
        name = str(attr.get("name") or "").strip()
        if name:
            names.append(name)
    return names


def _match_attribute(cluster: dict, token: str) -> Optional[str]:
    names = _attribute_names(cluster)
    wanted = normalize_token(token)
    for name in names:
        if normalize_token(name) == wanted:
            return name
    aliased = ATTRIBUTE_ALIASES.get(wanted, wanted)
    for name in names:
        if normalize_token(name) == aliased:
            return name
    # status -> OnOff, but some clusters only persist PowerState.
    if aliased == "onoff":
        for name in names:
            if normalize_token(name) in ("onoff", "powerstate"):
                return name
    if aliased == "labellist":
        for name in names:
            if normalize_token(name) in ("labellist", "label"):
                return name
    return None


def resolve_matter_path(device_type: Any, cluster_path: str) -> ResolvedAttribute | ResolveError:
    clusters = clusters_for_device_type(device_type)
    valid_clusters = [f"{c.get('clusterId')} {c.get('name')}".strip() for c in clusters]
    parts = [unquote(part).strip() for part in (cluster_path or "").split("/")]
    parts = [part for part in parts if part]
    if not parts:
        return ResolveError(404, "Cluster path is empty. Valid clusters: " + ", ".join(valid_clusters))

    if len(parts) >= 3:
        cluster_tokens = parts[:-1]
        attr_token = parts[-1]
    elif len(parts) == 2:
        cluster_tokens = [parts[0]]
        attr_token = parts[1]
    else:
        cluster_tokens = [parts[0]]
        attr_token = ""

    matched = [c for c in clusters if any(_cluster_matches(c, token) for token in cluster_tokens)]
    # A 3-segment path must agree: hex id and name identify the same cluster.
    if len(cluster_tokens) >= 2 and matched:
        agreed = [c for c in matched if all(_cluster_matches(c, token) for token in cluster_tokens)]
        if agreed:
            matched = agreed
        else:
            # Keep clusters that match the hex id when one token is an id.
            hex_hits = [c for c in matched if any(_parse_cluster_hex(t) is not None and _cluster_matches(c, t) for t in cluster_tokens)]
            name_hits = [c for c in matched if any(_parse_cluster_hex(t) is None and _cluster_matches(c, t) for t in cluster_tokens)]
            if hex_hits and name_hits and {c.get("clusterId") for c in hex_hits}.isdisjoint({c.get("clusterId") for c in name_hits}):
                return ResolveError(
                    404,
                    f"Cluster '{' / '.join(cluster_tokens)}' not available for this device. Valid clusters: "
                    + ", ".join(valid_clusters),
                )
            matched = hex_hits or name_hits or matched

    if not matched:
        return ResolveError(
            404,
            f"Cluster '{cluster_tokens[0]}' not available for this device. Valid clusters: "
            + ", ".join(valid_clusters),
        )

    if not attr_token:
        names = _attribute_names(matched[0])
        return ResolveError(
            404,
            f"Attribute missing. Valid attributes for cluster '{matched[0].get('name')}': " + ", ".join(names),
        )

    # Prefer the cluster that actually contains the attribute.
    chosen = None
    attribute_name = None
    for cluster in matched:
        found = _match_attribute(cluster, attr_token)
        if found:
            chosen = cluster
            attribute_name = found
            break
    if chosen is None:
        names = _attribute_names(matched[0])
        return ResolveError(
            404,
            f"Attribute '{attr_token.strip()}' not available for this device. "
            f"Valid attributes for cluster '{matched[0].get('name')}': " + ", ".join(names),
        )

    norm_name = normalize_token(attribute_name)
    return ResolvedAttribute(
        cluster_id=str(chosen.get("clusterId") or ""),
        cluster_name=str(chosen.get("name") or ""),
        attribute_name=attribute_name,
        endpoint_id=int(chosen.get("endpointId") or 1),
        writable=norm_name in WRITABLE_ATTRIBUTES or normalize_token(attr_token) in WRITABLE_ATTRIBUTES,
        valid_attributes=_attribute_names(chosen),
        valid_clusters=valid_clusters,
    )


def _power_on(device: Any) -> bool:
    state = getattr(device, "power_state", None)
    raw = getattr(state, "value", state)
    return str(raw).lower() in ("on", "powerstate.on")


def _meta(device: Any) -> dict:
    data = getattr(device, "extra_data", None) or {}
    return data if isinstance(data, dict) else {}


def _meta_lookup(meta: dict, name: str) -> tuple[bool, Any]:
    target = normalize_token(name)
    for key, value in meta.items():
        if normalize_token(str(key)) == target:
            return True, value
    return False, None


def read_resolved_attribute(device: Any, resolved: ResolvedAttribute) -> dict:
    meta = _meta(device)
    cluster = normalize_token(resolved.cluster_name)
    attr = normalize_token(resolved.attribute_name)

    if cluster == "laundrywashermode" and attr in ("currentmode", "supportedmodes"):
        return {
            "CurrentMode": meta.get("wash_mode", "normal"),
            "SupportedModes": list(WASHER_MODES),
        }
    if cluster == "laundrywashercontrols" and attr in ("spinspeedcurrent", "spinspeeds"):
        return {
            "SpinSpeedCurrent": meta.get("spin_speed", 1000),
            "SpinSpeeds": list(WASHER_SPIN_SPEEDS),
        }
    if cluster == "laundrywashercontrols" and attr in ("numberofrinses", "supportedrinses"):
        return {
            "NumberOfRinses": meta.get("number_of_rinses", 1),
            "SupportedRinses": list(WASHER_RINSES),
        }
    if cluster == "temperaturecontrol" and attr in ("temperaturesetpoint", "selectedtemperaturelevel"):
        return {
            "TemperatureSetpoint": meta.get("temperature_setpoint", meta.get("target_temperature", 40)),
            "SelectedTemperatureLevel": meta.get("temperature_level", meta.get("SelectedTemperatureLevel", 1)),
        }
    if attr in ("onoff", "powerstate"):
        on = _power_on(device)
        return {"OnOff": on, "PowerState": "on" if on else "off"}
    if attr in ("labellist", "label"):
        labels = meta.get("LabelList")
        if labels is None:
            found, labels = _meta_lookup(meta, "LabelList")
            if not found:
                labels = []
        return {"LabelList": labels or []}

    found, value = _meta_lookup(meta, resolved.attribute_name)
    if found:
        return {resolved.attribute_name: value}
    return {resolved.attribute_name: None}


def apply_attribute_write(device: Any, resolved: ResolvedAttribute, body: dict) -> dict:
    """Mutate device in memory. Caller commits. Does not delete other metadata keys."""
    meta = dict(_meta(device))
    attr = normalize_token(resolved.attribute_name)
    body = body or {}

    if attr in ("onoff", "powerstate"):
        raw = body.get("value", body.get("OnOff", body.get("status", body.get("PowerState"))))
        if raw is None:
            raise ValueError("Missing 'value' in request body")
        if isinstance(raw, str):
            on = raw.strip().lower() in ("1", "true", "on", "yes")
        else:
            on = bool(raw)
        from backend.models import PowerState

        device.power_state = PowerState.ON if on else PowerState.OFF
        return {"OnOff": on, "PowerState": "on" if on else "off"}

    if attr == "currentmode" or normalize_token(resolved.cluster_name) == "laundrywashermode":
        raw = body.get("value", body.get("CurrentMode", body.get("mode", body.get("NewMode"))))
        if raw is None:
            raise ValueError("Missing 'value' in request body")
        meta["wash_mode"] = raw
        device.extra_data = meta
        return {"CurrentMode": raw, "SupportedModes": list(WASHER_MODES)}

    if attr in ("labellist", "label"):
        if "LabelList" in body:
            meta["LabelList"] = body["LabelList"]
        elif "label" in body or "value" in body:
            meta["LabelList"] = [{"label": body.get("label", ""), "value": body.get("value", "")}]
        else:
            raise ValueError("Missing label or value in request body")
        device.extra_data = meta
        return {"LabelList": meta["LabelList"]}

    if attr == "spinspeedcurrent":
        raw = body.get("value", body.get("SpinSpeedCurrent"))
        if raw is None:
            raise ValueError("Missing 'value' in request body")
        meta["spin_speed"] = raw
        device.extra_data = meta
        return {"SpinSpeedCurrent": raw, "SpinSpeeds": list(WASHER_SPIN_SPEEDS)}

    if attr == "numberofrinses":
        raw = body.get("value", body.get("NumberOfRinses"))
        if raw is None:
            raise ValueError("Missing 'value' in request body")
        meta["number_of_rinses"] = raw
        device.extra_data = meta
        return {"NumberOfRinses": raw, "SupportedRinses": list(WASHER_RINSES)}

    if attr in ("temperaturesetpoint", "selectedtemperaturelevel"):
        if "value" in body or "TemperatureSetpoint" in body:
            meta["temperature_setpoint"] = body.get("TemperatureSetpoint", body.get("value"))
        if "SelectedTemperatureLevel" in body:
            meta["temperature_level"] = body["SelectedTemperatureLevel"]
        if "temperature_setpoint" not in meta and "temperature_level" not in meta:
            raise ValueError("Missing 'value' in request body")
        device.extra_data = meta
        return {
            "TemperatureSetpoint": meta.get("temperature_setpoint"),
            "SelectedTemperatureLevel": meta.get("temperature_level", 1),
        }

    raw = body.get("value", body.get(resolved.attribute_name))
    if raw is None:
        raise ValueError("Missing 'value' in request body")
    # Preserve existing keys; only set this attribute.
    replaced = False
    new_meta = {}
    for key, value in meta.items():
        if normalize_token(str(key)) == attr:
            new_meta[key] = raw
            replaced = True
        else:
            new_meta[key] = value
    if not replaced:
        new_meta[resolved.attribute_name] = raw
    device.extra_data = new_meta
    return {resolved.attribute_name: raw}


_HEX_RE = re.compile(r"^0x[0-9a-f]+$")


def is_hex_cluster(token: str) -> bool:
    return bool(_HEX_RE.match(unquote(token or "").strip().lower()))


def read_bare_cluster(device: Any, cluster_path: str) -> Optional[dict]:
    """GET .../cluster/{name} with no attribute returns every attribute on that cluster."""
    parts = [unquote(part).strip() for part in (cluster_path or "").split("/")]
    parts = [part for part in parts if part]
    if len(parts) != 1:
        return None
    clusters = clusters_for_device_type(getattr(device, "type", None))
    matched = [cluster for cluster in clusters if _cluster_matches(cluster, parts[0])]
    if not matched:
        return None
    cluster = matched[0]
    names = _attribute_names(cluster)
    if not names:
        return None
    merged: dict = {}
    for name in names:
        resolved = ResolvedAttribute(
            cluster_id=str(cluster.get("clusterId") or ""),
            cluster_name=str(cluster.get("name") or ""),
            attribute_name=name,
            endpoint_id=int(cluster.get("endpointId") or 1),
            writable=normalize_token(name) in WRITABLE_ATTRIBUTES,
            valid_attributes=names,
            valid_clusters=[],
        )
        merged.update(read_resolved_attribute(device, resolved))
    return merged
