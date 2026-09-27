"""
License Management API Endpoints
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from services.lemon_squeezy import LemonSqueezyClient
from models import LicenseKeyModel
from auth import require_auth

# Blueprint for license routes
license_bp = Blueprint('license', __name__, url_prefix='/api/license')


@license_bp.route('/validate', methods=['POST'])
@require_auth
def validate_license():
    """
    Validate license key and update user's tier.
    POST /api/license/validate
    Body: { "license_key": "gm_xxx_yyy" }
    """
    try:
        data = request.get_json() or {}
        license_key = data.get('license_key', '').strip()
        user_email = request.user_email

        if not license_key:
            return jsonify({'error': 'Chave de licença é obrigatória'}), 400

        # Validate with Lemon Squeezy API (online)
        validation = LemonSqueezyClient.validate_key(license_key)

        if not validation['valid']:
            return jsonify({
                'success': False,
                'error': validation['error'],
                'status': validation['status']
            }), 400

        # Cache the validated license
        LicenseKeyModel.create_or_update(
            user_email=user_email,
            license_key=license_key,
            status=validation['status'],
            tier=validation['tier'],
            expiry_date=validation['expiry_date']
        )

        return jsonify({
            'success': True,
            'message': 'Licença validada com sucesso',
            'tier': validation['tier'],
            'expiry_date': validation['expiry_date'],
            'status': validation['status']
        }), 200

    except Exception as e:
        print(f"License validation error: {e}")
        return jsonify({'error': str(e)}), 500


@license_bp.route('/status', methods=['GET'])
@require_auth
def get_license_status():
    """
    Get current license status for user.
    GET /api/license/status
    """
    try:
        user_email = request.user_email

        license_record = LicenseKeyModel.get_by_user(user_email)

        if not license_record:
            return jsonify({
                'tier': 'free',
                'status': 'no_license',
                'message': 'Nenhuma licença ativa. Usando tier gratuito (5 min/dia).'
            }), 200

        # Check if offline grace period is still valid
        if license_record['status'] == 'active':
            if LicenseKeyModel.is_offline_valid(user_email):
                return jsonify({
                    'tier': license_record['tier'],
                    'status': 'active',
                    'expiry_date': license_record['expiry_date'],
                    'last_validated_at': license_record['last_validated_at'],
                    'message': f"Licença ativa ({license_record['tier']})"
                }), 200
            else:
                # Offline grace period expired, attempt online validation
                validation = LemonSqueezyClient.validate_key(license_record['license_key'])

                LicenseKeyModel.create_or_update(
                    user_email=user_email,
                    license_key=license_record['license_key'],
                    status=validation['status'],
                    tier=validation['tier'],
                    expiry_date=validation['expiry_date']
                )

                if validation['valid']:
                    return jsonify({
                        'tier': validation['tier'],
                        'status': 'active',
                        'expiry_date': validation['expiry_date'],
                        'message': f"Licença validada ({validation['tier']})"
                    }), 200
                else:
                    return jsonify({
                        'tier': 'free',
                        'status': 'expired',
                        'message': 'Licença expirou. Usando tier gratuito.',
                        'error': validation['error']
                    }), 200

        # License is inactive (expired/revoked)
        return jsonify({
            'tier': 'free',
            'status': license_record['status'],
            'message': f"Licença {license_record['status']}. Usando tier gratuito.",
            'upgrade_url': 'https://lemonsqueezy.com/gama-voz/checkout'
        }), 200

    except Exception as e:
        print(f"Get license status error: {e}")
        return jsonify({'error': str(e)}), 500


@license_bp.route('/revoke', methods=['POST'])
@require_auth
def revoke_license():
    """
    Revoke/remove current user's license.
    POST /api/license/revoke
    """
    try:
        user_email = request.user_email

        # Update status to 'revoked'
        LicenseKeyModel.create_or_update(
            user_email=user_email,
            license_key='',
            status='revoked',
            tier='free'
        )

        return jsonify({
            'success': True,
            'message': 'Licença revogada',
            'tier': 'free'
        }), 200

    except Exception as e:
        print(f"Revoke license error: {e}")
        return jsonify({'error': str(e)}), 500
