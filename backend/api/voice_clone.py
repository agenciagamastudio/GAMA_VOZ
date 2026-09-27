"""
Voice Clone API Endpoints
Gerencia amostras de voz para clonagem zero-shot com Kokoro/KokoClone
"""

import os
import time
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from models import VoiceProfileModel
from auth import require_auth

voice_clone_bp = Blueprint('voice_clone', __name__, url_prefix='/api/voice-clone')

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads', 'voice_samples')
ALLOWED_EXTENSIONS = {'wav', 'mp3'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@voice_clone_bp.route('/upload', methods=['POST'])
@require_auth
def upload_voice_sample():
    """
    Upload amostra de voz (3-5s PT-BR) para clonagem zero-shot.
    POST /api/voice-clone/upload
    Form: file (WAV/MP3), name (string)
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Nenhum arquivo enviado'}), 400

        file = request.files['file']
        voice_name = request.form.get('name', 'Unnamed Voice').strip()

        if not file.filename:
            return jsonify({'error': 'Nome de arquivo inválido'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Apenas arquivos WAV ou MP3 são permitidos'}), 400

        # Validate magic bytes to prevent content-type spoofing
        header = file.read(4)
        file.seek(0)
        is_wav = header[:4] == b'RIFF'
        is_mp3 = header[:3] == b'ID3' or header[:2] in (b'\xff\xfb', b'\xff\xf3', b'\xff\xf2')
        if not (is_wav or is_mp3):
            return jsonify({'error': 'arquivo não é WAV/MP3 válido'}), 400

        # Enforce upload size limit (10 MB)
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)
        if file_size > 10 * 1024 * 1024:
            return jsonify({'error': 'Arquivo excede o limite de 10 MB'}), 400

        # Enforce per-user quota
        existing = VoiceProfileModel.list_by_user(request.user_id)
        if len(existing) >= 10:
            return jsonify({'error': 'limite de 10 perfis de voz atingido'}), 400

        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # Preserve original extension (already validated against whitelist above)
        original_ext = file.filename.rsplit('.', 1)[1].lower()
        safe_name = secure_filename(voice_name.replace(' ', '_'))
        filename = f"{request.user_id}_{safe_name}_{int(time.time())}.{original_ext}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)

        file.save(file_path)

        profile = VoiceProfileModel.create(
            user_id=request.user_id,
            name=voice_name,
            reference_audio_path=file_path
        )

        if not profile:
            os.remove(file_path)
            return jsonify({'error': 'Erro ao salvar perfil de voz'}), 500

        return jsonify({
            'id': profile['id'],
            'name': profile['name'],
            'created_at': profile['created_at']
        }), 201

    except Exception as e:
        print(f"Voice upload error: {e}")
        return jsonify({'error': str(e)}), 500


@voice_clone_bp.route('/list', methods=['GET'])
@require_auth
def list_voice_profiles():
    """
    Lista voice profiles do usuário autenticado.
    GET /api/voice-clone/list
    """
    try:
        profiles = VoiceProfileModel.list_by_user(request.user_id)
        return jsonify([{
            'id': p['id'],
            'name': p['name'],
            'created_at': p['created_at']
        } for p in profiles]), 200

    except Exception as e:
        print(f"List voice profiles error: {e}")
        return jsonify({'error': str(e)}), 500


@voice_clone_bp.route('/<int:profile_id>', methods=['DELETE'])
@require_auth
def delete_voice_profile(profile_id):
    """
    Deleta voice profile e arquivo associado.
    DELETE /api/voice-clone/<id>
    """
    try:
        profile = VoiceProfileModel.get_by_id(profile_id, request.user_id)

        if not profile:
            return jsonify({'error': 'Perfil não encontrado'}), 404

        # Remove arquivo de disco (ignora erro se não existir)
        try:
            os.remove(profile['reference_audio_path'])
        except FileNotFoundError:
            pass

        VoiceProfileModel.delete(profile_id, request.user_id)

        return jsonify({'message': 'Perfil deletado com sucesso'}), 200

    except Exception as e:
        print(f"Delete voice profile error: {e}")
        return jsonify({'error': str(e)}), 500
