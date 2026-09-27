---
name: fase3-monetizacao-gama-voz
description: Workflow Fase 3 — Monetização via Lemon Squeezy para GAMA_VOZ (assinatura recorrente)
type: workflow
status: in-progress
phase: 3
created: 2026-09-07
owner: @dev (Dex)
dependencies:
  - fase1-auth-protected
  - fase2-realtime-gama-voz
---

# Fase 3 — Monetização / Lemon Squeezy (GAMA_VOZ)

**Modelo escolhido (via elicitação 2026-09-07):**
- **Tipo:** Assinatura recorrente (mensal + anual)
- **Ativação:** Conta no app (combina com Fase 1 — auth já existe)
- **Gating:** Limites por uso (FREE: X/mês, PRO: ilimitado)

**Procedimento (seguindo padrão Fases 1 e 2):**

1. **Dependência (Fases 1+2)** ✅ — auth existe; realtime não bloqueia monetização
2. **Criar conta Lemon Squeezy** + produtos (Free trial 14d, Pro mensal, Pro anual)
3. **Backend** — webhook endpoint `/api/billing/webhook` valida assinatura; validação periódica (grace period 7d)
4. **Database** — `subscriptions` table (user_id, plan, status, expires_at, ls_subscription_id, ls_customer_id)
5. **Backend** — middleware de quota (`@require_quota(usage_type)`) para STT/TTS/audiobook
6. **Frontend** (`Billing.tsx` novo) — tela de planos + input de chave + status da assinatura
7. **Gate QA** — webhook signature validation; race conditions em ativação; quota reset mensal

## Componentes

| Arquivo | Ação | Status |
|---------|------|--------|
| `backend/auth.py` | + tabela `subscriptions` (SQLite) | ⏳ pendente |
| `backend/billing.py` | + integração Lemon Squeezy API | ⏳ pendente |
| `backend/app.py` | + `/api/billing/*` (plans, activate, status, webhook) | ⏳ pendente |
| `backend/quota.py` | + middleware `@require_quota(usage_type)` | ⏳ pendente |
| `backend/requirements.txt` | + `requests` (webhook + API calls) | ⏳ pendente |
| `frontend/src/components/Billing.tsx` | + UI de planos + ativação | ⏳ pendente |
| `frontend/src/components/DashboardLayout.tsx` | + tab/botão Billing | ⏳ pendente |
| `workflows/fase3-monetizacao-gama-voz.md` | Registro | ✅ criado |

## Regra do workflow (igual Fases 1 e 2)

- Sem auth = bloqueado (já feito)
- Sem subscription ativa = limites FREE (já existia como "sem token"; agora refina)
- Webhook valida `X-Signature` do Lemon Squeezy (HMAC SHA256)
- Quota counters resetam a cada 30 dias (cron interno)

## Limites FREE (sugestão inicial — ajustável)

| Recurso | FREE | PRO |
|---------|------|-----|
| STT (minutos/mês) | 30 | Ilimitado |
| TTS (caracteres/mês) | 10.000 | Ilimitado |
| Audiobook (capítulos/mês) | 1 | Ilimitado |
| Voice clone (perfis) | 0 | 5 |
| Realtime Socket.IO | ❌ | ✅ |

## Decisões pendentes (próxima iteração se usuário quiser)

- [ ] Preço exato Pro mensal/anual (sugestão: R$29/mês, R$290/ano — 17% off)
- [ ] Limite FREE ajustar para cima/baixo baseado em feedback
- [ ] Webhook URL pública (precisa deploy em domínio ou ngrok para testes)
- [ ] Cron de reset de quota (BullMQ + Dragonfly? ou APScheduler in-process?)

## Próximo passo

Delegar para **@dev (Dex)** via workflow SDC, ou execução direta já que as decisões estão tomadas.
