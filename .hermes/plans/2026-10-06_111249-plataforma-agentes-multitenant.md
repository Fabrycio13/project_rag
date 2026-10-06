# Plataforma de agentes multi-tenant — Plano detalhado do MVP

> **Para Hermes:** executar este plano por etapas, começando pela descoberta do repositório e validando cada fronteira de autenticação, organização e RAG antes de ampliar o escopo. Este documento é plano, não autorização para implementar ou publicar alterações.

**Objetivo:** Construir um MVP em que o owner da plataforma convida administradores por e-mail; cada administrador cria organizações isoladas e, dentro delas, gerencia agentes, skills, conhecimento, integrações e canais com uma experiência simples.

**Arquitetura proposta:** Next.js App Router com TypeScript atende o painel e as rotas de servidor. Clerk gerencia autenticação e entrada com e-mail/senha ou Google. A aplicação mantém o papel global de owner/administrador e as relações entre administradores e organizações. Supabase/PostgreSQL e Storage guardam os dados do produto, com isolamento obrigatório por organização e RLS. Um worker separado processa documentos de forma assíncrona; o runtime do agente valida acesso, busca evidências e executa ferramentas autorizadas. O painel esconde parâmetros técnicos do RAG atrás de um fluxo de upload, status e teste.

**Stack recomendada para o MVP, aprovada pelo usuário:** Next.js (App Router) + TypeScript para a aplicação web e endpoints server-side; Clerk para autenticação; Supabase (PostgreSQL, RLS, Storage privado, `pgvector` e busca textual) para dados e RAG; worker separado para ingestão assíncrona. Provedor/modelo de IA, embeddings, tecnologia/host do worker e deploy ainda serão escolhidos após confirmar requisitos e ambiente. A Fase 0 deve localizar o projeto correto e verificar se existe código relevante; não iniciar migração de framework sem essa descoberta.

---

## 1. Contexto confirmado e premissas

### Decisões informadas pelo usuário

- A plataforma é multi-tenant.
- O owner convida administradores por e-mail.
- O convidado poderá criar login com e-mail e senha ou autenticar com Google por Clerk.
- Cada administrador pode criar várias organizações para separar projetos/clientes, por exemplo “Oi tv”, “tim play” e “mileto”.
- Cada organização possui seus próprios agentes, skills, conhecimento e integrações; não deve haver mistura automática.
- O administrador cria agentes e skills dentro das organizações que administra.
- O RAG precisa ser simples de operar e criar, com poucos cliques, apoiado pelo Supabase.
- Cada resposta precisa ser auditável: identificar as fontes utilizadas, verificações/regras aplicadas, ferramentas propostas/executadas/bloqueadas e os ajustes que podem melhorar o comportamento.
- O produto precisa de uma estrutura de segurança e privacidade alinhada à LGPD, com regras de tratamento definidas para limitar o comportamento do agente.
- Considerar memória de usuário final reutilizável entre canais (WhatsApp, site e Telegram), sem juntar identidades ou dados automaticamente e sem cruzar organizações.
- Nesta fase, organizar e detalhar o plano; não começar implementação.

### Premissas recomendadas para este plano

- Uma identidade Clerk representa a pessoa; permissões do produto são controladas pela aplicação, não deduzidas apenas da autenticação.
- No MVP, cada organização é privada ao administrador que a criou. Compartilhamento com outros administradores fica fora do escopo inicial.
- O owner da plataforma pode gerenciar convites e acessos globais; não precisa atuar como administrador de cada organização no fluxo normal.
- Arquivos são privados por padrão. Torná-los elegíveis para um canal público requer seleção explícita e aviso.
- Um projeto Supabase compartilhado é o ponto de partida; não criar um Supabase por organização.
- Um provedor/modelo inicial e um canal inicial podem ser escolhidos após a inspeção do repositório e validação do caso de uso. WhatsApp e novos provedores não são pressupostos obrigatórios do primeiro corte.
- “Criar skill” significa cadastrar instruções e declarar capacidades permitidas; não permite executar código arbitrário nem concede permissões por si só.

### Contexto técnico ainda não verificado

A pasta de trabalho indicada foi `C:\Users\Usabit\Desktop\Projetos\Project-RAG`, mas a verificação inicial não encontrou um repositório Git nem arquivos listáveis. Portanto, stack, rotas, estrutura, migrations, testes, estado do Supabase e arquivos exatos a alterar são desconhecidos. A primeira etapa de execução deve localizar/confirmar o projeto correto. Não inventar caminhos nem presumir que a arquitetura proposta já existe.

---

## 2. Usuários e responsabilidades

| Perfil | Capacidades no MVP | Limites |
|---|---|---|
| Owner da plataforma | Convidar administradores, revogar/bloquear acesso, ver estado global essencial e limites operacionais. | Não ganha acesso irrestrito aos dados privados de organizações por mera conveniência; qualquer suporte administrativo deve ser explicitamente autorizado e auditado. |
| Administrador convidado | Criar organizações próprias; administrar nelas agentes, versões, skills, documentos, integrações e canais; testar e publicar. | Não pode ler nem alterar organizações pertencentes a outras pessoas. |
| Usuário final do agente | Conversar por um canal publicado. | Só pode acessar conteúdo e operações explicitamente permitidos para aquele canal e identidade. |

**Fora do MVP:** convite de equipe por organização, papéis de editor/operador, marketplace de plugins e acesso delegado entre administradores.

---

## 3. Jornada principal

### 3.1 Convite e primeiro acesso

1. Owner informa o e-mail e confirma o convite no painel.
2. Servidor verifica que o ator é owner, registra convite pendente com validade e uso único, e solicita envio pelo Clerk.
3. Convidado abre o e-mail e conclui cadastro com e-mail/senha ou Google.
4. Aplicação verifica convite válido, e-mail verificado compatível, papel autorizado e estado não revogado; associa o usuário Clerk ao perfil local.
5. Convite é consumido atomicamente; não basta obter uma sessão Clerk para entrar no produto.
6. Administrador sem organizações vê a ação “Criar primeira organização”.
7. Erros de convite expirado, revogado, já utilizado, e-mail incompatível e falha de provedor têm mensagem acionável.

A integração Clerk/Supabase e o método concreto de aceitar convites devem ser validados com a versão e configuração reais do projeto. Evitar aceitar apenas uma declaração do frontend; validar sessão/claims no servidor.

### 3.2 Organização e troca de contexto

1. Administrador cria uma organização com nome e, opcionalmente, descrição.
2. A organização aparece no seletor persistente do painel.
3. Selecionar outra organização atualiza o contexto e recarrega as consultas; todos os comandos de escrita são vinculados ao contexto autorizado no servidor.
4. Cada página indica claramente a organização ativa.
5. Organização sem agentes exibe orientação para criar o primeiro agente.

### 3.3 Criar agente e publicar

1. A partir da organização ativa, clicar “Novo agente”.
2. Informar nome, papel e estilo de comunicação.
3. Escolher um provedor/modelo aprovado e limites básicos; começar com padrão recomendado.
4. Selecionar skills e arquivos daquela organização.
5. Conceder ferramentas explicitamente; tudo começa negado.
6. Testar no playground vendo respostas, fontes, ferramentas propostas/bloqueadas e falhas.
7. Executar testes configurados e corrigir bloqueios obrigatórios.
8. Publicar uma versão imutável e associar um canal autorizado.
9. Mudanças posteriores criam nova versão; publicação anterior pode ser reativada.

### 3.4 Criar skill reutilizável

1. Na organização, clicar “Nova skill”.
2. Preencher nome, quando usar e instruções simples.
3. Opcionalmente declarar ferramentas necessárias dentre capacidades já disponibilizadas pelo sistema.
4. Salvar como rascunho e associar a um ou mais agentes da mesma organização.
5. Alterar skill não muda silenciosamente agente publicado; publicar nova versão do agente para adotar a mudança.

### 3.5 Adicionar conhecimento com poucos cliques

1. Abrir agente → “Conhecimento”.
2. Enviar arquivos ou selecionar itens já existentes na biblioteca da organização.
3. Mostrar progresso/estado: “Na fila”, “Processando”, “Pronto” ou “Falhou”.
4. Quando pronto, documento fica selecionado para o agente; administrador pode testar perguntas imediatamente.
5. Prévia mostra texto extraído e páginas/seções, sem expor parâmetros de chunking ou embeddings.
6. Substituição cria nova versão; versão anterior continua disponível até a ativação concluída.
7. “Remover deste agente” distingue-se de “Excluir da biblioteca”; exclusão avisa quais agentes serão afetados.

**Meta UX:** caminho usual do agente até teste com uma fonte já enviada em poucos passos, sem SQL, configuração manual de vetores, edição de prompt técnico ou chamada direta à API do Supabase.

### 3.6 Conversa e auditoria

1. Adaptador de canal normaliza entrada e identifica agente/versão e identidade da sessão.
2. Servidor deriva organização e escopo de acesso de vínculos confiáveis, não de campos arbitrários da mensagem.
3. Recupera somente evidências autorizadas e ativas.
4. Modelo gera resposta ou pedido estruturado de chamada de ferramenta.
5. Servidor revalida permissão e argumentos antes de executar ferramenta.
6. Canal recebe resposta com referências de fonte permitidas.
7. Registro de execução guarda versão, resultado, fontes, ferramentas, bloqueios, latência e consumo, minimizando PII e sem armazenar chain-of-thought.
8. Cada resposta recebe um identificador de execução para abrir sua trilha de auditoria no painel e relacioná-la a um teste/regressão.

### 3.7 Auditar uma resposta e ajustar o agente

1. Administrador abre uma resposta no histórico e seleciona “Ver auditoria”.
2. A auditoria prioriza a pergunta “quais arquivos sustentaram a resposta e por quê?”: mostra documentos e trechos efetivamente enviados ao modelo, citações usadas e, por afirmação relevante, o vínculo com a passagem que a sustenta.
3. O painel explica a justificativa em termos verificáveis (por exemplo, “este trecho descreve o prazo mencionado”), separando arquivos apenas recuperados daqueles realmente fornecidos/usados na resposta; também exibe ausência/conflito de evidência e ferramentas bloqueadas.
4. Administrador marca o resultado como adequado/inadequado, escolhe uma causa (fonte ausente, fonte errada, regra, estilo, ferramenta, resposta sem suporte ou outra) e registra uma observação opcional.
5. Com uma ação explícita, transforma a ocorrência em caso de teste reproduzível; não alterar automaticamente prompt, skill ou regra com base em um único feedback.
6. Após ajuste de configuração, administrador reexecuta o caso em rascunho e compara resposta, fontes e ações com a execução anterior antes de publicar nova versão.

**Limite de transparência:** a justificativa deve ser construída a partir das fontes, citações e validações realmente registradas, não de uma narrativa posterior do modelo sobre seu próprio raciocínio. Auditoria não promete revelar nem armazenar o raciocínio interno privado (chain-of-thought); mostra evidência verificável e limites conhecidos.

### 3.8 Memória de usuário final entre canais

1. O agente pode manter um perfil pequeno e estruturado dentro de uma organização, separado dos documentos de conhecimento da empresa e do histórico bruto da conversa.
2. Exemplos permitidos após informar o usuário e habilitar a função: idioma ou preferência de formato, nome de tratamento e preferências de atendimento explicitamente fornecidas. Não criar perfil psicológico nem inferir atributos sensíveis.
3. Cada identidade externa é inicialmente independente: sessão anônima do site, identificador de WhatsApp e identificador de Telegram não são considerados a mesma pessoa só por semelhança de nome ou contexto.
4. Para reunir canais, oferecer vinculação explícita com prova de controle (por exemplo, login ou código de verificação). Só após êxito associar identificadores ao mesmo perfil naquele tenant. A memória do projeto “Oi tv” nunca se mistura automaticamente com “tim play” ou outra organização.
5. O agente usa apenas fatos de memória pertinentes à solicitação; não usa memória para contornar regras, permissões ou fontes obrigatórias.
6. O usuário pode saber que a memória está ativa, consultar/corrigir/apagar o que foi guardado e desativar personalização; pedidos devem propagar-se aos registros e índices aplicáveis, respeitando retenções legalmente justificadas.
7. Se a identidade não puder ser vinculada com segurança, tratar a interação como nova/isolada, sem tentar adivinhar quem é.

**Premissa de privacidade:** memória persistente fica desativada até a organização configurar finalidade, base legal, transparência, prazo e controles após avaliação apropriada. Consentimento não deve ser presumido como a única base legal possível; a base aplicável depende do contexto e requer validação jurídica do controlador responsável.

---

## 4. Escopo funcional do MVP

### Incluído

- Acesso controlado por convite do owner.
- Clerk para autenticação e métodos habilitados de e-mail/senha e Google.
- Owner global e administrador convidado.
- Administrador pode criar várias organizações privadas.
- Seletor de organização e isolamento dos dados por organização.
- CRUD básico de agente, rascunho/publicação/versionamento e pausa.
- Identidade, estilo, regras de resposta, provedor/modelo e limites básicos separados.
- Skills textuais criadas pela organização e vinculadas a agentes.
- Catálogo fechado de ferramentas executadas server-side, com permissões por agente.
- Biblioteca de documentos da organização, seleção por agente, processamento assíncrono e estado compreensível.
- RAG com recuperação híbrida, reranking avaliado, citações, abstenção e tratamento de conflito/falha.
- Playground, conjunto inicial de testes, histórico de conversas e auditoria por execução, com fontes, verificações, decisões de ferramenta e feedback para regressão.
- Um canal inicial definido pelo piloto (recomendação: playground e integração controlada no site antes de WhatsApp, salvo validação de prioridade diferente).
- Estrutura mínima de privacidade e segurança e memória estruturada de usuário final por organização, com vinculação de canal explícita e controles de transparência/gestão; habilitação condicionada à configuração de privacidade.

### Excluído inicialmente

- Organizações Supabase separadas por cliente.
- Compartilhamento de organização entre administradores.
- Self-service aberto sem convite.
- Código arbitrário em skills/plugins ou instalação por terceiros.
- Tool genérica com URL livre, shell, SQL livre ou navegação autônoma.
- Escritas destrutivas ou ações financeiras sem revisão explícita.
- Coordenação multiagente, marketplace e treinamento/fine-tuning.
- OCR, ingestão de sites, sincronização Google Drive e múltiplos conectores de arquivos.
- Promessa de WhatsApp antes de validar configuração de provedor, consentimento e operação.

---

## 5. Arquitetura lógica

```text
Owner/Admin e usuários finais
             |
             v
Painel/API e adaptadores de canal
             |
             v
Autenticação Clerk -> perfil e autorização do produto
             |
             +--> comandos de domínio: organização/agente/skill/publicação
             |
             +--> runtime do agente
             |       +--> busca autorizada no Supabase
             |       +--> provedor de IA aprovado
             |       +--> ferramentas allowlisted e validadas
             |       +--> eventos de execução/auditoria
             |
             +--> upload privado no Supabase Storage
                     |
                     v
               fila/jobs persistidos
                     |
                     v
               worker de ingestão
                     +--> extração de texto
                     +--> segmentação e metadados
                     +--> embeddings
                     +--> índices lexical e vetorial
```

### Princípios

- Começar com um monólito modular e um worker; não microserviços sem necessidade comprovada.
- UI nunca é a barreira de segurança: API, worker e banco validam organização e permissões.
- Escopo de organização é derivado de membership verificado no servidor; não confiar em `organization_id` enviado sem autorização.
- RLS cobre tabelas e Storage; funções privilegiadas repetem validações porque credenciais de serviço podem ignorar RLS.
- Todas as ferramentas têm schema tipado, allowlist de campos, timeout, limite e log de efeito.
- Prompts não contêm segredos nem são autoridade final para política de negócio.
- Publicações referenciam versões fixas de skill, documentos/configuração e modelo quando possível.
- Operações assíncronas têm estado, tentativas, idempotência e erro visível.
- Cada resposta e efeito deve ser correlacionável com uma trilha de eventos legível; trilha de execução é somente acrescentável e protegida contra alteração pelo administrador comum.
- Identidades de usuário final são namespaced por organização; não há chave global para correlacionar pessoas entre clientes.
- Memória é separada de RAG corporativo, limitada a categorias permitidas, tem origem/validade/estado e não substitui autenticação ou autorização.
- Cada coleta/uso de dado pessoal tem finalidade documentada, acesso mínimo, transparência, prazo e fluxo de atendimento a direitos definidos com o controlador responsável.

---

## 6. Modelo de dados conceitual

Os nomes são rótulos de domínio, não nomes finais de tabelas/migrations.

| Entidade | Campos/relacionamentos essenciais |
|---|---|
| `platform_users` | Identificador Clerk, e-mail verificado de referência, estado da conta, papel global (`owner` ou `admin`), datas. Sem senha local. |
| `admin_invitations` | E-mail normalizado, token armazenado com segurança/hash quando aplicável, criador owner, validade, estado, aceite/usuário e idempotency key. |
| `organizations` | ID, nome, descrição opcional, `owner_admin_id`, estado e timestamps. |
| `agents` | ID, organização, nome, estado corrente e ator criador. |
| `agent_versions` | Agente, número/ID de versão, identidade, estilo, regras, provedor/modelo permitidos, limites, estado, autor e publicação. |
| `skills` | Organização, nome, descrição de uso, instruções, versão/estado. Skills ficam sempre no tenant; sem compartilhamento implícito. |
| `agent_skill_bindings` | Agente/versão e versão específica da skill. |
| `tool_definitions` | Ferramenta cadastrada pela plataforma, schema de entrada/saída e classificação de risco; não é conteúdo livre criado pelo admin. |
| `agent_tool_grants` | Agente/versão, ferramenta, operações/campos permitidos e política de confirmação. Ausência significa negar. |
| `provider_connections` | Organização, provedor e referência a segredo guardado no secret manager; segredo nunca em tabela legível ao cliente, prompt ou log. |
| `channel_bindings` | Organização, agente/versão publicada, canal, estado e configuração não secreta; credencial referenciada com segurança. |
| `documents` | Organização, título/nome, dono, estado geral, origem e classificação de visibilidade. |
| `document_versions` | Documento, objeto privado no Storage, hash, tipo/tamanho, status de ingestão, versão e erro sanitizado. |
| `document_chunks` | Organização, versão de documento, conteúdo, ordem, página/seção, metadados, embedding e campos/index lexical. |
| `agent_document_bindings` | Agente/versão, documento/versão e modo de acesso permitido. |
| `ingestion_jobs` | Versão do arquivo, etapa, tentativas, lease, idempotency key, status e erro acionável. |
| `conversations` / `messages` | Organização, agente/versão, canal, referência de sessão, conteúdo com retenção/minimização definida. |
| `end_user_profiles` | Perfil pseudônimo de usuário final com `organization_id`, estado, preferências explicitamente fornecidas e datas; nunca chave global de identidade entre clientes da plataforma. |
| `channel_identities` | `organization_id`, perfil, canal, identificador externo do canal, estado e método/data de verificação; UNIQUE por organização/canal/identificador para evitar vínculo duplicado. Sessões web anônimas ficam sem vínculo até autenticação. |
| `profile_memories` | Perfil, categoria permitida, valor mínimo necessário, origem (declaração explícita), criado/atualizado/expira, status e justificativa de uso; sem inferência sensível e com exclusão propagável. |
| `privacy_settings` / `privacy_requests` | Finalidade, estado de memória, informação exibida/versão, prazo, pedido de acesso/correção/eliminação/oposição aplicável, estado e trilha de atendimento. |
| `agent_runs` / `run_events` | Organização e versão, identificador de correlação, sequência temporal, etapa, versão de prompt/pipeline/modelo quando disponível, resultado da busca e filtros, IDs e posições dos trechos candidatos/usados, citações, verificações de regras/permissão, tool calls propostas/executadas/negadas e códigos de resultado, latência/consumo/erros; sem raciocínio privado do modelo. |
| `run_feedback` | Organização, execução, ator autorizado, avaliação, categoria da falha e observação opcional; referência à execução sem alterar seu registro imutável. |
| `test_cases` / `test_runs` | Organização/agente, entrada, contexto, critérios de fontes e proibições, versão testada e resultados; pode ser originado de feedback de execução. |

### Restrições de integridade

- FKs e políticas garantem que agente, skill, documento, conexão e canal pertencem à organização esperada.
- `owner_admin_id` não é escolhido pelo cliente em create; o servidor deriva do usuário autenticado.
- UNIQUE apropriados impedem duplicação de convite ativo, binding repetido e evento repetido.
- Excluir/desativar organização tem semântica definida; no MVP preferir arquivar e definir prazo/fluxo de exclusão real antes de apagar dados.
- Segredos, tokens de convite em claro e conteúdo pessoal desnecessário não aparecem em logs.

---

## 7. Regras de negócio, estilo e execução segura

### Separação de configuração

- **Identidade:** quem o agente representa e sua função.
- **Estilo:** tom, idioma, tamanho e formatação.
- **Regras de resposta:** como agir diante de falta, conflito ou incerteza de evidência.
- **Política de negócio:** decisões determinísticas, versionadas e testáveis; não confiar apenas em prosa no prompt.
- **Permissões:** dados e ações que o servidor disponibiliza de fato.
- **Skills:** instruções de procedimento reutilizável, sem elevar privilégios.

### Defesa contra ação proibida

1. Negação padrão para qualquer ferramenta não concedida.
2. Identidade, organização e escopo derivados da sessão verificada e da membership.
3. Consultas tenant-scoped antes de retornar dados; teste também no banco, não só na UI.
4. Tool calling em duas fases: proposta estruturada pelo modelo, validação e execução pelo servidor.
5. Allowlist de ferramentas, operações, argumentos, recursos e endpoints.
6. Revalidar autorização e estado do recurso imediatamente antes da execução.
7. Não permitir que modelo determine tenant, usuário, URL externa, segredo ou query SQL.
8. Limites de chamadas, tokens/custo, duração e payload; idempotência em efeitos externos.
9. Ações com impacto relevante exigem aprovação humana autenticada e vinculada a payload específico; não incluir escrita de alto impacto no primeiro piloto sem necessidade confirmada.
10. Prompt injection em mensagem/documento não concede permissão; texto recuperado é dado não confiável.
11. Registrar tentativa, decisão de autorização e resultado sem guardar segredos ou cadeia privada de raciocínio.
12. Testes adversariais de cross-tenant e tentativas de chamar ferramenta negada.

### Hierarquia de políticas da IA

1. **Limites da plataforma:** privacidade, isolamento, dados e ações proibidas; implementados em código e controles de dados, não editáveis por prompt/skill.
2. **Regras da organização:** podem restringir ainda mais o agente, nunca ampliar os limites da plataforma.
3. **Configuração e skills do agente:** definem papel, estilo e procedimentos dentro das permissões concedidas.
4. **Mensagem, documentos recuperados e saídas de ferramentas:** conteúdo não confiável; não pode alterar política nem autorizar operação.

Executar validações nos pontos de entrada de dados, antes de enviar conteúdo a provedor externo, antes de retrieval, antes de cada ferramenta e antes de publicar resposta. Em dúvida sobre permissão, escopo ou tratamento de dado, falhar de forma segura: bloquear/omitir e explicar o limite. Isso reduz riscos, mas não é promessa de que o modelo nunca produzirá uma resposta inadequada; manter avaliação adversarial, logs minimizados e revisão humana proporcional ao risco.

### Trilha de auditoria da IA

- Registrar fatos observáveis por execução: ator/canal autorizado, agente e versão, versões de configuração relevantes, documentos elegíveis após filtros, candidatos recuperados e ranking, trechos efetivamente enviados ao modelo, IDs de citação retornados/validados, resultado de regras determinísticas, tool call pedida, decisão (permitida/negada), executor e resultado, além de estado final e erro.
- Mostrar no painel um resumo “Por que esta resposta?” ancorado em evidências: “usou estes trechos”, “não encontrou fonte suficiente”, “esta regra bloqueou a ação”. Tratar isso como explicação de eventos e evidências, não como acesso ao pensamento privado do modelo.
- Permitir classificar a ocorrência e converter em teste com um clique explícito; feedback não modifica automaticamente configuração ou fonte publicada.
- Oferecer replay controlado contra uma nova versão em modo de teste e comparar fontes, citações, ferramentas e resposta lado a lado; replay não repete efeitos externos de ferramentas.
- Proteger a trilha contra edição/exclusão por quem configura o agente; respeitar isolamento por organização, retenção aprovada e solicitação de exclusão de dados aplicável.
- Minimizar conteúdo guardado: preferir IDs, hashes, posições e versões; quando conteúdo de pergunta/resposta/evidência for necessário para depuração, aplicar política de retenção e acesso explícita. Nunca registrar credenciais, tokens, URLs assinadas ou chain-of-thought.
- Se a explicação de suporte de uma resposta for produzida automaticamente, confrontá-la com trechos e citações efetivamente usados; não exibir como fato uma justificativa que não tenha vínculo verificável com a evidência.

### Segurança e privacidade (LGPD) por desenho

- Antes do piloto, inventariar categorias de dados, titulares, finalidade, fluxo, localização, retenção e fornecedores que recebem conteúdo; documentar quem define finalidades e quem processa dados em cada relação, com revisão jurídica/privacidade.
- Exibir aviso compreensível no canal, identificar finalidade de memória e uso de IA, oferecer canal para solicitações de titulares e registrar versão do aviso/configuração vigente.
- Aplicar minimização: não pedir dados que o agente não precisa; não salvar conversa inteira como memória por padrão; não coletar nem inferir dados sensíveis para personalização do MVP.
- Separar memória por usuário final + organização + finalidade; usar apenas quando pertinente e autorizado; permitir não usar/limpar sem prejudicar o acesso básico ao canal quando viável.
- Definir processo de acesso, correção, eliminação/bloqueio e revogação quando aplicável; refletir exclusão em perfil, memória, embeddings/índices derivados e fornecedores conforme contratos e política de retenção/backup.
- Segurança técnica: least privilege, autenticação forte para administradores, RLS e políticas Storage, isolamento de tenant, gestão segura de segredos, criptografia em trânsito e controles de armazenamento do provedor, proteção contra abuso, backups protegidos, auditoria e plano de resposta a incidente.
- Segurança organizacional: política simplificada escrita, revisão de acesso, gestão de fornecedores/suboperadores, treinamento mínimo, canal de privacidade e rotina para incidente e requisições.
- Decidir retenção por categoria; logs de auditoria minimizados e com acesso restrito não são licença para guardar conversa indefinidamente.
- Configurar guardrails de IA fora do prompt: allowlist de dados/ferramentas, bloqueio determinístico de operações proibidas, filtro de escopo antes do RAG, validação das saídas e limites de memória. Instruções do agente não podem sobrepor essas barreiras.
- Não usar respostas do agente para decidir sozinho sobre acesso, elegibilidade, crédito, emprego, preço ou outro resultado relevante no MVP; se um caso futuro puder afetar interesses, avaliar revisão humana, transparência e registro dos critérios/parâmetros aplicados antes de liberar.
- Registrar incidentes de segurança e ter processo de avaliação, contenção, preservação de evidência e comunicação às partes/autoridades conforme obrigações aplicáveis; prazos e papéis devem ser validados juridicamente.

**Limite:** o produto pode fornecer controles, registros e fluxos para apoiar conformidade, mas não certifica nem garante conformidade com a LGPD. A parte que efetivamente decide finalidade e meios essenciais do tratamento deve ser identificada como controladora conforme os fatos e contratos; a plataforma pode atuar como operadora ou assumir papéis distintos em tratamentos próprios. Isso não deve ser presumido apenas pelo nome da organização. Definir responsabilidades e obrigações com apoio jurídico/privacidade.

---

## 8. Plano de RAG simples de operar

### 8.1 Experiência do administrador

- Biblioteca por organização, upload drag-and-drop e seleção dentro do agente.
- Formatos iniciais: PDF pesquisável, DOCX e TXT; limites de tamanho configuráveis no servidor e informados antes do upload.
- Um padrão de ingestão gerenciado pela plataforma, sem knobs técnicos no fluxo comum.
- Estados e progresso reais; erro com ação (“arquivo sem texto pesquisável”, “formato não aceito”, “falha temporária — tentar novamente”).
- Prévia extraída e teste “faça uma pergunta sobre este documento”.
- Arquivo fica disponível somente quando versão completa foi indexada.
- Substituição versionada, reprocessamento idempotente e rollback para versão ativa anterior.
- Admin pode desmarcar documento de um agente sem apagar a fonte da biblioteca.

### 8.2 Pipeline

1. Validar sessão, tenant, MIME/tamanho e quota antes de aceitar upload.
2. Criar registro pendente e objeto privado em Storage com caminho contendo organização e ID opaco.
3. Agendar job persistido; não depender de chamada fire-and-forget do navegador.
4. Worker verifica posse/estado e idempotência, extrai texto e metadados.
5. Detectar conteúdo vazio/insuficiente; OCR fica fora do MVP e falha com mensagem explícita.
6. Dividir em trechos preservando página/título/seção e sobreposição controlada pelo pipeline.
7. Gerar embeddings usando configuração de plataforma e gravar versão do modelo.
8. Criar índice lexical e vetorial; manter chunks associados à versão e organização.
9. Validar contagens e amostra; só então marcar versão pronta e liberá-la na busca.
10. Falhas parciais não ativam versão incompleta; retry limitado, erro sanitizado e possibilidade de reprocessar.

A escolha exata entre Edge Function, serviço worker e fila depende do projeto e dos limites operacionais Supabase descobertos na fase inicial. Priorizar mecanismo durável e observável; não colocar extração pesada em request síncrono de usuário.

### 8.3 Recuperação por pergunta

1. Resolver organização/agente/versão e usuário/canal confiáveis.
2. Resolver, quando aplicável, perfil de memória apenas após vínculo de canal verificado; filtrar memória pelo tenant, estado, finalidade e pertinência. Se não houver vínculo, não fazer cross-channel lookup.
3. Aplicar filtro de documentos ativos, selecionados e autorizados antes de passar resultados ao modelo.
4. Fazer busca lexical para correspondência exata e vetorial para similaridade semântica.
5. Combinar rankings lexical/vetorial (por exemplo, RRF) com limites medidos.
6. Rerankear somente candidatos autorizados, se o ganho de qualidade justificar custo/latência no conjunto de avaliação.
7. Aplicar limiar calibrado e enviar ao modelo trechos limitados, com IDs de referência e metadados necessários.
8. Modelo retorna resposta e IDs de citação em formato estruturado.
9. Servidor valida que IDs foram realmente recuperados e permanecem autorizados; gera citações legíveis sem URL pública para fonte privada.
10. Registrar evento correlacionado com versão do pipeline, filtros aplicados, memória permitida (se usada), candidatos elegíveis, IDs/posições dos chunks, ranking, trechos entregues ao modelo, citação validada e resultado mínimo para auditoria/depuração, sujeito a retenção e minimização.

Reranking não deve ser requisito de marketing antes de ser avaliado. O MVP pode implementar a interface do pipeline e ativar reranking após benchmark com perguntas reais; se não agregar valor suficiente, manter busca híbrida sem etapa extra.

### 8.4 Falta de evidência e conflito

- Sem evidência acima do limiar: dizer que não encontrou informação suficiente; não completar com invenção.
- Evidência parcial: responder apenas ao que os trechos sustentam e indicar o que falta.
- Fontes conflitantes: apontar conflito com referências de ambas, sem decidir arbitrariamente qual é válida.
- Busca ou provedor indisponível: comunicar falha técnica distinta de “a resposta não consta”.
- Não usar resposta de conversa anterior como evidência factual sem fonte autorizada.

### 8.5 Avaliação e testes de qualidade

Construir conjunto versionado de perguntas reais/sintéticas aprovadas, cobrindo sinônimos, códigos e nomes exatos, perguntas sem resposta, fonte conflitante, documento longo, PDF sem camada de texto, arquivo removido, perguntas cross-tenant e instrução maliciosa no documento.

Métricas e revisão:
- Retrieval recall@k / precisão de fonte em casos anotados.
- Correção e sustentação da resposta, julgadas por avaliador humano em amostra; avaliador LLM é auxiliar, não árbitro único.
- Precisão das citações e correspondência afirmação-evidência.
- Taxa de abstenção correta e falsos positivos de resposta.
- Vazamento cross-tenant: zero nos testes de segurança.
- Latência, falha de ingestão e custo por pergunta/documento.
- Regressão comparada com versão previamente aprovada do pipeline.
- Completude da trilha: uma resposta pode ser reconstituída a partir dos eventos, fontes/versionamentos e decisões efetivamente registrados, sem alegar reconstruir o raciocínio privado do modelo.

Não publicar agente com testes obrigatórios de isolamento/ferramenta falhando. Qualidade semântica pode começar como gate revisado pelo administrador e ser endurecida após baseline medido; não inventar limites numéricos sem dados.

---

## 9. Telas do painel

1. **Login/aceite de convite:** Clerk; explica convite inválido ou e-mail incompatível.
2. **Início:** seletor de organização, organizações recentes e estado vazio “Criar primeira organização”.
3. **Organizações:** listar/criar/renomear/arquivar as próprias; não listar dados alheios.
4. **Visão da organização:** agentes, uso básico e ações rápidas.
5. **Agentes:** lista, estado, canal, versão ativa, última atividade; criar/duplicar/pausar.
6. **Editor de agente:** passos curtos ou abas compactas para identidade, estilo/regras, modelo, skills, conhecimento, permissões e canais.
7. **Skills:** lista, criar, editar rascunho, versionar e ver agentes vinculados.
8. **Conhecimento:** biblioteca, upload, processamento, prévia, vínculo por agente, substituir/remover/excluir com impacto explícito.
9. **Playground:** conversa à esquerda; evidências e ferramentas à direita; alternância de versão draft/publicada; sem revelar chain-of-thought.
10. **Testes:** casos, resultados, falhas, fontes esperadas, regressão e ação para reexecutar.
11. **Conversas/execuções e auditoria:** cada resposta abre uma linha do tempo com versão, fontes candidatas/usadas, citações, regras verificadas, ferramentas permitidas/bloqueadas e resultado; feedback categorizado pode virar teste e ser comparado em replay sem efeitos externos.
12. **Perfil e memória do usuário final:** controles de memória por organização, canais vinculados (com estado de verificação), preferências lembradas, origem, validade, apagar/desativar e aviso de privacidade.
13. **Integrações/canais:** credenciais mascaradas, conectividade, canal e escopo; sem valor secreto de volta ao browser.
14. **Administração de plataforma:** exclusivo do owner, convites, estado dos administradores e revogação.

### Regras de UX

- Mostrar organização ativa em toda tela de domínio e confirmação para ações destrutivas.
- Criar agente/skill/upload sempre no espaço atualmente selecionado e nomeado; nunca deixar escopo implícito visualmente.
- Defaults úteis; avançado recolhido, nunca esconder permissões.
- Erros acionáveis em português; não declarar “pronto” antes da confirmação do worker.
- Componentes seguem o design system existente após inspeção do repositório; não presumir biblioteca visual.

---

## 10. Fases de execução e tarefas

### Fase 0 — descoberta e decisões bloqueantes

1. Confirmar raiz correta do projeto e estado Git; preservar trabalho local.
2. Mapear stack, rotas, manifests, design system, autenticação atual, migrations, funções, RLS, Storage, testes e deploy.
3. Confirmar projeto Supabase e limites/integração Clerk disponíveis; não exibir nem copiar segredos.
4. Verificar se existe UI/RAG parcial e reutilizar apenas após entender contratos e permissões.
5. Registrar ADRs curtos para: um banco compartilhado, ownership da organização, convite Clerk, worker/fila, formatos e canal piloto.
6. Fechar as decisões abertas da seção 13 antes de migration/desenvolvimento que dependa delas.

**Saída:** mapa real da arquitetura, risco atual, inventário de arquivos e plano revisado com caminhos concretos. Nenhuma alteração de código nesta fase de planejamento.

### Fase 1 — identidade e isolamento

1. Escrever testes de autorização para owner/admin, convite válido/expirado/revogado e e-mail incorreto.
2. Implementar perfil local ligado ao subject Clerk e papel global administrado no servidor.
3. Implementar convite via fluxo oficial suportado pelo Clerk; consumo de uso único e revogação.
4. Criar organização com owner derivado da sessão; criar seletor/contexto.
5. Criar esquema e RLS para organizações e memberships; owner não obtém leitura irrestrita de conteúdo privado por default.
6. Testar com admin A/B e organizações X/Y que leitura, escrita, busca e Storage nunca atravessam tenant.
7. Adicionar trilha mínima de auditoria para convite, revogação e criação/arquivamento de organização.
8. Criar inventário inicial de dados e responsabilidades, definir contato de privacidade, classificação/retenção e fluxo para direitos dos titulares/incidentes com revisão jurídica antes de aceitar conteúdo real.

**Gate:** nenhuma tela ou endpoint consegue ler/escrever organização de outra pessoa, inclusive chamadas diretas e IDs adulterados.

### Fase 2 — agentes, versões e skills

1. Implementar entidades e validações tenant-scoped de agentes.
2. Criar fluxo de agente com identidade, estilo, regras e modelo claramente separados.
3. Implementar catálogo de skills da organização, editor simples e vínculos/versionamento.
4. Implementar catálogo de ferramentas fechado e grants deny-by-default.
5. Criar publicação imutável e retorno a versão anterior.
6. Implementar testes de atualização de skill sem mudança silenciosa em publicação existente.
7. Cobrir payload allowlist, concorrência de publicação e isolamento entre organizações.

### Fase 3 — biblioteca e ingestão RAG

1. Definir formatos/tamanho inicial, quotas e políticas de retenção.
2. Criar bucket privado, políticas Storage e teste direto de URLs/paths entre tenants.
3. Implementar upload e job idempotente; estados claros no painel.
4. Criar worker de extração, segmentação, embeddings e indexação, com retry e timeout.
5. Criar versões de documentos e ativação atômica apenas após sucesso completo.
6. Criar biblioteca simples e bindings de documento por agente.
7. Cobrir arquivo inválido/vazio, PDF escaneado, retry, duplicado, cancelamento e substituição sem indisponibilidade da versão ativa.

### Fase 4 — runtime, busca e segurança

1. Implementar boundary único de execução para playground/canais.
2. Implementar retrieval híbrido tenant-scoped e filtros de versão/visibilidade antes de qualquer envio a modelo.
3. Montar conjunto de avaliação e baseline da busca; calibrar k/limiares com dados, não por palpite.
4. Medir se reranking melhora qualidade e custo; ativar se aprovado pelo critério acordado.
5. Exigir saída estruturada com referências; validar IDs e produzir citações no servidor.
6. Implementar respostas de falta de evidência, evidência parcial, conflito e falha técnica.
7. Implementar proposta de tool call, validação, autorização, execução limitada e log.
8. Testar prompt injection, ferramentas proibidas, URLs/endpoints, dados cross-tenant e limites.

### Fase 5 — playground, canal piloto e observabilidade

1. Construir playground que mostra fontes, ações e versão, mas não raciocínio interno.
2. Implementar execução de testes e comparação entre versões.
3. Ligar o canal piloto escolhido sem duplicar lógica do agente.
4. Implementar trilha de auditoria por resposta, painel “Por que respondeu?”, registro append-only de feedback e conversão explícita de ocorrência em teste.
5. Implementar replay comparativo em modo seguro, desativando chamadas de ferramentas com efeitos externos.
6. Adicionar registros mínimos de uso, erros, latência e custo incerto/estimado claramente.
7. Adicionar rate limit, quotas, limites de upload e proteções contra abuso.
8. Fazer smoke test com dois admins, pelo menos duas organizações cada e casos de canal público/privado.
9. Pilotar com conteúdo não sensível antes de documentos reais de clientes.
10. Implementar perfil de usuário final e memória limitada por organização, com vinculação de canal somente após verificação e controles de ver/editar/apagar/desativar; manter recurso off até política, aviso e base aplicável configurados.
11. Testar binding entre os mesmos e diferentes canais, anônimo não vinculado, identidade não verificada, tentativa de correlação entre organizações e propagação de exclusão.

### Fase 6 — liberação controlada

1. Rever ameaça, privacidade, retenção e condições de envio a provedores externos.
2. Verificar backup/restore de metadados e objetos; testar reprocessamento/replay de jobs sem duplicar chunks.
3. Executar migrations e políticas em ambiente não produtivo primeiro.
4. Liberar para grupo pequeno de administradores convidados.
5. Observar falhas de ingestão, qualidade, custo e suporte; corrigir antes de ampliar.
6. Adicionar WhatsApp, segundo provedor, OCR ou compartilhamento somente a partir de evidência de necessidade.

---

## 11. Plano de testes e critérios de aceite

### Autenticação e convite

- Somente owner autenticado cria/revoga convite.
- Convite tem validade, uso único, estado rastreável e não pode ser aceito por e-mail não verificado diferente.
- Conta autenticada sem convite ativo não recebe acesso de administrador.
- Revogação impede novas sessões/operações conforme política definida.
- Google e e-mail/senha são testados em ambiente Clerk de desenvolvimento/staging.

### Multi-tenancy

- Admin A não lista, lê, altera, apaga, pesquisa nem infere recursos do Admin B.
- Testes incluem API direta, SQL/RLS, Storage, busca, jobs, logs, citações e exportação.
- Contexto trocado no frontend invalida/cacheia corretamente dados antigos.
- Owner global pode administrar convites, mas acesso a conteúdo tenant exige caminho explícito, justificado e auditado.
- Identificadores do mesmo canal em organizações diferentes nunca permitem inferir que se trata da mesma pessoa nem recuperar a mesma memória.

### Memória e LGPD

- Site anônimo, WhatsApp e Telegram iniciam como identidades distintas; apenas fluxo de vinculação autenticada/verificada os reúne dentro da mesma organização.
- Nome parecido, número digitado no site ou contexto conversacional nunca bastam para juntar perfis.
- Memória não guarda conversa integral por padrão, não cria inferência sensível e só alimenta resposta quando finalidade/estado e pertinência permitem.
- Usuário consegue consultar, corrigir, apagar ou desativar memória conforme fluxo definido; a exclusão alcança índices/derivados e respeita apenas retenção documentada e legalmente justificada.
- Há inventário, aviso, canal de solicitação, responsáveis, prazos operacionais, fornecedores e procedimento de incidente revisados antes de produção; isso é suporte de conformidade, não certificação automática.

### Agentes e permissões

- Skills nunca concedem tool grants.
- Falta de grant bloqueia execução no servidor mesmo que o modelo solicite repetidamente.
- Argumento extra, tenant trocado, endpoint não permitido e recurso de outro cliente são recusados.
- Publicação referencia configuração/versionamento estáveis; regressão permite rollback.

### RAG e documentos

- Só versões completas aparecem na recuperação.
- Remover documento do agente remove-o da busca sem afetar outras organizações/agentes indevidamente.
- Citação pertence à lista recuperada e é acessível para o canal correspondente.
- Auditoria de uma resposta mostra somente eventos e fontes da organização autorizada, distingue candidato recuperado de trecho efetivamente usado e permite abrir a fonte/citação correta.
- Feedback sobre uma execução não altera configuração publicada; criar teste exige ação explícita.
- Replay em modo de teste não repete efeitos externos nem permite alteração de dados de produção.
- Registro de auditoria não pode ser alterado por administrador comum e segue retenção/minimização aprovadas.
- Pergunta sem fonte recebe abstenção; busca indisponível recebe erro técnico distinto.
- Conflito entre fontes é indicado e referenciado.
- Retrieval e reranker nunca recebem texto proibido por filtro de tenant/visibilidade.
- Reprocessamento não duplica chunks ativos nem ativa versão parcialmente falha.

### Operação

- Logs não contêm segredo, token, URL assinada reutilizável ou conteúdo além da retenção definida.
- Jobs têm retry limitado, idempotência, timeout e erro recuperável.
- Limites de uso e upload funcionam e são visíveis.
- Build, tipos, lint, testes focados, testes de RLS e smoke visual executam segundo os scripts reais do repositório, identificados na Fase 0.

### Critério de liberação

- Zero falhas conhecidas de isolamento/autorização nos cenários críticos.
- Zero execução de ferramenta explicitamente proibida nos testes adversariais.
- Citações verificadas por referências reais autorizadas.
- Baseline documentado de qualidade, latência e custo em perguntas representativas.
- Estados de ingestão e suporte a falhas compreensíveis para administrador não técnico.
- Aprovação manual do owner para habilitar o piloto.

---

## 12. Riscos e mitigação

| Risco | Consequência | Mitigação/decisão |
|---|---|---|
| Mistura cross-tenant por erro de query | Exposição de documentos/conversas | RLS + validação server-side + testes de todas as superfícies, inclusive busca e Storage. |
| Owner entende-se como acesso a todos os dados | Acesso administrativo excessivo | Separar gestão de conta e acesso a conteúdo; caminho excepcional auditado. |
| Clerk autentica, mas produto não autoriza corretamente | Conta válida ganha privilégio indevido | Papel local e convite ativo verificados no servidor; não confiar no frontend. |
| RAG retorna trecho de organização/arquivo incorreto | Vazamento ou resposta errada | Filtrar antes de rerank/modelo, guardar organization_id em cada derivado, testes canário. |
| Skill escrita como política de segurança | Modelo pode ignorar regra | Enforcement em código/RLS/tools; instruções nunca são controle de acesso. |
| Modelo alucina ou cita sem suporte | Desinformação | Abstenção, IDs validados no servidor e avaliação de sustentação. |
| Auditoria confunde explicação com chain-of-thought | Falsa confiança, dados privados do modelo expostos ou logs inseguros | Exibir trilha verificável de fontes, filtros, regras e ferramentas; nunca prometer revelar raciocínio interno. |
| Auditoria guarda conteúdo excessivo | Exposição de dados pessoais/sensíveis e custo de retenção | Minimização por padrão, acesso restrito, prazo definido e distinção entre IDs/metadados e conteúdo bruto. |
| Feedback vira mudança automática no agente | Regressão ou mudança indevida de regra | Feedback só sugere ajuste/caso de teste; publicação continua versionada e explícita. |
| Worker falha ou repete processamento | Documento preso, duplicado ou parcialmente visível | Fila persistida, idempotência, retries limitados e ativação atômica. |
| Simplicidade remove controles importantes | Publicação acidental ou dado público | Defaults seguros, permissões visíveis e confirmação antes de publicação/canal público. |
| Custo/latência de embeddings/reranker | MVP caro/lento | Medir por pergunta/documento; rerank condicional; limites e quotas. |
| Correlação equivocada de usuário entre canais | Exposição de contexto a pessoa errada | Identidades independentes por padrão; vincular somente após prova de controle e apenas dentro do tenant. |
| Memória pessoal persiste sem finalidade ou prazo | Tratamento excessivo, surpresa ao titular e risco LGPD | Recurso desligado até finalidade/base/aviso/retenção configurados; memória estruturada, mínima e gerenciável. |
| Prompts são tratados como barreira de segurança | Agente pode contrariar política/lei após prompt injection | Regras determinísticas no servidor e no banco, escopo reduzido e testes adversariais; prompt é complemento, não enforcement. |
| Provedor recebe conteúdo sensível | Risco contratual/privacidade | Minimização, revisão de termos e retenção, seleção explícita do provedor. |
| Organização arquivada mas job continua | Dados órfãos ou ressurgem | Jobs verificam estado e autorização no início e antes de ativar resultado. |
| Datas de convite e envio fora de sincronia Clerk/banco | Convite perdido ou duplicado | Estado local explícito, idempotency key, retries e reconciliação. |

---

## 13. Decisões ainda necessárias antes da implementação

Recomendações abaixo são defaults, não escolhas já confirmadas:

1. **Canal do piloto:** playground + web widget é a recomendação; confirmar se WhatsApp precisa ser requisito da primeira versão.
2. **Compartilhamento de organização:** recomendado não compartilhar no MVP; confirmar se cada organização terá apenas seu administrador criador.
3. **Owner e suporte:** recomendado owner gerenciar convites sem ler conteúdo privado, salvo processo excepcional auditado.
4. **Conteúdo público:** recomendado nenhum documento aparecer em canal público sem opt-in explícito na configuração do agente/documento.
5. **Ações de escrita:** recomendado começar só com consulta; confirmar integração de leitura concreta e eventual ação que o piloto precisa executar.
6. **Provedor e modelos:** escolher após inventário do projeto, segredo disponível, requisito de privacidade e teste de português; não fixar por suposição.
7. **Formatos e quotas:** começar em PDF textual/DOCX/TXT; definir limites concretos após medir tamanho/custo do ambiente.
8. **Retenção/exclusão:** definir período de conversas e política de apagar documento, chunks, cópias/backups e eventos.
9. **Relação Clerk–Supabase:** confirmar estratégia suportada pela versão/configuração atual (JWT/claims ou verificação server-side) antes de escrever RLS.
10. **Reranking:** incluir apenas se benchmark mostrar ganho que compense custo e latência.
11. **Memória persistente:** definir categorias permitidas, prazo padrão, controles do titular e se habilitação exige ação afirmativa no canal; default deste plano é desligada até validação de privacidade.
12. **Vinculação cross-channel:** default é prova de controle (login/OTP) e escopo somente dentro da mesma organização; definir método por canal e risco de número reciclado/conta compartilhada.
13. **Governança LGPD:** identificar controlador(es), operador(es)/suboperadores conforme relação real, finalidades, bases legais, avisos, retenção, solicitações e resposta a incidentes com assessoria apropriada.

O fluxo de revisão deve discutir as decisões de produto uma por vez, com fatos técnicos apurados por inspeção do projeto antes de pedir escolhas que o código ou configuração possam resolver.

---

## 14. Arquivos e áreas prováveis

O projeto novo está iniciado em `C:\Users\Usabit\Desktop\Projetos\Project-RAG`, com repositório Git local na branch `main` e aplicação Next.js em `web/`. Arquivos já existentes e verificados: `web/package.json`, `web/package-lock.json`, `web/.npmrc`, `web/src/app/page.tsx`, `web/src/app/layout.tsx`, `web/src/app/globals.css`, `web/next.config.ts`, `web/tsconfig.json` e configuração ESLint. A primeira validação de `npm run lint` e `npm run build` passou; `npm audit --omit=dev` encontrou zero vulnerabilidades de produção. A auditoria completa apontou cinco avisos high no conjunto de ferramentas de lint, cuja correção automática sugerida exigiria downgrade major de `eslint-config-next`; não executar `npm audit fix --force`. Investigar atualização compatível antes da liberação. Próximas áreas de implementação a mapear/refinar incluem:

- Clerk: SDK, middleware/callbacks e autorização server-side;
- Supabase: migrations PostgreSQL, políticas RLS, busca/índices e Storage;
- telas/componentes de organização, convites, agentes, skills, conhecimento e playground;
- runtime/provedor de IA e catálogo de ferramentas;
- worker/fila de ingestão;
- testes unitários, integração/RLS, segurança e avaliação de RAG;
- configuração de ambientes/deploy e documentação operacional.

A Fase 0 deve continuar com a análise de segurança das dependências de lint e com a definição segura de configuração de ambiente. Não adicionar chaves reais a arquivos versionados, nem criar abstrações duplicadas sem necessidade.

---

## 15. Resumo executivo

O MVP é uma plataforma de acesso por convite em que **Clerk autentica pessoas, o owner controla quem entra, cada administrador cria vários espaços isolados e o Supabase guarda os dados separados por organização**. Dentro de cada espaço, o administrador cria agentes e skills, envia documentos com processamento automático e testa respostas com fontes. Cada execução oferece auditoria legível de evidências, regras e ferramentas, com feedback que pode virar teste e comparação segura entre versões; isso mostra o caminho verificável sem armazenar chain-of-thought. O sistema trata skills como instruções, não como permissões; ferramentas e busca são autorizadas pelo servidor/banco. A prioridade é uma jornada simples e poucos cliques sem sacrificar isolamento, rastreabilidade ou tratamento de falhas.
