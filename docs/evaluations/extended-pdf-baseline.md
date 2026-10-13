# Expanded PDF/OCR baseline

## Verified regression gate

`node --test --test-concurrency=1 tests/*.test.mjs`: 52 tests, 49 passed, 0 non-TODO failures, 3 TODO tests with actual failing assertions (rotated evidence, blank-interspersed whole-document failure, multi-column order). TODO failures are known unsupported requirements, NOT successful extraction. Full output: `docs/fixtures/rag/extended/test-output.txt`. Existing Node MODULE_TYPELESS_PACKAGE_JSON warnings remain; no package metadata changes. The new test file contributes 8 focused tests (5 pass, 3 known-gap TODO). A visual check caught and corrected an overlapping synthetic table cell before final measurement; final preview has a spanning header and two non-overlapping lines inside the right cell. No build required: production files untouched.

Evaluation and regression, NOT training model weights. Local synthetic fixtures only.

Fixtures: 9. Status counts: {"evidence_pass":3,"review_required":4,"evidence_gap":1,"failure":1}.

| Fixture | Measured outcome | Time ms | Missing evidence / review |
|---|---|---:|---|
| pt-br.pdf | evidence_pass | 574 |   |
| same-page.pdf | evidence_pass | 2438 |   |
| borderless.pdf | review_required | 2280 |  Borderless row/column association not reconstructed; text presence alone is insufficient. |
| merged-multiline.pdf | review_required | 2039 |  Merged header and multiline cell semantics unsupported; PSM 7 assumes single-line cells. |
| skew-rotated.pdf | evidence_gap | 2159 | não automática; 3,75% Rotation/layout requires review; no explicit orientation detection. |
| low-contrast-skew.pdf | review_required | 2221 |  9-degree skew unsupported; low contrast tested separately on page 2. |
| columns-blank.pdf | review_required | 478 |  PDF paint order interleaves columns; content presence does not verify reading order. |
| blank-interspersed.pdf | failure | 1388 | no_useful_text Blank page 2 currently rejects whole document; injection resistance of downstream generation is not tested. |
| injection.pdf | evidence_pass | 614 |   |

Evidence matching is exact and case/accent sensitive; OCR variations are exposed, never silently normalized away. Tables require verified associations, not just token coverage. Multi-column sequence is unverified even when all tokens survive. Blank-page rejection is a document-level failure, not success. Extraction of injection text proves retention only, NOT downstream LLM injection resistance.

Reproduce: `node docs/fixtures/rag/extended/generate.mjs`; `node docs/fixtures/rag/extended/evaluate.mjs`; `node --test --test-concurrency=1 tests/*.test.mjs`. Gold is authored before extraction with page provenance, answers and evidence. Raw output and machine baseline live beside fixtures. No application code changed; gaps require separately authorized fixes. Edge/worker architecture deferred per user.
