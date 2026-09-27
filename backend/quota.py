#!/usr/bin/env python3
"""
Middleware de quota — Fase 3 (GAMA_VOZ)
Decorator @require_quota(usage_type, amount=1) para rotas protegidas.
Verifica subscription ativa e registra uso.
"""

from functools import wraps
from flask import request, jsonify
from subscriptions import SubscriptionsDB


# Decorator de quota — registra uso e bloqueia se excedeu limite
# Uso: @require_quota('stt_seconds', amount=10)
# Uso: @require_quota('tts_chars', amount=500)
# Uso: @require_quota('audiobook_count', amount=1)
# Uso: @require_quota('voice_clones', amount=1)
# Uso: @require_quota('realtime_minutes', amount=1)

def require_quota(usage_type: str, amount: float = 1):
    """
    Decorator que verifica quota antes de executar a função.
    Se user não tem PRO e o uso excederia o limite, retorna 403 com mensagem.
    Se user tem PRO, passa direto e registra uso para métricas (opcional).

    A rota decorada precisa ter `@require_auth` ANTES (para ter user_id no request).
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # 1. Confirma que auth passou (request.user_id deve existir)
            user_id = getattr(request, 'user_id', None)
            if user_id is None:
                return jsonify({'error': 'Autenticação necessária para uso de quota'}), 401

            # 2. Verifica se user tem permissão
            check = SubscriptionsDB.check_quota(user_id, usage_type, amount)

            if check.get('error'):
                return jsonify({'error': check['error']}), 500

            # PRO: ilimitado — passa direto, mas ainda registra uso para analytics
            if check['is_pro']:
                # Registra sem bloquear (PRO nunca excede)
                SubscriptionsDB.record_usage(user_id, usage_type, amount)
                return f(*args, **kwargs)

            # FREE: verifica se passou do limite
            if not check['allowed']:
                current = check.get('current', 0)
                limit = check.get('limit', 0)
                return jsonify({
                    'error': f'Limite de uso excedido para {usage_type}',
                    'usage': {
                        'current': current,
                        'limit': limit,
                        'remaining': max(0, limit - current),
                        'plan': 'free',
                        'upgrade_url': '/billing',
                    }
                }), 403

            # FREE: ainda tem quota — registra e executa
            SubscriptionsDB.record_usage(user_id, usage_type, amount)
            return f(*args, **kwargs)
        return decorated
    return decorator
