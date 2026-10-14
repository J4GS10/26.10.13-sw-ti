import pytest

from app.core.config import Settings


def _settings(**overrides):
    values = {
        "POSTGRES_SERVER": "oracle",
        "POSTGRES_USER": "ci",
        "POSTGRES_PASSWORD": "ci",
        "POSTGRES_DB": "ORCLPDB1",
        "SECRET_KEY": "x" * 32,
        "ENVIRONMENT": "production",
        **overrides,
    }
    return Settings(**values)


def test_refresh_policy_defaults_to_30_days_but_idle_is_12_hours():
    s = _settings()
    assert s.REFRESH_TOKEN_EXPIRE_DAYS == 30
    assert s.SESSION_ABSOLUTE_MAX_HOURS == 720
    assert s.SESSION_IDLE_TIMEOUT_MINUTES == 720
    assert s.REFRESH_COOKIE_PERSISTENT is False


def test_refresh_policy_rejects_more_than_30_days():
    with pytest.raises(ValueError):
        _settings(REFRESH_TOKEN_EXPIRE_DAYS=31)


def test_refresh_policy_rejects_idle_longer_than_absolute():
    with pytest.raises(ValueError):
        _settings(SESSION_IDLE_TIMEOUT_MINUTES=721, SESSION_ABSOLUTE_MAX_HOURS=12)
