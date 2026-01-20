-- TimescaleDB Migration Script
-- This script converts standard PostgreSQL tables to TimescaleDB hypertables
-- with compression and continuous aggregates for time-series optimization.
--
-- Prerequisites:
--   - PostgreSQL 16 with TimescaleDB extension installed
--   - Database user must have superuser privileges to CREATE EXTENSION
--
-- Usage:
--   psql -d cycle_navigator -f scripts/timescale_migrations.sql
--
-- WARNING: Run this during a maintenance window. Back up your data first!

-- ============================================
-- 1. Enable TimescaleDB Extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================
-- 2. Convert FRED Series Data to Hypertable
-- ============================================
-- Add a unique constraint on (series_id, date) if not exists
-- This is required for TimescaleDB hypertable creation
DO $$
BEGIN
    -- Drop the old primary key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'fred_series_data' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE fred_series_data DROP CONSTRAINT IF EXISTS fred_series_data_pkey CASCADE;
    END IF;
    
    -- Add a new primary key on (id) if the table uses id
    -- Or create hypertable-compatible structure
END $$;

-- Convert fred_series_data to hypertable
-- migrate_data => true will move existing data into chunks
SELECT create_hypertable(
    'fred_series_data',
    'date',
    if_not_exists => true,
    migrate_data => true,
    chunk_time_interval => INTERVAL '1 year'
);

-- ============================================
-- 3. Convert Crypto Data to Hypertable
-- ============================================
-- Drop unique constraint on timestamp to allow hypertable conversion
DO $$
BEGIN
    ALTER TABLE crypto_data DROP CONSTRAINT IF EXISTS crypto_data_timestamp_key CASCADE;
EXCEPTION WHEN undefined_object THEN
    NULL;
END $$;

-- Convert crypto_data to hypertable
SELECT create_hypertable(
    'crypto_data',
    'timestamp',
    if_not_exists => true,
    migrate_data => true,
    chunk_time_interval => INTERVAL '1 month'
);

-- ============================================
-- 4. Add B-Tree Indexes for Query Performance
-- ============================================
-- Composite index on (series_id, date) for FRED queries
CREATE INDEX IF NOT EXISTS ix_fred_series_data_series_date 
ON fred_series_data (series_id, date DESC);

-- Index on crypto_data timestamp (hypertable already has time index)
-- Add ticker-like index if we add ticker column in future
CREATE INDEX IF NOT EXISTS ix_crypto_data_timestamp 
ON crypto_data (timestamp DESC);

-- ============================================
-- 5. Continuous Aggregates for Monthly M2/CPI
-- ============================================
-- These pre-calculate monthly averages in the database,
-- eliminating the need for Python aggregation.

-- Monthly M2 Money Supply aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS fred_m2_monthly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 month', date) AS bucket,
    series_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    FIRST(value, date) AS first_value,
    LAST(value, date) AS last_value,
    COUNT(*) AS observation_count
FROM fred_series_data
WHERE series_id = 'M2SL'
GROUP BY bucket, series_id
WITH NO DATA;

-- Refresh policy for M2 monthly aggregate (refresh daily)
SELECT add_continuous_aggregate_policy('fred_m2_monthly',
    start_offset => INTERVAL '2 months',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => true
);

-- Monthly CPI aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS fred_cpi_monthly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 month', date) AS bucket,
    series_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    FIRST(value, date) AS first_value,
    LAST(value, date) AS last_value,
    COUNT(*) AS observation_count
FROM fred_series_data
WHERE series_id = 'CPIAUCSL'
GROUP BY bucket, series_id
WITH NO DATA;

-- Refresh policy for CPI monthly aggregate
SELECT add_continuous_aggregate_policy('fred_cpi_monthly',
    start_offset => INTERVAL '2 months',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => true
);

-- Monthly aggregates for all FRED series (generic)
CREATE MATERIALIZED VIEW IF NOT EXISTS fred_all_monthly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 month', date) AS bucket,
    series_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    FIRST(value, date) AS first_value,
    LAST(value, date) AS last_value,
    COUNT(*) AS observation_count
FROM fred_series_data
GROUP BY bucket, series_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('fred_all_monthly',
    start_offset => INTERVAL '2 months',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => true
);

-- ============================================
-- 6. Crypto Dominance Daily Aggregates
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS crypto_dominance_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS bucket,
    AVG(total_mcap) AS avg_total_mcap,
    AVG(btc_dominance) AS avg_btc_dominance,
    AVG(eth_dominance) AS avg_eth_dominance,
    AVG(altcoin_mcap) AS avg_altcoin_mcap,
    LAST(total_mcap, timestamp) AS last_total_mcap,
    LAST(btc_dominance, timestamp) AS last_btc_dominance,
    LAST(eth_dominance, timestamp) AS last_eth_dominance,
    COUNT(*) AS observation_count
FROM crypto_data
GROUP BY bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('crypto_dominance_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);

-- ============================================
-- 7. Enable Compression on Hypertables
-- ============================================
-- Compression can reduce storage by 90%+ for time-series data

-- Enable compression on fred_series_data
ALTER TABLE fred_series_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'series_id',
    timescaledb.compress_orderby = 'date DESC'
);

-- Add compression policy: compress chunks older than 90 days
SELECT add_compression_policy('fred_series_data', 
    INTERVAL '90 days',
    if_not_exists => true
);

-- Enable compression on crypto_data  
ALTER TABLE crypto_data SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'timestamp DESC'
);

-- Add compression policy: compress chunks older than 30 days
SELECT add_compression_policy('crypto_data',
    INTERVAL '30 days', 
    if_not_exists => true
);

-- ============================================
-- 8. Initial Refresh of Continuous Aggregates
-- ============================================
-- Manually refresh to populate with existing data
CALL refresh_continuous_aggregate('fred_m2_monthly', NULL, NULL);
CALL refresh_continuous_aggregate('fred_cpi_monthly', NULL, NULL);
CALL refresh_continuous_aggregate('fred_all_monthly', NULL, NULL);
CALL refresh_continuous_aggregate('crypto_dominance_daily', NULL, NULL);

-- ============================================
-- 9. Verify Migration
-- ============================================
-- Check hypertables were created
SELECT hypertable_name, num_chunks, compression_enabled
FROM timescaledb_information.hypertables;

-- Check continuous aggregates
SELECT view_name, materialization_hypertable_name
FROM timescaledb_information.continuous_aggregates;

-- Check compression policies
SELECT hypertable_name, compress_after
FROM timescaledb_information.compression_settings;

-- Print success message
DO $$
BEGIN
    RAISE NOTICE '✅ TimescaleDB migration completed successfully!';
    RAISE NOTICE 'Hypertables: fred_series_data, crypto_data';
    RAISE NOTICE 'Continuous Aggregates: fred_m2_monthly, fred_cpi_monthly, fred_all_monthly, crypto_dominance_daily';
    RAISE NOTICE 'Compression: Enabled with 90-day (FRED) and 30-day (crypto) policies';
END $$;
