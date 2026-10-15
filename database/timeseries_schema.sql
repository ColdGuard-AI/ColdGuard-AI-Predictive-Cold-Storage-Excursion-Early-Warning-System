-- ============================================================================
-- ColdGuard AI - Unified PostgreSQL & TimescaleDB Database Schema
-- Both Ordinary Relational Tables and Time-Stamped Sensor Telemetry live in 
-- the same database: 'coldguard_db'
-- ============================================================================

-- Enable TimescaleDB extension for time-stamped sensor telemetry
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================================================
-- 1. ORDINARY RELATIONAL POSTGRESQL TABLES
-- (Users, Permissions, Storage-Unit Details, Alert Configurations, Companies)
-- ============================================================================

-- 1.1 Permissions Directory
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(255) NOT NULL,
    module VARCHAR(64) NOT NULL
);

-- 1.2 Tenant Companies
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(255) NOT NULL,
    headquarters VARCHAR(255) DEFAULT 'Global Operations',
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Facilities
CREATE TABLE IF NOT EXISTS facilities (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_temp_c DOUBLE PRECISION NOT NULL DEFAULT -25.0,
    safe_temp_min DOUBLE PRECISION NOT NULL DEFAULT -28.0,
    safe_temp_max DOUBLE PRECISION NOT NULL DEFAULT -20.0,
    current_temp_c DOUBLE PRECISION NOT NULL DEFAULT -24.6,
    status VARCHAR(32) DEFAULT 'SAFE',
    status_color VARCHAR(16) DEFAULT '#10B981',
    sensors_active INT DEFAULT 48,
    compressor_status VARCHAR(64) DEFAULT 'DUAL_INVERTER_OPTIMAL',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Storage-Unit Details (Chamber Bays, Deep-Freeze Vaults, Hardening Rooms)
CREATE TABLE IF NOT EXISTS storage_units (
    id VARCHAR(64) PRIMARY KEY,
    facility_id VARCHAR(64) REFERENCES facilities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit_type VARCHAR(128) DEFAULT 'Deep Freeze Cryo Bay',
    refrigerant_type VARCHAR(64) DEFAULT 'R-744 CO2 Transcritical',
    target_temp_c DOUBLE PRECISION NOT NULL DEFAULT -25.0,
    safe_temp_min DOUBLE PRECISION NOT NULL DEFAULT -28.0,
    safe_temp_max DOUBLE PRECISION NOT NULL DEFAULT -20.0,
    current_temp_c DOUBLE PRECISION DEFAULT -24.8,
    capacity_cubic_meters DOUBLE PRECISION DEFAULT 4500.0,
    sensor_nodes_count INT DEFAULT 12,
    compressor_rack_id VARCHAR(64) DEFAULT 'RACK-VFD-01',
    status VARCHAR(32) DEFAULT 'SAFE',
    status_color VARCHAR(16) DEFAULT '#10B981',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Users (Authoritative Database Identities)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    actual_role VARCHAR(64) NOT NULL, -- cold_storage_manager, facility_operator, government_auditor, buyer_retailer
    role_display VARCHAR(128) NOT NULL,
    title VARCHAR(255) DEFAULT '',
    security_clearance VARCHAR(128) DEFAULT 'LEVEL_1_STANDARD',
    approval_status VARCHAR(32) DEFAULT 'APPROVED', -- APPROVED, PENDING_APPROVAL, SUSPENDED
    company_id VARCHAR(64) REFERENCES companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.6 User <-> Facility Memberships (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_facility_memberships (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    facility_id VARCHAR(64) REFERENCES facilities(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, facility_id)
);

-- 1.7 Role <-> Permissions Association
CREATE TABLE IF NOT EXISTS role_permissions (
    role_key VARCHAR(64) NOT NULL,
    permission_id VARCHAR(64) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_key, permission_id)
);

-- 1.8 Alert Configurations (Thresholds, Early Warning Leads, Notification Channels)
CREATE TABLE IF NOT EXISTS alert_configurations (
    id SERIAL PRIMARY KEY,
    facility_id VARCHAR(64) REFERENCES facilities(id) ON DELETE CASCADE,
    unit_id VARCHAR(64) REFERENCES storage_units(id) ON DELETE CASCADE,
    alert_name VARCHAR(255) NOT NULL,
    metric_name VARCHAR(64) NOT NULL, -- temperature, humidity, door_vacuum, compressor_rpm
    warning_threshold DOUBLE PRECISION NOT NULL,
    critical_threshold DOUBLE PRECISION NOT NULL,
    early_warning_lead_time_min INT DEFAULT 60,
    notification_channels VARCHAR(128) DEFAULT 'DASHBOARD,SMS,EMAIL,AUDIT_LEDGER',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.9 Access Requests & Administrator Sign-Off Queue
CREATE TABLE IF NOT EXISTS access_requests (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    requested_role VARCHAR(64) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    facility_id VARCHAR(64) NOT NULL,
    invitation_code VARCHAR(128),
    justification TEXT,
    status VARCHAR(32) DEFAULT 'PENDING_ADMIN_SIGN_OFF',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. TIMESCALEDB TIME-STAMPED SENSOR TELEMETRY HYPERTABLE
-- (Same Database: Optimized for Billions of High-Speed Sensor Telemetry Points)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sensor_telemetry (
    timestamp TIMESTAMPTZ NOT NULL,
    facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id),
    sensor_node_id VARCHAR(64) NOT NULL,
    unit_id VARCHAR(64) REFERENCES storage_units(id),
    ambient_temp_c DOUBLE PRECISION NOT NULL,
    relative_humidity_rh DOUBLE PRECISION NOT NULL DEFAULT 58.0,
    compressor_rpm INT DEFAULT 3480,
    door_vacuum_mbar DOUBLE PRECISION DEFAULT 988.4,
    power_kw DOUBLE PRECISION DEFAULT 42.5,
    excursion_risk_score DOUBLE PRECISION DEFAULT 0.8,
    status VARCHAR(32) DEFAULT 'SAFE'
);

-- Convert standard table to TimescaleDB hypertable partitioned by timestamp (1-day chunks)
SELECT create_hypertable(
    'sensor_telemetry', 
    'timestamp', 
    chunk_time_interval => INTERVAL '1 day', 
    if_not_exists => TRUE
);

-- Multi-column composite index for instant analytical range queries
CREATE INDEX IF NOT EXISTS idx_telemetry_facility_unit_time 
ON sensor_telemetry (facility_id, unit_id, timestamp DESC);

-- Automated compression policy: Compress hypertable chunks older than 7 days
ALTER TABLE sensor_telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'facility_id, unit_id',
    timescaledb.compress_orderby = 'timestamp DESC'
);
SELECT add_compression_policy('sensor_telemetry', INTERVAL '7 days', if_not_exists => TRUE);

-- ============================================================================
-- 3. Continuous Aggregate View (5-Minute Resampled Rollup for AI Excursion Engine)
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_5min_summary
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('5 minutes', timestamp) AS bucket,
    facility_id,
    unit_id,
    AVG(ambient_temp_c) AS avg_temp_c,
    MIN(ambient_temp_c) AS min_temp_c,
    MAX(ambient_temp_c) AS max_temp_c,
    AVG(relative_humidity_rh) AS avg_humidity_rh,
    AVG(door_vacuum_mbar) AS avg_vacuum_mbar,
    MAX(excursion_risk_score) AS peak_excursion_risk
FROM sensor_telemetry
GROUP BY bucket, facility_id, unit_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('telemetry_5min_summary',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => TRUE);
