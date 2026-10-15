# Structured Markdown pilot

Status: **literal_evidence_pass_structure_review_required**. Not production-ready.

- PDF: medio.pdf; 3 pages; extractor pdf-evidence-v4-numeric-crop.
- 51 nonempty native spans preserved exactly once across 28 blocks.
- Exact authored page-gold: 9/9; exact table row tuples 2/2.
- Critical literal checks: 7/7.
- Raw extractor stdout is untouched. Markdown built before gold access, from actual native spans only. Canonical is not copied.
- Safe transformation: geometric reading order, space-joining native lines, Markdown syntax, source comments. No accent/case/number normalization or gold-driven repairs.
- Auto-supported: literal source coverage, exact page/indices/boxes, same-baseline aligned local rows.
- Heuristic/review: margin furniture, font-size headings, header roles, cross-page continuation, note applicability. No merged table fabricated.

## Reproduce

From repository root: `node docs/evaluations/structured-markdown-pilot/generate.mjs`. Uses installed Node dependencies only, no provider calls.

## Gaps

- No OCR evaluated in this bounded native-text pilot.
- Only one synthetic PDF: no generalization claim.
- Heading hierarchy inferred from font size; not semantically certified.
- Aligned rows support local cell associations, not cross-page table semantics.
- Cross-page join intentionally withheld; note scope requires human review.
- No retrieval/answering, injection resistance, persistence, chunking or indexing certification.
- Canonical used only for evaluation; page-specific gold includes continuation marker absent from canonical.

## Scope

Local validation/demo only. No application source, auth, migrations, ingestion or production state modified. Browser test status is recorded separately in VISUAL-VERIFICATION.md.
