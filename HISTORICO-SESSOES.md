# Histórico de sessões — acervo-meishu-sama

Registro técnico das sessões de trabalho no projeto (workflow de ingestão n8n,
banco Supabase e app Next.js). Mantido pra dar continuidade entre sessões e
entre assistentes de IA diferentes que tenham acesso a este projeto.

---

## Sessão — 2026-08-31 / 2026-09-01 (Claude)

**Contexto:** trabalho em paralelo com o ChatGPT no mesmo projeto (n8n +
Supabase). Ambos os assistentes têm acesso de escrita — ver nota de
coordenação no final.

### Diagnóstico do workflow original

- `tipo_estrutura`/`separador_secao`/tags se perdiam na tradução (corrigido
  depois, ver abaixo)
- Sem `on_conflict` no insert de `trechos` → risco de duplicar chunks em
  reprocessamento
- Sem tratamento de erro: falhas derrubavam a execução do n8n sem marcar
  `status_ingestao='erro'` no Supabase, obra ficava presa em "processando"
- `Roteador por Tipo` sem fallback → tipo `video` (válido no schema) era
  descartado silenciosamente

### Migration Supabase (aplicada pelo ChatGPT antes de eu tentar)

- Tabela `lotes_traducao` (obra_id, lote_index, texto_traduzido, status,
  erro_msg, unique(obra_id, lote_index)) — permite retomar tradução
  interrompida
- `UNIQUE(obra_id, chunk_index)` em `trechos` — dedup em reprocessamento

### Workflow n8n (`acervo-meishu-sama`, id `4w8nyqpsj1lHndPl`)

- ChatGPT reestruturou via AI Builder do próprio n8n: removeu nós órfãos/
  duplicados (Firecrawl, extratores antigos, tradutor monolítico antigo),
  fechou o loop de tradução por lote (`Checar Lote Traduzido` →
  `Traduzir Lote Gemini` → `Salvar Lote Traduzido` → volta pro loop → no
  "done" → `Agregar Traducao` → `Chunking do Texto`), corrigiu roteadores
  com fallback, adicionou marcação de erro nos pontos críticos
- Eu (Claude, via n8n MCP) apliquei só o ajuste de resiliência pedido:
  `Traduzir Lote Gemini` não derruba mais a execução inteira quando 1 lote
  falha permanentemente — marca esse lote como erro e o loop segue pros
  próximos. `Salvar Lote Traduzido` ajustado pra aceitar salvar lotes com
  `status='erro'`

### Site (Next.js/Vercel) — commit `23d2e45`

- Bug encontrado: `app/wiki/obras/[id]/page.tsx` e `app/wiki/busca/page.tsx`
  renderizavam `conteudo` sem `whitespace-pre-line` — poemas e palestras
  (que preservam quebra de linha no chunking) apareciam achatados em uma
  linha só no site
- Fix: adicionado `whitespace-pre-line` nos dois `<p>` que renderizam
  trechos. Push direto pra `main`, deploy automático via Vercel

### Erro identificado, sem fix aplicado ainda

- Gemini free tier: `429 RESOURCE_EXHAUSTED — Your prepayment credits are
  depleted`. Causa provável: loop de tradução por lote não tem delay entre
  chamadas (diferente do loop de embedding, que já tem `Wait` de 2,5s).
  RPM do free tier pro `gemini-2.5-flash` é baixo (~5-10 RPM). Opções
  discutidas: (A) adicionar delay no loop de tradução, (B) fallback pra
  provedor gratuito alternativo quando bater rate limit, (C) trocar de
  provedor. Ficou em aberto — usuário resolveu o bloqueio imediato trocando
  a chave, sem aplicar nenhuma das 3 opções ainda

### Pendências conhecidas

- DOCX sem extrator definido (rota existe, sem nó de extração)
- OCR não implementado (PDFs sem camada de texto)
- Delay/rate-limit no loop de tradução (ver acima)
- Teste end-to-end com arquivo real ainda não realizado
- n8n ainda roda em `automacoes-n8n.tvywld.easypanel.host` — migração
  planejada pra VPS Hostinger própria (`personalsupport.tech`, EasyPanel já
  instalado), ainda não feita

### ⚠️ Nota de coordenação — leia antes de mexer

Este projeto tem **dois assistentes de IA com acesso de escrita** ao mesmo
n8n e Supabase (ChatGPT e Claude), sem visibilidade um do outro em tempo
real. Já aconteceu de um preparar uma mudança e descobrir, ao tentar
aplicar, que o outro já tinha feito algo equivalente por fora. Antes de
qualquer edição estrutural no workflow ou no banco: releia o estado atual
primeiro, não assuma que o que você viu há algumas mensagens ainda é o
estado real.
