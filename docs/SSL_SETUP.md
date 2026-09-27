# 🔐 Configuração de Certificados SSL — GAMA Voz

## Visão Geral

O GAMA Voz usa certificados SSL para comunicação segura entre o frontend e o backend. **As chaves privadas nunca devem ser commitadas no Git.**

## Estrutura de Certificados

```
GAMA_VOZ/
└── frontend/
    ├── certs/          ← Certificados principais (usuário 1)
    │   ├── cert.pem    ← Certificado público
    │   └── key.pem     ← Chave privada (NÃO COMPARTILHAR)
    └── ssl/            ← Certificados alternativos (usuário 2, etc.)
        ├── cert.pem
        └── key.pem
```

## Como Configurar Suas Chaves

### Opção A: Certificados Locais (dev)

Cada usuário cria sua própria pasta de certificados:

```bash
# No seu computador, na pasta GAMA_VOZ/frontend/:

# 1. Crie uma pasta para suas chaves (se ainda não existir)
mkdir -p frontend/certs

# 2. Copie ou gere suas chaves SSL
# Exemplo com OpenSSL:
openssl req -x509 -newkey rsa:2048 -keyout frontend/certs/key.pem -out frontend/certs/cert.pem -days 365 -nodes

# 3. Configure o .env se necessário:
echo "SSL_KEY_PATH=frontend/certs/key.pem" >> .env.local
echo "SSL_CERT_PATH=frontend/certs/cert.pem" >> .env.local
```

### Opção B: Certificados de Produção

Para produção, use certificados emitidos por uma CA (ex: Let's Encrypt, AWS ACM):

```bash
# Exemplo com Let's Encrypt (certbot):
certbot certonly --manual --preferred-challenges dns -d seu-dominio.com

# Copie os certificados para:
# frontend/certs/cert.pem  (fullchain.pem)
# frontend/certs/key.pem   (privkey.pem)
```

## Arquivos Sensíveis

Os seguintes arquivos **NÃO devem** ser commitados:

- `frontend/certs/key.pem` — Chave privada
- `frontend/ssl/key.pem` — Chave privada alternativa
- `.env` — Variáveis de ambiente com secrets
- `backend/.env` — Variáveis de ambiente do backend

Eles já estão listados no `.gitignore`.

## Troubleshooting

### "Permission denied" ao iniciar o backend
Verifique se o key.pem tem permissões corretas:
```bash
chmod 600 frontend/certs/key.pem
```

### Frontend não conecta ao backend
Verifique se `VITE_API_BASE_URL` está correto em `frontend/.env.local`:
```bash
VITE_API_BASE_URL=http://localhost:5001
```
