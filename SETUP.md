# 🎤 GAMA VOZ — Guia de Instalação

Instruções passo a passo para clonar e instalar o GAMA VOZ em outro PC.

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Git** (para clonar o repositório)
  - Download: https://git-scm.com/
  - Verifique: `git --version`

- **Node.js 18+** (para rodar a aplicação)
  - Download: https://nodejs.org/
  - Verifique: `node --version`

- **npm** (gerenciador de pacotes — vem com Node.js)
  - Verifique: `npm --version`

---

## 🚀 Instalação Passo a Passo

### **PASSO 1: Clonar o repositório**

Abra o terminal/prompt de comando e execute:

```bash
git clone https://github.com/agenciagamastudio/Gama-Voice-IA.git
cd Gama-Voice-IA
```

Isso vai baixar todo o projeto (~500 MB). Pode levar alguns minutos.

---

### **PASSO 2: Navegar para a pasta GAMA_VOZ**

```bash
cd Desktop/O_GRANDE_PROJETO/GAMA_VOZ
```

---

### **PASSO 3: Instalar dependências do backend**

O backend é um servidor Python com a API de speech-to-text.

```bash
cd backend
pip install -r requirements.txt
```

**Nota:** Você precisa ter Python 3.9+ instalado. Se não tiver:
- Download: https://www.python.org/
- Durante a instalação, marque "Add Python to PATH"

Se estiver usando `pip3` em vez de `pip`:

```bash
pip3 install -r requirements.txt
```

---

### **PASSO 4: Instalar dependências do frontend**

O frontend é uma aplicação Next.js/React.

```bash
cd ../frontend
npm install
```

Isso vai instalar todos os pacotes necessários (~500 MB em node_modules). Pode levar 2-5 minutos.

---

### **PASSO 5: Configurar variáveis de ambiente (se necessário)**

Verifique se existe um arquivo `.env.local` na pasta `frontend/`:

```bash
ls frontend/.env.local
```

Se não existir, crie um:

```bash
cd frontend
echo VITE_API_BASE_URL=http://localhost:5001 > .env.local
cd ..
```

---

### **PASSO 6: Iniciar o backend**

Em um terminal, execute:

```bash
cd backend
python -m uvicorn main:app --reload --port 5001
```

Ou:

```bash
python3 -m uvicorn main:app --reload --port 5001
```

Você deve ver:

```
INFO:     Uvicorn running on http://127.0.0.1:5001
INFO:     Application startup complete
```

**⚠️ Deixe este terminal aberto!**

---

### **PASSO 7: Iniciar o frontend (novo terminal)**

Abra um **novo terminal** e execute:

```bash
cd Desktop/O_GRANDE_PROJETO/GAMA_VOZ/frontend
npm run dev
```

Você deve ver:

```
VITE v5.0.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  press h + enter to show help
```

---

### **PASSO 8: Acessar a aplicação**

Abra seu navegador e vá para:

```
http://localhost:5173
```

Você deve ver a interface GAMA VOZ com:
- 🎤 Círculo interativo (waveform)
- 📊 Painel de histórico
- 🎙️ Botões de controle

---

## ✅ Testes rápidos

1. **Teste 1: Waveform interativa**
   - Clique no círculo verde
   - Fale algo no microfone
   - Observe o círculo reagindo em tempo real
   - Clique novamente para parar

2. **Teste 2: Transcrição**
   - Após parar, aguarde alguns segundos
   - Você deve ver o texto transcrito abaixo do círculo

3. **Teste 3: Histórico**
   - Gravações anteriores aparecem na esquerda
   - Clique em uma anterior para recarregá-la

---

## 🛑 Parar a aplicação

Quando terminar:

1. **Terminal do frontend:** Pressione `Ctrl+C`
2. **Terminal do backend:** Pressione `Ctrl+C`

---

## 🐛 Troubleshooting

### Erro: "git: command not found"
- Git não está instalado ou não está no PATH
- Reinstale Git: https://git-scm.com/

### Erro: "python/python3: command not found"
- Python não está instalado ou não está no PATH
- Reinstale Python: https://www.python.org/
- ⚠️ Durante instalação, marque "Add Python to PATH"

### Erro: "npm: command not found"
- Node.js não está instalado ou não está no PATH
- Reinstale Node.js: https://nodejs.org/

### Erro: "Port 5001 already in use"
- Outra aplicação está usando a porta 5001
- Opção 1: Encerre a outra aplicação
- Opção 2: Use outra porta:
  ```bash
  python -m uvicorn main:app --reload --port 5002
  ```
  E ajuste o `.env.local`:
  ```
  VITE_API_BASE_URL=http://localhost:5002
  ```

### Erro: "Microfone não funciona"
- Verifique se o navegador tem permissão para acessar o microfone
- Clique no ícone de câmera na barra de endereço do navegador
- Selecione "Permitir" para http://localhost:5173

### Erro: "Transcrição falha"
- Verifique se o backend está rodando (terminal com "Uvicorn running...")
- Verifique se a URL do backend no `.env.local` está correta

---

## 📁 Estrutura do projeto

```
GAMA_VOZ/
├── backend/                    # API (Python/FastAPI)
│   ├── main.py                # Servidor principal
│   ├── requirements.txt        # Dependências Python
│   └── ...
│
├── frontend/                   # Interface (React/Next.js)
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   ├── pages/            # Páginas
│   │   └── ...
│   ├── .env.local            # Variáveis de ambiente
│   ├── package.json          # Dependências Node.js
│   └── ...
│
└── SETUP.md                   # Este arquivo
```

---

## 🚀 Próximos passos

Depois de instalar:

1. Explore a interface
2. Teste a gravação de áudio
3. Verifique o histórico de transcrições
4. Modifique cores/estilos em `frontend/src/components/AudioVisualizer.tsx`

---

## 📞 Suporte

Se tiver problemas:
1. Verifique se todos os pré-requisitos estão instalados
2. Verifique os logs no terminal do backend
3. Abra o console do navegador (F12) e procure por erros
4. Consulte este guia de troubleshooting acima

---

**Última atualização:** 2026-04-10  
**Versão:** 1.0.0  
**Status:** ✅ Testado e funcional
