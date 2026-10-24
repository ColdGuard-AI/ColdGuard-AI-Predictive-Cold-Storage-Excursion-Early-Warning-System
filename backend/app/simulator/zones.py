"""Storage-zone definitions used by the simulator and the analytics pipeline.

All values are illustrative defaults for a prototype; they are not regulatory limits.
"""
from __future__ import annotations

from dataclasses import dataclass, field


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
    vulnerable_items: list[str] = field(default_factory=list)
    inventory_value_usd: int = 50000
    spoilage_threshold: float = 8.0
    spoilage_mechanism: str = "Thermal degradation of stored perishables."

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
            vulnerable_items=[
                "COVID-19 mRNA Vaccine Vials (Comirnaty / Spikevax) - 4,200 doses",
                "Pediatric MMR, Varicella & Rotavirus Cold-Chain Vaccines - 3,500 doses",
                "Recombinant Human Insulin (Glargine & Lispro) - 2,800 cartridges",
                "Monoclonal Antibodies & Oncology Immunotherapies - 1,100 vials",
            ],
            inventory_value_usd=186000,
            spoilage_threshold=8.0,
            spoilage_mechanism="Denaturation of tertiary protein chains and mRNA lipid nanoparticle degradation above 8.0°C; results in total antigenic potency loss requiring mandatory quarantine and disposal under WHO/FDA Good Distribution Practices.",
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
            vulnerable_items=[
                "Grade-A Pasteurized Whole & Skim Milk Cartons - 1,800 units",
                "Artisan Live-Culture Greek Yoghurts & Kefir - 950 jars",
                "Soft Fresh Cheeses (Fresh Mozzarella, Ricotta, Brie) - 620 kg",
                "Heavy Whipping Cream & Custards - 480 liters",
            ],
            inventory_value_usd=26500,
            spoilage_threshold=6.0,
            spoilage_mechanism="Proliferation of psychrotrophic bacteria (Pseudomonas, Listeria monocytogenes) accelerating casein proteolysis and lactic acidification above 6.0°C; causes premature souring, curdling, and renders stock unsellable within 2-4 hours.",
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
            vulnerable_items=[
                "Clinical Trial Cryo-Preserved Blood Plasma & Serum Units - 850 units",
                "Export-Grade Frozen Wild Salmon & Bluefin Tuna Loins - 1,400 kg",
                "Ultra-Premium Dairy Ice Cream & Gelato Desserts - 1,200 tubs",
                "Prepared Frozen Surgical Bone & Tissue Allografts - 320 units",
            ],
            inventory_value_usd=114000,
            spoilage_threshold=-15.0,
            spoilage_mechanism="Ice crystal recrystallization and Ostwald ripening above -15.0°C causing cellular membrane rupture, freezer burn, and irreversible textural collapse; thawing above -10.0°C triggers active enzymatic degradation and bacterial revival.",
        ),
    ]
}


def get_zone(zone_id: str) -> ZoneConfig:
    try:
        return ZONES[zone_id]
    except KeyError as exc:  # pragma: no cover - callers translate to HTTP 404
        raise KeyError(f"Unknown zone '{zone_id}'") from exc
