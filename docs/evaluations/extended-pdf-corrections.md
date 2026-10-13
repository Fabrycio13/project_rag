# Correções da extração PDF — evidência local

## Resultado verificado

Os nove PDFs expandidos foram executados pelo wrapper real `src/lib/pdf-extraction.mjs`, sem upload remoto. O gold e o baseline anterior foram preservados. Comparação calculada dos JSONs:

| Métrica | Antes | Depois |
|---|---:|---:|
| Evidências literais por página | 24/29 | 29/29 |
| Falhas de documento | 1/9 | 0/9 |
| Ordem esquerda → direita validada no caso de colunas | falhava | passa |
| Associação do cabeçalho mesclado e célula multilinha | não reconstruída | passa no fixture com bordas |

Cinco documentos expandidos continuam `review_required`, com `indexingEligible=false`. Cobertura textual não certifica layout, tabela ou resposta de IA.

Os três PDFs originais também foram executados: fácil 7/8 → 7/8, médio 7/9 → 7/9, difícil 5/9 → 7/9 no benchmark existente. Esse benchmark normaliza somente Unicode e espaços; não modifica números ou negativas. As faltas C5/C5a/C5b continuam visíveis e não foram declaradas corrigidas. Outputs novos: `docs/fixtures/rag/extended/after-corrections/original/`; os outputs anteriores não foram sobrescritos.

## Causa → correção → limite

- **Página vazia intercalada:** rejeição por página interrompia um documento com evidência útil. A renderização sem tinta e sem texto nativo registra `method=empty`, `evidenceState=empty`, texto vazio e confiança nula, preservando número/geometria. Documento inteiramente vazio ainda falha com `no_useful_text`. Página não vazia ilegível exige revisão, não é rotulada vazia. Contagem total inclui vazias; contagem OCR usa somente `method=ocr`.
- **Rotação raster:** OCR sobre imagem na orientação errada perdia negativa e percentual. Projeções de tinta selecionam candidatos limitados de quarto/meia volta; a tentativa original permanece registrada. Tentativas preservam texto, confiança, palavras e coordenadas, com matrizes `sourceToOcr` e `viewportTransform`. Ambiguidade sinaliza revisão. Não é deskew arbitrário nem certificação de cobertura. Regressões incluem rotações físicas sem metadado PDF.
- **Colunas nativas:** ordem de pintura intercalava as duas colunas. Ordenação espacial e corte conservador por corredor vazio preservam strings, spans e `nativeRawText` separado. Regressão usa texto diferente e pintura invertida. Suporta o arranjo de duas colunas validado; layout arbitrário, mais colunas, notas e tabelas nativas continuam não certificados (`layout_unverified`).
- **Tabela com bordas mesclada/multilinha:** segmentação de linha única e separadores globais perdiam associação. Separadores por faixa de linha permitem `columnSpan`; OCR de bloco preserva as duas linhas da célula. Retém linha, coluna, spans, bbox, página, confiança e transformação da fonte. Inspeção visual de `merged-multiline.preview.png` confirma o cabeçalho “Benefícios — categoria única”, “Saúde” à esquerda e “Reembolso de R$ 123,45” / “Não inclui dependentes.” à direita.
- **Sem bordas e estruturas não certificadas:** suporte completo NÃO foi entregue. O contrato `ocrTableStructure` explicita revisão, motivo e `markdown=null`. Cabeçalhos mesclados não são achatados em Markdown pipe falsamente fiel. `rowSpan` arbitrário e múltiplas tabelas também não foram certificados. Um TODO com execução e assertion realmente falhando expõe a falta de células sem bordas; retenção de tokens não é sucesso semântico.

## Gates e reprodução

```bash
node docs/fixtures/rag/extended/evaluate-corrections.mjs
node docs/fixtures/rag/benchmark.mjs docs/fixtures/rag/extended/after-corrections/original
node --test --test-concurrency=1 tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

- Suíte final: **60 testes, 59 passes, 0 falhas não-TODO, 1 TODO realmente falhando** (tabela sem bordas). Log: `docs/fixtures/rag/extended/after-corrections/test-output.txt`.
- Lint: 0 erros, 6 warnings de imports não usados em scripts preexistentes; TypeScript, build e diff check passam. Warnings Node `MODULE_TYPELESS_PACKAGE_JSON` permanecem.
- O seam explícito de tabela teve RED real (campo ausente) antes da implementação e GREEN na suíte final.
- Evidência máquina expandida: `docs/fixtures/rag/extended/after-corrections/report.json` e nove arquivos `.raw.json` separados dos anteriores.

## Persistência e reprocessamento

Inspecionadas as migrations `20261013000200_document_extraction.sql` e `20261013000300_document_extraction_review.sql`: páginas ficam em JSONB, sem enum por método de página; portanto `empty` e metadados adicionais não exigem nova migration. A migration 003 existente adiciona estado de documento `review_required` e versão do extrator; ela precisa estar aplicada no deployment para persistir esses estados. Nenhuma migration aplicada foi editada ou executada nesta verificação. Banco real e persistência autenticada NÃO foram verificados.

Resultados já persistidos não mudam automaticamente. A função de claim existente permite repetir `failed`/`review_required`; `completed` não é elegível a reprocessamento pelo fluxo atual. Reprocessamento de concluídos exige uma ação autorizada futura, sem alteração destrutiva direta no banco.

Não houve instalação de dependência, chamada de IA paga, envio de segredo, commit, push ou mudança de arquitetura Edge/worker. O working tree sujo foi preservado. Esta entrega melhora extração local; não promete suporte completo a tabelas complexas nem segurança de geração contra instruções presentes no documento.
