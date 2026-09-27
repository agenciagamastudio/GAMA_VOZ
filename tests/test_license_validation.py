"""
Unit tests for License Validation System
"""

import pytest
import sys
import os
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.lemon_squeezy import LemonSqueezyClient
from models import LicenseKeyModel


class TestLemonSqueezyClient:
    """Tests for Lemon Squeezy API client"""

    def test_validate_key_missing_api_key(self):
        """Test validation when API key is not configured"""
        with patch('services.lemon_squeezy.LS_API_KEY', None):
            result = LemonSqueezyClient.validate_key('gm_test_key')
            assert result['valid'] is False
            assert result['status'] == 'invalid'
            assert 'not configured' in result['error']

    def test_validate_key_invalid_format(self):
        """Test validation with invalid key format"""
        with patch('services.lemon_squeezy.LS_API_KEY', 'test_api_key'):
            result = LemonSqueezyClient.validate_key('invalid_key')
            assert result['valid'] is False
            assert result['status'] == 'invalid'
            assert 'Chave inválida' in result['error']

    @patch('services.lemon_squeezy.requests.post')
    def test_validate_key_online_success(self, mock_post):
        """Test successful online license validation"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': {
                'id': '1',
                'attributes': {
                    'status': 'active',
                    'expires_at': '2027-12-31T23:59:59Z'
                },
                'relationships': {
                    'product': {
                        'data': {'id': '2000'}
                    }
                }
            }
        }
        mock_post.return_value = mock_response

        with patch('services.lemon_squeezy.LS_API_KEY', 'test_api_key'):
            result = LemonSqueezyClient.validate_key('gm_test_valid_key')
            assert result['valid'] is True
            assert result['status'] == 'active'
            assert result['tier'] == 'pro'
            assert result['expiry_date'] == '2027-12-31T23:59:59Z'

    @patch('services.lemon_squeezy.requests.post')
    def test_validate_key_online_expired(self, mock_post):
        """Test validation with expired license"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': {
                'attributes': {
                    'status': 'expired',
                    'expires_at': '2023-12-31T23:59:59Z'
                }
            }
        }
        mock_post.return_value = mock_response

        with patch('services.lemon_squeezy.LS_API_KEY', 'test_api_key'):
            result = LemonSqueezyClient.validate_key('gm_test_expired_key')
            assert result['valid'] is False
            assert result['status'] == 'expired'

    @patch('services.lemon_squeezy.requests.post')
    def test_validate_key_401_unauthorized(self, mock_post):
        """Test validation with unauthorized API key"""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_post.return_value = mock_response

        with patch('services.lemon_squeezy.LS_API_KEY', 'invalid_api_key'):
            result = LemonSqueezyClient.validate_key('gm_test_key')
            assert result['valid'] is False
            assert 'Chave inválida' in result['error']

    @patch('services.lemon_squeezy.requests.post')
    def test_validate_key_connection_timeout(self, mock_post):
        """Test validation with connection timeout"""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout()

        with patch('services.lemon_squeezy.LS_API_KEY', 'test_api_key'):
            result = LemonSqueezyClient.validate_key('gm_test_key')
            assert result['valid'] is False
            assert 'Timeout' in result['error']

    @patch('services.lemon_squeezy.requests.post')
    def test_validate_key_connection_error(self, mock_post):
        """Test validation with connection error"""
        import requests
        mock_post.side_effect = requests.exceptions.ConnectionError()

        with patch('services.lemon_squeezy.LS_API_KEY', 'test_api_key'):
            result = LemonSqueezyClient.validate_key('gm_test_key')
            assert result['valid'] is False
            assert 'conexão' in result['error'].lower()


class TestLicenseKeyModel:
    """Tests for License Key database model"""

    @classmethod
    def setup_class(cls):
        """Setup test database"""
        LicenseKeyModel.init_db()

    def test_create_license(self):
        """Test creating a new license record"""
        success = LicenseKeyModel.create_or_update(
            user_email='test@example.com',
            license_key='gm_test_001',
            status='active',
            tier='pro',
            expiry_date='2027-12-31'
        )
        assert success is True

    def test_get_license_by_user(self):
        """Test retrieving license by user email"""
        LicenseKeyModel.create_or_update(
            user_email='test2@example.com',
            license_key='gm_test_002',
            status='active',
            tier='pro',
            expiry_date='2027-12-31'
        )

        license_record = LicenseKeyModel.get_by_user('test2@example.com')
        assert license_record is not None
        assert license_record['license_key'] == 'gm_test_002'
        assert license_record['status'] == 'active'
        assert license_record['tier'] == 'pro'

    def test_get_nonexistent_license(self):
        """Test retrieving non-existent license"""
        license_record = LicenseKeyModel.get_by_user('nonexistent@example.com')
        assert license_record is None

    def test_update_license(self):
        """Test updating an existing license"""
        LicenseKeyModel.create_or_update(
            user_email='test3@example.com',
            license_key='gm_test_003',
            status='active',
            tier='free',
            expiry_date=None
        )

        # Update to pro tier
        success = LicenseKeyModel.create_or_update(
            user_email='test3@example.com',
            license_key='gm_test_003_updated',
            status='active',
            tier='pro',
            expiry_date='2027-12-31'
        )

        assert success is True

        license_record = LicenseKeyModel.get_by_user('test3@example.com')
        assert license_record['tier'] == 'pro'
        assert license_record['license_key'] == 'gm_test_003_updated'

    def test_is_cached_valid_active(self):
        """Test checking if cached license is valid (active)"""
        LicenseKeyModel.create_or_update(
            user_email='test4@example.com',
            license_key='gm_test_004',
            status='active',
            tier='pro',
            expiry_date='2027-12-31'
        )

        is_valid = LicenseKeyModel.is_cached_valid('test4@example.com')
        assert is_valid is True

    def test_is_cached_valid_expired(self):
        """Test checking if cached license is valid (expired)"""
        LicenseKeyModel.create_or_update(
            user_email='test5@example.com',
            license_key='gm_test_005',
            status='expired',
            tier='free',
            expiry_date='2023-12-31'
        )

        is_valid = LicenseKeyModel.is_cached_valid('test5@example.com')
        assert is_valid is False

    def test_is_offline_valid_within_grace_period(self):
        """Test checking if offline grace period is valid"""
        LicenseKeyModel.create_or_update(
            user_email='test6@example.com',
            license_key='gm_test_006',
            status='active',
            tier='pro',
            expiry_date='2027-12-31'
        )

        is_valid = LicenseKeyModel.is_offline_valid('test6@example.com', max_offline_days=30)
        assert is_valid is True

    def test_is_offline_valid_outside_grace_period(self):
        """Test checking if offline grace period is expired"""
        # This test simulates a license that hasn't been validated in 31+ days
        # In real scenario, this would require mocking datetime
        user_email = 'test7@example.com'
        LicenseKeyModel.create_or_update(
            user_email=user_email,
            license_key='gm_test_007',
            status='active',
            tier='pro',
            expiry_date='2027-12-31'
        )

        # For this test to pass, we'd need to mock the datetime
        # In a real scenario, this would return False after 30+ days
        with patch('models.datetime') as mock_datetime:
            # Set current time to 31 days later
            mock_now = datetime.utcnow() + timedelta(days=31)
            mock_datetime.utcnow.return_value = mock_now

            is_valid = LicenseKeyModel.is_offline_valid(user_email, max_offline_days=30)
            assert is_valid is False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
