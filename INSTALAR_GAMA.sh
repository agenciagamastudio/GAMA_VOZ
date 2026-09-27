#!/bin/bash

# ========================================
# GAMA VOZ - Script de Instalação (Linux/Mac)
# ========================================

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  🎤 GAMA VOZ - Script de Instalação Automática  ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Verificar Node.js
echo "[1/5] Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale em https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js detectado: $(node --version)"

# Verificar Python
echo "[2/5] Verificando Python..."
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "❌ Python não encontrado. Instale em https://www.python.org/"
        exit 1
    fi
    PYTHON=python
else
    PYTHON=python3
fi
echo "✅ Python detectado: $($PYTHON --version)"

# Instalar dependências do backend
echo "[3/5] Instalando dependências do backend..."
cd backend
$PYTHON -m pip install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências do backend"
    exit 1
fi
cd ..
echo "✅ Backend pronto"

# Instalar dependências do frontend
echo "[4/5] Instalando dependências do frontend..."
cd frontend
npm install --silent
if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências do frontend"
    exit 1
fi
cd ..
echo "✅ Frontend pronto"

# Criar .env.local se não existir
echo "[5/5] Configurando variáveis de ambiente..."
if [ ! -f "frontend/.env.local" ]; then
    echo "VITE_API_BASE_URL=http://localhost:5001" > "frontend/.env.local"
    echo "✅ Arquivo .env.local criado"
else
    echo "✅ Arquivo .env.local já existe"
fi

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  ✅ Instalação concluída com sucesso!         ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "🚀 Para iniciar a aplicação:"
echo ""
echo "  1. Backend:"
echo "     cd backend"
echo "     python3 -m uvicorn main:app --reload --port 5001"
echo ""
echo "  2. Frontend (novo terminal):"
echo "     cd frontend"
echo "     npm run dev"
echo ""
echo "  3. Acesse em: http://localhost:5173"
echo ""
