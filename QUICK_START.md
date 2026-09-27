# ⚡ GAMA VOZ — Quick Start (5 minutos)

## 🍎 macOS / Linux

```bash
# 1. Clonar
git clone https://github.com/agenciagamastudio/Gama-Voice-IA.git
cd Gama-Voice-IA/Desktop/O_GRANDE_PROJETO/GAMA_VOZ

# 2. Instalar (escolha uma opção)

# Opção A: Script automático (recomendado)
chmod +x INSTALAR_GAMA.sh
./INSTALAR_GAMA.sh

# Opção B: Manual
cd backend && pip3 install -r requirements.txt && cd ..
cd frontend && npm install && cd ..

# 3. Rodar

# Terminal 1 - Backend
cd backend
python3 -m uvicorn main:app --reload --port 5001

# Terminal 2 - Frontend
cd frontend
npm run dev

# 4. Abrir navegador
# http://localhost:5173
```

---

## 🪟 Windows

```bash
# 1. Clonar
git clone https://github.com/agenciagamastudio/Gama-Voice-IA.git
cd Gama-Voice-IA\Desktop\O_GRANDE_PROJETO\GAMA_VOZ

# 2. Instalar (escolha uma opção)

# Opção A: Script automático (recomendado) — Double-click
INSTALAR_GAMA.bat

# Opção B: Manual
cd backend && pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..

# 3. Rodar (escolha uma opção)

# Opção A: Script automático — Double-click
INICIAR_GAMA.bat

# Opção B: Manual
# Terminal 1 (cmd ou PowerShell)
cd backend
python -m uvicorn main:app --reload --port 5001

# Terminal 2 (novo cmd ou PowerShell)
cd frontend
npm run dev

# 4. Abrir navegador
# http://localhost:5173
```

---

## ✅ Checklist de verificação

- [ ] Node.js 18+ instalado (`node --version`)
- [ ] Python 3.9+ instalado (`python --version`)
- [ ] Git instalado (`git --version`)
- [ ] Backend rodando em http://localhost:5001
- [ ] Frontend rodando em http://localhost:5173
- [ ] Microfone funcionando no navegador
- [ ] Primeira gravação completou com sucesso

---

## 🆘 Se der erro

**"Port 5001 already in use"**
```bash
# Mude a porta:
python -m uvicorn main:app --reload --port 5002

# E atualize o .env.local:
# frontend/.env.local
VITE_API_BASE_URL=http://localhost:5002
```

**"npm: command not found"**
- Reinstale Node.js: https://nodejs.org/

**"python: command not found"**
- Reinstale Python: https://www.python.org/
- ⚠️ Marque "Add Python to PATH"

**"Microfone não funciona"**
- Clique no ícone 🔒 na barra de endereço
- Selecione "Permitir"

---

## 📚 Documentação completa

Veja `SETUP.md` para instruções detalhadas e troubleshooting avançado.
