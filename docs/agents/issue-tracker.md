# Issue tracker: GitHub

Issues e specs deste repositório ficam no GitHub Issues: `Fabrycio13/project_rag_seguros`. Use `gh` para operações.

## Convenções

- Criar: `gh issue create --title "..." --body "..."`
- Ler: `gh issue view <number> --json number,title,body,labels,comments`
- Listar: `gh issue list --state open`
- Comentar: `gh issue comment <number> --body "..."`
- Aplicar/remover labels: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- Fechar: `gh issue close <number> --comment "..."`

O repositório pode ser inferido do remote Git.

## Pull requests como superfície de triagem

**Não.** PRs não entram no fluxo de triagem.

## Publicar no issue tracker

Criar uma GitHub Issue.

## Buscar ticket relevante

Ler a issue com `gh issue view`.
