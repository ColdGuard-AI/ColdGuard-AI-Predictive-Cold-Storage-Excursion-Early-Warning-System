"""
ColdGuard AI Unified Database Models (TimescaleDB / PostgreSQL)
- Relational PostgreSQL Tables: Users, Permissions, Storage-Unit Details, Alert Configurations, Companies, Access Requests
- TimescaleDB Hypertables: High-Volume Time-Stamped Sensor Telemetry
"""

import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Table,
    Text,
    PrimaryKeyConstraint
)
from sqlalchemy.orm import relationship
from database.connection import Base

# Many-to-Many Association: Users <-> Facilities
user_facility_association = Table(
    "user_facility_memberships",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("facility_id", String(64), ForeignKey("facilities.id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", DateTime, default=datetime.datetime.utcnow)
)

# Many-to-Many Association: Roles <-> Permissions
role_permission_association = Table(
    "role_permissions",
    Base.metadata,
    Column("role_key", String(64), primary_key=True),
    Column("permission_id", String(64), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
)

# ============================================================================
# 1. ORDINARY RELATIONAL POSTGRESQL TABLES
# ============================================================================

class Permission(Base):
    """Granular permission definitions"""
    __tablename__ = "permissions"

    id = Column(String(64), primary_key=True) # e.g. VIEW_TELEMETRY, OVERRIDE_COMPRESSOR
    name = Column(String(128), nullable=False)
    description = Column(String(255), nullable=False)
    module = Column(String(64), nullable=False) # OPERATIONS, GOVERNANCE, AUDIT, PROCUREMENT

class Company(Base):
    """Tenant company entities"""
    __tablename__ = "companies"

    id = Column(String(64), primary_key=True, index=True) # e.g. COMP-NORDIC-01
    name = Column(String(255), nullable=False)
    business_type = Column(String(255), nullable=False)
    headquarters = Column(String(255), default="Global Operations")
    verified = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    facilities = relationship("Facility", back_populates="company", cascade="all, delete-orphan")
    users = relationship("User", back_populates="company")

class Facility(Base):
    """Cold storage facility locations"""
    __tablename__ = "facilities"

    id = Column(String(64), primary_key=True, index=True) # e.g. FAC-CHILL-8092
    company_id = Column(String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    target_temp_c = Column(Float, nullable=False, default=-25.0)
    safe_temp_min = Column(Float, nullable=False, default=-28.0)
    safe_temp_max = Column(Float, nullable=False, default=-20.0)
    current_temp_c = Column(Float, nullable=False, default=-24.6)
    status = Column(String(32), default="SAFE")
    status_color = Column(String(16), default="#10B981")
    sensors_active = Column(Integer, default=48)
    compressor_status = Column(String(64), default="DUAL_INVERTER_OPTIMAL")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="facilities")
    storage_units = relationship("StorageUnit", back_populates="facility", cascade="all, delete-orphan")
    members = relationship("User", secondary=user_facility_association, back_populates="assigned_facilities")
    alert_configurations = relationship("AlertConfiguration", back_populates="facility", cascade="all, delete-orphan")

class StorageUnit(Base):
    """
    Storage-Unit Details (Chamber Bays, Deep-Freeze Vaults, Hardening Rooms)
    Kept in ordinary relational PostgreSQL tables
    """
    __tablename__ = "storage_units"

    id = Column(String(64), primary_key=True, index=True) # e.g. UNIT-BAY-08A
    facility_id = Column(String(64), ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    unit_type = Column(String(128), default="Deep Freeze Cryo Bay")
    refrigerant_type = Column(String(64), default="R-744 CO2 Transcritical")
    target_temp_c = Column(Float, nullable=False, default=-25.0)
    safe_temp_min = Column(Float, nullable=False, default=-28.0)
    safe_temp_max = Column(Float, nullable=False, default=-20.0)
    current_temp_c = Column(Float, default=-24.8)
    capacity_cubic_meters = Column(Float, default=4500.0)
    sensor_nodes_count = Column(Integer, default=12)
    compressor_rack_id = Column(String(64), default="RACK-VFD-01")
    status = Column(String(32), default="SAFE")
    status_color = Column(String(16), default="#10B981")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    facility = relationship("Facility", back_populates="storage_units")
    alert_configurations = relationship("AlertConfiguration", back_populates="storage_unit", cascade="all, delete-orphan")

class User(Base):
    """User identities and authoritative role assignments"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=True)
    actual_role = Column(String(64), nullable=False) # cold_storage_manager, facility_operator, government_auditor, buyer_retailer
    role_display = Column(String(128), nullable=False)
    title = Column(String(255), default="")
    security_clearance = Column(String(128), default="LEVEL_1_STANDARD")
    approval_status = Column(String(32), default="APPROVED") # APPROVED, PENDING_APPROVAL, REJECTED, SUSPENDED
    must_change_password = Column(Boolean, default=False)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_reason = Column(String(512), nullable=True)
    company_id = Column(String(64), ForeignKey("companies.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="users")
    assigned_facilities = relationship("Facility", secondary=user_facility_association, back_populates="members")

class AlertConfiguration(Base):
    """
    Alert Configurations & Predictive Excursion Thresholds
    Kept in ordinary relational PostgreSQL tables
    """
    __tablename__ = "alert_configurations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    facility_id = Column(String(64), ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False)
    unit_id = Column(String(64), ForeignKey("storage_units.id", ondelete="CASCADE"), nullable=True)
    alert_name = Column(String(255), nullable=False)
    metric_name = Column(String(64), nullable=False) # temperature, humidity, door_vacuum, compressor_rpm
    warning_threshold = Column(Float, nullable=False)
    critical_threshold = Column(Float, nullable=False)
    early_warning_lead_time_min = Column(Integer, default=60)
    notification_channels = Column(String(128), default="DASHBOARD,SMS,EMAIL,AUDIT_LEDGER")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    facility = relationship("Facility", back_populates="alert_configurations")
    storage_unit = relationship("StorageUnit", back_populates="alert_configurations")

class AccessRequest(Base):
    """Administrator-Approved Invitation / Registration Queue"""
    __tablename__ = "access_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column(String(64), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=True)
    password_hash = Column(String(255), nullable=False)
    requested_role = Column(String(64), nullable=False)
    company_id = Column(String(64), nullable=False)
    facility_id = Column(String(64), nullable=False)
    invitation_code = Column(String(128), nullable=True)
    justification = Column(Text, nullable=True)
    status = Column(String(32), default="PENDING_ADMIN_SIGN_OFF")
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# ============================================================================
# 2. TIMESCALEDB TIME-STAMPED SENSOR TELEMETRY HYPERTABLE
# Partitioned by timestamp for high-volume time-series ingestion
# ============================================================================

class SensorTelemetry(Base):
    """
    Time-stamped Sensor Telemetry
    Managed as a TimescaleDB hypertable in PostgreSQL
    """
    __tablename__ = "sensor_telemetry"

    # In TimescaleDB, primary key or partition key is (timestamp, facility_id, sensor_node_id)
    timestamp = Column(DateTime, nullable=False, primary_key=True, default=datetime.datetime.utcnow)
    facility_id = Column(String(64), nullable=False, primary_key=True)
    sensor_node_id = Column(String(64), nullable=False, primary_key=True)
    unit_id = Column(String(64), nullable=True) # Linked to storage_units.id
    ambient_temp_c = Column(Float, nullable=False)
    relative_humidity_rh = Column(Float, nullable=False, default=58.0)
    compressor_rpm = Column(Integer, default=3480)
    door_vacuum_mbar = Column(Float, default=988.4)
    power_kw = Column(Float, default=42.5)
    excursion_risk_score = Column(Float, default=0.8) # 0.0 - 100.0%
    status = Column(String(32), default="SAFE")
