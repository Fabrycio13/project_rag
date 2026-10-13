# RAG empresarial estruturado — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task, somente após autorização de implementação. Este documento não autoriza commits, migrations ou chamadas com dados reais.

**Goal:** Construir RAG verificável, isolado por organização/agente, preservando estrutura e significado dos PDFs e respondendo com fontes exatas ou abstenção.

**Architecture:** PDF privado imutável → extração bruta por página → representação estruturada versionada + Markdown derivado → gate de qualidade/revisão → chunks filhos/pais → indexação explicitamente confirmada → recuperação híbrida autorizada → reranking → contexto com proveniência → resposta validada com citações. Começar pela fatia local de avaliação de extração; acrescentar persistência/jobs mínimos antes de oferecer execução durável, sem serviços distribuídos antes de medir necessidade.

**Tech Stack:** Next.js/React/TypeScript, Node, Supabase/Postgres; PDF.js + Tesseract.js como baseline observado; Docling como candidato em benchmark isolado, ainda não escolhido; pgvector + FTS como proposta; embeddings OpenAI aprovados, `text-embedding-3-small` proposto. Reranker e modelo de resposta ainda indefinidos.

**Data da inspeção:** 13/10/2026, 11:58:22 -0300 (terminal). Planejamento apenas: código, ambiente secreto e banco remoto não alterados; nenhum teste/build executado nesta tarefa. Working tree já contém alterações e arquivos não rastreados de upload/extração; preservá-los integralmente.

## 1. Decisões e limites

- **Aprovado:** embeddings OpenAI; ação explícita **Indexar documento**; comunicação de envio de texto/custo. Não pedir aprovação novamente desses pontos. Modelo small é proposta técnica, não autorização para executar chamadas nesta etapa.
- **Proposto:** extração/OCR local conservador, Markdown estruturado e JSON de layout como derivados, nunca substitutos do PDF/texto bruto.
- **Não decidido:** extrator vencedor, reranker/provedor, modelo de geração e limites numéricos finais de qualidade/latência. Escolher por benchmark e contrato de dados; embeddings não constituem reranker.
- **Corpus autorizado:** usuário aprovou três PDFs inteiramente fictícios (fácil/médio/difícil), mesmo cenário de contrato/política, em `docs/fixtures/rag/`, com gold autoral e benchmark local do extrator atual. Esta aprovação não autoriza dados reais, uploads remotos, implementação RAG ou escolha de fornecedor.
- **Fora do escopo:** login/convites (pausados), expansão de permissões, agentes autônomos com ferramentas, memória pessoal global, multiformato, infraestrutura distribuída, processamento de documentos reais sem aprovação, aplicação automática de migrations, commits/push.
- Preservar owner/admin ativos **e** organização criada pelo próprio usuário: admin não recebe acesso global. Manter vinculação agente/organização; não transformar RAG em oportunidade de relaxar auth/RLS.

## 2. Baseline comprovado no repositório

### Caminhos existentes inspecionados

| Caminho observado | Contrato atual / consequência |
|---|---|
| `scripts/pdf-extract.mjs` | PDF.js junta `item.str` com espaços; descarta coordenadas, hierarquia e tabelas. Resultado `{pages:[{page,method,text}]}`. OCR por página quando menos de 12 letras/números, Tesseract português; confiança menor que 35 ou texto não útil falha. Não é gate semântico. Página mista com texto nativo suficiente pode deixar imagem textual sem OCR. |
| `src/lib/pdf-extraction.mjs` | `execFile` de Node, `active` em memória por instância; timeout 120 s, heap V8 384 MiB, stdout 4 MiB. Não é fila nem limite global/RSS nativo. |
| `docs/security/2026-10-13-pdf-extraction-ocr.md` | Registra execução anterior de testes sintéticos e limites/deploy; não equivale a validação remota nesta tarefa. Declara que página realmente em branco falha e nenhum parcial vira sucesso. |
| `supabase/migrations/20261013000200_document_extraction.sql` | Uma extração por `document_id`, claim token, lease de três minutos; retry manual de failed/lease vencido. Completed não reprocessa. Sem versão de pipeline e sem fila durável. Aplicação remota não verificada. |
| `supabase/migrations/20261013000100_agent_documents.sql` | Bucket privado `agent-documents`; metadata restrita, path organização/agente/documento; acesso via `can_access_agent_documents`, owner/admin ativo e `owner_clerk_user_id`. Sem política de substituição do objeto stored. |
| `src/lib/documents.ts` | Validação PDF/extensão/MIME/assinatura, 10 MiB. Não é scanner ou sandbox. |
| `src/lib/document-upload.ts` | Coordenador reserve → upload → finalize; compensação remove/fail. Pending é ledger de recuperação de upload, não job de extração. |
| `src/app/api/organizations/[id]/agents/[agentId]/documents/route.ts` | Auth/organização/agente, same-origin, upload limitado, Storage `upsert:false`; GET devolve estado/contagens, sem texto. Fallback mantém upload/lista quando extração indisponível. |
| `src/app/api/organizations/[id]/agents/[agentId]/documents/[documentId]/process/route.ts` | Node route, `maxDuration=150`; download antecede timeout do subprocesso; claim e persistência condicionados por token. POST fica aguardando, sem garantia de continuação após interrupção do servidor. |
| `src/app/organizations/[id]/agents/[agentId]/document-manager.tsx` | Enviar PDF e Extrair texto separados; mostra que ainda não há índice; busy/ref impede duplicidade no cliente apenas. Texto não apresentado para revisão hoje. |
| `package.json` | Next 16.3.8, React 19.2.8; PDF.js/canvas/Tesseract; sem SDK OpenAI/pgvector/tokenizador/Docling declarados. Scripts `dev`, `build`, `start`, `lint`; testes Node por comando direto. |

Limites observados: 10 MiB, 30 páginas, raster 12 milhões de pixels/6000 por dimensão, um milhão de caracteres. A ausência de layout e a falha em página vazia são limitações concretas, não evidência de que todos os PDFs estejam incorretos. O registro atual de páginas é saída bruta do extrator, **não** reconstrução literal garantida do conteúdo visual.

Deploy atual depende de scripts, modelos locais e binários nativos acessíveis na raiz. Doc de segurança informa Windows/Node como runtime exercitado anteriormente. Edge, serverless curto e standalone sem assets não validados; `maxDuration` não supera limite do host. Python/Docling introduziria dependência nova, não presente em produção hoje.

## 3. Jornada do usuário e efeitos

1. **Enviar PDF:** comportamento atual preservado; arquivo privado, sem embeddings, geração ou envio a IA.
2. **Extrair/estruturar:** executar localmente a versão aprovada do extrator. Exibir progresso por etapa/página e diferença entre erro, vazio detectado e revisão necessária. Esta ação não indexa.
3. **Revisar extração:** abrir comparação PDF/página, texto bruto e Markdown estruturado; indicar páginas/tabelas suspeitas e coordenadas disponíveis. Renderizar Markdown sanitizado, sem HTML ativo/URLs executáveis. Aceitar/rejeitar ou corrigir derivado; bruto não editável. Correção cria versão e registra autor/motivo, sem reescrita automática.
4. **Indexar documento:** abrir confirmação com versão, páginas, modelo, tokens estimados e aviso: texto dos chunks será enviado à OpenAI, embeddings têm custo e perguntas também podem gerar custo. Não afirmar preço unitário nem custo exato não calculado. Confirmar cria job idempotente; abrir/reabrir modal ou revisão não cria job.
5. **Acompanhar:** estados queued/running/review_required/failed/ready e ação segura de retry; reabrir carrega estado persistido, não reexecuta. Índice incompleto não aparece como pronto.
6. **Perguntar:** buscar somente corpus aprovado, ativo e autorizado do agente; reranquear e devolver resposta com arquivo/versão/página/trecho. Abrir fonte é leitura privada autenticada, não publicação ou URL pública.
7. **Sem suporte suficiente:** “Não encontrei evidência suficiente nos documentos disponíveis.” Mostrar conflitos entre versões/fontes quando aplicável; não preencher com conhecimento externo silencioso.

## 4. Contratos de dados propostos (não existem ainda)

Usar novas migrations futuras, sem editar as migrations já entregues como se não tivessem sido aplicadas. Nome final/timestamp somente na implementação.

- `agent_document_versions`: documento lógico, organização/agente, versão, SHA-256 dos bytes calculado no servidor, referência ao PDF privado imutável, ator e origem. Não sobrescrever stored; nova versão usa novo objeto. Confirmar se `agent_documents.id` será versão física com vínculo lógico novo antes de escrever SQL.
- `agent_document_processing_runs`: versão do PDF + extrator/modelos/opções + hashes de pipeline, estado, métricas e flags de qualidade. Resultado completed append-only; evitar grants que permitam editar bruto após conclusão. Migrar/associar páginas atuais como baseline legacy, sem inventar bboxes.
- Artefatos privados: PDF, texto bruto por página, JSON estruturado e Markdown. Pequenas páginas podem ficar em JSONB; artefatos grandes em Storage privado com checksum. Medir tamanho antes de decidir. Derivados têm hashes e relação explícita com source version/run; não colocar PDFs/texto pessoal em logs.
- Elementos estruturados: `element_id`, tipo (heading/paragraph/list/table/caption/furniture), ordem de leitura, caminho de seção, texto/células originais, páginas, spans do bruto, bboxes opcionais, tamanho da página, unidade/origem/rotação das coordenadas, método OCR/nativo, confiança quando disponível, flags. Sem geometria: `bbox=null` e indicação explícita; nunca estimar região fingindo exatidão.
- `agent_document_reviews`: aprovação/rejeição/correção append-only vinculada ao hash da estrutura; nova estrutura invalida aprovação anterior. Capturar o mínimo necessário de autor/motivo.
- `agent_document_chunks`: tenant/agente/version/run/index_version, child_id/parent_id, texto exato versionado, heading trail, tokens, spans/element refs/páginas/bboxes, checksum. Texto enviado para embedding separado de texto citável se prepend de título for usado; mapear cada prefixo, não citá-lo como conteúdo do PDF.
- `agent_document_indexes`: estado, modelo/dimensão/tokenizador/chunker/cleaner, manifest esperado/recebido, aprovação de egress, active pointer. `vector(1536)` é default proposto para small [R2]; não misturar dimensões/modelos num mesmo índice.
- `agent_document_jobs`: stage, idempotency_key única, tenant/actor/version, status, attempt, claim token/fencing, lease/heartbeat, next_retry, erro sanitizado e métricas. Payload referencia artefatos, não duplica texto sensível.
- `agent_rag_evaluations` e audit mínimo: versões/prompt/retriever/reranker, IDs de fontes elegíveis/recuperadas/enviadas/citadas em estados separados, latency/tokens/usage, claims suportadas. Preferir artefatos locais no primeiro benchmark; só persistir auditoria de produto quando necessário e com retenção definida. Não armazenar chain-of-thought.

Identidades, UUIDs, hashes e versões são atribuídos por mecanismos de servidor/banco. Nunca copiar whole-row/spread de documento para outro; allowlist de conteúdo e denylist de identidade, tenant, estado, aprovações, histórico, índice e jobs.

## 5. Fases acionáveis e gates

Cada tarefa de código abaixo deverá ser decomposta em teste que falha → comando focado → implementação mínima → teste que passa, sem commit automático. Fases posteriores dependem do gate anterior, não de uma lista de tarefas marcada como concluída.

### Fase 0 — primeira fatia vertical: corpus e comparação local

**Objetivo:** decidir se extração estruturada melhora evidência sem alterar significado; nenhuma infraestrutura remota nova.

**Novos caminhos propostos:** `tests/fixtures/rag/`, `tests/fixtures/rag/manifest.json`, `tests/fixtures/rag/gold.json`, `scripts/benchmark-document-extraction.mjs`, `docs/evaluations/rag-extraction-baseline.md`; adaptador experimental Docling em `scripts/experiments/docling-extract.py` somente se autorizado a implementar/instalar depois.

1. Definir corpus sintético/anonimizado aprovado: contrato com cláusulas/negações/exceções, política hierárquica, tabela com células mescladas, duas colunas, PDF nativo, escaneado, misto na mesma página, baixa resolução, hifenização e rodapés; incluir página branca, documento protegido e injection no corpo. Registrar autorização, hash e tipo; não usar documentos reais só por estarem na máquina.
2. Anotar manualmente gold: ordem, headings, cláusulas críticas, números/moedas/datas/unidades, cada célula crítica, páginas/bboxes quando verificáveis e perguntas com respostas/abstenções.
3. Executar baseline atual inalterado e candidato Docling com configuração/modelos fixados em ambiente isolado. Preservar PDF/raw de cada candidato e comparar JSON/Markdown lado a lado. Downloads de modelos são preparação autorizada; processamento do corpus não deve enviar documentos para serviço externo.
4. Medir tempo/page, RSS pico, tamanho de artefatos, cobertura, falhas, ordem de leitura, fidelidade de tabelas e preservação literal dos fatos críticos. Comparar custo operacional de Python/modelos/empacotamento contra benefício, não só estética do Markdown.
5. Emitir matriz de erro e recomendação: manter baseline enriquecido, adotar Docling, ou rota por classe de documento. Sem declarar vencedor antecipadamente. Docling possui representação com hierarquia/layout/proveniência [R1], mas isso não prova fidelidade no nosso corpus.

**Aceite:** todos os fixtures têm raw preservado e proveniência real ou ausência marcada; nenhuma mudança de negação/número/cláusula crítica é aprovada silenciosamente; página branca permanece no inventário, sem sumir. Fixtures de falha mantêm erro honesto. Resultado contém medições reais e limitações, não respostas API sintetizadas. Só avançar após análise manual das diferenças. A fatia termina aqui, antes de embeddings ou deploy.

### Fase 1 — contrato de estrutura e limpeza conservadora

**Modificar existentes:** `scripts/pdf-extract.mjs`, `src/lib/pdf-extraction.mjs`, `src/lib/pdf-extraction.d.mts`, process route, `tests/pdf-extraction.test.mjs`, doc de segurança.
**Novos propostos:** `src/lib/document-structure.mjs`, `src/lib/document-quality.mjs`, `tests/document-structure.test.mjs`, `tests/document-quality.test.mjs`.

1. Definir schema validado para página bruta/elementos/Markdown e versões. Se baseline ganhar, capturar transforms/geometria PDF.js em vez de perder todos os items; não confundir item PDF.js com detecção correta de tabela. Se Docling ganhar, adaptador normaliza output sem descartar JSON/proveniência original.
2. Limpar somente derivado: espaços redundantes, quebras inequivocamente artificiais, furniture repetida reconhecida; registrar mapa de transformação e motivo. Hifenização ambígua, ordem duvidosa, caracteres confusos e mudança de pontuação crítica geram flag/revisão. Não usar LLM para “melhorar” ou reescrever cláusulas.
3. Preservar tabelas como células/headers/row-col span/nota/unidade; Markdown é apresentação. Tabela não representável fielmente usa fallback estruturado e revisão, nunca uma sequência solta de palavras. Listas e cláusulas mantêm número/condição/exceção.
4. Nova política proposta para vazio: página detectada vazia com evidência/flag permanece no resultado; OCR sem confiança ou página suspeita não se disfarça de vazia. Contrato pode completar extração em review_required, mas não publicar índice incompleto. Atualizar explicitamente teste que atualmente exige falha de página branca; não relaxar corrompido/senha/OCR ilegível.
5. Gate por página e documento: cobertura, ordem, conteúdo crítico, tabelas, OCR confidence quando real, mapeamento dos spans e anomalias. Heurística produz alerta, não garantia semântica. Calibrar limites no corpus e conservar revisão obrigatória para páginas/tabelas críticas suspeitas.

**Aceite:** round-trip de referências/spans; números/negações/exceções gold idênticos; limpeza nunca altera bruto; ausência de bbox não cria precisão falsa; nenhum status ready só porque confidence OCR passou de 35. Sem qualquer chamada LLM nesta fase.

### Fase 2 — versão, revisão e execução durável mínima

**Modificar existentes:** UI document-manager, documents route/process route e docs de segurança.
**Novos propostos:** `src/lib/document-jobs.ts`, `scripts/document-worker.mjs`, `src/app/api/organizations/[id]/agents/[agentId]/documents/[documentId]/review/route.ts`, migrations novas em `supabase/migrations/` (nomes futuros), `tests/document-jobs.test.mjs`, `tests/document-review.test.mjs`, `tests/sql/document-rag-rls.sql`.

1. Criar schema/versionamento acima, constraints compostas de tenant/agent/version e políticas equivalentes às atuais; resultados brutos completed imutáveis e revisão separada. Escrever testes reais de banco com JWT Clerk/sub e roles corretas em banco descartável, não somente grep do SQL.
2. Implementar job via Postgres + um worker Node supervisionado no deploy aprovado. Claim atômico, lease/heartbeat e fencing; key `(tenant, source_hash, pipeline_version, stage, target_model)`; revalidar permissão antes de processar/egress/publicar. Processo morto volta por lease, stale worker não conclui, retries limitados/backoff/jitter só em falha transitória. Revisão/erro permanente não reexecuta automaticamente.
3. Guardar checkpoint por etapa e manifest; não chamar uma Promise pós-response de fila. Não exigir Kafka/Redis/Kubernetes no MVP. Benchmark primeiro; dimensionar concorrência global/tenant depois com limites explícitos.
4. Limites de bytes/páginas/pixels/stdout/tokens, duração total incluindo download, RSS nativo via host, quotas tenant, número de tentativas e retenção. Testar subprocessos mortos e cleanup; caminho temporário privado se Docling precisar de disco, lifetime e acesso documentados — isso muda o contrato atual “sem documento em disco”.
5. Adicionar revisão restrita e navegação privada da fonte. Estado/error em PT-BR, logs técnicos sem secrets/texto. Backend indisponível não gera “aprovado” ou “sem resultados”.

**Aceite:** reinício durante extração e escrita, duplicate submit, lease expirado, revogação de acesso, tentativa antiga, Storage indisponível e retomada são exercitados; nenhuma versão publicada parcialmente. Permissões/login não mudam. Aplicação de migrations/deploy exige autorização separada e read-back autenticado depois; nesta tarefa nenhum destes passos é executado.

### Fase 3 — chunks e Indexar documento

**Novos propostos:** `src/lib/document-chunking.mjs`, `src/lib/embedding-provider.ts`, `src/lib/document-indexing.ts`, `tests/document-chunking.test.mjs`, `tests/document-indexing.test.mjs`, `src/app/api/organizations/[id]/agents/[agentId]/documents/[documentId]/index/route.ts`.
**Modificar existentes:** UI, worker e package manifest/lock somente para dependências escolhidas.

1. Chunk por estrutura: pai = seção/cláusula/grupo de tabela; filhos = unidades recuperáveis mantendo headings e contexto local. Preferir sentença/itens completos; não separar condição da obrigação, negação do verbo ou nota da tabela. Divisão de cláusula longa usa subunidades, parent referência e continuação explícita.
2. Tokenizar com tokenizer compatível ao modelo escolhido, contar prefixos/títulos também. Configuração inicial candidata: filhos 300–600 tokens e pais até 1800, ajustável pelo corpus, não promessa de ótimo. Se unidade indivisível exceder limite, bloquear e criar representação específica/revisão; nunca truncar silenciosamente. Orçamento de embedding, reranker e geração independentes; contexto reservado para prompt/pergunta/resposta e expansão de pais.
3. Doc oficial registra small com 1536 dimensões default e máximo 8192 tokens/input [R2]; usar folga, validar limites atuais de batch/rate antes de implementar e não projetar chunks perto do teto. Dimensão/encoding/modelo/tokenizer fixados no manifest.
4. Confirmar egress antes de criar job; construir allowlist do payload textual, não PDF bruto/credenciais/instruções. Revalidar tenant antes do primeiro byte ao provedor. Key de embedding por hash do texto+modelo+dimensão, **cache isolado por tenant**, sem dedup global revelador.
5. Persistir embeddings de staging, checksums e contagens; finalizar active pointer atomicamente somente após manifest completo. Retry evita recalcular o que já foi salvo; timeout depois da chamada pode cobrar novamente — idempotência local não garante cobrança exatamente uma vez. Salvar usage real e requests, sem preço hardcoded. Índice anterior continua ativo até troca aprovada.

**Aceite:** cada chunk resolve fonte exata; heading não inventado; table rows mantêm headers/unidades/nota; nenhuma exceção perdida em fronteira. Duplicata e falha em metade dos batches não publicam índice parcial. Abrir modal não envia texto; confirmação explícita envia apenas chunks aprovados; recusar cancela sem egress.

### Fase 4 — recuperação híbrida e reranking avaliado

**Novos propostos:** `src/lib/rag-retrieval.ts`, `src/lib/rag-reranker.ts`, `tests/rag-retrieval.test.mjs`, `tests/rag-reranker.test.mjs`, RPC/migration nova, `tests/sql/document-rag-retrieval.sql`.

1. RPC invoker com tenant/agent derivados de contexto confiável; todas as duas listas (pgvector/FTS) restringem tenant, agente, versão ativa, qualidade aprovada e autorização **antes** de rank/top-k/fusão. Não buscar global e filtrar depois. Revalidar IDs na expansão de pais e antes de egress.
2. Usar FTS português e benchmark de códigos, siglas, números de cláusula; avaliar componente lexical simples/exato sem apagar corpus bruto. Fusão RRF com ranks, dedup e tie-break estável. Supabase documenta pgvector+tsvector/RRF [R3]; exemplo público não contém nosso modelo de permissões e não deve ser copiado sem escopo.
3. Começar com busca exata para corpus pequeno; medir planos/latência/recall sob filtro antes de HNSW/ANN. ANN com filtro pode perder candidatos; se adotado, medir recall e fallback autorizado, não ampliar tenant para preencher top-k.
4. Interface separada de reranker: pergunta + lista de passagens autorizadas → IDs/scores/versão. **Provedor ainda INDEFINIDO.** Avaliar cross-encoder local versus serviço autorizado depois; egress a outro provedor requer aprovação própria. RRF não substitui reranker e embedding OpenAI não reranqueia pares como cross-encoder.
5. Avaliar só grupo pequeno pós-híbrido, expandir pais deduplicados dentro do orçamento. Score não é confiança calibrada de resposta. Timeout reranker deve ser erro explícito ou modo degradado previamente definido/rotulado; não fingir reranking realizado.

**Aceite:** documento relevante lexical no fim do corpus é recuperado; duas organizações com textos idênticos não vazam; agent errado, org arquivada e perfil revogado não chegam ao reranker. Medir Recall@k, MRR/nDCG e latency para vetor/FTS/híbrido/híbrido+rerank no mesmo gold; reranker só entra se melhorar critérios acordados sem regressão crítica.

### Fase 5 — respostas, citações e proteção por código

**Novos propostos:** `src/lib/rag-context.ts`, `src/lib/rag-answer-validation.ts`, `tests/rag-answer-validation.test.mjs`, endpoint de consulta privado e fonte privada (caminhos finais dependem da UI de chat a inspecionar antes de implementar; não afirmar que já existe).

1. Gerador recebe apenas contexto autorizado delimitado como dados não confiáveis, sem ferramentas/execução/URLs sugeridas pelo documento. Não misturar regras de organização com instruções extraídas; prompt injection em texto é evidência, não comando. Modelo/egress de geração precisam contrato próprio antes de ativar.
2. Output estruturado com claims e evidence IDs. Servidor resolve IDs para version/page/spans reais, garante que constam do contexto enviado e ainda estão autorizados. Cliente não recebe IDs arbitrários ou localização inventada pelo modelo. Renderizador cria links privados a partir do banco, não de URL gerada.
3. Exigir citação para afirmações factuais; validar quotes exatos, páginas e versões. Validação de ID/quote não prova suporte semântico: verificar claim-support na avaliação humana; para números/cláusulas críticos usar respostas extrativas/templates e checks determinísticos. Saída inválida/sem evidência adequada não é publicada como resposta fundamentada.
4. Abstenção quando contexto insuficiente/baixo suporte/conflict não resolvido; política calibrada no gold com positivos/negativos. Documentos de versões diferentes não viram uma cláusula híbrida. Erro técnico é distinto de abstenção.
5. Auditoria mínima distingue elegíveis → recuperadas → enviadas → citadas, versões, e métricas; feedback autorizado pode gerar novo caso de teste mediante confirmação, não editar automaticamente regras/prompts. Retenção/deleção inclui índices, artefatos, logs e dados dos processadores sob política aprovada; PDF imutável significa não sobrescrever, não retenção eterna.

**Aceite:** citação inexistente/trocada/fora do tenant e resposta sem fonte são bloqueadas por código; injection não invoca ferramentas nem altera corpus/policy. Fonte abre arquivo/versão/página correta em leitura autenticada. Abstenção negativa e conflito são verificados por humanos, sem alegar segurança semântica absoluta por prompt.

### Fase 6 — avaliação de ponta a ponta e deploy medido

**Novos propostos:** `tests/rag-evaluation.test.mjs`, `scripts/evaluate-rag.mjs`, `docs/evaluations/rag-release.md`, casos gold versionados e smoke de UI autenticada em ambiente isolado.

1. Gold manual separa tuning de holdout: pergunta, resposta esperada/abstenção, fatos críticos, versão/páginas/elementos gold, tenant, adversarial flags. Sintéticos cobrem correção; amostras aprovadas anonimizadas verificam representatividade. LLM judge, se usado futuramente, é auxiliar e não substitui conferência humana de tabela/cláusula.
2. Executar pipeline real candidato: extração → limpeza → chunking → embeddings autorizados em ambiente de teste → SQL/RLS → reranker escolhido → geração → UI fonte. Testes mocks validam falha/idempotência, mas não são prova de embeddings/retrieval/OCR reais.
3. Registrar recall de fonte, precisão de citação, cobertura de claims, taxa de abstenção correta, alteração de números/negações, latency p50/p95, pico RSS, tokens/usage e retries. Congelar metas antes do holdout; gates críticos sem tolerância: vazamento tenant, citação inventada e alteração silenciosa de conteúdo crítico. Metas de recall/latência dependem do corpus e host, não inventar números de desempenho.
4. Validar SO de produção, Python/modelos se escolhidos, versões fixadas, assets/tracing, child_process/worker supervisionado e limites do host. Testar restart/deploy em processamento e atomic switch/rollback do índice. Nunca copiar binários Windows para Linux.
5. Publicar primeiro para pequeno corpus autorizado, manter versão anterior e flag de ativação; medir antes de adicionar ANN, múltiplos workers ou serviço de fila externo. Sucesso de build não prova persistência nem UX autenticada.

## 6. Comandos e comprovação futura

Executar na raiz `C:/Users/Usabit/Desktop/Projetos/Project-RAG`, **somente durante implementação autorizada**. Não há script npm test observado.

```bash
node --test tests/pdf-extraction.test.mjs
node --test tests/document-upload.test.mjs tests/document-processing.test.mjs tests/document-boundaries.test.mjs
node --test tests/document-structure.test.mjs tests/document-quality.test.mjs
node --test tests/document-chunking.test.mjs tests/document-jobs.test.mjs tests/document-indexing.test.mjs
node --test tests/rag-retrieval.test.mjs tests/rag-reranker.test.mjs tests/rag-answer-validation.test.mjs tests/rag-evaluation.test.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Novos testes acima são caminhos **propostos**, não comandos disponíveis hoje. Esperado: testes/gates passam sem mascarar skip de dependência/serviço; relatar testes reais separados dos mocks. Benchmark proposto: `node scripts/benchmark-document-extraction.mjs` e eval `node scripts/evaluate-rag.mjs` com defaults locais documentados e sem envio real automático. Não usar `npm install`, migrations ou chamadas a API nesta fase de planejamento.

Banco descartável: implementar harness explícito para `tests/sql/document-rag-rls.sql` e `tests/sql/document-rag-retrieval.sql`, depois documentar comando conforme ferramenta local disponível; não inventar comando Supabase instalado. Exercitar policies com roles reais e tentativas diretas, não apenas testes estáticos. Browser autenticado: envio/revisão/confirmação/reabertura/erro/retry/citação e tenant indevido, após autorização e preparação isolada. Não inserir fixtures no tenant de produção.

## 7. Riscos e decisões técnicas diferidas

- Markdown sem JSON/spans perde estrutura; OCR confidence não mede fidelidade de cláusulas; bboxes opcionais não asseguram exatidão de highlight. Avaliação visual é gate.
- Limpeza de rodapé pode remover nota material; guardar original + provenance e revisão. Estrutura “bonita” nunca vale mais que obrigação/negação/tabela correta.
- Docling acrescenta modelos/Python/tempo/RSS/artefatos; avaliar pacote/licença/modelos/offline no host escolhido antes de adotar. Não prometer OCR mais correto sem corpus.
- Persistência atual é mutável durante processing e limitada a uma extração; nova versão deve ter migração compatível, sem apagar history ou esconder falha legacy.
- Worker privilegiado, se inevitável, ignora RLS com service_role: validar identidade/tenant/status e scope explicitamente antes de download, recuperação e egress. Preferir RLS quando possível. Segredo só server-side; nunca abrir `.env` para relatório.
- Approval pode ficar obsoleta entre revisão/indexação; vincular hash e revalidar na transação de claim/publicação. Revogação durante chamada externa não desfaz bytes já enviados; minimizar payload e revalidar imediatamente antes do envio.
- Não prometer compliance legal automática. Definir finalidade, retenção, categorias, direitos de acesso/deleção, subprocessadores e contrato de dados com responsáveis antes de corpus real.
- Não alterar skills/perfis nesta tarefa: escopo permite **somente este markdown**. Nenhuma migration remota aplicada, preço declarado ou provedor reranker escolhido.

## 8. Referências primárias contemporâneas

Consultadas por busca web oficial disponível no runtime em 13/10/2026, restringindo consultas às fontes primárias abaixo. O nome `web.run` solicitado não está exposto neste subagente; a ferramenta web_search recuperou as páginas oficiais por fallback após falha do backend nativo. web_extract falhou por backend search-only; nenhuma configuração foi alterada. Links textuais em código preservam referência no arquivo; não copiar preços. Rever limites na implementação.

- **[R1] Docling, “Docling document”**, documentação oficial: hierarquia, furniture, tabelas, bounding boxes quando disponíveis e provenance. `https://docling-project.github.io/docling/concepts/docling_document/`
- **[R1b] Docling, referência DoclingDocument**, exportação Markdown e ProvenanceItem. `https://docling-project.github.io/docling/reference/docling_document/`
- **[R2] OpenAI, “Vector embeddings”**, oficial: `text-embedding-3-small`, dimensão default 1536, máximo documentado de 8192 tokens/input, uso por tokens; não há aprovação de reranker decorrente disso. `https://developers.openai.com/api/docs/guides/embeddings`
- **[R3] Supabase, “Hybrid search”**, oficial: Postgres `tsvector` + pgvector e RRF. Exemplo deve ser adaptado a idioma, tenant, agente e versões desta aplicação. `https://supabase.com/docs/guides/ai/hybrid-search`

## 9. Ordem de entrega e único próximo pedido

1. Corpus autorizado + relatório comparativo local de extração (primeira entrega, sem embeddings).
2. Estrutura/proveniência/limpeza e revisão com qualidade bloqueante.
3. Versionamento/jobs mínimos e indexação OpenAI explicitamente confirmada.
4. Busca híbrida tenant-scoped; avaliar e então escolher reranker.
5. Resposta validada/citações/abstenção, eval holdout e deploy pequeno medido.

**Primeira fatia autorizada:** corpus inteiramente sintético em `docs/fixtures/rag/`, com três PDFs comparáveis, gold autoral e baseline local atual. Não solicitar documentos reais novamente para esta entrega. Escolha de extrator/reranker permanece posterior à avaliação; nenhum fornecedor foi escolhido.
