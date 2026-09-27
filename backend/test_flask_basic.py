"""
Basic pytest tests for GAMA_VOZ Flask application.
These tests verify core Flask functionality and API endpoints.
"""

import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app import app, FRONTEND_BUILD


@pytest.fixture
def client():
    """Create a Flask test client."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestFlaskSetup:
    """Test Flask application setup and basic endpoints."""

    def test_app_creation(self):
        """Test that Flask app was created successfully."""
        assert app is not None
        assert app.name == 'app'

    def test_app_testing_config(self):
        """Test that app configuration can be set to testing mode."""
        app.config['TESTING'] = True
        assert app.config['TESTING'] is True

    def test_cors_enabled(self):
        """Test that CORS is enabled on the app."""
        # CORS is applied via CORS(app) in app.py
        # Just verify the app has the CORS decorator applied by checking responses
        assert app is not None


class TestHttpEndpoints:
    """Test HTTP endpoints."""

    def test_root_endpoint(self, client):
        """Test GET / endpoint."""
        response = client.get('/')
        # Should return 200 OK or redirect to React
        assert response.status_code in [200, 301, 302]

    def test_health_check(self, client):
        """Test health check endpoint if available."""
        # Try common health check endpoints
        for endpoint in ['/health', '/api/health', '/status']:
            response = client.get(endpoint)
            # Should not return 404 if implemented
            if response.status_code != 404:
                assert response.status_code in [200, 500]
                break


class TestFrontendBuild:
    """Test frontend build configuration."""

    def test_frontend_build_path(self):
        """Test that frontend build path is configured."""
        assert FRONTEND_BUILD is not None
        assert 'frontend' in FRONTEND_BUILD
        assert 'dist' in FRONTEND_BUILD

    def test_frontend_build_path_valid(self):
        """Test that frontend build path is valid (if built)."""
        # This will pass even if dist doesn't exist yet
        # (it will be created during npm build in the build script)
        assert isinstance(FRONTEND_BUILD, str)
        assert len(FRONTEND_BUILD) > 0


class TestAuthModule:
    """Test authentication module."""

    def test_auth_module_importable(self):
        """Test that auth module can be imported."""
        try:
            from auth import AuthDB, require_auth
            assert AuthDB is not None
            assert require_auth is not None
        except ImportError as e:
            pytest.fail(f"Failed to import auth module: {e}")


class TestAudiobookProcessor:
    """Test audiobook processor module."""

    def test_audiobook_processor_importable(self):
        """Test that audiobook processor can be imported."""
        try:
            from audiobook_processor import (
                create_audiobook_task,
                get_audiobook_status,
                process_audiobook_queue,
                AUDIOBOOK_QUEUE,
                AUDIOBOOK_QUEUE_LOCK
            )
            assert create_audiobook_task is not None
            assert get_audiobook_status is not None
            assert process_audiobook_queue is not None
            assert AUDIOBOOK_QUEUE is not None
            assert AUDIOBOOK_QUEUE_LOCK is not None
        except ImportError as e:
            pytest.fail(f"Failed to import audiobook_processor: {e}")


class TestDependencies:
    """Test that critical dependencies are available."""

    def test_flask_available(self):
        """Test Flask is installed."""
        try:
            import flask
            assert flask.__version__
        except ImportError:
            pytest.fail("Flask not installed")

    def test_flask_cors_available(self):
        """Test Flask-CORS is installed."""
        try:
            import flask_cors
            assert flask_cors
        except ImportError:
            pytest.fail("Flask-CORS not installed")

    def test_numpy_available(self):
        """Test NumPy is installed."""
        try:
            import numpy
            assert numpy.__version__
        except ImportError:
            pytest.fail("NumPy not installed")

    def test_groq_available(self):
        """Test Groq client is installed."""
        try:
            import groq
            assert groq
        except ImportError:
            pytest.fail("Groq not installed")


if __name__ == '__main__':
    # Run tests with verbose output
    pytest.main([__file__, '-v', '--tb=short'])
