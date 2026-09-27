---
name: fase2-realtime-gama-voz
description: Workflow Fase 2 — Socket.IO realtime para GAMA_VOZ (transcrição ao vivo)
type: workflow
status: in-progress
phase: 2
created: 2026-09-07
owner: @dev (Dex)
dependencies:
  - fase1-auth-protected
---

# Fase 2 — Realtime / Socket.IO (GAMA_VOZ)

**Procedimento (seguindo Fase 1 — auth primeiro, depois funcionalidade):**

1. **Dependência (Fase 1)** ✅ — todas rotas STT/TTS protegidas (`@require_auth`)
2. **Instalar** `flask-socketio` (backend) + `socket.io-client` (frontend)
3. **Backend** — inicializar `SocketIO(app)`; evento `transcription_chunk` emissor a cada 3s
4. **Frontend** (`STT.tsx`) — conectar via `io(API_BASE_URL)`; ouvir `chunk`; atualizar `liveText` em tempo real
5. **Gate QA** — latência < 500ms; sem falha de conexão

## Componentes

| Arquivo | Ação | Status |
|---------|------|--------|
| `backend/requirements.txt` | + flask-socketio | ✅ editado |
| `backend/app.py` | + SocketIO(app, cors_allowed_origins="*"); evento `transcription_chunk` | ⏳ pendente |
| `frontend/package.json` | + socket.io-client | ⏳ pendente |
| `frontend/src/components/STT.tsx` | + `io()` listener + `emit` chunk | ⏳ pendente |
| `workflows/fase2-realtime-gama-voz.md` | Registro | ✅ criado |

## Regra do workflow (igual Fase 1)

- Sem auth = bloqueado (já feito)
- Sem token no header = 401 (já feito)
- Realtime não substitui REST, complementa (chunks em paralelo ao endpoint `/api/stt/transcribe`)
