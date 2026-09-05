import asyncio
from backend.models import DeviceType
from backend.api.v1.devices import _get_default_state
print(_get_default_state(DeviceType.EV_VEHICLE))
