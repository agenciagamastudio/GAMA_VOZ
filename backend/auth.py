#!/usr/bin/env python3
"""
Sistema de autenticação com SQLite
Migrará para Supabase no futuro
"""

import sqlite3
import os
import hashlib
import secrets
from datetime import datetime, timedelta
import jwt
from functools import wraps
from flask import request, jsonify

# Config
DB_PATH = os.path.join(os.path.dirname(__file__), 'gama_voz.db')
JWT_SECRET = os.environ.get('JWT_SECRET', 'gama-voz-secret-dev-only')
JWT_ALGORITHM = 'HS256'
TOKEN_EXPIRY_HOURS = 7 * 24  # 7 dias


class AuthDB:
    """Gerenciador de banco de dados de autenticação"""

    @staticmethod
    def init_db():
        """Cria tabela de usuários se não existir"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()
        print(f"✅ Database inicializado: {DB_PATH}")

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash de senha com salt"""
        salt = secrets.token_hex(16)
        password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return f"{salt}${password_hash.hex()}"

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verifica se password corresponde ao hash"""
        try:
            salt, stored_hash = password_hash.split('$')
            password_check = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
            return password_check.hex() == stored_hash
        except:
            return False

    @staticmethod
    def register_user(email: str, password: str, name: str = "") -> dict:
        """Registra novo usuário"""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            password_hash = AuthDB.hash_password(password)

            cursor.execute('''
                INSERT INTO users (email, password_hash, name)
                VALUES (?, ?, ?)
            ''', (email.lower(), password_hash, name))

            conn.commit()
            user_id = cursor.lastrowid
            conn.close()

            return {'success': True, 'user_id': user_id, 'email': email}

        except sqlite3.IntegrityError:
            return {'success': False, 'error': 'Email já registrado'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def get_user(email: str) -> dict:
        """Retorna usuário por email"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('SELECT id, email, password_hash, name FROM users WHERE email = ?', (email.lower(),))
        row = cursor.fetchone()
        conn.close()

        if row:
            return {'id': row[0], 'email': row[1], 'password_hash': row[2], 'name': row[3]}
        return None

    @staticmethod
    def create_token(user_id: int, email: str) -> str:
        """Cria JWT token"""
        payload = {
            'user_id': user_id,
            'email': email,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    @staticmethod
    def verify_token(token: str) -> dict:
        """Verifica JWT token"""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return {'valid': True, 'user_id': payload['user_id'], 'email': payload['email']}
        except jwt.ExpiredSignatureError:
            return {'valid': False, 'error': 'Token expirado'}
        except jwt.InvalidTokenError:
            return {'valid': False, 'error': 'Token inválido'}


def require_auth(f):
    """Decorator para rotas que precisam autenticação"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None

        # Verificar Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Formato de token inválido'}), 401

        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401

        auth_info = AuthDB.verify_token(token)
        if not auth_info['valid']:
            return jsonify({'error': auth_info['error']}), 401

        # Passar user_id para a rota
        request.user_id = auth_info['user_id']
        request.user_email = auth_info['email']

        return f(*args, **kwargs)

    return decorated_function
