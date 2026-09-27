"""
Lemon Squeezy API Client for License Management
"""

import requests
import os
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta

LS_API_KEY = os.getenv('LS_API_KEY')
LS_API_URL = 'https://api.lemonsqueezy.com/v1'


class LemonSqueezyClient:
    """Client for Lemon Squeezy License API"""

    @staticmethod
    def validate_key(license_key: str) -> Dict:
        """
        Validate a license key against Lemon Squeezy API.

        Args:
            license_key: License key in format "gm_xxx_yyy"

        Returns:
            {
                'valid': bool,
                'status': 'active' | 'expired' | 'revoked' | 'invalid',
                'tier': 'free' | 'pro' | 'enterprise',
                'expiry_date': ISO date string or None,
                'error': error message if invalid
            }
        """
        if not LS_API_KEY:
            return {
                'valid': False,
                'status': 'invalid',
                'error': 'LS_API_KEY not configured'
            }

        if not license_key or not license_key.startswith('gm_'):
            return {
                'valid': False,
                'status': 'invalid',
                'error': 'Chave inválida. Verifique o email de confirmação.'
            }

        try:
            headers = {
                'Authorization': f'Bearer {LS_API_KEY}',
                'Accept': 'application/vnd.api+json'
            }

            # Lemon Squeezy API endpoint for validating license keys
            # Doc: https://docs.lemonsqueezy.com/api/license-keys#validate-a-license-key
            response = requests.post(
                f'{LS_API_URL}/licenses/validate',
                headers=headers,
                json={'license_key': license_key},
                timeout=10
            )

            if response.status_code == 401:
                return {
                    'valid': False,
                    'status': 'invalid',
                    'error': 'Chave inválida. Verifique o email de confirmação.'
                }

            if response.status_code != 200:
                return {
                    'valid': False,
                    'status': 'invalid',
                    'error': 'Erro ao validar chave. Tente novamente.'
                }

            data = response.json()

            # Extract license data from LS API response
            # LS returns: { data: { attributes: { status, expires_at }, relationships: {...} } }
            license_data = data.get('data', {})
            attributes = license_data.get('attributes', {})

            status = attributes.get('status', 'unknown')
            expires_at = attributes.get('expires_at')

            # Determine tier based on product (PRO = product_id > 1000, else FREE)
            # This is simplified; adjust based on your LS product structure
            product_id = license_data.get('relationships', {}).get('product', {}).get('data', {}).get('id')
            tier = 'pro' if product_id and int(product_id or 0) > 1000 else 'free'

            valid = status == 'active'

            return {
                'valid': valid,
                'status': status,
                'tier': tier,
                'expiry_date': expires_at,
                'error': None if valid else f'Licença {status.capitalize()}'
            }

        except requests.exceptions.Timeout:
            return {
                'valid': False,
                'status': 'error',
                'error': 'Timeout ao conectar com servidor de licenças'
            }
        except requests.exceptions.ConnectionError:
            return {
                'valid': False,
                'status': 'error',
                'error': 'Sem conexão com servidor de licenças'
            }
        except Exception as e:
            return {
                'valid': False,
                'status': 'error',
                'error': str(e)
            }

    @staticmethod
    def get_license_product(license_key: str) -> Optional[Dict]:
        """Get product details for a license key"""
        if not LS_API_KEY:
            return None

        try:
            headers = {
                'Authorization': f'Bearer {LS_API_KEY}',
                'Accept': 'application/vnd.api+json'
            }

            response = requests.get(
                f'{LS_API_URL}/licenses',
                headers=headers,
                params={'filter[license_key]': license_key},
                timeout=10
            )

            if response.status_code != 200:
                return None

            data = response.json()
            licenses = data.get('data', [])

            if not licenses:
                return None

            license_data = licenses[0]
            return {
                'id': license_data.get('id'),
                'key': license_data.get('attributes', {}).get('license_key'),
                'status': license_data.get('attributes', {}).get('status'),
                'expires_at': license_data.get('attributes', {}).get('expires_at')
            }

        except Exception:
            return None
