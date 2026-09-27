#!/usr/bin/env python3
"""
GAMA Voz — Backend com Kokoro TTS (Humanizado)
TTS: Kokoro (natural, humanizada)
STT: Groq Whisper Turbo
"""

import binascii
import os
import sys
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, disconnect
from groq import Groq
import io
import numpy as np
import traceback
import threading

# Audiobook processor
from audiobook_processor import (
    create_audiobook_task,
    get_audiobook_status,
    process_audiobook_queue,
    AUDIOBOOK_QUEUE,
    AUDIOBOOK_QUEUE_LOCK
)

# Authentication
from auth import AuthDB, require_auth
from billing import get_plans, activate_license, deactivate_license, sync_subscription_from_ls, verify_webhook_signature, LS_STORE_ID
from quota import require_quota
from subscriptions import SubscriptionsDB
import time

# License management
from api.license import license_bp
from models import LicenseKeyModel

# Voice clone
from api.voice_clone import voice_clone_bp
from models import VoiceProfileModel

# Try to load .env using python-dotenv, fallback to manual loading
try:
    from dotenv import load_dotenv
    # Load from parent directory (.env is in GAMA_VOZ/, backend is in GAMA_VOZ/backend/)
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
except ImportError:
    # Fallback: manual loading if python-dotenv not available
    env_paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'),
        '.env'
    ]
    for env_file in env_paths:
        if os.path.exists(env_file):
            try:
                with open(env_file) as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            os.environ[key] = value
                print(f"✅ Loaded .env from {env_file}")
                break
            except Exception as e:
                print(f"❌ Error loading {env_file}: {e}")

# Load API key from environment
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

app = Flask(__name__)
CORS(app)

# Realtime Socket.IO — Fase 2 (seguindo workflow da Fase 1: auth primeiro, realtime depois)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Initialize databases
LicenseKeyModel.init_db()
VoiceProfileModel.init_db()

# Register blueprints
app.register_blueprint(license_bp)
app.register_blueprint(voice_clone_bp)

# Configure static files (React build)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_BUILD = os.path.join(os.path.dirname(BASE_DIR), 'frontend', 'dist')

# Check if frontend build exists
if os.path.exists(FRONTEND_BUILD):
    print(f"✅ Frontend build found at {FRONTEND_BUILD}")
else:
    print(f"⚠️  Frontend build not found at {FRONTEND_BUILD} — run 'npm run build' in frontend/")

# Increase timeout for large text synthesis (client-side timeout in frontend should be increased)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 600


# Voice registry - Kokoro Portuguese voices
VOICES_PT_BR = {
    "pm_alex": {"id": "pm_alex", "gender": "male", "description": "Male voice (Portuguese)"},
    "pm_santa": {"id": "pm_santa", "gender": "male", "description": "Male voice (Portuguese)"},
    "pf_dora": {"id": "pf_dora", "gender": "female", "description": "Female voice (Portuguese)"}
}

# Initialize Auth DB
AuthDB.init_db()
SubscriptionsDB.init_db()  # Fase 3: subscriptions + usage_counters

# Initialize TTS engines
from tts_engines import KokoroEngine, PiperEngine, CloneEngine
_kokoro_engine = KokoroEngine()
_piper_engine = PiperEngine()
_clone_engine = CloneEngine()
# Semaphore(1): only one clone synthesis at a time (XTTS-v2 ~57s on CPU).
# Non-blocking acquire returns 503 when occupied so callers get fast feedback.
_clone_semaphore = threading.Semaphore(1)
# Keep kokoro_model as alias used by audiobook_processor (passed directly)
kokoro_model = _kokoro_engine._pipeline


# ============== SOCKET.IO DELEGATION (Fase 2) ==============
# O flask-socketio registra /socket.io/ via middleware interno (socketio.wsgi_app).
# Isso funciona para socketio.run(), mas o Flask test_client() testa contra app direto.
# Para polling handshake sem eventlet, a rota raiz /socket.io/ precisa existir.
# O proxy abaixo é chamado pelo test_client; em produção com socketio.run() é bypassado.

@app.route('/socket.io/', methods=['GET', 'POST'])
def _sio_proxy():
    """Delega /socket.io/ (sem sub-path) ao flask-socketio via handle_request."""
    return socketio.handle_request(request.environ)


@app.route('/socket.io/<path:sio_path>', methods=['GET', 'POST'])
def _sio_proxy_sub(sio_path):
    """Delega /socket.io/subpath ao flask-socketio via handle_request."""
    return socketio.handle_request(request.environ)


# ============== SERVE REACT FRONTEND ==============


# ============== SERVE REACT FRONTEND (MUST BE BEFORE /<path:filename> CATCH-ALL) ==============


@app.route('/', methods=['GET', 'HEAD'])
def serve_root():
    """Serve React app index.html"""
    if not os.path.exists(FRONTEND_BUILD):
        return jsonify({'error': 'Frontend build not found. Run npm run build in frontend/'}), 404

    index_path = os.path.join(FRONTEND_BUILD, 'index.html')
    if not os.path.exists(index_path):
        return jsonify({'error': 'index.html not found'}), 404

    return send_from_directory(FRONTEND_BUILD, 'index.html')


@app.route('/<path:filename>', methods=['GET', 'HEAD'])
def serve_static(filename):
    """Serve static files from React build"""
    if not os.path.exists(FRONTEND_BUILD):
        return jsonify({'error': 'Frontend build not found'}), 404

    # Try to serve the requested file
    file_path = os.path.join(FRONTEND_BUILD, filename)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_BUILD, filename)

    # If file doesn't exist, return index.html for SPA routing (React Router)
    return send_from_directory(FRONTEND_BUILD, 'index.html')


# ============== API ENDPOINTS ==============

@app.route('/health', methods=['GET'])
def health():
    if _kokoro_engine.is_available:
        tts_status = "kokoro"
    elif _piper_engine.is_available:
        tts_status = "piper"
    else:
        tts_status = "unavailable"
    return jsonify({
        'status': 'ok',
        'service': 'GAMA Voz',
        'tts': tts_status,
        'kokoro': _kokoro_engine.is_available,
        'piper': _piper_engine.is_available,
    }), 200

# ============== AUTHENTICATION ENDPOINTS ==============

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Registra novo usuário"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '')

        if not email or not password or len(password) < 6:
            return jsonify({'error': 'Email e senha (mín 6 caracteres) são obrigatórios'}), 400

        result = AuthDB.register_user(email, password, name)

        if not result['success']:
            return jsonify({'error': result['error']}), 400

        return jsonify({
            'message': 'Usuário registrado com sucesso',
            'user_id': result['user_id'],
            'email': email
        }), 201

    except Exception as e:
        print(f"❌ Register error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Faz login e retorna token JWT"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email e senha são obrigatórios'}), 400

        user = AuthDB.get_user(email)

        if not user or not AuthDB.verify_password(password, user['password_hash']):
            return jsonify({'error': 'Email ou senha incorretos'}), 401

        token = AuthDB.create_token(user['id'], user['email'])

        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name']
            }
        }), 200

    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def get_user_info():
    """Retorna informações do usuário autenticado"""
    try:
        user = AuthDB.get_user(request.user_email)

        return jsonify({
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name']
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/config', methods=['GET'])
def config():
    return jsonify({
        'app': 'GAMA Voz',
        'tts': 'kokoro',
        'stt': 'groq-whisper',
        'voices': list(VOICES_PT_BR.keys())
    }), 200

@app.route('/api/tts/voices', methods=['GET'])
def get_voices():
    return jsonify({
        'voices': list(VOICES_PT_BR.keys()),
        'details': VOICES_PT_BR,
        'default': 'pm_alex'
    }), 200

@app.route('/api/tts/synthesize', methods=['POST'])
@require_auth
def synthesize():
    try:
        data = request.json or {}
        text = data.get('text', '').strip()
        voice = data.get('voice', 'pm_alex')
        speed = float(data.get('speed', 1.0))
        engine_preference = data.get('engine', 'auto')  # 'auto' | 'kokoro' | 'piper'
        voice_profile_id = data.get('voice_profile_id')  # optional int — triggers clone path

        print(f"🎙️ TTS Request: text='{text[:50]}...', voice={voice}, speed={speed}, engine={engine_preference}, voice_profile_id={voice_profile_id}")

        # Validations
        if not text or len(text) > 50000:
            return jsonify({'error': 'Invalid text (max 50000 characters)'}), 400
        if voice not in VOICES_PT_BR:
            return jsonify({'error': 'Invalid voice'}), 400
        if not (0.5 <= speed <= 2.0):
            return jsonify({'error': 'Invalid speed'}), 400
        if engine_preference not in ('auto', 'kokoro', 'piper'):
            return jsonify({'error': 'Invalid engine (use: auto, kokoro, piper)'}), 400

        # --- Voice profile / clone path ---
        if voice_profile_id is not None:
            # require_auth decorator already set request.user_id — just use it
            # Validate profile ownership (prevents IDOR)
            try:
                voice_profile_id_int = int(voice_profile_id)
            except (ValueError, TypeError):
                return jsonify({'error': 'voice_profile_id inválido'}), 400
            profile = VoiceProfileModel.get_by_id(voice_profile_id_int, user_id)
            if not profile:
                return jsonify({'error': 'Perfil de voz não encontrado'}), 404

            # Clone engine stub — returns 501 until model is installed
            if not _clone_engine.is_available:
                return jsonify({'error': 'Clonagem de voz ainda não disponível nesta versão'}), 501

            # Concurrency guard: XTTS-v2 synthesis takes ~57s on CPU.
            # Only one request may synthesize at a time; others get 503.
            if not _clone_semaphore.acquire(blocking=False):
                return jsonify({
                    'error': 'clonagem em andamento, tente novamente em alguns instantes'
                }), 503
            try:
                wav_bytes = _clone_engine.synthesize(
                    text,
                    speed=speed,
                    reference_audio_path=profile['reference_audio_path'],
                )
            finally:
                _clone_semaphore.release()
            audio_buffer = io.BytesIO(wav_bytes)
            response = send_file(audio_buffer, mimetype='audio/wav')
            response.headers['X-TTS-Source'] = 'clone'
            return response, 200

        # TTS via engine abstraction — supports forced engine or auto fallback
        wav_bytes = None
        source = None

        if engine_preference == 'kokoro':
            # Force Kokoro — no fallback
            if not _kokoro_engine.is_available:
                return jsonify({'error': 'Kokoro engine not available'}), 503
            try:
                print(f"  → Generating with Kokoro (forced)...")
                wav_bytes = _kokoro_engine.synthesize(text, voice=voice, speed=speed)
                source = "kokoro"
                print(f"  ✅ Kokoro audio ready: {len(wav_bytes)} bytes")
            except Exception as e:
                print(f"  ❌ Kokoro synthesis error: {e}")
                traceback.print_exc()
                return jsonify({'error': f'Kokoro synthesis failed: {e}'}), 500

        elif engine_preference == 'piper':
            # Force Piper — no fallback
            if not _piper_engine.is_available:
                return jsonify({'error': 'Piper engine not available'}), 503
            try:
                print(f"  → Generating with Piper (forced)...")
                wav_bytes = _piper_engine.synthesize(text, speed=speed)
                source = "piper"
                print(f"  ✅ Piper audio ready: {len(wav_bytes)} bytes")
            except Exception as e:
                print(f"  ❌ Piper synthesis error: {e}")
                traceback.print_exc()
                return jsonify({'error': f'Piper synthesis failed: {e}'}), 500

        else:
            # Auto: Kokoro primary, Piper fallback
            if _kokoro_engine.is_available:
                try:
                    print(f"  → Generating with Kokoro...")
                    wav_bytes = _kokoro_engine.synthesize(text, voice=voice, speed=speed)
                    source = "kokoro"
                    print(f"  ✅ Kokoro audio ready: {len(wav_bytes)} bytes")
                except Exception as e:
                    print(f"  ⚠️ Kokoro failed, trying Piper fallback: {e}")
                    traceback.print_exc()

            if wav_bytes is None and _piper_engine.is_available:
                try:
                    print(f"  → Generating with Piper (fallback)...")
                    wav_bytes = _piper_engine.synthesize(text, speed=speed)
                    source = "piper"
                    print(f"  ✅ Piper audio ready: {len(wav_bytes)} bytes")
                except Exception as e:
                    print(f"  ❌ Piper synthesis error: {e}")
                    traceback.print_exc()

        if wav_bytes is None:
            print(f"  ❌ No TTS engine available")
            return jsonify({'error': 'No TTS engine available'}), 503

        audio_buffer = io.BytesIO(wav_bytes)
        response = send_file(audio_buffer, mimetype='audio/wav')
        response.headers['X-TTS-Source'] = source
        return response, 200

    except Exception as e:
        print(f"❌ Synthesize error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/process', methods=['POST'])
@require_auth
def process_audio_effects():
    """Apply post-processing effects to audio (pitch, reverb, compressor, EQ)"""
    from audio_effects import AudioEffects
    from base64 import b64decode, b64encode

    try:
        data = request.json or {}
        audio_base64 = data.get('audio')
        effects = data.get('effects', {})

        if not audio_base64:
            return jsonify({'error': 'audio is required (base64 encoded WAV)'}), 400

        if not isinstance(effects, dict):
            return jsonify({'error': 'effects must be a JSON object'}), 400

        invalid_vals = {k: type(v).__name__ for k, v in effects.items() if not isinstance(v, dict)}
        if invalid_vals:
            return jsonify({
                'error': f'Valores de efeitos inválidos (devem ser objetos JSON): {invalid_vals}. '
                         f'Chaves válidas: pitch_shift, time_stretch, reverb, compressor, eq_bass_boost'
            }), 400

        if len(audio_base64) > 10_000_000:  # ~7.5MB WAV
            return jsonify({'error': 'Áudio muito grande (limite ~7.5MB)'}), 413

        try:
            wav_bytes = b64decode(audio_base64)
        except binascii.Error:
            return jsonify({'error': 'base64 inválido'}), 400

        processed, skipped = AudioEffects.process(wav_bytes, effects)

        return jsonify({
            'audio': b64encode(processed).decode(),
            'effects_applied': list(effects.keys()),
            'skipped_effects': skipped,
        }), 200

    except Exception as e:
        print(f"❌ Audio effects error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/stt/transcribe', methods=['POST'])
@require_auth
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'Audio required'}), 400

        audio = request.files['audio']
        lang = request.form.get('language', 'pt')

        if not GROQ_API_KEY:
            return jsonify({'error': 'STT not configured'}), 503

        groq = Groq(api_key=GROQ_API_KEY)
        result = groq.audio.transcriptions.create(
            file=(audio.filename, audio.stream, audio.content_type),
            model='whisper-large-v3-turbo',
            language=lang
        )

        return jsonify({'text': result.text, 'language': lang}), 200

    except Exception as e:
        print(f"❌ Transcribe error: {e}")
        return jsonify({'error': str(e)}), 500


# ============== STT HISTORY FILES ==============

from pathlib import Path
from datetime import datetime

TRANSCRIPTIONS_DIR = Path.home() / 'Documents' / 'GAMA_VOZ' / 'Transcricoes'


def _write_transcription_file(record: dict) -> bool:
    """Escreve um .md para o registro se ainda não existir. Retorna True se criou."""
    text = (record.get('text') or '').strip()
    if not text:
        return False
    ts_ms = record.get('timestamp') or 0
    rec_id = str(record.get('id') or '')
    # sufixo estável do id para evitar colisão de nomes no mesmo segundo
    suffix = ''.join(c for c in rec_id if c.isalnum())[-6:] or 'x'
    dt = datetime.fromtimestamp(ts_ms / 1000) if ts_ms else datetime.now()
    filename = f"{dt.strftime('%Y-%m-%d_%H-%M-%S')}_{suffix}.md"
    TRANSCRIPTIONS_DIR.mkdir(parents=True, exist_ok=True)
    filepath = TRANSCRIPTIONS_DIR / filename
    if filepath.exists():
        return False
    header = f"# Transcrição — {dt.strftime('%d/%m/%Y %H:%M:%S')}\n\n"
    filepath.write_text(header + text + '\n', encoding='utf-8')
    return True


@app.route('/api/stt/history/save-file', methods=['POST'])
@require_auth
def save_history_file():
    """Salva uma transcrição como arquivo .md em Documentos/GAMA_VOZ/Transcricoes"""
    try:
        record = request.get_json(silent=True) or {}
        created = _write_transcription_file(record)
        return jsonify({'saved': created, 'folder': str(TRANSCRIPTIONS_DIR)}), 200
    except Exception as e:
        print(f"❌ Save history file error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/stt/history/open-folder', methods=['POST'])
@require_auth
def open_history_folder():
    """Sincroniza os registros recebidos para a pasta e abre o Explorer nela"""
    try:
        payload = request.get_json(silent=True) or {}
        records = payload.get('records') or []
        created = 0
        for record in records:
            if isinstance(record, dict) and _write_transcription_file(record):
                created += 1
        TRANSCRIPTIONS_DIR.mkdir(parents=True, exist_ok=True)
        try:
            os.startfile(str(TRANSCRIPTIONS_DIR))  # Windows Explorer
        except AttributeError:
            import subprocess
            subprocess.Popen(['xdg-open', str(TRANSCRIPTIONS_DIR)])
        return jsonify({'synced': created, 'folder': str(TRANSCRIPTIONS_DIR)}), 200
    except Exception as e:
        print(f"❌ Open history folder error: {e}")
        return jsonify({'error': str(e)}), 500


# ============== AUDIOBOOK ENDPOINTS ==============

@app.route('/api/audiobook/create', methods=['POST'])
@require_auth
def create_audiobook():
    """Cria nova tarefa de audiobook"""
    try:
        text = request.form.get('text', '').strip()
        voice = request.form.get('voice', 'pm_alex')
        speed = float(request.form.get('speed', 1.0))
        chunk_mode = request.form.get('chunkMode', 'auto')

        # Optional audio effects chain (JSON-encoded string in form data)
        import json as _json
        effects_raw = request.form.get('effects', '')
        effects = _json.loads(effects_raw) if effects_raw else {}

        if not isinstance(effects, dict):
            return jsonify({'error': 'effects deve ser um objeto JSON'}), 400

        invalid_vals = {k: type(v).__name__ for k, v in effects.items() if not isinstance(v, dict)}
        if invalid_vals:
            return jsonify({
                'error': f'Valores de efeitos inválidos (devem ser objetos JSON): {invalid_vals}. '
                         f'Chaves válidas: pitch_shift, time_stretch, reverb, compressor, eq_bass_boost'
            }), 400

        print(f"📚 Audiobook Request: {len(text)} chars, voice={voice}, mode={chunk_mode}, effects={list(effects.keys())})")

        if not text or len(text) > 500000:
            return jsonify({'error': 'Texto inválido (máx 500k caracteres)'}), 400

        if voice not in VOICES_PT_BR:
            return jsonify({'error': 'Voz inválida'}), 400

        if not (0.5 <= speed <= 2.0):
            return jsonify({'error': 'Velocidade inválida'}), 400

        # Criar tarefa (user_id set atomically inside create_audiobook_task)
        task_id = create_audiobook_task(text, voice, speed, chunk_mode, effects=effects or None,
                                        user_id=request.user_id)

        with AUDIOBOOK_QUEUE_LOCK:
            _n_chunks = len(AUDIOBOOK_QUEUE[task_id]['chunks'])
        print(f"  → Task {task_id}: {_n_chunks} chunks")

        # Aguardar Kokoro estar carregado (máx 60 segundos)
        wait_count = 0
        while not _kokoro_engine.is_available and wait_count < 60:
            time.sleep(1)
            wait_count += 1

        if not _kokoro_engine.is_available:
            return jsonify({'error': 'Kokoro não conseguiu carregar. Tente novamente'}), 503

        # Iniciar processamento em thread
        # audiobook_processor still expects the raw KPipeline object
        thread = threading.Thread(
            target=process_audiobook_queue,
            args=(task_id, _kokoro_engine._pipeline),
            daemon=True
        )
        thread.start()

        with AUDIOBOOK_QUEUE_LOCK:
            _chunks_snapshot = list(AUDIOBOOK_QUEUE[task_id]['chunks'])
            _estimated_time = AUDIOBOOK_QUEUE[task_id]['estimated_time']

        return jsonify({
            'taskId': task_id,
            'chunks': [chunk.to_dict() for chunk in _chunks_snapshot],
            'estimatedTime': _estimated_time
        }), 201

    except Exception as e:
        print(f"❌ Audiobook create error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/audiobook/status/<task_id>', methods=['GET'])
@require_auth
def get_audiobook_status_endpoint(task_id):
    """Get status de processamento"""
    with AUDIOBOOK_QUEUE_LOCK:
        task = AUDIOBOOK_QUEUE.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        if task.get('user_id') != request.user_id:
            return jsonify({'error': 'Task not found'}), 404

    status = get_audiobook_status(task_id)
    if 'error' in status and status.get('error') == 'Task not found':
        return jsonify(status), 404

    return jsonify(status), 200


@app.route('/api/audiobook/download/<task_id>', methods=['GET'])
@require_auth
def download_audiobook(task_id):
    """Download do audiobook final"""
    # Use lock para evitar race condition com background thread
    with AUDIOBOOK_QUEUE_LOCK:
        task = AUDIOBOOK_QUEUE.get(task_id)

        if not task:
            print(f"❌ DOWNLOAD: Task {task_id} não encontrada em AUDIOBOOK_QUEUE")
            return jsonify({'error': 'Tarefa não encontrada'}), 404

        if task.get('user_id') != request.user_id:
            return jsonify({'error': 'Tarefa não encontrada'}), 404

        status = task.get('status')
        print(f"✅ DOWNLOAD: Task encontrada. Status={status}")

        if task['status'] != 'completed':
            return jsonify({'error': f'Audiobook ainda não está pronto (status: {task["status"]})'}), 400

        if 'final_file' not in task:
            print(f"❌ DOWNLOAD: final_file não está em task. Keys: {list(task.keys())}")
            print(f"   Task dict: status={task.get('status')}, temp_dir={task.get('temp_dir')}")
            return jsonify({'error': 'Arquivo não foi criado (final_file não setado)'}), 404

        final_file = task['final_file']
        print(f"✅ DOWNLOAD: final_file={final_file}")

    # Verificar fora do lock (não bloqueia durante I/O)
    if not os.path.exists(final_file):
        print(f"❌ DOWNLOAD: Arquivo não existe em: {final_file}")
        # Debug: check parent directory
        parent_dir = os.path.dirname(final_file)
        if os.path.exists(parent_dir):
            print(f"   Parent dir exists. Contents: {os.listdir(parent_dir)}")
        return jsonify({'error': 'Arquivo não encontrado no servidor'}), 500

    try:
        print(f"📥 DOWNLOAD: Servindo audiobook: {final_file}")
        return send_file(
            final_file,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name=f'audiobook_{task_id}.mp3'
        )
    except Exception as e:
        print(f"❌ DOWNLOAD error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/audiobook/cancel/<task_id>', methods=['POST'])
@require_auth
def cancel_audiobook(task_id):
    """Cancela processamento de audiobook"""
    with AUDIOBOOK_QUEUE_LOCK:
        task = AUDIOBOOK_QUEUE.get(task_id)

        if not task:
            return jsonify({'error': 'Tarefa não encontrada'}), 404

        if task.get('user_id') != request.user_id:
            return jsonify({'error': 'Tarefa não encontrada'}), 404

        if task['status'] in ['completed', 'error', 'cancelled']:
            return jsonify({'error': 'Tarefa não pode ser cancelada'}), 400

        task['status'] = 'cancelled'
        task['finished_at'] = time.time()

    return jsonify({'status': 'cancelled'}), 200


# ============== BILLING / FASE 3 — LEMON SQUEEZY ==============

@app.route('/api/billing/plans', methods=['GET'])
def billing_plans():
    """Retorna planos (free + pro_monthly + pro_yearly)"""
    return jsonify({'plans': get_plans()}), 200


@app.route('/api/billing/status', methods=['GET'])
@require_auth
def billing_status():
    """Status da assinatura do user (subscription + usage + quota)"""
    user_id = request.user_id
    sub = SubscriptionsDB.get_active_subscription(user_id)

    # Se não tem sub ativa → FREE
    if not sub:
        sub_info = {
            'plan': 'free',
            'status': 'inactive',
            'expires_at': None,
            'cancel_at_period_end': False,
        }
    else:
        # Sincroniza com LS se tiver ls_subscription_id
        if sub.get('ls_subscription_id'):
            sync_subscription_from_ls(user_id, sub['ls_subscription_id'])
            # Re-lê
            sub = SubscriptionsDB.get_active_subscription(user_id) or sub

        sub_info = {
            'plan': sub['plan'],
            'status': sub['status'],
            'expires_at': sub.get('current_period_end'),
            'cancel_at_period_end': sub.get('cancel_at_period_end', False),
            'ls_subscription_id': sub.get('ls_subscription_id'),
        }

    usage = SubscriptionsDB.get_usage(user_id)
    is_pro = SubscriptionsDB.is_pro(user_id)

    # Quota para cada tipo (current / limit / remaining)
    quota_summary = {}
    for ut in SubscriptionsDB.get_usage.__code__.co_consts if False else ['stt_seconds', 'tts_chars', 'audiobook_count', 'voice_clones', 'realtime_minutes']:
        # Uso direto: pega current + limit
        # (simplificado — para produção, extrair do DB)
        pass

    # Quota rápida via SubscriptionsDB.check_quota
    quota_summary = {}
    for ut in ['stt_seconds', 'tts_chars', 'audiobook_count', 'voice_clones', 'realtime_minutes']:
        info = SubscriptionsDB.check_quota(user_id, ut)
        quota_summary[ut] = {
            'current': info.get('current', 0),
            'limit': info.get('limit'),
            'remaining': info.get('remaining'),
            'is_pro': info['is_pro'],
        }

    return jsonify({
        'subscription': sub_info,
        'usage': usage,
        'quota': quota_summary,
        'is_pro': is_pro,
    }), 200


@app.route('/api/billing/activate', methods=['POST'])
@require_auth
def billing_activate():
    """Ativa assinatura via chave Lemon Squeezy"""
    user_id = request.user_id
    data = request.get_json(silent=True) or {}
    license_key = data.get('license_key', '').strip()

    if not license_key:
        return jsonify({'error': 'license_key é obrigatório'}), 400

    # Verifica se já tem ativa (evita duplicata)
    existing = SubscriptionsDB.get_active_subscription(user_id)
    if existing and existing.get('status') == 'active' and existing.get('plan') != 'free':
        return jsonify({
            'success': True,
            'message': 'Já possui assinatura ativa',
            'plan': existing['plan'],
            'status': existing['status'],
        }), 200

    result = activate_license(license_key, user_id)
    if result['success']:
        # Se ativou, registra no DB (já feito em activate_license)
        # Busca novamente para confirmar
        sub = SubscriptionsDB.get_active_subscription(user_id)
        return jsonify({
            'success': True,
            'plan': result.get('plan'),
            'status': result.get('status'),
            'expires_at': sub.get('current_period_end') if sub else result.get('expires_at'),
        }), 200
    else:
        return jsonify({'success': False, 'error': result.get('error')}), 400


@app.route('/api/billing/webhook', methods=['POST'])
def billing_webhook():
    """Webhook do Lemon Squeezy — valida assinatura + sincroniza"""
    import flask

    payload = flask.request.get_data()
    signature = flask.request.headers.get('X-Signature', '')

    if not verify_webhook_signature(payload, signature):
        return jsonify({'error': 'Assinatura do webhook inválida'}), 401

    data = flask.request.get_json(silent=True) or {}
    event = data.get('meta', {}).get('event_name', '')

    # Diferentes eventos
    # 'subscription_created' | 'subscription_updated' | 'subscription_cancelled' | 'subscription_expired' | 'subscription_payment_failed'
    # Tenta extrair user_id do event (via custom data) — se não tiver, usa ls_subscription_id para buscar no DB
    ls_subscription_id = data.get('data', {}).get('id', '')

    # Se não tem user_id direto, busca pelo ls_subscription_id
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT user_id FROM subscriptions WHERE ls_subscription_id = ?', (ls_subscription_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        user_id = row[0]
    else:
        # Se ainda não tem user associado, tenta pelo customer
        customer_id = data.get('data', {}).get('attributes', {}).get('customer_id', '')
        cursor = sqlite3.connect(DB_PATH).cursor()
        cursor.execute('SELECT user_id FROM subscriptions WHERE ls_customer_id = ?', (customer_id,))
        row = cursor.fetchone()
        if row:
            user_id = row[0]
        else:
            # Sem associação — loga, retorna 200 (LS espera 200, não 404, para não re-tentar)
            print(f'⚠️  Webhook sem user associado: event={event}, sub_id={ls_subscription_id}')
            return jsonify({'status': 'ok', 'message': 'No associated user — logged'}), 200

    # Processa evento
    if event == 'subscription_created' or event == 'subscription_updated':
        sync_subscription_from_ls(user_id, ls_subscription_id)
    elif event == 'subscription_cancelled':
        SubscriptionsDB.cancel_subscription(user_id)
    elif event == 'subscription_expired':
        SubscriptionsDB.upsert_subscription(user_id, plan='free', status='expired')
    elif event == 'subscription_payment_failed':
        SubscriptionsDB.upsert_subscription(user_id, plan='free', status='past_due')

    return jsonify({'status': 'ok', 'event': event}), 200


@app.route('/api/billing/cancel', methods=['POST'])
@require_auth
def billing_cancel():
    """Cancela assinatura (mantém até fim do período)"""
    user_id = request.user_id
    result = deactivate_license(user_id)
    if result['success']:
        SubscriptionsDB.cancel_subscription(user_id)
        return jsonify({'success': True, 'message': 'Assinatura cancelada. Acesso mantido até o fim do período.'}), 200
    else:
        return jsonify({'success': False, 'error': result.get('error')}), 400


# ============== BILLING STANDALONE (Fase 3) ==============
# Billing UI standalone acessível em /billing — não modifica App.tsx (protegido).
# Frontend React (Billing.tsx) existe mas só é carregado se a build separar.
# Aqui servimos um HTML inline que consome a API diretamente.

@app.route('/billing', methods=['GET'])
@require_auth
def billing_page():
    """Serve página de billing standalone (não requer App.tsx modificado)"""
    html = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GAMA Voz — Assinatura</title>
<style>
:root { --bg:#161616; --surface:#272727; --primary:#88ce11; --text:#fff; }
* { box-sizing:border-box; }
body { margin:0; font-family:system-ui; background:var(--bg); color:var(--text); min-height:100vh; }
.container { max-width:960px; margin:0 auto; padding:48px 24px; }
h1 { color:var(--primary); font-size:28px; margin:0 0 8px; }
.subtitle { color:#999; margin:0 0 32px; font-size:14px; }
.status { background:#1a1a1a; border:1px solid #333; border-radius:12px; padding:20px; margin-bottom:24px; }
.status h3 { margin:0 0 12px; font-size:16px; }
.status-row { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.badge { padding:4px 12px; border-radius:999px; font-weight:bold; font-size:12px; }
.badge.free { background:#333; color:#ccc; }
.badge.pro { background:rgba(136,206,17,0.2); color:var(--primary); }
.status-row span { color:#aaa; font-size:14px; }
.quota { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin-top:12px; }
.quota-item { background:#161616; border:1px solid #333; border-radius:8px; padding:8px 10px; font-size:11px; color:#aaa; }
.quota-item .v { color:var(--primary); font-size:14px; font-weight:bold; }
.plans { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; margin-bottom:24px; }
.card { background:var(--surface); border:1px solid #333; border-radius:16px; padding:24px; transition:all .2s; }
.card:hover { border-color:var(--primary); box-shadow:0 0 20px rgba(136,206,17,0.15); }
.card.pro { border-color:rgba(136,206,17,0.4); }
.card h3 { margin:0 0 4px; font-size:20px; }
.card h3.ico { display:flex; align-items:center; gap:8px; }
.card h3.ico::before { content:"\\1F451"; }
.card h3.ico.free::before { content:"\\26A1"; }
.price { font-size:28px; font-weight:bold; margin:8px 0; }
.price small { font-size:13px; color:#999; font-weight:normal; }
.features { list-style:none; padding:0; margin:16px 0; font-size:14px; color:#ccc; }
.features li { padding:4px 0; }
.features li::before { content:"\\2713 "; color:var(--primary); margin-right:6px; }
.license-form { background:#1a1a1a; border:1px solid #333; border-radius:12px; padding:20px; margin-bottom:24px; }
.license-form label { display:block; font-size:13px; color:#aaa; margin-bottom:8px; }
.license-form input { width:100%; padding:12px 14px; border-radius:8px; border:1px solid #333; background:var(--surface); color:#fff; font-size:14px; margin-bottom:12px; }
.license-form input:focus { outline:none; border-color:var(--primary); }
.license-form button { width:100%; padding:12px; border-radius:8px; background:var(--primary); color:#161616; font-weight:bold; border:none; font-size:15px; cursor:pointer; transition:background .2s; }
.license-form button:hover:not(:disabled) { background:#a3d500; }
.license-form button:disabled { opacity:0.5; cursor:not-allowed; }
.msg { margin-top:8px; font-size:13px; min-height:18px; }
.msg.ok { color:var(--primary); }
.msg.err { color:#ff6b6b; }
.cancel-zone { background:#1a1a1a; border:1px solid rgba(255,99,99,0.3); border-radius:12px; padding:20px; }
.cancel-zone h3 { margin:0 0 8px; color:#ff8080; font-size:16px; }
.cancel-zone p { margin:0 0 12px; font-size:13px; color:#999; }
.cancel-zone button { background:rgba(220,38,38,0.2); color:#fca5a5; border:1px solid rgba(220,38,38,0.4); padding:10px 16px; border-radius:8px; cursor:pointer; font-size:14px; }
.cancel-zone button:hover { background:rgba(220,38,38,0.3); }
</style>
</head>
<body>
<div class="container">
<h1>GAMA Voz — Assinatura</h1>
<p class="subtitle">Ative o Pro para acesso ilimitado e recursos premium.</p>

<div class="status">
  <h3>Seu plano</h3>
  <div class="status-row" id="planRow">
    <span class="badge free">FREE</span><span>Carregando...</span>
  </div>
  <div class="quota" id="quotaRow"></div>
</div>

<div class="plans">
  <div class="card">
    <h3 class="ico free">Free</h3>
    <div class="price">R$ 0 <small>/mês</small></div>
    <ul class="features">
      <li>30 min de transcrição / mês</li>
      <li>10.000 caracteres TTS / mês</li>
      <li>1 audiobook / mês</li>
      <li>Suporte da comunidade</li>
    </ul>
  </div>
  <div class="card pro">
    <h3 class="ico">Pro Mensal</h3>
    <div class="price">R$ 29 <small>/mês</small></div>
    <ul class="features">
      <li>Transcrições ilimitadas (STT)</li>
      <li>Síntese de voz ilimitada (TTS)</li>
      <li>Audiobooks ilimitados</li>
      <li>5 clones de voz (XTTS)</li>
      <li>Realtime Socket.IO</li>
    </ul>
  </div>
  <div class="card pro">
    <h3 class="ico">Pro Anual</h3>
    <div class="price">R$ 290 <small>/ano</small></div>
    <ul class="features">
      <li>Tudo do Pro Mensal</li>
      <li>2 meses grátis</li>
      <li>Suporte prioritário</li>
    </ul>
  </div>
</div>

<div class="license-form">
  <label for="licenseInput">Ativar chave de licença (Lemon Squeezy)</label>
  <input id="licenseInput" type="text" placeholder="LS-key-xxxx-xxxx..." />
  <button id="btnActivate" onclick="activateLicense()">Confirmar ativação</button>
  <div id="msg" class="msg"></div>
</div>

<div class="cancel-zone" id="cancelZone" style="display:none">
  <h3>Cancelar assinatura</h3>
  <p>O cancelamento é imediato: a assinatura não renova, mas você mantém acesso até o fim do período pago.</p>
  <button onclick="cancelSubscription()">Cancelar assinatura</button>
</div>

</div>
<script>
const token = localStorage.getItem('gama_voz_token');
const apiBase = (window.location.origin || (window.location.protocol + '//' + window.location.hostname + ':8000'));

if (!token) { window.location.href = '/'; }

async function loadStatus() {
  try {
    const res = await fetch(apiBase + '/api/billing/status', { headers: { Authorization: 'Bearer ' + token } });
    if (res.status === 401) { window.location.href = '/'; return; }
    const d = await res.json();
    const planRow = document.getElementById('planRow');
    const isPro = d.is_pro;
    planRow.innerHTML = '<span class="badge ' + (isPro ? 'pro' : 'free') + '">' + (isPro ? 'PRO' : 'FREE') + '</span>'
      + '<span>Plano: ' + (d.subscription?.plan || 'free') + '</span>'
      + (d.subscription?.current_period_end ? '<span>Renova: ' + new Date(d.subscription.current_period_end).toLocaleDateString('pt-BR') + '</span>' : '');
    if (isPro) document.getElementById('cancelZone').style.display = 'block';

    // Quota cards
    const quotaRow = document.getElementById('quotaRow');
    if (d.quota) {
      quotaRow.innerHTML = Object.entries(d.quota).map(([k, v]) =>
        '<div class="quota-item"><div>' + k.toUpperCase().replace('_', ' ') + '</div><div class="v">' + (v.current || 0) + (v.limit ? ' / ' + v.limit : ' \\u221E') + '</div></div>'
      ).join('');
    }
  } catch (e) {
    document.getElementById('planRow').innerHTML = '<span class="badge free">FREE</span><span>Erro ao carregar</span>';
  }
}

async function activateLicense() {
  const key = document.getElementById('licenseInput').value.trim();
  const msg = document.getElementById('msg');
  if (!key) { msg.textContent = 'Digite a chave.'; msg.className = 'msg err'; return; }
  document.getElementById('btnActivate').disabled = true;
  msg.textContent = 'Ativando...'; msg.className = 'msg';
  try {
    const res = await fetch(apiBase + '/api/billing/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ license_key: key })
    });
    const d = await res.json();
    if (d.success) {
      msg.textContent = '\\u2705 Ativado com sucesso! Recarregando...';
      msg.className = 'msg ok';
      setTimeout(() => window.location.reload(), 1500);
    } else {
      msg.textContent = '\\u274C ' + (d.error || 'Erro ao ativar');
      msg.className = 'msg err';
    }
  } catch (e) {
    msg.textContent = '\\u274C Erro de rede';
    msg.className = 'msg err';
  } finally {
    document.getElementById('btnActivate').disabled = false;
  }
}

async function cancelSubscription() {
  if (!confirm('Tem certeza? Acesso mantido até o fim do período.')) return;
  try {
    const res = await fetch(apiBase + '/api/billing/cancel', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
    const d = await res.json();
    alert(d.success ? 'Cancelado. Acesso até fim do período.' : 'Erro: ' + d.error);
    if (d.success) setTimeout(() => window.location.reload(), 1000);
  } catch (e) { alert('Erro de rede'); }
}
loadStatus();
</script>
</body>
</html>'''
    return html, 200, {'Content-Type': 'text/html; charset=utf-8'}


# ============== SOCKET.IO REALTIME HANDLERS (FASE 2) ==============
# Eventos para transcrição ao vivo via WebSocket.
# Auth via Bearer token no handshake, validado em cada evento.

@socketio.on('connect')
def handle_connect():
    """Valida token ao conectar via query string ou header."""
    token = request.args.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '')
    if token and AuthDB.verify_token(token):
        user = AuthDB.get_user_by_id(AuthDB._decode_token(token).get('user_id'))
        if user:
            print(f'✅ Socket connected: user={user["email"]}')
            emit('connected', {'status': 'ok', 'user': user['email']})
            return  # emit() called, connection accepted
    print('❌ Socket auth failed — disconnecting')
    disconnect()
    return False


@socketio.on('transcribe_chunk')
def handle_transcribe_chunk(data):
    """
    Recebe chunk de áudio e retorna transcrição parcial.
    data: { audio_base64: str, language: str, session_id: str }
    """
    import base64
    try:
        audio_b64 = data.get('audio_base64', '')
        language = data.get('language', 'pt')
        session_id = data.get('session_id', '')

        if not audio_b64:
            emit('transcription_chunk', {'error': 'audio_base64 ausente'}, to=request.sid)
            return

        # Decodifica áudio
        audio_bytes = base64.b64decode(audio_b64)
        audio_io = io.BytesIO(audio_bytes)
        audio_io.name = 'chunk.webm'

        # Transcreve via Groq
        client = Groq(api_key=GROQ_API_KEY)
        with open(audio_io.name, 'wb') as f:
            f.write(audio_bytes)
        with open(audio_io.name, 'rb') as f:
            transcription = client.audio.transcriptions.create(
                file=f,
                model='whisper-large-v3-turbo',
                language=language if language != 'auto' else None,
                response_format='json',
                temperature=0.0,
            )
        os.remove(audio_io.name)

        text = transcription.text.strip()
        print(f'🔊 Realtime chunk: "{text}"')
        emit('transcription_chunk', {
            'text': text,
            'session_id': session_id,
            'timestamp': time.time(),
        })

    except Exception as e:
        print(f'❌ Socket transcribe error: {e}')
        emit('transcription_chunk', {'error': str(e)}, to=request.sid)


# Troca app.run por socketio.run para suportar WebSocket
if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=8000, debug=False)
