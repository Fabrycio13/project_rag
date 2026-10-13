# Correção de associação de tabela digitalizada sem bordas

## Resultado e escopo

Correção local do extrator, sem alteração de arquitetura, UI, migrações aplicadas, embeddings, chamadas pagas ou envio dos PDFs a serviços externos. Versão identificada: `pdf-evidence-v3-borderless`.

O caso histórico `extended/borderless.pdf` passou de **0/9 para 9/9 associações exatas** (cabeçalho e duas linhas de dados), não apenas presença de palavras. O teste TODO foi convertido em regressão ativa somente depois de executar a falha real: as nove células estavam `undefined`. Exemplo recuperado: linha Avançado → coluna Valor → `R$ 987,65`; linha Essencial → coluna Desconto → `2,5%`. A observação `Não acumular descontos.` permanece no OCR bruto, fora da tabela.

Um segundo documento sintético, inventário de quatro colunas e três linhas de dados, tem **16/16 associações exatas**, incluindo cabeçalhos, percentuais e restrições `Não vender`, `Não exportar` e `Não acumular`. Foi escrito independentemente do gold histórico. Os previews foram inspecionados: textos não se sobrepõem e não estão cortados.

**Atualização: perda específica de `-17` recuperada por OCR real, sem inferir sinal.** A variante negativa agora tem **16/16 células exatas**. O OCR de página original continua lendo `7` (confiança 47); a releitura local do recorte lê literalmente `- 17` (confiança 45), selecionado como `-17` após remover somente o espaço entre sinal já reconhecido e dígitos. `-3` permanece `-3` (releitura 88). Tentativas, palavras, texto bruto e bbox originais são preservados. A divergência exige `review_required`, Markdown nulo e `indexingEligible=false`. Isso resolve o caso medido, não garante reconhecimento universal de negativos. Veja a evidência adicional abaixo.

## Causa raiz

`tableCells()` detecta linhas horizontais e separadores verticais em pixels. Sem linhas, retorna zero células. O OCR já guardava palavras com bbox e confiança nas tentativas de orientação, mas `pdf-extract.mjs` não consumia essas coordenadas para construir associações. Portanto os valores estavam no texto, sem vínculo verificável com linha, coluna e cabeçalho.

## Implementação

Novo `scripts/ocr-borderless-table.mjs`, chamado somente quando não há células de grade e a orientação não é ambígua:

1. Ordena palavras no raster orientado e agrupa centros verticais em linhas pela altura mediana das palavras.
2. Separa grupos horizontais por espaços largos relativos à altura dos glifos, não por textos específicos ou contagens do fixture.
3. Exige cabeçalho compacto sem números ou pontuação de fim de frase, três a dez colunas, pelo menos duas linhas de dados e evidência numérica nas linhas. Tabelas de duas colunas são deliberadamente não suportadas para evitar confusão com prosa em colunas.
4. Verifica alinhamento dos grupos, espaçamento vertical e gutters comuns a todas as linhas, sem atravessar palavras. Linhas parciais, continuação deslocada, baixa confiança ou geometria inconsistente não recebem Markdown validado. Uma nota final de uma linha, alinhada à esquerda e terminada como frase, permanece fora da tabela e no OCR bruto.
5. Constrói células com `row`, `column`, spans unitários, `header`, `headerText`, palavras originais, bbox, confiança mínima, página, escala, frame, `sourceToOcr` e `viewportTransform`. As transformações permitem rastrear o bbox do raster orientado à origem; bbox não é apresentado falsamente como coordenada PDF.
6. Só gera Markdown para o retângulo simples aprovado pelas verificações: `validated_rectangular`. Escapa barras invertidas e pipes. Células mescladas de tabelas com bordas continuam com `spans_not_representable_in_markdown`, sem achatamento.

A validação é estrutural e heurística, não certificação semântica nem garantia de cobertura de página. **Todos os PDFs raster continuam em revisão e sem elegibilidade de indexação**, mesmo quando a tabela simples possui Markdown. `ocrPageText`, tentativas, texto nativo e demais avisos existentes não são substituídos pelo Markdown.

Não há literais de plano, valor, nome de arquivo nem número esperado de linhas no algoritmo. Os tipos em `src/lib/pdf-extraction.d.mts` acompanham o contrato novo.

## Evidência executada — etapa anterior (baseline preservado)

- `node --test tests/*.test.mjs`: **67 testes, 67 aprovados, 0 falhas, 0 TODOs**. Saída preservada em `docs/evaluations/borderless-tests.tap`.
- Corpus histórico: nove PDFs estendidos e três originais executados novamente pelo wrapper real. Além disso, três PDFs novos (inventário, prosa em duas colunas e inventário com OCR ambíguo).
- `check-borderless-table.mjs`: doze PDFs (nove estendidos + três novos), **29/29 evidências históricas**, associação histórica **9/9**, inventário **16/16**, variante negativa **15/16 e revisão obrigatória**. A limitação negativa é reportada explicitamente; não é contabilizada como reconhecimento perfeito.
- Benchmark original: fácil **7/8**, médio **7/9**, difícil **7/9** na métrica literal anterior. Comparação direta com os artefatos `extended/after-corrections/original/`: páginas, textos e células iguais nos três documentos. Os gaps literais anteriores não foram convertidos em alegações de sucesso semântico. Difícil mantém revisão e bloqueio de indexação.
- Prosa digitalizada de duas colunas: zero células promovidas, Markdown nulo. Testes adicionais cobrem prosa de três colunas com números, linha irregular, baixa confiança, preservação de negativo e escape de pipe.
- `npm run lint`: zero erros, seis warnings preexistentes (imports não usados no gerador estendido e verificador de runtime), sem alterações fora do escopo para escondê-los.
- `npx tsc --noEmit`, `npm run build`, `git diff --check`: aprovados. Build usa a configuração local já existente; `.env.local` não foi lido ou alterado manualmente.

Artefatos novos em `docs/evaluations/borderless-table-after/` preservam extrações completas, comparação antes/depois e benchmark original; os baselines anteriores não foram sobrescritos.

## Reprodução

```sh
node docs/fixtures/rag/borderless-extra/generate.mjs
node --test tests/pdf-borderless-table.test.mjs tests/pdf-evaluation-corpus.test.mjs
node docs/evaluations/check-borderless-table.mjs
node docs/fixtures/rag/benchmark.mjs docs/evaluations/borderless-table-after/original
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

## Correção numérica medida — 13/10/2026

Versão atual: `pdf-evidence-v4-numeric-crop`. A regressão estrita nova foi executada primeiro e falhou realmente: `'7' !== '-17'`. Não se limita mais a testar que o documento fica em revisão.

O raster original foi inspecionado: `-17` e `-3` estão visíveis, sem corte. A caixa de palavra reconhecida não representa os glifos perdidos. O helper novo `scripts/ocr-borderless-numeric.mjs` pesquisa tinta no intervalo delimitado pelos gutters de coluna e de linha, recorta o envelope completo, acrescenta margem branca de metade da altura da tinta, amplia 2× e usa OCR português local PSM 7. É limitado a células numéricas de dados com confiança original <60, o mesmo limiar de incerteza do associador. Não consulta gold, nomes de fixtures nem valores esperados.

Experimentos reais: crop amplo 230×70, escalas 1/2/3, PSM 6/7 não recuperou o sinal (`17`); PSM 13 produziu texto inválido. Crop estreito ampliado 2× com margem de 10–20 pixels reconheceu `- 17`; escala 4× voltou a perder glifos. Aumentar resolução indiscriminadamente não resolve. Um protótipo que relia todos os números degradou `2,5%` para `2,95%`; foi rejeitado pela regressão histórica. A implementação final não substitui números confiáveis. Executável Tesseract nativo não foi encontrado no PATH nem em `C:/Program Files/Tesseract-OCR/tesseract.exe`; portanto não há alegação de comparação com CLI nativa. Todas as medições finais usam o worker Tesseract.js português local real do aplicativo.

- Variante histórica negativa: **15/16 → 16/16**; Cobre/Saldo `7` → raw crop `- 17` → seleção `-17`, bbox de tinta `{x:341,y:288,width:41,height:22}`, margem 11, confiança 45. Palavras originais `7` e OCR bruto de página permanecem intactos em campos separados.
- Fixture independente reproduzível `tests/fixtures/generate-numeric-signs.mjs`: **21/21 células**, incluindo 12 valores numéricos exatos: `-3`, `-17`, `-125`, `-0,75`, `-12,5`, `-125,25`, e controles `3`, `17`, `125`, `0,75`, `12,5`, `125,25`. Também reproduz `-17` → `7` no OCR original. Sem sinais acrescentados aos controles positivos; imagem inspecionada, sem sobreposição/corte.
- Corpus: **29/29 evidências**, borderless histórico **9/9**, inventário positivo **16/16**, negativo **16/16**. Arquivos anteriores não sobrescritos; novas saídas em `numeric-sign-after/`.
- Benchmark original continua fácil **7/8**, médio **7/9**, difícil **7/9**; testes reais nativos, mistos, tabelas com bordas e orientações passam.
- Suite final: **69/69 testes**, zero falhas/TODO; `numeric-sign-tests.tap`. Lint: zero erros, seis warnings anteriores; TypeScript, build e diff check aprovados.

`numericOcr` conserva texto/confiança/bbox originais, raw crop, leitura selecionável, confiança, bbox no raster orientado, padding, escala, PSM e divergência. A bbox da seleção inclui o sinal recuperado; página e transformações de origem permanecem. Remover espaço de um sinal efetivamente reconhecido não inventa sinal. Divergência continua bloqueando Markdown e indexação, mesmo com leitura correta comparada ao gold. Uma leitura inválida não substitui o original.

Limitações: confiança baixa do novo `-17`, perdas em números de confiança alta, caracteres não numéricos reconhecidos no lugar do número, células ausentes e tabelas não associadas não são solucionados por esse retry. Não há correção universal nem aprovação sem revisão. `ocrPageText` permanece `7`, deliberadamente; o valor recuperado fica na evidência de célula, com divergência explícita. Os PDFs/golds históricos permanecem iguais.

Reprodução adicional:
```sh
node tests/fixtures/generate-numeric-signs.mjs
node --test tests/pdf-numeric-preservation.test.mjs
node docs/evaluations/check-numeric-signs.mjs
node docs/evaluations/check-borderless-table.mjs ./numeric-sign-after/corpus/
node docs/fixtures/rag/benchmark.mjs docs/evaluations/numeric-sign-after/original
```

## Limitações residuais e operação

Não há suporte geral a tabelas sem bordas com duas colunas, células multiline, cabeçalhos multinível, células vazias/mescladas, números em cabeçalhos, alinhamentos muito variáveis ou várias tabelas candidatas por página. Prosa tabulada com formato de dados ainda pode satisfazer heurísticas; a revisão obrigatória de página evita tratá-la como conteúdo automaticamente aprovado. Confiança alta do OCR não prova correção de cada caractere. Não há alegação de precisão empresarial universal.

Inspecionados, sem alteração/aplicação: `supabase/migrations/20261013000300_document_extraction_review.sql` e rota de processamento. A migration 003 permite claim de `failed`, `review_required` ou lease de `processing` expirada; **não permite reprocessar um registro `completed`**. A rota mantém o claim e persiste a versão devolvida pelo extrator. Resultados já persistidos não são atualizados por esta correção. Reprocessamento seguro dos documentos `completed` permanece pendente e exige decisão explícita; não foi contornado por updates manuais. Nenhuma migration, commit ou push foi realizado.
