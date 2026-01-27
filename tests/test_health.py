"""
Unit tests for health check service.

Tests the health check functionality that validates critical application
dependencies (database, Redis, schema, environment configuration).
"""

from unittest.mock import Mock, patch, MagicMock
import pytest

from backend.health import HealthCheckService, HealthCheckResult


@pytest.fixture
def health_service():
    """Create a HealthCheckService instance for testing."""
    return HealthCheckService()


class TestHealthCheckResult:
    """Test HealthCheckResult dataclass."""
    
    def test_result_creation(self):
        """Test creating a HealthCheckResult."""
        result = HealthCheckResult(
            status="ok",
            message="Test message",
            details={"key": "value"}
        )
        assert result.status == "ok"
        assert result.message == "Test message"
        assert result.details == {"key": "value"}
    
    def test_result_without_details(self):
        """Test creating a HealthCheckResult without details."""
        result = HealthCheckResult(status="error", message="Error message")
        assert result.status == "error"
        assert result.message == "Error message"
        assert result.details is None


class TestEnvConfigCheck:
    """Test environment configuration checks."""
    
    @patch('backend.health.config')
    def test_all_config_present(self, mock_config, health_service):
        """Test when all configuration is present."""
        mock_config.DATABASE_URL = "postgresql://test"
        mock_config.REDIS_URL = "redis://test"
        mock_config.FRED_API_KEY = "test_fred_key"
        mock_config.COINGECKO_API_KEY = "test_coingecko_key"
        
        results = health_service.check_env_config()
        
        assert all(r.status == "ok" for r in results.values())
        assert len(results) == 4
    
    @patch('backend.health.config')
    def test_missing_database_url(self, mock_config, health_service):
        """Test when DATABASE_URL is missing."""
        mock_config.DATABASE_URL = None
        mock_config.REDIS_URL = "redis://test"
        mock_config.FRED_API_KEY = "test_key"
        mock_config.COINGECKO_API_KEY = "test_key"
        
        results = health_service.check_env_config()
        
        assert results["DATABASE_URL"].status == "error"
        assert "not set" in results["DATABASE_URL"].message
    
    @patch('backend.health.config')
    def test_missing_redis_url(self, mock_config, health_service):
        """Test when REDIS_URL is missing."""
        mock_config.DATABASE_URL = "postgresql://test"
        mock_config.REDIS_URL = None
        mock_config.FRED_API_KEY = "test_key"
        mock_config.COINGECKO_API_KEY = "test_key"
        
        results = health_service.check_env_config()
        
        assert results["REDIS_URL"].status == "error"
        assert "not set" in results["REDIS_URL"].message
    
    @patch('backend.health.config')
    def test_missing_optional_keys(self, mock_config, health_service):
        """Test when optional API keys are missing (warnings only)."""
        mock_config.DATABASE_URL = "postgresql://test"
        mock_config.REDIS_URL = "redis://test"
        mock_config.FRED_API_KEY = None
        mock_config.COINGECKO_API_KEY = None
        
        results = health_service.check_env_config()
        
        assert results["FRED_API_KEY"].status == "warning"
        assert results["COINGECKO_API_KEY"].status == "warning"
        assert results["DATABASE_URL"].status == "ok"
        assert results["REDIS_URL"].status == "ok"


class TestDatabaseCheck:
    """Test database connectivity checks."""
    
    @patch('backend.health.create_engine')
    @patch('backend.health.config')
    def test_database_connection_success(self, mock_config, mock_create_engine, health_service):
        """Test successful database connection."""
        mock_config.DATABASE_URL = "postgresql://test"
        
        # Mock database connection and version query
        mock_conn = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = "PostgreSQL 14.5, compiled by Visual C++ build 1914, 64-bit"
        mock_conn.execute.return_value = mock_result
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_engine = MagicMock()
        mock_engine.connect.return_value = mock_conn
        mock_create_engine.return_value = mock_engine
        
        result = health_service.check_database()
        
        assert result.status == "ok"
        assert "OK" in result.message
        assert result.details is not None
        assert "version" in result.details
        assert "PostgreSQL 14.5" in result.details["version"]
    
    @patch('backend.health.create_engine')
    @patch('backend.health.config')
    def test_database_connection_failure(self, mock_config, mock_create_engine, health_service):
        """Test database connection failure."""
        mock_config.DATABASE_URL = "postgresql://test"
        mock_create_engine.side_effect = Exception("Connection refused")
        
        result = health_service.check_database()
        
        assert result.status == "error"
        assert "failed" in result.message.lower()
        assert result.details is not None
        assert "error" in result.details


class TestRedisCheck:
    """Test Redis connectivity checks."""
    
    @patch('backend.health.redis')
    @patch('backend.health.config')
    def test_redis_connection_success(self, mock_config, mock_redis, health_service):
        """Test successful Redis connection."""
        mock_config.REDIS_URL = "redis://test"
        
        # Mock Redis client
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.info.return_value = {
            'redis_version': '7.0.5',
            'used_memory_human': '1.2M'
        }
        mock_redis.from_url.return_value = mock_client
        
        result = health_service.check_redis()
        
        assert result.status == "ok"
        assert "OK" in result.message
        assert result.details is not None
        assert result.details["version"] == "7.0.5"
        assert result.details["used_memory"] == "1.2M"
    
    @patch('backend.health.redis')
    @patch('backend.health.config')
    def test_redis_connection_failure(self, mock_config, mock_redis, health_service):
        """Test Redis connection failure."""
        mock_config.REDIS_URL = "redis://test"
        mock_redis.from_url.side_effect = Exception("Connection refused")
        
        result = health_service.check_redis()
        
        assert result.status == "error"
        assert "failed" in result.message.lower()
        assert result.details is not None
        assert "error" in result.details


class TestTablesCheck:
    """Test database table validation checks."""
    
    @patch('backend.health.inspect')
    @patch('backend.health.create_engine')
    @patch('backend.health.config')
    def test_all_tables_exist_with_data(self, mock_config, mock_create_engine, mock_inspect, health_service):
        """Test when all required tables exist and have data."""
        mock_config.DATABASE_URL = "postgresql://test"
        
        # Mock inspector
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = [
            'fred_series_data',
            'fred_series_metadata',
            'crypto_data',
            'crypto_metadata'
        ]
        mock_inspect.return_value = mock_inspector
        
        # Mock database connection for count queries
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = [
            Mock(scalar=lambda: 1000),  # fred_count
            Mock(scalar=lambda: 500),   # crypto_count
        ]
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_engine = MagicMock()
        mock_engine.connect.return_value = mock_conn
        mock_create_engine.return_value = mock_engine
        
        result = health_service.check_tables()
        
        assert result.status == "ok"
        assert "required tables exist" in result.message
        assert result.details is not None
        assert result.details["record_counts"]["fred_series_data"] == 1000
        assert result.details["record_counts"]["crypto_data"] == 500
        assert result.details["warnings"] is None
    
    @patch('backend.health.inspect')
    @patch('backend.health.create_engine')
    @patch('backend.health.config')
    def test_missing_tables(self, mock_config, mock_create_engine, mock_inspect, health_service):
        """Test when some required tables are missing."""
        mock_config.DATABASE_URL = "postgresql://test"
        
        # Mock inspector with missing tables
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = [
            'fred_series_data',
            'fred_series_metadata'
        ]  # Missing crypto tables
        mock_inspect.return_value = mock_inspector
        
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine
        
        result = health_service.check_tables()
        
        assert result.status == "error"
        assert "Missing database tables" in result.message
        assert result.details is not None
        assert "crypto_data" in result.details["missing_tables"]
        assert "crypto_metadata" in result.details["missing_tables"]
    
    @patch('backend.health.inspect')
    @patch('backend.health.create_engine')
    @patch('backend.health.config')
    def test_tables_exist_no_data(self, mock_config, mock_create_engine, mock_inspect, health_service):
        """Test when tables exist but have no data."""
        mock_config.DATABASE_URL = "postgresql://test"
        
        # Mock inspector
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = [
            'fred_series_data',
            'fred_series_metadata',
            'crypto_data',
            'crypto_metadata'
        ]
        mock_inspect.return_value = mock_inspector
        
        # Mock database connection with zero counts
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = [
            Mock(scalar=lambda: 0),  # fred_count
            Mock(scalar=lambda: 0),  # crypto_count
        ]
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_engine = MagicMock()
        mock_engine.connect.return_value = mock_conn
        mock_create_engine.return_value = mock_engine
        
        result = health_service.check_tables()
        
        assert result.status == "warning"
        assert "required tables exist" in result.message
        assert result.details is not None
        assert len(result.details["warnings"]) == 2  # Both FRED and crypto warnings


class TestRunAllChecks:
    """Test the comprehensive health check method."""
    
    @patch.object(HealthCheckService, 'check_tables')
    @patch.object(HealthCheckService, 'check_redis')
    @patch.object(HealthCheckService, 'check_database')
    def test_all_checks_pass(self, mock_db, mock_redis, mock_tables, health_service):
        """Test when all health checks pass."""
        mock_db.return_value = HealthCheckResult(
            status="ok",
            message="Database OK",
            details={"version": "PostgreSQL 14.5"}
        )
        mock_redis.return_value = HealthCheckResult(
            status="ok",
            message="Redis OK",
            details={"version": "7.0.5"}
        )
        mock_tables.return_value = HealthCheckResult(
            status="ok",
            message="All tables exist"
        )
        
        results = health_service.run_all_checks()
        
        assert results["status"] == "healthy"
        assert results["services"]["database"]["status"] == "ok"
        assert results["services"]["redis"]["status"] == "ok"
        assert results["services"]["tables"]["status"] == "ok"
    
    @patch.object(HealthCheckService, 'check_tables')
    @patch.object(HealthCheckService, 'check_redis')
    @patch.object(HealthCheckService, 'check_database')
    def test_database_fails(self, mock_db, mock_redis, mock_tables, health_service):
        """Test when database check fails."""
        mock_db.return_value = HealthCheckResult(
            status="error",
            message="Database connection failed",
            details={"error": "Connection refused"}
        )
        mock_redis.return_value = HealthCheckResult(
            status="ok",
            message="Redis OK"
        )
        mock_tables.return_value = HealthCheckResult(
            status="ok",
            message="All tables exist"
        )
        
        results = health_service.run_all_checks()
        
        assert results["status"] == "degraded"
        assert results["services"]["database"]["status"] == "error"
        assert results["services"]["redis"]["status"] == "ok"
    
    @patch.object(HealthCheckService, 'check_tables')
    @patch.object(HealthCheckService, 'check_redis')
    @patch.object(HealthCheckService, 'check_database')
    def test_multiple_failures(self, mock_db, mock_redis, mock_tables, health_service):
        """Test when multiple checks fail."""
        mock_db.return_value = HealthCheckResult(status="error", message="DB failed")
        mock_redis.return_value = HealthCheckResult(status="error", message="Redis failed")
        mock_tables.return_value = HealthCheckResult(status="error", message="Tables missing")
        
        results = health_service.run_all_checks()
        
        assert results["status"] == "degraded"
        assert results["services"]["database"]["status"] == "error"
        assert results["services"]["redis"]["status"] == "error"
        assert results["services"]["tables"]["status"] == "error"


class TestLogStartupChecks:
    """Test startup validation logging."""
    
    @patch.object(HealthCheckService, 'check_tables')
    @patch.object(HealthCheckService, 'check_redis')
    @patch.object(HealthCheckService, 'check_database')
    @patch.object(HealthCheckService, 'check_env_config')
    def test_startup_checks_pass(self, mock_env, mock_db, mock_redis, mock_tables, health_service):
        """Test startup checks when everything passes."""
        mock_env.return_value = {
            "DATABASE_URL": HealthCheckResult(status="ok", message="Configured"),
            "REDIS_URL": HealthCheckResult(status="ok", message="Configured"),
            "FRED_API_KEY": HealthCheckResult(status="ok", message="Configured"),
            "COINGECKO_API_KEY": HealthCheckResult(status="ok", message="Configured"),
        }
        mock_db.return_value = HealthCheckResult(status="ok", message="DB OK")
        mock_redis.return_value = HealthCheckResult(status="ok", message="Redis OK")
        mock_tables.return_value = HealthCheckResult(status="ok", message="Tables OK")
        
        result = health_service.log_startup_checks()
        
        assert result is True
    
    @patch.object(HealthCheckService, 'check_tables')
    @patch.object(HealthCheckService, 'check_redis')
    @patch.object(HealthCheckService, 'check_database')
    @patch.object(HealthCheckService, 'check_env_config')
    def test_startup_checks_fail(self, mock_env, mock_db, mock_redis, mock_tables, health_service):
        """Test startup checks when critical checks fail."""
        mock_env.return_value = {
            "DATABASE_URL": HealthCheckResult(status="error", message="Not set"),
            "REDIS_URL": HealthCheckResult(status="ok", message="Configured"),
            "FRED_API_KEY": HealthCheckResult(status="ok", message="Configured"),
            "COINGECKO_API_KEY": HealthCheckResult(status="ok", message="Configured"),
        }
        mock_db.return_value = HealthCheckResult(status="ok", message="DB OK")
        mock_redis.return_value = HealthCheckResult(status="ok", message="Redis OK")
        mock_tables.return_value = HealthCheckResult(status="ok", message="Tables OK")
        
        result = health_service.log_startup_checks()
        
        assert result is False
