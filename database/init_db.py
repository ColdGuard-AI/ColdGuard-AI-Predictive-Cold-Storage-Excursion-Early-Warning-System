"""
Database Initialization & Seeding Script for ColdGuard AI
Seeds ordinary relational data (users, permissions, storage-unit details, alert configurations)
and initializes TimescaleDB time-stamped sensor telemetry hypertable.
"""

import sys
import os
import datetime

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from database.connection import engine, Base, SessionLocal, ACTIVE_DB_TYPE
from database.models import (
    Company, 
    Facility, 
    StorageUnit, 
    User, 
    Permission, 
    AlertConfiguration, 
    AccessRequest, 
    SensorTelemetry,
    role_permission_association
)
from sqlalchemy import text

def init_and_seed_db(drop_existing: bool = False):
    print(f"Initializing ColdGuard database schema on [{ACTIVE_DB_TYPE}] (drop_existing={drop_existing})...")
    if drop_existing:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # If connected to PostgreSQL with TimescaleDB, convert sensor_telemetry to hypertable
    if ACTIVE_DB_TYPE == "postgresql_timescale":
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
                conn.execute(text(
                    "SELECT create_hypertable('sensor_telemetry', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);"
                ))
                conn.commit()
                print("TimescaleDB hypertable 'sensor_telemetry' successfully configured.")
        except Exception as e:
            print(f"Notice: TimescaleDB extension setup: {e}")

    db = SessionLocal()

    try:
        # Check if already seeded to prevent wiping or duplicate primary key insertion
        if not drop_existing and db.query(User).count() > 0:
            print(f"Database already contains {db.query(User).count()} registered users. Preserving records.")
            return

        # 1. SEED RELATIONAL PERMISSIONS
        perms = [
            Permission(id="VIEW_TELEMETRY", name="View Real-Time Telemetry", description="Access real-time sensor dials and chiller readings", module="OPERATIONS"),
            Permission(id="OVERRIDE_COMPRESSOR", name="Compressor Override", description="Manual compressor VFD speed control & lead/lag swap", module="OPERATIONS"),
            Permission(id="MODIFY_SETPOINTS", name="Modify Thermal Setpoints", description="Adjust chamber target setpoints and tolerance bands", module="GOVERNANCE"),
            Permission(id="APPROVE_INVITATIONS", name="Approve User Access", description="Authorize pending user invitations and role grants", module="GOVERNANCE"),
            Permission(id="EXPORT_AUDIT_LOGS", name="Export Regulatory Audit Pack", description="Download certified FDA FSMA 204 & HACCP audit packages", module="AUDIT"),
            Permission(id="VIEW_LEDGER", name="View Immutable Cryptographic Ledger", description="Inspect SHA-256 sensor timestamp audit trails", module="AUDIT"),
            Permission(id="DISPATCH_LOT_RELEASE", name="Release Perishable Lots", description="Issue commercial clearance certificates for retail dispatch", module="PROCUREMENT"),
            Permission(id="VIEW_FRESHNESS", name="Inspect Freshness Index", description="Continuous perishable shelf-life score calculation", module="PROCUREMENT")
        ]
        db.add_all(perms)
        db.flush()

        # Seed Role <-> Permission mappings
        role_perms = [
            # Cold Storage Manager (Level 3 Governance)
            ("cold_storage_manager", "VIEW_TELEMETRY"),
            ("cold_storage_manager", "MODIFY_SETPOINTS"),
            ("cold_storage_manager", "APPROVE_INVITATIONS"),
            ("cold_storage_manager", "VIEW_LEDGER"),
            # Facility Operator (Level 2 Machinery)
            ("facility_operator", "VIEW_TELEMETRY"),
            ("facility_operator", "OVERRIDE_COMPRESSOR"),
            # Government / Quality Auditor (Level 4 Audit)
            ("government_auditor", "VIEW_TELEMETRY"),
            ("government_auditor", "VIEW_LEDGER"),
            ("government_auditor", "EXPORT_AUDIT_LOGS"),
            # Buyer / Retailer (Level 1 Lot Clearance)
            ("buyer_retailer", "VIEW_FRESHNESS"),
            ("buyer_retailer", "DISPATCH_LOT_RELEASE")
        ]
        for role_key, perm_id in role_perms:
            db.execute(role_permission_association.insert().values(role_key=role_key, permission_id=perm_id))

        # 2. SEED RELATIONAL COMPANIES
        c1 = Company(
            id="COMP-NORDIC-01",
            name="Nordic Frost Logistics Corp",
            business_type="Commercial Deep-Freeze Logistics",
            headquarters="Reykjavik / Boston Hub",
            verified=True
        )
        c2 = Company(
            id="COMP-ARCTIC-02",
            name="Arctic Vault BioPharma ColdChain",
            business_type="Ultra-Low Cryo BioPharma Storage",
            headquarters="Basel / Stockholm Depot",
            verified=True
        )
        c3 = Company(
            id="COMP-PACIFIC-03",
            name="Pacific Marine Fresh Logistics",
            business_type="Seafood & Perishables Controlled Humidity Hub",
            headquarters="Seattle / Vancouver Gateway",
            verified=True
        )
        db.add_all([c1, c2, c3])
        db.flush()

        # 3. SEED RELATIONAL FACILITIES
        f1 = Facility(
            id="FAC-CHILL-8092",
            company_id="COMP-NORDIC-01",
            name="Bay-8 Cryo Hub (Deep Chill -25°C)",
            target_temp_c=-25.0,
            safe_temp_min=-28.0,
            safe_temp_max=-20.0,
            current_temp_c=-24.6,
            status="SAFE",
            status_color="#10B981",
            sensors_active=48,
            compressor_status="DUAL_INVERTER_OPTIMAL"
        )
        f2 = Facility(
            id="FAC-NORDIC-5501",
            company_id="COMP-NORDIC-01",
            name="Nordic Central Distribution Hub (-18°C)",
            target_temp_c=-18.0,
            safe_temp_min=-22.0,
            safe_temp_max=-15.0,
            current_temp_c=-18.4,
            status="SAFE",
            status_color="#10B981",
            sensors_active=32,
            compressor_status="NOMINAL"
        )
        f3 = Facility(
            id="FAC-ARCTIC-4011",
            company_id="COMP-ARCTIC-02",
            name="Arctic BioPharma Vault A (Ultra-Low -70°C)",
            target_temp_c=-70.0,
            safe_temp_min=-75.0,
            safe_temp_max=-65.0,
            current_temp_c=-71.2,
            status="SAFE",
            status_color="#10B981",
            sensors_active=64,
            compressor_status="CASCADE_CYCLE_NOMINAL"
        )
        f4 = Facility(
            id="FAC-PACIFIC-1022",
            company_id="COMP-PACIFIC-03",
            name="Pacific Seafood Processing Cold Terminal (1.5°C)",
            target_temp_c=1.5,
            safe_temp_min=0.0,
            safe_temp_max=4.0,
            current_temp_c=1.8,
            status="SAFE",
            status_color="#10B981",
            sensors_active=28,
            compressor_status="VARIABLE_SPEED_SAFE"
        )
        db.add_all([f1, f2, f3, f4])
        db.flush()

        # 4. SEED RELATIONAL STORAGE-UNIT DETAILS
        units = [
            StorageUnit(
                id="UNIT-BAY-08A",
                facility_id="FAC-CHILL-8092",
                name="Chamber Bay 08 — Meat & Poultry High-Bay Rack",
                unit_type="Deep Freeze Automated Rack",
                refrigerant_type="R-744 CO2 Transcritical",
                target_temp_c=-25.0,
                safe_temp_min=-28.0,
                safe_temp_max=-20.0,
                current_temp_c=-24.8,
                capacity_cubic_meters=4800.0,
                sensor_nodes_count=12,
                compressor_rack_id="RACK-VFD-01",
                status="SAFE"
            ),
            StorageUnit(
                id="UNIT-BAY-08B",
                facility_id="FAC-CHILL-8092",
                name="Chamber Bay 08 — Frozen Seafood Pallet Zone",
                unit_type="Deep Freeze Automated Rack",
                refrigerant_type="R-744 CO2 Transcritical",
                target_temp_c=-25.0,
                safe_temp_min=-28.0,
                safe_temp_max=-20.0,
                current_temp_c=-24.9,
                capacity_cubic_meters=4200.0,
                sensor_nodes_count=12,
                compressor_rack_id="RACK-VFD-01",
                status="SAFE"
            ),
            StorageUnit(
                id="UNIT-BIO-CRYO-01",
                facility_id="FAC-ARCTIC-4011",
                name="BioPharma Vault Cryo-Chamber A1",
                unit_type="Ultra-Low Cryogenic Storage",
                refrigerant_type="Cascade Liquid Nitrogen / R-23",
                target_temp_c=-70.0,
                safe_temp_min=-75.0,
                safe_temp_max=-65.0,
                current_temp_c=-71.2,
                capacity_cubic_meters=1800.0,
                sensor_nodes_count=24,
                compressor_rack_id="RACK-CASCADE-01",
                status="SAFE"
            ),
            StorageUnit(
                id="UNIT-PACIFIC-SEA-01",
                facility_id="FAC-PACIFIC-1022",
                name="Pacific Fresh Seafood Cold Processing Room",
                unit_type="Controlled Atmosphere High-Humidity",
                refrigerant_type="R-134a Glycol Chilled Loop",
                target_temp_c=1.5,
                safe_temp_min=0.0,
                safe_temp_max=4.0,
                current_temp_c=1.8,
                capacity_cubic_meters=3200.0,
                sensor_nodes_count=16,
                compressor_rack_id="RACK-GLYCOL-01",
                status="SAFE"
            )
        ]
        db.add_all(units)
        db.flush()

        # 5. SEED RELATIONAL ALERT CONFIGURATIONS
        alerts = [
            AlertConfiguration(
                facility_id="FAC-CHILL-8092",
                unit_id="UNIT-BAY-08A",
                alert_name="Thermal Excursion Predictive Warning (-20°C Threshold)",
                metric_name="temperature",
                warning_threshold=-21.5,
                critical_threshold=-20.0,
                early_warning_lead_time_min=60,
                notification_channels="DASHBOARD,SMS,EMAIL,AUDIT_LEDGER",
                is_active=True
            ),
            AlertConfiguration(
                facility_id="FAC-CHILL-8092",
                unit_id="UNIT-BAY-08A",
                alert_name="Chamber Negative Door Seal Vacuum Depressurization",
                metric_name="door_vacuum",
                warning_threshold=960.0,
                critical_threshold=940.0,
                early_warning_lead_time_min=30,
                notification_channels="DASHBOARD,SMS",
                is_active=True
            ),
            AlertConfiguration(
                facility_id="FAC-ARCTIC-4011",
                unit_id="UNIT-BIO-CRYO-01",
                alert_name="Ultra-Low Cryo Excursion Breach (-65°C Threshold)",
                metric_name="temperature",
                warning_threshold=-66.5,
                critical_threshold=-65.0,
                early_warning_lead_time_min=90,
                notification_channels="DASHBOARD,SMS,EMAIL,PAGER,AUDIT_LEDGER",
                is_active=True
            )
        ]
        db.add_all(alerts)
        db.flush()

        # 6. SEED RELATIONAL USERS
        u1 = User(
            email="manager@coldguard.ai",
            password_hash="Manager123!",
            name="Elena Rostova",
            actual_role="cold_storage_manager",
            role_display="Cold Storage Manager",
            company_id="COMP-NORDIC-01",
            approval_status="APPROVED",
            title="Director of Cold Storage Operations",
            security_clearance="LEVEL_3_FULL_FACILITY_OVERVIEW"
        )
        u1.assigned_facilities = [f1, f2]

        u2 = User(
            email="operator@coldguard.ai",
            password_hash="Operator123!",
            name="Marcus Vance",
            actual_role="facility_operator",
            role_display="Facility Operator",
            company_id="COMP-NORDIC-01",
            approval_status="APPROVED",
            title="Senior Cryogenic Plant Operator",
            security_clearance="LEVEL_2_COMPRESSOR_CHILLER_CONTROL"
        )
        u2.assigned_facilities = [f1]

        u3 = User(
            email="auditor@fda-quality.gov",
            password_hash="Auditor123!",
            name="Dr. Aris Thorne",
            actual_role="government_auditor",
            role_display="Government / Quality Auditor",
            company_id="COMP-ARCTIC-02",
            approval_status="APPROVED",
            title="Lead HACCP & FSMA 204 Regulatory Inspector",
            security_clearance="LEVEL_4_READONLY_IMMUTABLE_AUDIT_LOGS"
        )
        u3.assigned_facilities = [f1, f3, f4]

        u4 = User(
            email="buyer@freshmart-global.com",
            password_hash="Buyer123!",
            name="Sarah Lin",
            actual_role="buyer_retailer",
            role_display="Buyer / Retailer",
            company_id="COMP-PACIFIC-03",
            approval_status="APPROVED",
            title="Cold-Chain Procurement & Quality Specialist",
            security_clearance="LEVEL_1_LOT_FRESHNESS_VERIFICATION"
        )
        u4.assigned_facilities = [f4]

        # Edge Cases
        u5 = User(
            email="pending.user@coldguard.ai",
            password_hash="Pending123!",
            name="Devon Cross",
            actual_role="facility_operator",
            role_display="Facility Operator",
            company_id="COMP-NORDIC-01",
            approval_status="PENDING_APPROVAL",
            title="Apprentice Technician",
            security_clearance="NONE_PENDING_APPROVAL"
        )
        u5.assigned_facilities = [f1]

        u6 = User(
            email="pacific.operator@coldguard.ai",
            password_hash="Pacific123!",
            name="Kenji Sato",
            actual_role="facility_operator",
            role_display="Facility Operator",
            company_id="COMP-PACIFIC-03",
            approval_status="APPROVED",
            title="Refrigeration Specialist",
            security_clearance="LEVEL_2_PACIFIC_FACILITY_ONLY"
        )
        u6.assigned_facilities = [f4]

        db.add_all([u1, u2, u3, u4, u5, u6])
        db.flush()

        # 7. SEED TIMESCALEDB TIME-STAMPED SENSOR TELEMETRY HYPERTABLE
        now = datetime.datetime.utcnow()
        telemetry_samples = []
        for i in range(10):
            t = now - datetime.timedelta(minutes=i * 5)
            telemetry_samples.append(
                SensorTelemetry(
                    timestamp=t,
                    facility_id="FAC-CHILL-8092",
                    sensor_node_id=f"SN-CRYOMESH-0{i%4 + 1}",
                    unit_id="UNIT-BAY-08A",
                    ambient_temp_c=round(-24.8 + 0.1 * ((i % 3) - 1), 2),
                    relative_humidity_rh=59.1,
                    compressor_rpm=3480,
                    door_vacuum_mbar=988.4,
                    power_kw=42.1,
                    excursion_risk_score=0.8,
                    status="SAFE"
                )
            )
        db.add_all(telemetry_samples)

        db.commit()
        print("Ordinary relational data and TimescaleDB sensor telemetry hypertable seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_and_seed_db()
