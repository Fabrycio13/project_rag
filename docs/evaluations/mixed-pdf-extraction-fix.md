# Correção de cobertura OCR em páginas mistas

## Resultado e escopo

Correção local exercitada nos PDFs sintéticos autorizados, sem enviar PDFs a serviços externos. A página 4 de `dificil.pdf` agora preserva C7 e T1: passou de 84 para 506 caracteres. Não é uma correção completa de tabelas nem uma certificação de qualidade empresarial. PDFs, `canonical.md`, `gold.json`, manifest e referências de página continuam sendo as fontes; não foram reescritos para combinar com a extração.

Arquivos de implementação: `scripts/pdf-extract.mjs` e `src/lib/pdf-extraction.d.mts`. Wrapper `src/lib/pdf-extraction.mjs`, API, autorização, storage e migrations não foram alterados. As mudanças preexistentes da árvore suja foram mantidas. Nenhum commit/push, migration remota, embedding ou upload foi realizado. O build carregou a configuração existente normalmente; não foi lido nem exposto o conteúdo de `.env.local`.

## Causa demonstrada antes da correção

O extrator decidia OCR somente pela contagem de letras/números nativos (mínimo 12). Um cabeçalho/rodapé com 84 caracteres satisfazia esse critério, embora o conteúdo substancial estivesse em uma imagem na mesma página. Assim, o processo retornava `completed` e perdia C7 e T1. Texto nativo significativo também não demonstra que uma imagem incorporada não contém evidência adicional.

Foram adicionadas e executadas antes da mudança três regressões reais: PDF gerado com mobiliário nativo + cláusula rasterizada, corpo nativo significativo + cláusula rasterizada, e `dificil.pdf` real do corpus. Resultado RED: 0 passaram / 3 falharam, por ausência das cláusulas esperadas; não por indisponibilidade de OCR. O primeiro GREEN recuperou o conteúdo; a assertion literal do terceiro teste precisou aceitar quebra de linha entre `Nao` e `existe`, sem alterar texto de produção ou gold. Resultado final: 3 passaram / 0 falharam.

Hipóteses avaliadas: limiar de texto impedir OCR (confirmada); falha OCR do corpo (refutada para C7/T1 pela execução real); divergência meramente de formatação (refutada para p4 original, confirmada para tabelas nativas sem pipes). Não houve ajuste específico por nome do PDF, página, identificador C7 ou quantidade de caracteres do corpus.

## O que mudou

1. O operador raster de PDF.js é detectado independentemente do tamanho do texto nativo. Páginas somente nativas continuam sem OCR. Qualquer página com pintura de imagem passa por OCR conservador, inclusive imagens em páginas com corpo nativo significativo.
2. Na renderização destinada ao OCR, `operationsFilter` suprime a pintura de glifos nativos. Não há preenchimento branco de bounding boxes que apagaria imagem sobreposta, nem deduplicação aproximada que poderia eliminar uma cláusula legítima. Cabeçalho/rodapé nativo permanece uma vez, na camada nativa.
3. Por página, são preservados `nativeText` (saída nativa anterior sem reescrita), `ocrText` (saída OCR sem reescrita), `ocrConfidence` e `warnings`, além de `page`, `method`, `text`. `text` concatena nativo e OCR com linha em branco, e não inventa uma ordem visual. `method: ocr` indica que OCR foi executado, inclusive em página mista; mantém compatibilidade com a contagem atual de páginas OCR.
4. `layout_unverified` explicita que extração de texto não reconstrói layout. `mixed_reading_order_unverified` marca concatenação de camadas sem ordem espacial demonstrada. OCR vazio/baixo em página com texto nativo útil conserva a evidência nativa e marca `raster_text_unverified`; sem texto útil continua falhando, como antes. Esses avisos são dados de extração, não uma nova indicação na UI. A rota existente salva `result.pages` integralmente, mas persistência autenticada não foi exercitada neste trabalho.
5. O benchmark aceita diretório de saída opcional, evitando substituir o baseline existente. Novas evidências ficam em `docs/evaluations/mixed-pdf-before/` e `mixed-pdf-after/`. `check-mixed-pdf.mjs` verifica hashes, preservação do nativo, ausência de duplicação de rodapé em p4 e publica offsets das linhas/células para inspeção.

## Medição antes/depois

Execução real serial do wrapper limitado, Node v26.7.0/Windows. Tempos individuais, não percentis; variam com concorrência e aquecimento. Os SHA-256 dos três PDFs coincidem com o manifest, verificados programaticamente.

| PDF | Elementos literais normalizados antes | Depois | Métodos antes → depois | Tempo antes → depois (ms) |
|---|---:|---:|---|---:|
| fácil | 7/8 | 7/8 | text → text | 576 → 658 |
| médio | 7/9 | 7/9 | text,text,text → igual | 567 → 548 |
| difícil | 5/9 | 7/9 | text,text,ocr,text → text,text,ocr,ocr | 3160 → 4184 |

Status técnico dos três: `completed` antes e depois. Isso, isoladamente, não garante cobertura. P4 difícil: `nativeText` conserva os 84 caracteres originais; `ocrText` acrescenta C7/T1; `text` final contém 506 caracteres. C7 e T1 correspondem ao gold após normalizar apenas Unicode/espaços. Negação de exportação, desconto 0%, valor adversarial R$ 9,99 e aviso de valor correto R$ 1.250,00 estão presentes. Recuperar T1 não demonstra resistência a prompt injection: não foi executado modelo de resposta.

## Revisão de estrutura, tabelas e ordenação

A revisão comparou raw antes/depois, gold autoral e previews reais: contact sheet, difícil p1, p3 e p4. Os offsets auxiliares estão em `mixed-pdf-structure-checks.json`; são diagnósticos de texto, não bboxes ou medição de reconstrução de tabela.

- **Fácil p1, tabela C5:** Base → 120 unidades → 8 horas úteis → R$ 0,00; Extra → 40 unidades → 4 horas úteis → R$ 200,00 aparecem na ordem correta. A nota de aprovação/não acumulação também permanece. A falha literal deve-se à ausência de pipes/linhas estruturadas no texto achatado, não à ausência dessas células.
- **Médio p2/p3:** cabeçalhos da tabela repetidos e marcadores de continuação preservados. Base está em p2; Extra e nota de exceção em p3, seguidos de C6/C7/T1. As quatro células de cada linha estão presentes e ordenadas. Não há objeto de tabela unificado nem relação de continuação formal produzida pelo extrator.
- **Difícil p1, duas colunas:** preview confirma C1/C2 à esquerda e C3/C4 à direita. O raw retorna C1 → C2 → C3 → C4, sem intercalar linhas das colunas neste corpus; lista numerada mantém 1 → 2 → 3. Não foi implementado algoritmo geral de leitura multicoluna. Rodapé aparece antes do corpo na extração nativa por ordem de operadores, logo layout global não é fiel mesmo quando a ordem das cláusulas é adequada.
- **Difícil p2, tabela nativa:** linha Base com quatro células preservada; divergência literal de separadores como no médio.
- **Difícil p3, tabela escaneada:** há uma perda real distinta, **não corrigida**: os valores `40 unidades`, `4 horas uteis` e `R$ 200,00` e a linha tabular Extra não são recuperados pelo OCR atual. A palavra Extra aparece somente na nota, o que não pode ser contado como linha recuperada. Preview mostra a tabela legível; raw mantém título, nota e C6, mas omite cabeçalhos/células. Confiança média OCR não detecta essa omissão. Exige avaliação dedicada de segmentação/extração tabular, não inserção manual dos valores do gold.
- **Difícil p4:** C7 precede T1 como no preview/gold; ambos foram recuperados, sem repetir cabeçalho/rodapé no OCR. Na concatenação, rodapé nativo ainda antecede corpo OCR. O aviso de ordem não verificada é intencional.

Portanto, não houve falha evidenciada de ordenação das cláusulas nas duas colunas que exigisse modificar o algoritmo nesta correção. Não se deve converter ausência de substring com pipes em “falha semântica”, nem converter presença isolada de palavras em tabela fiel.

## Reproduzir

Na raiz `C:/Users/Usabit/Desktop/Projetos/Project-RAG`, com `node_modules` existente:

```sh
node --test tests/pdf-mixed-page.test.mjs
node docs/fixtures/rag/benchmark.mjs docs/evaluations/mixed-pdf-after
node docs/evaluations/check-mixed-pdf.mjs
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

O baseline **anterior ao fix** foi executado antes da edição e arquivado em `mixed-pdf-before`; não pode ser reobtido simplesmente executando o extrator corrigido. Seus raw e métricas são evidência daquela execução. O baseline histórico original em `docs/fixtures/rag` foi mantido com seus tempos originais. O gerador foi inspecionado, não regenerado: seus PDFs/hashes e gold permanecem inalterados.

## Gates executados

- Regressões novas: 3 pass / 0 fail; OCR real em subprocesso local.
- Suíte completa: 42 pass / 0 fail / 0 skip. Avisos preexistentes `MODULE_TYPELESS_PACKAGE_JSON` em módulos TS; não foram mascarados nem corrigidos fora de escopo.
- `npm run lint`: exit 0.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0, compilação/TypeScript e 10 páginas estáticas concluídos.
- Benchmark: três PDFs executados antes e depois; hashes e preservação nativa verificados; checker exit 0. Resultados de tabela ausente são exibidos, não mascarados como pass semântico.
- `git diff --check`: exit 0; avisos CRLF preexistentes nos três arquivos rastreados já modificados. Como vários arquivos desta tarefa são untracked, esse comando não os cobre; os novos scripts foram exercitados diretamente, tipos verificados e todos os arquivos de implementação inspecionados/aplicados por ferramentas. A árvore já era suja, com vários arquivos novos de processamento e docs; não houve limpeza/reset/commit.

## Limitações e riscos restantes

OCR adicional pode ser desnecessário em logos/fotografias e aumentar custo/tempo. Preferiu-se cobertura conservadora a ignorar imagens com evidência; não há detector de texto raster. PDFs com camada OCR sobre imagem podem devolver texto redundante entre camadas; supressão de glifos não elimina texto já rasterizado. Glifos convertidos em caminhos, clipping e transparências complexos exigem novos casos de teste. OCR continua sujeito a omissões e erros mesmo com confiança alta; tabelas são um exemplo comprovado. Páginas mistas não têm fusão espacial de blocos, bboxes ou reconstrução de tabelas; avisos não devem ser interpretados como detecção completa de toda perda. Pipeline tabular separado deve ser avaliado com métricas por célula/relação antes de indexar documentos que dependem dessas tabelas. Não foram avaliados pico de memória, benchmark empresarial representativo, recuperação/geração, persistência autenticada, segurança semântica ou qualidade end-to-end. Não há promessa de precisão empresarial.
