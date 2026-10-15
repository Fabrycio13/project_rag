# Design System & Playbook para IA — web
> **Gerado automaticamente por `sync-design-system` em:** `2026-10-15T18:08:21.270Z`
> **Total escaneado:** 284 arquivos | 3.518 linhas de código | 21 variáveis CSS | 57 cores | 12 componentes | 19 telas

<!-- SECTION: stack -->
## 01. Visão Geral & Stack Tecnológica
| Camada | Tecnologia |
|---|---|
| **Framework** | `next` |
| **Linguagem** | `typescript` |
| **CSS Framework** | `tailwind 4` |
| **UI Library** | `none` |
| **Bundler** | `none` |
| **Data Fetching** | `native` |
| **Autenticação** | `supabase` |
| **Roteamento** | `next-router` |

<!-- SECTION: ai-playbook -->
## 🤖 02. Guia de Uso & Engenharia para IA (Playbook Completo)
Sempre que você (Agente de IA) for criar uma nova tela, modal, componente ou editar uma funcionalidade neste projeto, siga rigorosamente as matrizes e blueprints abaixo:

### 2.1 Matriz de Decisão Semântica (Dark Mode `:root` vs Light Mode `[data-theme='light']`)
| Elemento / Papel Visual | Variável CSS Oficial | Valor Dark Mode | Valor Light Mode | Classes Recomendadas | Quando Usar |
|---|---|---|---|---|---|
| **Fundo Principal da Página (Page Background)** | `var(--background)` | `#ffffff` | Herda | `bg-[var(--bg-main)] text-[var(--text-main)]` | Sempre no wrapper principal de cada tela para alternar automaticamente entre Dark e Light mode. |
| **Superfície de Card / Container / Modal (Card Surface)** | — | — | Herda | `bg-[var(--bg-card)] border border-[var(--border)] rounded-xl` | Qualquer caixa ou seção agrupada sobre o fundo principal. |
| **Navegação Lateral / Sidebar / Header Secundário** | — | — | Herda | `bg-[var(--bg-sidebar)] border-r border-[var(--border)]` | Containers de navegação estrutural do sistema. |
| **Campos de Entrada (Input, Select, Textarea, Search)** | — | — | Herda | `bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:border-[var(--primary)]` | Em todos os campos editáveis de formulários e barras de pesquisa. |
| **Ação Primária / CTA / Destaque Principal** | — | — | Herda | `bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium` | Botão principal de salvar/criar na tela, indicadores de seleção ativa. |
| **Hover da Ação Primária** | — | — | Herda | `hover:bg-[var(--primary-hover)]` | Transição suave de hover em elementos com --primary. |
| **Cor Secundária / Botões Secundários & Destaques** | — | — | Herda | `text-[var(--secondary)] bg-[var(--secondary)]/10 border-[var(--secondary)]/30` | Para ações secundárias, pílulas de busca/filtro ou destaques complementares. |
| **Texto Principal (Títulos H1-H3, Valores de KPI, Dados)** | `var(--foreground)` | `#171717` | Herda | `text-[var(--text-main)] font-semibold` | Todo texto de leitura primária e títulos de seção. |
| **Texto Secundário (Subtítulos, Labels, Metadados)** | — | — | Herda | `text-[var(--text-muted)] text-sm` | Textos explicativos abaixo de títulos, labels de campos e metadados. |
| **Texto Terciário / Placeholders / Desabilitado** | — | — | Herda | `text-[var(--text-dim)] text-xs` | Informações de baixa prioridade visual ou estados vazios/inativos. |
| **Bordas Estruturais e Divisores** | — | — | Herda | `border-[var(--border)] divide-[var(--border)]` | Para separar áreas sem criar contraste excessivo. |
| **Efeito Glassmorphism / Botões Flutuantes sobre Imagem** | — | — | Herda | `bg-[var(--glass)] backdrop-blur-md border border-[var(--border)]` | Superfícies translúcidas com backdrop-blur sobre fotos/cards. |
| **Feedback de Sucesso / Indicador Positivo** | — | — | Herda | `text-[var(--success)] bg-[var(--success)]/15` | Indicadores positivos, confirmações e métricas em alta. |

### 2.2 Blueprints de Código Prontos (Templates Oficiais)
```tsx
// 1. Container Padrão de Nova Página Autenticada (Suporta Dark e Light Mode)
<div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] p-6 space-y-6">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-main)]">Título da Página</h1>
      <p className="text-sm text-[var(--text-muted)]">Subtítulo descritivo</p>
    </div>
    <Button className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white">Ação Principal</Button>
  </div>
  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6">
    {/* Conteúdo do Card */}
  </div>
</div>
```

### 2.3 Mapa de Referência por Tipo de Feature
- **Nova Listagem / Catálogo com Filtros:** Consultar e seguir a estrutura das telas de catálogo e listagem mapeadas
- **Novo Grid de Cards / Galeria:** Consultar a estrutura responsiva de cards catalogada
- **Novo Dashboard Analítico (KPIs + Gráficos):** Consultar a tela principal de Dashboard catalogada
- **Nova Tela de Configurações:** Consultar formulários e padrões de inputs catalogados
- **Novo Formulário / Modal de Criação:** Consultar componentes de formulário mapeados

<!-- SECTION: css-variables -->
## 03. Paleta de Cores & Variáveis CSS por Tema
### Escopo: `:root` (4 tokens de cor)
| Variável | Valor |
|---|---|
| `--background` | `#ffffff` |
| `--foreground` | `#171717` |
| `--background` | `#0a0a0a` |
| `--foreground` | `#ededed` |

### Escopo: `@theme inline` (2 tokens de cor)
| Variável | Valor |
|---|---|
| `--color-background` | `var(--background)` |
| `--color-foreground` | `var(--foreground)` |

### Escopo: `[data-design-reference="dark"]` (13 tokens de cor)
| Variável | Valor |
|---|---|
| `--reference-bg-main` | `#10100c` |
| `--reference-bg-card` | `#28282c` |
| `--reference-bg-sidebar` | `#10100c` |
| `--reference-bg-input` | `#1e2235` |
| `--reference-primary` | `#0864c8` |
| `--reference-primary-hover` | `#0864c8` |
| `--reference-secondary` | `#18508c` |
| `--reference-text-main` | `#f8fafc` |
| `--reference-text-muted` | `#94a3b8` |
| `--reference-text-dim` | `#64748b` |
| `--reference-border` | `#48484c` |
| `--reference-glass` | `rgba(15, 23, 42, 0.78)` |
| `--reference-success` | `#22c55e` |

## 04. Dicionário Completo de Variáveis CSS (21)
| Variável | Valor | Escopo | Categoria | Arquivo |
|---|---|---|---|---|
| `--background` | `#ffffff` | `:root` | color | `src/app/globals.css:4` |
| `--foreground` | `#171717` | `:root` | color | `src/app/globals.css:5` |
| `--color-background` | `var(--background)` | `@theme inline` | color | `src/app/globals.css:9` |
| `--color-foreground` | `var(--foreground)` | `@theme inline` | color | `src/app/globals.css:10` |
| `--font-sans` | `var(--font-geist-sans)` | `@theme inline` | typography | `src/app/globals.css:11` |
| `--font-mono` | `var(--font-geist-mono)` | `@theme inline` | typography | `src/app/globals.css:12` |
| `--background` | `#0a0a0a` | `:root` | color | `src/app/globals.css:17` |
| `--foreground` | `#ededed` | `:root` | color | `src/app/globals.css:18` |
| `--reference-bg-main` | `#10100c` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:1` |
| `--reference-bg-card` | `#28282c` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:2` |
| `--reference-bg-sidebar` | `#10100c` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:3` |
| `--reference-bg-input` | `#1e2235` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:4` |
| `--reference-primary` | `#0864c8` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:5` |
| `--reference-primary-hover` | `#0864c8` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:6` |
| `--reference-secondary` | `#18508c` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:7` |
| `--reference-text-main` | `#f8fafc` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:8` |
| `--reference-text-muted` | `#94a3b8` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:9` |
| `--reference-text-dim` | `#64748b` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:10` |
| `--reference-border` | `#48484c` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:11` |
| `--reference-glass` | `rgba(15, 23, 42, 0.78)` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:12` |
| `--reference-success` | `#22c55e` | `[data-design-reference="dark"]` | color | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg:13` |

<!-- SECTION: pages -->
## 08. Catálogo Completo de Telas (19 páginas)
### Tela: `layout` (Sub-view) — [Geral]
- **Arquivo:** `src/app/layout.tsx` (34 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Componentes Utilizados (3):** `ClerkProvider`, `Geist`, `Geist_Mono`
- **Sub-componentes Internos:** `RootLayout`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/page.tsx` (107 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Entre para continuar`, `Sua conta não tem acesso à plataforma`, `Bem-vindo à plataforma`, `Sua conta está pronta`
- **Componentes Utilizados (2):** `Link`, `SignOutButton`
- **Sub-componentes Internos:** `Home`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `sign-out-button` (Sub-view) — [Geral]
- **Arquivo:** `src/app/sign-out-button.tsx` (17 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Componentes Utilizados (1):** `SignOutButton`
- **Sub-componentes Internos:** `SignOutButton`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/accept-invitation/page.tsx` (127 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Não foi possível concluir o acesso`
- **Componentes Utilizados (2):** `Link`, `SignOutButton`
- **Sub-componentes Internos:** `InvitationMessage`, `AcceptInvitationPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/account-check/page.tsx` (46 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Verificação da conta`
- **Componentes Utilizados (0):** nenhum
- **Sub-componentes Internos:** `AccountCheckPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `organization-form` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/organization-form.tsx` (30 linhas) | **Padrão Visual:** Formulário Multi-Seção / Wizard
- **Layout:** `próprio`
- **Componentes Utilizados (0):** nenhum
- **Sub-componentes Internos:** `OrganizationForm`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum
- **Hooks Utilizados:** `useRouter`, `useRef`, `useState`

### Tela: `organization-shell` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/organization-shell.tsx` (11 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Organizações indisponíveis`
- **Componentes Utilizados (2):** `Link`, `SignOutButton`
- **Sub-componentes Internos:** `OrganizationShell`, `OrganizationNotice`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/page.tsx` (18 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Organizações`, `Suas organizações`
- **Componentes Utilizados (5):** `Link`, `ORGANIZATION_READINESS_MESSAGE`, `OrganizationShell`, `OrganizationNotice`, `OrganizationForm`
- **Sub-componentes Internos:** `OrganizationsPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `invitation-manager` (Sub-view) — [Geral]
- **Arquivo:** `src/app/admin/invitations/invitation-manager.tsx` (215 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Convidar administrador`, `Convites`
- **Componentes Utilizados (0):** nenhum
- **Sub-componentes Internos:** `InvitationManager`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum
- **Hooks Utilizados:** `useRouter`, `useState`

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/admin/invitations/page.tsx` (71 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Acesso restrito`
- **Componentes Utilizados (3):** `Link`, `SignOutButton`, `InvitationManager`
- **Sub-componentes Internos:** `AdminInvitationsPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/[id]/page.tsx` (20 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Componentes Utilizados (4):** `Link`, `ORGANIZATION_READINESS_MESSAGE`, `OrganizationShell`, `OrganizationNotice`
- **Sub-componentes Internos:** `OrganizationPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/sign-in/[[...sign-in]]/page.tsx` (10 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Componentes Utilizados (1):** `SignIn`
- **Sub-componentes Internos:** `SignInPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/sign-up/[[...sign-up]]/page.tsx` (10 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Componentes Utilizados (1):** `SignUp`
- **Sub-componentes Internos:** `SignUpPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `agent-form` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/[id]/agents/agent-form.tsx` (43 linhas) | **Padrão Visual:** Formulário Multi-Seção / Wizard
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Criar agente`
- **Componentes Utilizados (0):** nenhum
- **Sub-componentes Internos:** `AgentForm`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum
- **Hooks Utilizados:** `useRouter`, `useRef`, `useState`

### Tela: `error` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/[id]/agents/error.tsx` (6 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Agentes indisponíveis`
- **Componentes Utilizados (1):** `Link`
- **Sub-componentes Internos:** `AgentsError`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `loading` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/[id]/agents/loading.tsx` (5 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Componentes Utilizados (1):** `OrganizationShell`
- **Sub-componentes Internos:** `LoadingAgents`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/[id]/agents/page.tsx` (32 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Agentes`, `Agentes da organização`
- **Componentes Utilizados (4):** `Link`, `AGENT_READINESS_MESSAGE`, `OrganizationShell`, `AgentForm`
- **Sub-componentes Internos:** `AgentsPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

### Tela: `document-manager` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/[id]/agents/[agentId]/document-manager.tsx` (64 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Abas / Seções / Modais:** `Documentos privados`
- **Componentes Utilizados (1):** `DOCUMENT_MAX_BYTES`
- **Sub-componentes Internos:** `DocumentManager`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum
- **Hooks Utilizados:** `useState`, `useRef`, `useCallback`, `useEffect`

### Tela: `page` (Sub-view) — [Geral]
- **Arquivo:** `src/app/organizations/[id]/agents/[agentId]/page.tsx` (32 linhas) | **Padrão Visual:** Página de Conteúdo / View
- **Layout:** `próprio`
- **Componentes Utilizados (4):** `Link`, `AGENT_READINESS_MESSAGE`, `OrganizationShell`, `DocumentManager`
- **Sub-componentes Internos:** `AgentPage`
- **Cores Específicas na Tela:** usa tokens globais
- **Assets / Imagens na Tela:** nenhum

<!-- SECTION: components -->
## 09. Catálogo de Componentes (12)
| Componente | Tipo | Arquivo | Linhas | Variantes | Props | Usado Em |
|---|---|---|---|---|---|---|
| `<RootLayout />` | layout | `src/app/layout.tsx` | 34 | — | — | 0 arquivos |
| `<SignOutButton />` | page | `src/app/sign-out-button.tsx` | 17 | — | — | 4 arquivos |
| `<OrganizationForm />` | page | `src/app/organizations/organization-form.tsx` | 30 | — | — | 1 arquivos |
| `<OrganizationShell />` | page | `src/app/organizations/organization-shell.tsx` | 11 | — | — | 5 arquivos |
| `<OrganizationNotice />` | page | `src/app/organizations/organization-shell.tsx` | 11 | — | — | 2 arquivos |
| `<InvitationManager />` | page | `src/app/admin/invitations/invitation-manager.tsx` | 215 | — | — | 1 arquivos |
| `<SignInPage />` | page | `src/app/sign-in/[[...sign-in]]/page.tsx` | 10 | — | — | 0 arquivos |
| `<SignUpPage />` | page | `src/app/sign-up/[[...sign-up]]/page.tsx` | 10 | — | — | 0 arquivos |
| `<AgentForm />` | page | `src/app/organizations/[id]/agents/agent-form.tsx` | 43 | — | — | 1 arquivos |
| `<AgentsError />` | page | `src/app/organizations/[id]/agents/error.tsx` | 6 | — | — | 0 arquivos |
| `<LoadingAgents />` | page | `src/app/organizations/[id]/agents/loading.tsx` | 5 | — | — | 0 arquivos |
| `<DocumentManager />` | page | `src/app/organizations/[id]/agents/[agentId]/document-manager.tsx` | 64 | — | — | 2 arquivos |

<!-- SECTION: assets -->
## 10. Catálogo de Imagens, SVGs e Vídeos
| Arquivo | Caminho | Tamanho | Referenciado Em |
|---|---|---|---|
| `table-p3-scale2.png` | `docs/evaluations/table-p3-scale2.png` | 91.6 KB | — |
| `table-p3-scale3.png` | `docs/evaluations/table-p3-scale3.png` | 123 KB | — |
| `Apple Vision Pro _ HR Software Design.jpg` | `docs/Issues/Apple Vision Pro _ HR Software Design.jpg` | 38.5 KB | — |
| `favicon.ico` | `src/app/favicon.ico` | 25.3 KB | — |
| `page-1.png` | `docs/evaluations/structured-markdown-pilot/page-1.png` | 40.5 KB | `docs/evaluations/structured-markdown-pilot/generate.mjs` |
| `page-2.png` | `docs/evaluations/structured-markdown-pilot/page-2.png` | 34.7 KB | `docs/evaluations/structured-markdown-pilot/generate.mjs` |
| `page-3.png` | `docs/evaluations/structured-markdown-pilot/page-3.png` | 56.5 KB | `docs/evaluations/structured-markdown-pilot/generate.mjs` |
| `source.png` | `tests/fixtures/numeric-signs/source.png` | 51.2 KB | `tests/fixtures/generate-numeric-signs.mjs` |
| `inventory-low-confidence.png` | `docs/fixtures/rag/borderless-extra/inventory-low-confidence.png` | 45 KB | — |
| `inventory.png` | `docs/fixtures/rag/borderless-extra/inventory.png` | 44.9 KB | — |
| `prose-columns.png` | `docs/fixtures/rag/borderless-extra/prose-columns.png` | 40 KB | — |
| `borderless.preview.png` | `docs/fixtures/rag/extended/borderless.preview.png` | 47.5 KB | — |
| `low-contrast-skew.preview.png` | `docs/fixtures/rag/extended/low-contrast-skew.preview.png` | 55.7 KB | — |
| `merged-multiline.preview.png` | `docs/fixtures/rag/extended/merged-multiline.preview.png` | 41.1 KB | — |
| `same-page.preview.png` | `docs/fixtures/rag/extended/same-page.preview.png` | 49.6 KB | — |
| `skew-rotated.preview.png` | `docs/fixtures/rag/extended/skew-rotated.preview.png` | 39.1 KB | — |
| `contact-sheet.png` | `docs/fixtures/rag/preview/contact-sheet.png` | 183.8 KB | — |
| `dificil-1.png` | `docs/fixtures/rag/preview/dificil-1.png` | 36.4 KB | — |
| `dificil-2.png` | `docs/fixtures/rag/preview/dificil-2.png` | 17.9 KB | — |
| `dificil-3.png` | `docs/fixtures/rag/preview/dificil-3.png` | 36.8 KB | — |
| `dificil-4.png` | `docs/fixtures/rag/preview/dificil-4.png` | 29.3 KB | — |
| `facil-1.png` | `docs/fixtures/rag/preview/facil-1.png` | 77.7 KB | — |
| `medio-1.png` | `docs/fixtures/rag/preview/medio-1.png` | 31.1 KB | — |
| `medio-2.png` | `docs/fixtures/rag/preview/medio-2.png` | 26.9 KB | — |
| `medio-3.png` | `docs/fixtures/rag/preview/medio-3.png` | 44.7 KB | — |
| `file.svg` | `public/file.svg` | 0.4 KB | — |
| `globe.svg` | `public/globe.svg` | 1 KB | — |
| `next.svg` | `public/next.svg` | 1.3 KB | — |
| `vercel.svg` | `public/vercel.svg` | 0.1 KB | — |
| `window.svg` | `public/window.svg` | 0.4 KB | — |
