#!/usr/bin/env python3
"""
Sistema de assinaturas e quotas — Fase 3 (Lemon Squeezy)
Tabela SQLite + CRUD + registro de uso + reset de quota
"""

import sqlite3
import os
import time
from datetime import datetime, timedelta
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), 'gama_voz.db')

# Limites FREE (mensais) — PRO = None (ilimitado)
# Ajustáveis via env se necessário
FREE_LIMITS = {
    'stt_seconds': int(os.environ.get('FREE_STT_SECONDS', 30 * 60)),       # 30 min/mês
    'tts_chars':   int(os.environ.get('FREE_TTS_CHARS', 10_000)),          # 10k chars/mês
    'audiobook_count': int(os.environ.get('FREE_AUDIOBOOK', 1)),           # 1 audiobook/mês
    'voice_clones': int(os.environ.get('FREE_VOICE_CLONES', 0)),           # 0 clones (PRO only)
    'realtime_minutes': int(os.environ.get('FREE_REALTIME_MIN', 0)),       # 0 min (PRO only)
}

# Preços exibidos no frontend (em reais). Lemon Squeezy processa em USD na prática.
PRO_PLANS = {
    'pro_monthly': {
        'name': 'Pro Mensal',
        'price_brl': 29.00,
        'period': 'monthly',
        'features': [
            'Transcrições ilimitadas (STT)',
            'Síntese de voz ilimitada (TTS)',
            'Audiobooks ilimitados',
            '5 clones de voz (XTTS)',
            'Realtime Socket.IO',
        ],
    },
    'pro_yearly': {
        'name': 'Pro Anual',
        'price_brl': 290.00,        # 17% off vs mensal
        'period': 'yearly',
        'features': [
            'Tudo do Pro Mensal',
            '2 meses grátis',
            'Suporte prioritário',
        ],
    },
}


class SubscriptionsDB:
    """Gerenciador de assinaturas + quotas"""

    @staticmethod
    def init_db():
        """Cria tabelas subscriptions + usage_counters se não existirem"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan TEXT NOT NULL DEFAULT 'free',           -- 'free' | 'pro_monthly' | 'pro_yearly'
                status TEXT NOT NULL DEFAULT 'inactive',     -- 'active' | 'canceled' | 'expired' | 'past_due' | 'inactive'
                ls_subscription_id TEXT,                      -- Lemon Squeezy subscription id
                ls_customer_id TEXT,                          -- Lemon Squeezy customer id
                ls_license_key TEXT,                          -- license key (se aplicável)
                current_period_start TIMESTAMP,
                current_period_end TIMESTAMP,
                cancel_at_period_end INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usage_counters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                usage_type TEXT NOT NULL,            -- 'stt_seconds' | 'tts_chars' | 'audiobook_count' | 'voice_clones' | 'realtime_minutes'
                period_start TIMESTAMP NOT NULL,     -- início do ciclo (mensal)
                amount REAL NOT NULL DEFAULT 0,      -- usage atual
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, usage_type, period_start)
            )
        ''')

        # Índices para queries frequentes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_counters(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_usage_period ON usage_counters(period_start)')

        conn.commit()
        conn.close()
        print('✅ Subscriptions DB inicializado')

    @staticmethod
    def _get_period_start() -> str:
        """Início do mês atual (UTC) — resets de quota mensais"""
        now = datetime.utcnow()
        return datetime(now.year, now.month, 1).isoformat()

    @staticmethod
    def get_active_subscription(user_id: int) -> Optional[dict]:
        """Retorna assinatura ativa ou None"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, user_id, plan, status, ls_subscription_id, ls_customer_id,
                   current_period_start, current_period_end, cancel_at_period_end,
                   created_at, updated_at
            FROM subscriptions
            WHERE user_id = ? AND status = 'active'
            ORDER BY id DESC LIMIT 1
        ''', (user_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        return {
            'id': row[0],
            'user_id': row[1],
            'plan': row[2],
            'status': row[3],
            'ls_subscription_id': row[4],
            'ls_customer_id': row[5],
            'current_period_start': row[6],
            'current_period_end': row[7],
            'cancel_at_period_end': bool(row[8]),
            'created_at': row[9],
            'updated_at': row[10],
        }

    @staticmethod
    def is_pro(user_id: int) -> bool:
        """Verifica rapidamente se user tem plano PRO ativo"""
        sub = SubscriptionsDB.get_active_subscription(user_id)
        return sub is not None and sub['plan'] in ('pro_monthly', 'pro_yearly')

    @staticmethod
    def upsert_subscription(user_id: int, plan: str, status: str = 'active',
                            ls_subscription_id: str = None, ls_customer_id: str = None,
                            current_period_end: str = None) -> dict:
        """Cria ou atualiza assinatura do user (idempotente)"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        now = datetime.utcnow().isoformat()
        period_start = now if status == 'active' else None
        period_end = current_period_end

        # UPSERT pattern (SQLite >= 3.24)
        cursor.execute('''
            INSERT INTO subscriptions (
                user_id, plan, status, ls_subscription_id, ls_customer_id,
                current_period_start, current_period_end, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                plan = excluded.plan,
                status = excluded.status,
                ls_subscription_id = COALESCE(excluded.ls_subscription_id, subscriptions.ls_subscription_id),
                ls_customer_id = COALESCE(excluded.ls_customer_id, subscriptions.ls_customer_id),
                current_period_end = COALESCE(excluded.current_period_end, subscriptions.current_period_end),
                updated_at = excluded.updated_at
        ''', (user_id, plan, status, ls_subscription_id, ls_customer_id,
              period_start, period_end, now))

        conn.commit()
        conn.close()

        return SubscriptionsDB.get_active_subscription(user_id) or {'plan': plan, 'status': status}

    @staticmethod
    def cancel_subscription(user_id: int) -> bool:
        """Cancela assinatura (mantém até fim do período)"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE subscriptions
            SET cancel_at_period_end = 1, status = 'canceled', updated_at = ?
            WHERE user_id = ? AND status = 'active'
        ''', (datetime.utcnow().isoformat(), user_id))
        changed = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return changed

    @staticmethod
    def get_usage(user_id: int) -> dict:
        """Retorna usage atual do user no mês corrente"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        period = SubscriptionsDB._get_period_start()

        cursor.execute('''
            SELECT usage_type, amount
            FROM usage_counters
            WHERE user_id = ? AND period_start = ?
        ''', (user_id, period))

        rows = cursor.fetchall()
        conn.close()

        # Monta dict com todos os tipos (default 0)
        usage = {key: 0.0 for key in FREE_LIMITS.keys()}
        for ut, amount in rows:
            if ut in usage:
                usage[ut] = amount

        return usage

    @staticmethod
    def get_limit(usage_type: str, is_pro: bool) -> Optional[float]:
        """Retorna limite do user. None = ilimitado (PRO)"""
        if is_pro:
            return None
        return FREE_LIMITS.get(usage_type)

    @staticmethod
    def record_usage(user_id: int, usage_type: str, amount: float) -> dict:
        """
        Registra uso do user no mês corrente. Retorna dict com:
        - new_amount: usage atualizado
        - limit: limite do user (None = ilimitado)
        - exceeded: True se passou do limite
        """
        if usage_type not in FREE_LIMITS:
            return {'error': f'unknown usage_type: {usage_type}'}

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        period = SubscriptionsDB._get_period_start()
        is_pro = SubscriptionsDB.is_pro(user_id)
        limit = SubscriptionsDB.get_limit(usage_type, is_pro)

        # UPSERT com increment atômico
        cursor.execute('''
            INSERT INTO usage_counters (user_id, usage_type, period_start, amount, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, usage_type, period_start) DO UPDATE SET
                amount = amount + excluded.amount,
                updated_at = excluded.updated_at
        ''', (user_id, usage_type, period, amount, datetime.utcnow().isoformat()))

        # Lê valor atualizado
        cursor.execute('''
            SELECT amount FROM usage_counters
            WHERE user_id = ? AND usage_type = ? AND period_start = ?
        ''', (user_id, usage_type, period))
        new_amount = cursor.fetchone()[0]
        conn.commit()
        conn.close()

        exceeded = (limit is not None) and (new_amount > limit)

        return {
            'new_amount': new_amount,
            'limit': limit,
            'exceeded': exceeded,
            'is_pro': is_pro,
        }

    @staticmethod
    def check_quota(user_id: int, usage_type: str, requested_amount: float = 0) -> dict:
        """
        Verifica se user pode usar `requested_amount` do `usage_type` sem passar do limite.
        NÃO registra uso — só checa. Para registrar, chame record_usage depois.
        """
        if usage_type not in FREE_LIMITS:
            return {'error': f'unknown usage_type: {usage_type}'}

        is_pro = SubscriptionsDB.is_pro(user_id)
        limit = SubscriptionsDB.get_limit(usage_type, is_pro)

        # PRO = sempre passa
        if is_pro:
            return {
                'allowed': True,
                'is_pro': True,
                'limit': None,
                'current': 0,
                'remaining': None,
            }

        usage = SubscriptionsDB.get_usage(user_id)
        current = usage.get(usage_type, 0)
        remaining = max(0, limit - current) if limit is not None else None
        would_exceed = (limit is not None) and (current + requested_amount > limit)

        return {
            'allowed': not would_exceed,
            'is_pro': False,
            'limit': limit,
            'current': current,
            'remaining': remaining,
            'would_exceed': would_exceed,
        }
