# GAMA Voz — Frontend Context

**Status:** PRODUCTION STABLE ✅  
**Stack:** React + TypeScript + Vite (port 5000) · Flask backend (port 8000)  
**Design System:** GAMA DS V3 — tokens via CSS custom properties `[data-theme="dark"]`

---

## ⛔ ARQUIVOS PROTEGIDOS — NÃO MODIFICAR SEM INSTRUÇÃO EXPLÍCITA

Esses arquivos estão em estado **PRODUCTION STABLE**. Tudo funciona perfeitamente:
visual, funcional, servidor, áudio, transcrição. **Não refatore, não "melhore", não toque** sem o usuário pedir explicitamente.

| Arquivo | Por que protegido |
|---------|------------------|
| `src/styles/globals.css` | DS V3 completo — tokens, glass, volumetric, keyframes |
| `src/components/ParticleBackground.tsx` | Canvas particle system com mouse interaction — perfeito |
| `src/components/AudioVisualizer.tsx` | Visualizador de áudio validado |
| `src/App.tsx` | Layout, tabs, estrutura geral — estável |
| `src/components/Login.tsx` | Tela de login com partículas — estável |
| `src/components/STT.tsx` | Transcrição de voz — fluxo de gravação perfeito |
| `src/components/TTS.tsx` | Síntese de voz — Kokoro + Edge-TTS integrados |
| `src/components/AudiobookGenerator.tsx` | Gerador de audiobook com polling de status |

### Regra de ouro
> Se não foi pedido mudar, não muda. Lê, analisa, sugere — mas **não edita** esses arquivos por conta própria.

---

## Cores canônicas (DS V3)

| Variável | Hex | Uso |
|----------|-----|-----|
| `--color-primary` | `#88ce11` | Botões, destaques, bordas ativas |
| `#a3d500` | — | Hovers (presente no DS V3 globals) |
| `#6fa80a` | — | Stop escuro de gradientes (scrollbar DS V3) |
| `--color-bg` | `#161616` | Background |
| `--color-surface` | `#272727` | Cards |

Canvas 2D não lê CSS vars — partículas usam `R=136, G=206, B=17` (decomposição de `#88ce11`).

---

## Estrutura de componentes

```
src/
├── App.tsx                    # Shell: tabs STT / TTS / Audiobook
├── components/
│   ├── ParticleBackground.tsx # Canvas fixo, zIndex 0, pointerEvents none
│   ├── AudioVisualizer.tsx    # FFT / waveform do mic
│   ├── STT.tsx                # Speech-to-text (Groq Whisper)
│   ├── TTS.tsx                # Text-to-speech (Kokoro / Edge-TTS)
│   ├── AudiobookGenerator.tsx # TTS em chunks com polling
│   ├── Login.tsx              # Auth screen
│   └── HistoryPanel.tsx       # Histórico de transcrições
├── styles/
│   └── globals.css            # DS V3 completo
└── utils/
    ├── config.ts              # API_BASE_URL
    └── history.ts             # LocalStorage history manager
```

---

## Dev commands

```bash
npm run dev      # Vite HMR em localhost:5000
npm run build    # Build de produção
npm run lint     # ESLint
```

Backend Flask: `cd ../backend && python app.py` (porta 8000)
