# FICTICIO TESTE — corpus local de extracao

Autorizado pelo usuario: somente documentos inteiramente inventados. UNIDADE-A, UNIDADE-B, CENARIO-ZETA, datas, valores e regras nao descrevem pessoas ou empresas reais. Nao ha emails, dados pessoais, aconselhamento juridico ou fontes normativas externas. A frase adversarial T1 e dado de teste inerte, nunca instrucao operacional.

## Arquivos

| PDF | Paginas | Bytes | Cobertura |
|---|---:|---:|---|
| facil.pdf | 1 | 2732 | Texto nativo, uma coluna, clausulas, lista e tabela completa |
| medio.pdf | 3 | 4069 | Texto nativo, cabecalhos/rodapes, lista numerada, tabela e nota de excecao continuadas entre paginas |
| dificil.pdf | 4 | 118408 | Duas colunas p1; tabela nativa p2; continuacao e retencao escaneadas p3; texto nativo + corpo rasterizado p4 |

Todos repetem o MESMO conteudo contratual/politica, C1-C7 e T1, com marcas FICTICIO TESTE em cabecalho, rodape e titulos. Limites atuais de 10 MiB/30 paginas atendidos. Rasterizacao e limpa, 144 dpi, sem ruido artificial. Texto sem acentos e intencional: este pequeno corpus nao testa cobertura linguistica completa.

- `canonical.md`: ground truth autoral gerado diretamente de E no gerador, **nao** Markdown extraido.
- `gold.json`: dez perguntas comparaveis (inclui abstencao), respostas esperadas, fontes 1-based por PDF/pagina/ID, elementos em ordem autoral e celulas criticas. `quote` reproduz o texto autoral; pipes representam separadores de celulas, nao glifos presentes no PDF. Nenhum bbox e inventado (null). C5a/C5b sao a mesma tabela C5 segmentada.
- `manifest.json`: SHA-256, bytes, numero de paginas, classificacao por pagina, caracteres nativos/imagens e metadados efetivamente inspecionados com PyMuPDF.
- `*.raw.json`: saida real do extrator atual, nao corrigida.
- `baseline-results.json`: metodos, caracteres, tempos e comparacao literal normalizada com gold.
- `preview/*.png`: todas as oito paginas renderizadas e `contact-sheet.png` para inspecao visual. Inspecionadas: sem cortes/sobreposicoes visiveis; colunas, listas, tabelas e rodapes legiveis nos PNGs individuais.

## Reproduzir, somente local

Na raiz do repositorio:

```sh
uv run docs/fixtures/rag/generate.py
node docs/fixtures/rag/benchmark.mjs
node --test tests/pdf-extraction.test.mjs
git diff --check
```

Gerador usa dependencias temporarias uv fixadas no PEP 723 (ReportLab, PyMuPDF, Pillow), nao altera package.json/lock nem dependencias de producao. Preparacao inicial pode baixar pacotes; PDFs nao sao enviados a rede. Benchmark exige node_modules ja instalado com dependencias existentes. Usa o wrapper real `src/lib/pdf-extraction.mjs` e seu timeout/heap/limites. Sobrescreve somente artefatos deste diretorio. Metadados de criacao sao datas ficticias fixadas, nao datas de execucao. Execucao serial evita o limitador `active` atual.

## Resultado observado nesta maquina

Node v26.7.0, Windows; tempos de uma execucao, nao percentis:

| PDF | Status tecnico | Tempo ms | Metodos | Elementos com texto literal normalizado |
|---|---|---:|---|---|
| facil | completed | 936 | text | 7/8 |
| medio | completed | 639 | text,text,text | 7/9 |
| dificil | completed | 3812 | text,text,ocr,text | 5/9 |

**Completed nao significa correto.** Tabelas nao correspondem literalmente porque PDF.js/OCR achata celulas e nao produz pipes/estrutura. Portanto essas contagens NAO medem precisao semantica nem provam perda de todas as celulas. No dificil p3, C6 foi preservada literalmente pelo OCR; tabela precisa revisao. No dificil p4, o extrator devolveu somente 84 caracteres de cabecalho/rodape: corpo rasterizado C7 e T1 foi ignorado porque texto nativo suficiente impediu OCR. E uma falha real de cobertura, apesar do status completed; nao e evidencia de resistencia a injection. Comparar raw com PDF/gold antes de indexar.

Gates executados: geracao com assertions de margens inferiores, bytes/paginas; metadados/classes computados; oito paginas renderizadas e inspecionadas; extrator real nos tres PDFs; testes existentes PDF 9 pass / 0 fail / 0 skip (OCR real); `git diff --check` exit 0 (avisos CRLF preexistentes). Sem build/tsc: somente docs e gerador, nao codigo da aplicacao. Sem uploads, banco, migrations, secrets, embeddings, commits ou push. Implementacao suja preexistente preservada; apenas uma decisao do plano ativo foi atualizada para registrar autorizacao sintetica.

## Limites e proximos benchmarks (nao executados)

Sem Docling, modelo de resposta, retrieval/reranking ou avaliacao end-to-end; sem pico RSS ou garantia de seguranca semantica. Nao ha holdout nem representatividade comprovada de documentos empresariais reais. Este corpus nao inclui paginas brancas, senha, baixa resolucao, celulas mescladas ou hifenizacao; testes atuais separados cobrem branco/senha/limites. Inspecao visual e humana, nao detector automatico de colisao. A cobertura de tabela deve ser avaliada por celulas e relacoes, nao apenas substrings. Fontes gold representam anotacao autoral, nunca output sintetizado de um extrator.
