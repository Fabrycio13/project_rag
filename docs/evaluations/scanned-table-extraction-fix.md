# Correção incremental: células omitidas na tabela escaneada

## Resultado demonstrado

Na página 3 de `docs/fixtures/rag/dificil.pdf`, OCR local agora recupera **Extra**, **40 unidades**, **4 horas uteis**, **R$ 200,00** como quatro células distintas, com página, bbox em pixels, escala 2 e confiança por célula. Não foram inseridos valores do gold no extrator. O PDF, canonical, gold, manifest e raw históricos não foram editados. A correção mista anterior permanece: p4 tem 506 caracteres e conserva C7/T1.

Escopo: recuperação de texto em grades retas com bordas. Não é reconstrução completa de tabelas, Markdown estruturado nem certificação de acurácia RAG.

## Evidência e causa

O preview `docs/fixtures/rag/preview/dificil-3.png` mostra a linha legível e todas as bordas. Renderizações reais PDF.js a escalas 2 e 3 foram salvas em `docs/evaluations/table-p3-scale2.png` e `table-p3-scale3.png`. A tabela não desaparece no raster: a perda ocorre na segmentação/reconhecimento de página do Tesseract.

Hipóteses investigadas: perda no raster; resolução insuficiente; segmentação de grade com bordas; confiança média esconder omissão. A renderização refuta a primeira. Os probes locais compararam PSM 3/6/11 em duas escalas, sem serviço externo. PSM 6 em escala 2 omite cabeçalhos/linha embora apresente confiança 94. Escala 3 não resolve: todos os três modos omitem a tabela, com confiança 93. PSM 3 em escala 2 retorna `Extra [ao unidades 4 horas uteis Jas 200,00` (confiança 92), portanto trocar o modo não recupera fielmente números/moeda. PSM 11 também altera a ordem de células.

Remoção experimental de linhas por runs de pixels, com limiares 160 e 230, recupera sinais da grade mas mantém `ao unidades`, `a horas uteis` e/ou `las 200,00`. Essa abordagem NÃO foi adotada na produção. As 18 saídas estão preservadas em `scanned-table-probes-original.json`, `scanned-table-probes-threshold160.json` e `scanned-table-probes.json`. A primeira execução do probe terminou com erro no cleanup (`pdf.destroy` não existe), após salvar os resultados; o script foi corrigido e executado com exit 0. Isso não foi erro de reconhecimento.

O isolamento dos interiores das células elimina a competição da borda com caracteres e fornece ao OCR uma única linha por célula. Essa mudança recuperou os oito textos de cabeçalho/dados sem corrigir manualmente caracteres.

## Implementação

- `scripts/ocr-table-cells.mjs`: detecta runs horizontais contínuos maiores que 30% da largura da página, agrupa espessura de linha e procura separadores verticais presentes em mais de 85% do intervalo. Exige ao menos três separadores; intervalos entre 15 pixels e 12% da altura. Recorta interior com margem, acrescenta fundo branco e devolve candidatos. Esses limiares são geométricos, não palavras/número de página/nome de arquivo.
- `scripts/pdf-extract.mjs`: mantém OCR de página em PSM 6 e executa PSM 7 nos candidatos da grade, com limite de 120 células por página, além dos limites anteriores de tempo/memória/páginas/pixels/texto. Preserva `ocrPageText` original e registra `ocrTableCells` com `page`, `bbox`, `scale`, `row`, `column`, `method`, `text`, `confidence`. `ocrText` acrescenta as saídas das células ao raw da página; não faz deduplicação nem reescrita. `text` continua concatenando nativo/OCR. A confiança média original não é artificialmente elevada. Texto útil agregado de células reconhecidas pode salvar uma página tabular cuja passagem de página não reconheceu nada.
- `src/lib/pdf-extraction.d.mts`: tipa os novos campos.
- `tests/pdf-scanned-table.test.mjs`: regressão real verifica exatamente os valores ausentes e proveniência p3/bbox; outro PDF sintético gerado em memória usa Premium/73 unidades/R$ 345,67, sem vocabulário do gold.

A regressão real foi executada antes da integração: RED por `page 3 OCR missing 40 unidades`. Depois: GREEN. O novo teste sintético revelou que o limiar de texto útil não deve ser aplicado a cada célula curta separadamente; a validação usa o texto agregado das células com confiança mínima, sem fabricar conteúdo. Suíte final passou.

## Antes/depois

Fonte anterior: `docs/evaluations/mixed-pdf-after/dificil.raw.json` (arquivada pela correção precedente). Fonte atual: `docs/evaluations/scanned-table-after/dificil.raw.json`.

| Campo | Antes | Depois |
|---|---|---|
| p3 caracteres | 503 | 590 |
| linha Extra | ausente (Extra somente na nota) | Extra, célula p3, confiança 96 |
| limite mensal | ausente | 40 unidades, confiança 96 |
| resposta | ausente | 4 horas uteis, confiança 95 |
| custo adicional | ausente | R$ 200,00, confiança 82 |
| p4 caracteres | 506 | 506 |

`check-scanned-table.mjs` comprovou igualdade exata do texto nativo das quatro páginas, texto final inalterado em p1/p2/p4 e `ocrPageText` p3 idêntico ao `ocrText` anterior. Registra hashes SHA-256 de PDFs, canonical, gold, manifest, probes e raw em `docs/evaluations/scanned-table-checks.json`. SHA-256 difícil: `9037ffe2ba637fb183799b873dda8dd0adc20c76eb6a030e853c69a67b797944`; raw anterior: `2f139c4c347d8ee1dc9f6e1920d6270977d9ce83eb89d8c1bd4b89cae1fe18fb`; raw atual: `df6efa0520471081be9aa0a683f0d1c669e7b485f0ab3633a3bf945e722844ff`.

Benchmark serial real: fácil 725 ms, médio 705 ms, difícil 5282 ms; valores individuais, não percentis. Correspondências literais normalizadas continuam **7/8, 7/9, 7/9**: gold contém pipes e relações estruturadas que o texto bruto não reproduz. A recuperação das células não transforma esses números em porcentagens de acurácia nem em prova de tabela fiel.

## Gates e reprodução

Na raiz `C:/Users/Usabit/Desktop/Projetos/Project-RAG`:

```sh
node --test tests/pdf-scanned-table.test.mjs
node docs/fixtures/rag/benchmark.mjs docs/evaluations/scanned-table-after
node docs/evaluations/check-scanned-table.mjs
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Resultados finais: regressões focadas 2 pass/0 fail; suíte completa **44 pass/0 fail/0 skip**; checker, benchmark, lint, TypeScript, build e diff-check exit 0. Build gerou 10 páginas estáticas. Permanecem avisos preexistentes MODULE_TYPELESS_PACKAGE_JSON e CRLF. Diff-check não cobre arquivos untracked; scripts novos foram executados e lintados. Probes reproduzíveis: `node docs/evaluations/probe-scanned-table.mjs --original`, `--threshold160` ou sem flag. Gerador do corpus não foi executado.

## Persistência, reprocessamento e limites

Nenhuma API/UI, migration, configuração de credenciais, upload, documento remoto, commit/push ou embedding foi alterado. Não há migration nova necessária para estes campos: a rota existente salva `result.pages` integralmente e a coluna `pages` é JSONB. Isso foi inspecionado localmente, NÃO verificado com persistência autenticada. Como os valores faltantes foram recuperados nos casos exercitados, não foi implementado o fallback de novo estado `review_required` previsto para falha de recuperação.

**Documentos já completed não são reprocessáveis pela ação atual**: a função de claim só retoma failed ou processing com lease expirada. Este fix não atualiza extrações já salvas. Não apagar/rebaixar registros nem reenviar privados como workaround sem autorização. Reprocessamento seguro/versionado continua uma tarefa separada; documentos existentes mantêm a extração antiga até esse fluxo ser autorizado e implementado.

Detector limitado a grades axis-aligned, largas, com linhas contínuas e separadores suficientes. Tabelas sem bordas, estreitas, inclinadas, células mescladas/multilinha, clipping e qualidade baixa não estão resolvidas. Bboxes referem-se ao raster escala 2, não coordenadas PDF. `row`/`column` são índices do detector, não estrutura semântica de tabela nem IDs de continuação (a linha de dados deste PDF tem índice 2 devido aos intervalos de bordas). O OCR adicional fica ao fim da representação plana e pode duplicar células que o OCR de página já reconheceu. `table_cells_reading_order_unverified` registra essa limitação; a UI atual não exibe esses warnings. Confiança continua não sendo garantia de cobertura. Não foram testados RAG/geração, resistência a prompt injection, documentos empresariais variados ou consumo de pico. A etapa incremental está exercitada para a perda documentada; o plano de ingestão rigorosa/Markdown/layout ainda NÃO está completo.
