"""
Models for GAMA Voz (SQLite via sqlite3)
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'gama_voz.db')


class LicenseKeyModel:
    """Model for license key management"""

    @staticmethod
    def init_db():
        """Initialize license_keys table"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS license_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT UNIQUE NOT NULL,
                license_key TEXT NOT NULL,
                status TEXT DEFAULT 'invalid',
                tier TEXT DEFAULT 'free',
                expiry_date TEXT,
                last_validated_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()

    @staticmethod
    def create_or_update(user_email: str, license_key: str, status: str, tier: str, expiry_date: str = None) -> bool:
        """Create or update license key record"""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO license_keys (user_email, license_key, status, tier, expiry_date, last_validated_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_email) DO UPDATE SET
                    license_key = excluded.license_key,
                    status = excluded.status,
                    tier = excluded.tier,
                    expiry_date = excluded.expiry_date,
                    last_validated_at = excluded.last_validated_at,
                    updated_at = excluded.updated_at
            ''', (user_email, license_key, status, tier, expiry_date, datetime.utcnow().isoformat(), datetime.utcnow().isoformat()))

            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error updating license: {e}")
            return False

    @staticmethod
    def get_by_user(user_email: str) -> dict:
        """Get license key for user"""
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM license_keys WHERE user_email = ?', (user_email,))
            row = cursor.fetchone()
            conn.close()

            if not row:
                return None

            return {
                'id': row['id'],
                'user_email': row['user_email'],
                'license_key': row['license_key'],
                'status': row['status'],
                'tier': row['tier'],
                'expiry_date': row['expiry_date'],
                'last_validated_at': row['last_validated_at'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at']
            }
        except Exception as e:
            print(f"Error fetching license: {e}")
            return None

    @staticmethod
    def is_cached_valid(user_email: str) -> bool:
        """Check if cached license is still valid (within 30-day grace period)"""
        try:
            license_record = LicenseKeyModel.get_by_user(user_email)

            if not license_record:
                return False

            # If status is not 'active', it's invalid
            if license_record['status'] != 'active':
                return False

            # Check if within 30-day grace period from last validation
            last_validated = datetime.fromisoformat(license_record['last_validated_at'])
            now = datetime.utcnow()
            grace_period = (now - last_validated).days <= 30

            return grace_period
        except Exception:
            return False

    @staticmethod
    def is_offline_valid(user_email: str, max_offline_days: int = 30) -> bool:
        """Check if offline grace period is still valid"""
        try:
            license_record = LicenseKeyModel.get_by_user(user_email)

            if not license_record:
                return False

            # Check if last_validated_at is within max_offline_days
            last_validated = datetime.fromisoformat(license_record['last_validated_at'])
            now = datetime.utcnow()
            days_offline = (now - last_validated).days

            return days_offline <= max_offline_days
        except Exception:
            return False


class VoiceProfileModel:
    """Model for voice clone profile management"""

    @staticmethod
    def init_db():
        """Initialize voice_profiles table"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS voice_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                reference_audio_path TEXT NOT NULL,
                embedding BLOB,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')

        conn.commit()
        conn.close()

    @staticmethod
    def create(user_id: int, name: str, reference_audio_path: str) -> dict:
        """Create a new voice profile record"""
        conn = sqlite3.connect(DB_PATH)
        try:
            cursor = conn.cursor()

            now = datetime.utcnow().isoformat()
            cursor.execute('''
                INSERT INTO voice_profiles (user_id, name, reference_audio_path, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, name, reference_audio_path, now, now))

            conn.commit()
            profile_id = cursor.lastrowid

            return {
                'id': profile_id,
                'user_id': user_id,
                'name': name,
                'reference_audio_path': reference_audio_path,
                'created_at': now,
                'updated_at': now
            }
        except Exception as e:
            print(f"Error creating voice profile: {e}")
            return None
        finally:
            conn.close()

    @staticmethod
    def list_by_user(user_id: int) -> list:
        """List all voice profiles for a user"""
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(
                'SELECT * FROM voice_profiles WHERE user_id = ? ORDER BY created_at DESC',
                (user_id,)
            )
            rows = cursor.fetchall()

            return [dict(row) for row in rows]
        except Exception as e:
            print(f"Error listing voice profiles: {e}")
            return []
        finally:
            conn.close()

    @staticmethod
    def get_by_id(profile_id: int, user_id: int) -> dict:
        """Get a single voice profile by id, scoped to user"""
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(
                'SELECT * FROM voice_profiles WHERE id = ? AND user_id = ?',
                (profile_id, user_id)
            )
            row = cursor.fetchone()

            return dict(row) if row else None
        except Exception as e:
            print(f"Error fetching voice profile: {e}")
            return None
        finally:
            conn.close()

    @staticmethod
    def delete(profile_id: int, user_id: int) -> bool:
        """Delete a voice profile record"""
        conn = sqlite3.connect(DB_PATH)
        try:
            cursor = conn.cursor()

            cursor.execute(
                'DELETE FROM voice_profiles WHERE id = ? AND user_id = ?',
                (profile_id, user_id)
            )

            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deleting voice profile: {e}")
            return False
        finally:
            conn.close()
