# Reprocessamento explícito e versionado de documentos

- Data: 2026-10-13
- Branch local: `master` (árvore já continha alterações de OCR, fixtures e ingestão)
- Escopo: revisão defensiva e implementação incremental de API, UI, histórico privado e transações SQL.
- Status: código e gates locais verificados; **banco Supabase real, PostgREST e fluxo autenticado de produção não verificados**.
- Confiança: alta nos comportamentos exercitados localmente; limitada no ambiente remoto e na concorrência entre conexões reais.

## Resultado e jornada

Em documento concluído, **Reprocessar documento** exige confirmação. Reutiliza o PDF privado armazenado; não faz upload novo. Cria uma tentativa numerada com identidade própria, preservando as páginas completas de todas as tentativas anteriores.

A extração continua no processo Node local, em subprocesso limitado, com OCR local. Não há Edge Function, worker, fila durável, embeddings ou chamada de provedor nesta mudança. Se a requisição/servidor parar, o processo não tem garantia de continuidade nem retentativa automática.

| Nova tentativa | Resultado ativo |
| --- | --- |
| Em andamento | Mantém a versão concluída anterior |
| Concluída sem revisão requerida | Promove nova versão em transação |
| Revisão necessária | Guarda candidata e mantém a versão concluída anterior |
| Falhou | Guarda falha e mantém a versão concluída anterior |
| Lease vencida | Impede conclusão pelo ator antigo; próxima ação explícita marca tentativa vencida como falha e cria outra |

Sem versão concluída anterior, a extração inicial e as retentativas de falha/revisão continuam funcionando. A revisão inicial permanece visível como revisão, sem ponteiro ativo aprovado. Não foi implementada aprovação manual de candidatas.

A tela mostra **comparação de metadados**, não comparação textual: número de versão, estado, versão ativa, contagem de páginas/OCR, nome e identificação curta do extrator/PDF. Texto bruto, coordenadas e tentativas OCR completos continuam preservados na relação privada para leitura autorizada no servidor. Não há endpoint público de texto, link público de PDF ou agente/instruções no retorno.

## Migração que precisa ser aplicada pelo usuário

004 já aplicada pelo usuário. **Aplicar manualmente `supabase/migrations/20261013000500_extraction_server_authority.sql` após 004, ANTES de testar o fluxo versionado em produção.** Configurar `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no servidor; nunca variável pública. 004 isolada permite fabricar conclusão via RPC autenticada e não é um gate seguro. Nenhuma SQL anterior foi alterada. Não foi executado push de banco nem migração remota.

A migração:

1. Cria `agent_document_extraction_runs` com RLS privada e versões por documento.
2. Copia a extração existente integralmente para versão 1, sem inventar hashes/proveniência de resultados legados.
3. Adiciona `agent_document_extractions.active_run_id`; a relação existente continua como snapshot da versão ativa ou estado inicial sem versão ativa.
4. Retira escrita direta de `authenticated` e execução da antiga claim, para não existir caminho de sobrescrita fora das transações versionadas.
5. Adiciona `claim_document_extraction_run` e `finish_document_extraction`.

**Implantação coordenada:** o código novo precisa da 004 + 005 e da chave privada no servidor. A 004 desabilita o escritor antigo; não aplicar isoladamente e deixar instâncias antigas processando. Conferir estado remoto, permissões, cache de schema do PostgREST e relacionamentos antes da validação autenticada. A lista mantém fallback de upload/metadados sem extração quando a relação nova não está disponível; isso não significa que processamento esteja ativo.

## Controles e evidências de segurança

### Autorização e dados privados — BOLA/IDOR, CWE-639

- API usa autenticação existente, organização do criador, agente dentro da organização e consulta do documento com os três IDs antes de baixar PDF.
- Corpo aceita apenas `action: extract | reprocess`; não aceita papel, tenant ou identidade de usuário vindos do navegador. Corpo vazio mantém ação inicial, nunca autoriza reprocessamento implícito de concluído.
- Mutação requer mesma origem. Corpo JSON limitado a 128 bytes durante leitura, inclusive chunked.
- Histórico usa a mesma `can_access_agent_documents` da 001: organização não arquivada, criador e usuário ativo owner/admin; não concede acesso global a admin não criador.
- RPCs são `SECURITY DEFINER` com `search_path=''`, nomes qualificados e checagem explícita de autorização **em ambas** usando `actor` derivado no servidor de `getOrganizationAccess` (Clerk `auth()`), não JWT do service client nem papel recebido do navegador. Cada RPC verifica usuário ativo owner/admin, criador da organização não arquivada e vínculo organização/agente/documento. Necessário para retirar escrita direta sem permitir contornar a imutabilidade pelo cliente. Não se deve inferir que RLS protege internamente o definer: a checagem explícita é o limite.
- 005 retira execução de todas as assinaturas legadas de claim/finish (incluindo eventuais mark-failure), remove as duas assinaturas da 004 sem CASCADE e expõe somente assinaturas com `actor` obrigatório, sem defaults. Somente `service_role` executa as novas RPCs. `authenticated` mantém leitura RLS, nunca claim/finish/escrita de evidências. Nenhum fallback autenticado.

### Concorrência e preservação — CWE-362

- Claim e conclusão bloqueiam a mesma linha do documento com `FOR UPDATE`.
- Uma claim com lease viva bloqueia segunda execução. Numeração é calculada sob esse lock; unicidade `(document_id,version)` reforça a regra.
- Conclusão requer documento, ID da tentativa, token correto, estado processing e lease ainda válida. Resultado terminal não pode ser concluído novamente.
- Nova claim não apaga extração ativa nem páginas históricas. Tokens repetidos não reabrem tentativas antigas nem estendem leases.
- Páginas históricas e promoção do snapshot/ponteiro são gravadas na mesma transação. Revisão/falha não altera ponteiro ou snapshot concluído anterior.
- Retirada do grant de escrita antiga foi exercitada com roles reais no PostgreSQL descartável.

### Identidade e egress

- `source_hash`: SHA-256 dos bytes realmente baixados para a tentativa.
- `extractor_hash`: hash determinístico, em ordem fixa com nomes/fronteiras, de wrapper, scripts de extração/layout/OCR, lockfile e versão Node. Não é apenas o rótulo amigável do extrator.
- Pacote standalone inclui explicitamente essa closure; corrigidos includes ausentes de OCR borderless sem modificar algoritmos/fixtures.
- Não há reutilização silenciosa de resultado por hash, nem hash inventado para legado. Cada ação explícita gera tentativa nova; repetição da conclusão é rejeitada.
- Conteúdo do documento é dado não confiável; não é interpretado como instrução. API retorna somente metadados fechados. Falhas públicas em PT-BR; exceção privada/provider/variáveis de ambiente não são retornadas.
- API lê novamente tentativa terminal e ponteiro após sucesso; após falha persistida, lê novamente a tentativa antes de responder como falha concluída.

## Verificação real executada

### RED → GREEN

- Testes de contrato falharam antes da migração/ação/histórico existir.
- Teste da closure falhou antes dos includes de borderless e fingerprint.
- Teste do limite de corpo falhou antes da leitura limitada.
- Testes da API falharam antes do retorno de identidade/promoção e readback da falha.
- Execução SQL detectou referência ambígua a `extractor_hash`; corrigida com qualificação do parâmetro.
- Teste SQL demonstrou que `reprocess=NULL` permitia claim de concluído; corrigido para rejeitar intenção ausente.

### Gates finais

- `PGLITE_MODULE='C:/Users/Usabit/AppData/Local/hermes/cache/scratch/reprocessing-db/node_modules/@electric-sql/pglite/dist/index.js' node --test tests/*.test.mjs`: **81 testes, 81 passaram, 0 falhas, 0 skips, 0 TODOs**. Inclui extração PDF/OCR real e regressões de sinais, tabelas, raster misto, rotação, evidência e injeção.
- `npm run build`: passou, sem warning novo de tracing após ajuste.
- `npx tsc --noEmit`: passou.
- `npm run lint`: 0 erros, 6 warnings preexistentes de imports não usados no gerador de fixture e check de runtime; preservados por escopo.
- `git diff --check`: passou; Git avisa apenas conversão LF/CRLF em arquivos já dirty.
- Node emite warnings preexistentes de package type nos testes TypeScript; não foi alterado package.json para silenciá-los.

### O que os testes SQL realmente provam

`tests/document-reprocessing-db.test.mjs` aplica 001–005 em **PGlite 0.5.9**, PostgreSQL/WASM descartável, com roles `authenticated`/`anon`/`service_role` e tabelas-base/identidade/storage sintéticas mínimas. Exercita leitura RLS, criador versus outro admin, bloqueio do criador, grants, preservação de páginas, falha/revisão, promoção, retentativas iniciais, lease vencida antes/depois de reclaim e conclusão terminal imutável.

Duas chamadas submetidas juntas resultam em uma claim aceita e uma negada; PGlite serializa consultas de uma instância. **Não é prova de contenção entre duas conexões independentes do Supabase/PostgreSQL real.** O SQL usa lock transacional no documento para esse caso, mas teste multi-sessão no ambiente real continua pendente.

API: testes executam o handler TypeScript transpilado com dependências de auth/storage/extrator isoladas, e verificam parâmetros, ordem de autorização/claim/download, limites, readback e resposta sem texto. Não simulam integração real Clerk/Supabase.

UI: testes renderizam markup React e invocam handlers com hooks isolados; verificam confirmação/cancelamento, payload explícito, refresh e botão desabilitado sob lease viva. Não são QA visual de navegador nem fluxo autenticado end-to-end.

### Reprodução do banco descartável

Não há nova dependência no pacote do projeto. Instalação de teste foi feita em scratch:

```bash
npm install --prefix 'C:/Users/Usabit/AppData/Local/hermes/cache/scratch/reprocessing-db' --no-audit --no-fund @electric-sql/pglite@0.5.9
PGLITE_MODULE='C:/Users/Usabit/AppData/Local/hermes/cache/scratch/reprocessing-db/node_modules/@electric-sql/pglite/dist/index.js' node --test tests/document-reprocessing-db.test.mjs
```

Sem `PGLITE_MODULE`, o teste SQL fica explicitamente skipped, não inventa resultado. O harness faz rollback ao encontrar erro antes de fechar o banco: um erro dentro de transação inicialmente deixou o encerramento aguardando e provocou timeout; a execução final está resolvida.

## Correção de autenticidade (revisão pré-commit)

- Achado confirmado: a 004 concedia claim/finish a `authenticated`; um criador podia fabricar páginas, hashes e estado concluído sem executar o extrator (CWE-862, integridade de evidência, severidade alta). A validação de formato de hash não prova sua origem.
- RED SQL real sem 005 (`AUTHORITY_RED=1`) falhou expondo exatamente as duas assinaturas da 004; RED de API falhou por mutações não privilegiadas e ausência de fail-closed.
- 005 concentra autoridade de escrita em servidor confiável. API usa cliente secreto somente para claim/finish, após escopo autenticado; download e readback continuam cliente JWT/RLS. Hash do extrator vem dos arquivos locais/Node; hash do PDF vem dos bytes realmente baixados.
- Teste SQL chama RPCs como authenticated e recebe permission denied; testa service_role com admin de outro criador, ator ausente, bloqueado, membro e organização arquivada. Ator válido preserva fencing, snapshot antigo em falha/revisão, histórico imutável e promoção transacional.
- Auditoria 002/003/004: única claim legada continua sem execute; nenhuma outra função SQL de falha de extração existe no repositório. Escrita direta de snapshots/histórico permanece revogada. Função de falha de convite é domínio independente. 005 revoga todos os overloads desses nomes antes de criar assinaturas sem ambiguidade. Dependência inesperada interrompe transação (não usa CASCADE).
- Falta da chave privada retorna 503 com mensagem humana em PT-BR, antes de claim/download. Não foi lido nem alterado `.env.local`; build carrega automaticamente seu ambiente, sem imprimir valores. Não verificada presença/configuração real do segredo.
- Log do suite completo: `C:/Users/Usabit/AppData/Local/hermes/cache/scratch/extraction-authority-tests.log`. Relatório de segurança atualizado neste arquivo. Nenhum remote apply/commit/push; revisão independente pelo parent ainda obrigatória.

## Ressalvas e próximos gates

- Banco **real** não verificado/aplicado; schema/cache/relacionamento PostgREST, duas conexões simultâneas, role real Clerk, autorização revogada durante extração e leitura autenticada de versões precisam do gate de implantação.
- Persistência não é uma fila: sem reexecução automática, heartbeat ou worker. Lease de três minutos excede o timeout local de dois minutos; retentativa continua explícita.
- Resultado sem revisão significa aprovação pelo gate atual do extrator, não certificação universal de qualidade. Regressões verdes não removem limitações de OCR/layout; textos ilegíveis continuam revisão/falha.
- Histórico retém páginas completas por versão, portanto aumenta armazenamento. Limite por tentativa existe; retenção e quota/rate limit por organização continuam decisão operacional antes de escala. Não foi feito benchmark de carga/DoS nem auditoria de CVEs.
- Sem comparação textual na UI, aprovação manual de candidatas, indexação ou reprocessamento em lote nesta entrega.
- Não alterados `.env.local`, algoritmos de OCR, PDFs, golds, fixtures, evidências anteriores ou lockfile/pacote do projeto. Nenhum upload, dado real, chamada de provedor, migração remota, commit ou push realizado.

## Arquivos da entrega

Novos: migração 004; quatro arquivos `tests/document-reprocessing*.test.mjs` (contrato, API, UI, SQL); este relatório.

Adaptados incrementalmente: route POST de process, route GET de documents, document-manager, teste de processamento e includes do `next.config.ts`. A árvore dirty preexistente permanece preservada.
