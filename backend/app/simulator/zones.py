"""Storage-zone definitions used by the simulator and the analytics pipeline.

All values are illustrative defaults for a prototype; they are not regulatory limits.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ZoneConfig:
    zone_id: str
    name: str
    product: str
    sensor_id: str
    setpoint: float  # target temperature (°C)
    lower_limit: float  # configured safe range, lower bound (°C)
    upper_limit: float  # configured safe range, upper bound (°C)
    ambient_base: float  # typical surrounding temperature (°C)
    k_leak: float  # heat-leak coefficient through walls (1/min)
    k_door: float  # extra air-exchange coefficient while the door is open (1/min)
    cooling_max: float  # max cooling rate of the refrigeration unit (°C/min)
    kp: float  # proportional gain of the simulated thermostat
    humidity_base: float  # typical relative humidity (%)
    humidity_door: float  # humidity the room drifts to with the door open (%)

    @property
    def range_width(self) -> float:
        return self.upper_limit - self.lower_limit


ZONES: dict[str, ZoneConfig] = {
    z.zone_id: z
    for z in [
        ZoneConfig(
            zone_id="zone-a",
            name="Vaccine Store A",
            product="Vaccines & biologics",
            sensor_id="TS-A01",
            setpoint=5.0,
            lower_limit=2.0,
            upper_limit=8.0,
            ambient_base=25.0,
            k_leak=0.0040,
            k_door=0.0110,
            cooling_max=0.20,
            kp=0.5,
            humidity_base=52.0,
            humidity_door=78.0,
        ),
        ZoneConfig(
            zone_id="zone-b",
            name="Dairy Chiller B",
            product="Milk, yoghurt & cheese",
            sensor_id="TS-B01",
            setpoint=3.0,
            lower_limit=0.0,
            upper_limit=6.0,
            ambient_base=26.0,
            k_leak=0.0036,
            k_door=0.0094,
            cooling_max=0.20,
            kp=0.5,
            humidity_base=80.0,
            humidity_door=90.0,
        ),
        ZoneConfig(
            zone_id="zone-c",
            name="Frozen Store C",
            product="Frozen food",
            sensor_id="TS-C01",
            setpoint=-20.0,
            lower_limit=-25.0,
            upper_limit=-15.0,
            ambient_base=24.0,
            k_leak=0.0024,
            k_door=0.0068,
            cooling_max=0.26,
            kp=0.5,
            humidity_base=45.0,
            humidity_door=70.0,
        ),
    ]
}


def get_zone(zone_id: str) -> ZoneConfig:
    try:
        return ZONES[zone_id]
    except KeyError as exc:  # pragma: no cover - callers translate to HTTP 404
        raise KeyError(f"Unknown zone '{zone_id}'") from exc
