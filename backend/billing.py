#!/usr/bin/env python3
"""
Integração Lemon Squeezy — Fase 3 (GAMA_VOZ)
Validação de licença + webhook handling + API client
Docs: https://docs.lemonsqueezy.com/api
"""

import os
import hmac
import hashlib
import time
import requests
from typing import Optional
from subscriptions import SubscriptionsDB

# ─── Config ───────────────────────────────────────────────────────────────────
LS_API_KEY      = os.environ.get('LS_API_KEY', '')
LS_STORE_ID     = os.environ.get('LS_STORE_ID', '')
LS_WEBHOOK_SECRET = os.environ.get('LS_WEBHOOK_SECRET', '')
LS_BASE_URL     = 'https://api.lemonsqueezy.com/v1'
LS_API_HEADERS  = {
    'Authorization': f'Bearer {LS_API_KEY}',
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
}

# ─── Plans mapping (substitua pelos IDs reais do Lemon Squeezy) ──────────────
LS_VARIANT_IDS = {
    'pro_monthly': os.environ.get('LS_PRO_MONTHLY_VARIANT_ID', 'YOUR_VARIANT_ID'),
    'pro_yearly':  os.environ.get('LS_PRO_YEARLY_VARIANT_ID', 'YOUR_VARIANT_ID'),
}

LS_PLAN_BY_VARIANT = {v: k for k, v in LS_VARIANT_IDS.items()}


# ─── Webhook signature ───────────────────────────────────────────────────────
def verify_webhook_signature(payload_bytes: bytes, signature: str) -> bool:
    """
    Valida X-Signature do Lemon Squeezy (HMAC SHA256).
    O payload_bytes é o raw request body (bytes, não string).
    """
    if not LS_WEBHOOK_SECRET:
        print('⚠️  LS_WEBHOOK_SECRET não configurado — webhook NÃO verificado')
        return False

    expected = hmac.new(
        LS_WEBHOOK_SECRET.encode(),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

    # Lemon Squeezy envia "t=timestamp,v1=signature"
    parts = dict(p.split('=', 1) for p in signature.split(',') if '=' in p)
    received = parts.get('v1', '')

    # Também verifica timestamp para prevenir replay attacks (5 min janela)
    timestamp = int(parts.get('t', 0))
    if timestamp and abs(time.time() - timestamp) > 300:
        print(f'❌ Webhook timestamp fora da janela: {timestamp}')
        return False

    return hmac.compare_digest(expected, received)


# ─── License key activation ──────────────────────────────────────────────────
def activate_license(license_key: str, user_id: int) -> dict:
    """
    Ativa licença Lemon Squeezy para o user.
    POST https://api.lemonsqueezy.com/v1/licenses/activate

    Returns:
        {'success': True, 'plan': 'pro_monthly', ...}  ou
        {'success': False, 'error': '...'}
    """
    if not LS_API_KEY:
        return {'success': False, 'error': 'LS_API_KEY não configurado'}

    try:
        resp = requests.post(
            f'{LS_BASE_URL}/licenses/activate',
            json={
                'data': {
                    'type': 'license-activations',
                    'attributes': {
                        'license_key': license_key,
                        'instance_name': f'gama_voz_user_{user_id}',
                    }
                }
            },
            headers=LS_API_HEADERS,
            timeout=15,
        )
        data = resp.json()

        if resp.status_code == 200 and data.get('meta', {}).get('activated'):
            # Descobre o plano pelo product_id da licença
            plan_key = data.get('meta', {}).get('plan_name', 'pro_monthly').lower()
            # Mapeia para nossas chaves de plano
            if 'year' in plan_key or 'anual' in plan_key:
                plan = 'pro_yearly'
            elif 'month' in plan_key or 'mensal' in plan_key:
                plan = 'pro_monthly'
            else:
                plan = 'pro_monthly'  # default

            # Atualiza subscription
            sub = SubscriptionsDB.upsert_subscription(
                user_id=user_id,
                plan=plan,
                status='active',
                current_period_end=_calc_period_end(plan),
            )

            return {
                'success': True,
                'plan': plan,
                'status': 'active',
                'expires_at': sub.get('current_period_end'),
            }
        else:
            error = data.get('errors', [{}])[0].get('detail', 'Erro desconhecido')
            return {'success': False, 'error': error}

    except requests.RequestException as e:
        return {'success': False, 'error': f'Erro de rede: {e}'}


def deactivate_license(user_id: int) -> dict:
    """
    Desativa licença Lemon Squeezy do user (opcional — user pedindo cancelamento).
    """
    if not LS_API_KEY:
        return {'success': False, 'error': 'LS_API_KEY não configurado'}

    sub = SubscriptionsDB.get_active_subscription(user_id)
    if not sub or not sub.get('ls_subscription_id'):
        return {'success': False, 'error': 'Nenhuma licença ativa'}

    try:
        resp = requests.post(
            f'{LS_BASE_URL}/licenses/deactivate',
            json={
                'data': {
                    'type': 'license-activations',
                    'attributes': {
                        'license_key': sub.get('ls_license_key', ''),
                    }
                }
            },
            headers=LS_API_HEADERS,
            timeout=15,
        )
        if resp.status_code == 200:
            SubscriptionsDB.upsert_subscription(user_id, plan='free', status='inactive')
            return {'success': True}
        return {'success': False, 'error': resp.json().get('errors', [{}])[0].get('detail', 'Erro')}

    except requests.RequestException as e:
        return {'success': False, 'error': f'Erro de rede: {e}'}


# ─── Subscription status via LS API ─────────────────────────────────────────
def sync_subscription_from_ls(user_id: int, ls_subscription_id: str) -> dict:
    """
    Busca status atual da subscription no Lemon Squeezy e sincroniza com DB.
    Usado no webhook + no endpoint /api/billing/status (refresh).
    """
    if not LS_API_KEY or not ls_subscription_id:
        return {'success': False, 'error': 'Config missing'}

    try:
        resp = requests.get(
            f'{LS_BASE_URL}/subscriptions/{ls_subscription_id}',
            headers=LS_API_HEADERS,
            timeout=15,
        )
        if resp.status_code != 200:
            return {'success': False, 'error': 'Subscription not found'}

        sub_data = resp.json().get('data', {})
        attrs = sub_data.get('attributes', {})
        variant_id = str(attrs.get('variant_id', ''))
        plan = LS_PLAN_BY_VARIANT.get(variant_id, 'pro_monthly')
        status_ls = attrs.get('status', 'active')

        # Mapeia status LS → nosso status
        status_map = {
            'active': 'active',
            'past_due': 'past_due',
            'canceled': 'canceled',
            'expired': 'expired',
            'on_trial': 'active',
            'paused': 'inactive',
        }
        status = status_map.get(status_ls, 'active')
        renews_at = attrs.get('renews_at', '')

        SubscriptionsDB.upsert_subscription(
            user_id=user_id,
            plan=plan,
            status=status,
            ls_subscription_id=ls_subscription_id,
            current_period_end=renews_at,
        )

        return {'success': True, 'status': status, 'plan': plan}

    except requests.RequestException as e:
        return {'success': False, 'error': f'LS API error: {e}'}


# ─── Plans (sem segredo — frontend consome) ──────────────────────────────────
def get_plans() -> list:
    """Retorna lista de planos para exibir no frontend."""
    from subscriptions import PRO_PLANS
    return [
        {
            'id': 'free',
            'name': 'Free',
            'price': 0,
            'price_display': 'Grátis',
            'period': None,
            'features': [
                f"30 min de transcrição/mês",
                f"10.000 caracteres TTS/mês",
                '1 audiobook/mês',
                'Suporte da comunidade',
            ],
            'limits': {
                'stt_seconds': 30 * 60,
                'tts_chars': 10_000,
                'audiobook_count': 1,
                'voice_clones': 0,
                'realtime_minutes': 0,
            },
        },
        *[
            {
                'id': plan_id,
                'name': info['name'],
                'price': info['price_brl'],
                'price_display': f"R$ {info['price_brl']:.2f}",
                'period': info['period'],
                'features': info['features'],
                'variant_id': LS_VARIANT_IDS.get(plan_id, ''),
            }
            for plan_id, info in PRO_PLANS.items()
        ],
    ]


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _calc_period_end(plan: str) -> str:
    """Calcula fim do período (para ativação manual sem webhook)."""
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    if 'year' in plan:
        end = now + timedelta(days=365)
    else:
        end = now + timedelta(days=30)
    return end.isoformat() + 'Z'


def get_checkout_url(plan_id: str, user_id: int, user_email: str) -> Optional[str]:
    """
    Gera URL de checkout Lemon Squeezy para o plano.
    O webhook ativará a licença automaticamente no callback.
    """
    if not LS_API_KEY:
        return None

    variant_id = LS_VARIANT_IDS.get(plan_id)
    if not variant_id:
        return None

    # Em produção real, usar Lemon Squeezy Checkout API
    # Por ora, retorna URL do produto na LS (user ativa manualmente depois)
    return f"https://gama-voz.lemonsqueezy.com/checkout/extract/{variant_id}?checkout[email]={user_email}&checkout[custom][user_id]={user_id}"
