# Histórico de sessões — acervo-meishu-sama

Registro técnico das sessões de trabalho no projeto (workflow de ingestão n8n,
banco Supabase e app Next.js). Mantido pra dar continuidade entre sessões e
entre assistentes de IA diferentes que tenham acesso a este projeto.

---

## Sessão — 2026-09-02 (Claude) — Debug: 404 no Traduzir Lote Gemini

**⚠️ PISTA MAIS IMPORTANTE PARA A PRÓXIMA SESSÃO**: o usuário confirmou que o
código original de tradução (versão bem anterior às edições desta sessão)
**conseguia trazer tradução com sucesso**. Ou seja, o 404 é uma regressão
introduzida em algum momento das edições — vale comparar contra o histórico
de versões do workflow no n8n (`get_workflow_history`) pra achar exatamente
o que mudou entre a última versão que funcionava e a atual, em vez de seguir
só tentando variações novas às cegas.

### O problema

Nó `Traduzir Lote Gemini` retorna **404** (`AxiosError`, `ERR_BAD_REQUEST`)
em toda tentativa de tradução, mesmo com o mesmo modelo (`gemini-2.5-flash`)
e a mesma key funcionando normalmente em `Extrair Metadados` e
`Identificar Estrutura` (usuário confirmou: processou 4 arquivos em
português com sucesso usando essas duas etapas, já com a conta paga do
Gemini).

### O que já foi testado e descartado como causa

1. Autenticação por header (`x-goog-api-key`) vs query param (`?key=`) — trocado, 404 continua
2. Endpoint `/v1beta/` vs `/v1/` — usuário testou os dois manualmente, 404 continua nos dois
3. Presença de `system_instruction` + `topP` no body — removidos, alinhado 1:1 com a estrutura de `Extrair Metadados`, 404 continua
4. `thinkingConfig: { thinkingBudget: 0 }` causar 400 — sugestão de outro assistente, mas **não bate com os fatos**: os nós que funcionam usam a mesma config, e o erro observado é 404, não 400

### Limitação real descoberta (não é mais hipótese, é fato confirmado)

O n8n (self-hosted, versão 2.36.9, arquitetura de task runner separado)
**descarta o objeto `error.response` do Axios** antes dele chegar no
catch de um Code node — só sobra `message`, `name`, `code`, `status`.
Testado 4 formas diferentes de capturar isso (`response.data`,
`cause.message`, dump completo via `Object.getOwnPropertyNames`,
priorização de `response` sobre `config`) — nenhuma trouxe o corpo real
da resposta do Google. Essa é uma limitação de arquitetura, não falta de
tentativa.

### Próximo passo definido, ainda não aplicado

Substituir a chamada inline (`this.helpers.httpRequest` dentro do Code
node) por um nó **HTTP Request** de verdade do n8n, configurado com
"Never Error" (`onError: continueRegularOutput`) — isso faz o corpo e o
status da resposta virarem dado normal de saída, mesmo em erro, sem
passar pelo bloqueio de serialização do task runner. É a única forma
confiável de ver a mensagem real do Google. Exige reestruturar o loop de
retry (hoje totalmente dentro do Code node) pra fora, ou adaptar.

### Estado da trava (`ingestao_lock`) durante a sessão

Toda vez que a tradução falha de verdade (erro real no node, não o
retorno gracioso), a execução para antes de `Liberar Lock` e a trava
fica presa — precisou ser liberada manualmente várias vezes via SQL
direto. Ainda é um ponto em aberto (mencionado sessão anterior também).

### Erro de operação cometido nesta sessão (corrigido)

3 edições seguidas (troca de auth, 2 diagnósticos) usaram `setNodeParameter`
com `path: "/parameters/jsCode"` — esse path criava um `parameters.parameters.jsCode`
aninhado que o n8n nunca executa de verdade, fazendo o código real nunca
mudar apesar dos "sucessos" reportados pela ferramenta. Corrigido usando
`updateNodeParameters` com `replace: true`, que substitui o objeto
`parameters` inteiro corretamente. **Lição**: sempre usar `updateNodeParameters`
pra reescrever o `jsCode` de um node inteiro, nunca `setNodeParameter` com
path apontando pra dentro de `parameters`.

---

## Sessão — 2026-09-01/02 (Claude)

**Contexto:** teste real do fluxo n8n (self-hosted, `automacoes-n8n.tvywld.easypanel.host`,
workflow id `4w8nyqpsj1lHndPl`) após o checkpoint da sessão anterior. Continua em
paralelo com o ChatGPT no mesmo n8n/Supabase.

### Teste real — 1 obra processada com sucesso

`Palestras_03_a_06.docx.pdf` (nome engana, mimetype real é PDF) processou
`concluido` de ponta a ponta, 4 trechos salvos. Já estava em português —
não passou pelo `Traduzir Lote Gemini`. Os outros 2 arquivos na pasta do
Drive eram sobras de teste de maio/julho, sem relação com este teste;
as `obras` órfãs foram deletadas do banco a pedido do usuário, mantendo
só a de hoje.

### Bug de fidelidade encontrado e resolvido (decisão do usuário)

Conteúdo já em português, ao pular a tradução, não recebe a normalização
de nomes do glossário (ex.: apareceu "Mokiti Okada"/"Okada Mokichi" em vez
de "Meishu-Sama", citação literal da fonte). Perguntado, o usuário decidiu
manter assim — fidelidade ao original tem prioridade sobre consistência de
nomenclatura entre documentos. Nenhum código mudou por causa disso.

### Bug de busca (`/api/busca`) — causa raiz e fix

Busca retornava 500 ("Embedding não gerado") sempre que o Gemini falhava,
mesmo pra buscas de palavra/frase exata que não precisam de embedding. A
key do Gemini usada pelo Vercel **não foi trocada** junto com a do n8n —
são variáveis de ambiente separadas (`GEMINI_API_KEY` no projeto Vercel).
Fix aplicado: falha no embedding agora degrada graciosamente pra busca só
por texto (`semantic_weight: 0`) em vez de derrubar a busca inteira.
Busca por sinônimo/sentido (ex. "plantando" achar "praticando") continua
dependendo do Gemini estar funcionando — isso é esperado, não é bug.

### Formatação dos trechos no site — 3 iterações até acertar

1ª tentativa: cada trecho virou parágrafo isolado (recuo + borda) — trechos
cortados no meio da frase pareciam parágrafos diferentes.
2ª tentativa: fluxo único sem quebra nenhuma — foi longe demais, perdeu até
quebras de parágrafo reais, e o usuário não gostava de texto alinhado à
esquerda (preferia o justificado de antes).
3ª (atual, aprovada): agrupa trechos em parágrafos reais via heurística —
só inicia parágrafo novo quando o trecho ANTERIOR termina em pontuação
final (`.!?…`). Justificado e recuo de volta. Heurística, não garantia
absoluta (a info real de parágrafo já foi achatada no chunking pra
conteúdo tipo `ensinamento_corrido`).
Também corrigido: `whitespace-pre-line` nos trechos (poemas/palestras
paravam achatados numa linha só) e bug de login preso em "Entrando..."
(faltava resetar o loading no caminho de sucesso).

### Melhorias de escala no workflow (pedido do usuário — "muitas obras, algumas grandes")

Aplicadas 3, sem alterar lógica de nós existentes:
1. **Trava de concorrência** (`Adquirir Lock`/`Liberar Lock`) usando a
   tabela `ingestao_lock` (id='global', locked boolean, execution_id) —
   já existia no Supabase, criada por trabalho anterior do ChatGPT.
   Só uma execução fala com o Gemini por vez; trava expira sozinha em 3h
   se uma execução travar sem liberar.
2. **Retry no Extrair Metadados e Identificar Estrutura** — 3 tentativas
   com backoff antes de cair no fallback genérico (`tipo_estrutura='misto'`).
   Antes falhavam na 1ª tentativa e degradavam silenciosamente justo
   quando o Gemini estivesse ocupado (múltiplas obras ao mesmo tempo).
3. **Log de progresso** via tabela `ingestao_log` (também já existia, sem
   uso até agora) — só início e fim registrados por enquanto; progresso
   granular dentro do loop de tradução ficou de fora por segurança
   (não mexer na parte mais delicada do fluxo sem pedido explícito).

### Prompt de tradução reforçado

`Traduzir Lote Gemini`: (1) devolvida a instrução de preservar autoria/estilo
quando o texto não é fala de Meishu-Sama (depoimentos, prefácios) — existia
na versão validada de 31/08, tinha se perdido numa simplificação posterior
do ChatGPT; (2) nova instrução explícita sobre contexto histórico-linguístico
— ortografia antiga (kyūjitai/kyūkanazukai), registro formal/religioso da
era Showa/Taisho tardia, expressões regionais, e regra de não modernizar o
teor do texto. **Ainda não testado com japonês real** — a única obra
processada até agora já estava em português. Usuário vai soltar um PDF
japonês pequeno na pasta do Drive quando puder, pra validar de verdade.

### Pendências conhecidas (atualizadas)

- Testar tradução real com japonês (prompt reforçado, sem validação ainda)
- DOCX sem extrator definido
- OCR não implementado
- Delay/rate-limit fixo (2,5s) no loop de embeddings — nunca testado com
  centenas de chunks
- Migração do n8n pra VPS Hostinger própria — ainda não feita

### ⚠️ Nota de coordenação (repetida — ainda vale)

Dois assistentes de IA (ChatGPT e Claude) com acesso de escrita ao mesmo
n8n e Supabase. Releia o estado atual antes de qualquer edição estrutural
— não assuma que o que você viu há algumas mensagens ainda é real.

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
