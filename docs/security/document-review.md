# Authenticated document extraction review

- Date: 2026-10-15
- Branch inspected: `master` (dirty before this work; unrelated dashboard/auth/configuration work preserved).
- Mode: focused implementation and defensive code review, not a production penetration test.
- Status: local code/SQL/render verification; **deployment and production readback not verified**.
- Confidence: 90% for the tested local boundaries; no claim about deployed secrets, database state or cloud runtime capacity.

## Delivered journey

Agent → document metadata history → **Revisar páginas desta versão** → authenticated private comparison. The version selector identifies active versus candidate/historical runs. Page navigation retains the actual persisted page count, including empty pages. The original is rendered one page at a time with local PDF.js in a bounded Node subprocess; the UI receives PNG pixels, not an embedded PDF viewer with executable annotations or links. A separate authenticated endpoint streams the verified original as a PDF attachment.

The right pane displays immutable literal page text, warning reasons, OCR confidence/orientation and preserved cell/native provenance. Only an existing `validated_rectangular` table's Markdown is displayed, literally, without interpreting HTML. Otherwise the UI says **Estrutura requer revisão**. No headings, corrected text, canonical Markdown, chunks or other generated structure are invented.

Approval requires a checkbox attesting that all pages and flags were compared with the original, then an explicit confirmation. This is an attestation, not proof of attention or OCR correctness. The most recent terminal run (`completed` or `review_required`) may receive a human decision. Processing, failed, legacy-unfingerprinted and superseded candidates cannot. Approval records actor, run, original SHA-256, extractor hash, database-computed extraction-evidence hash, fixed attestation and timestamp. It atomically activates the chosen snapshot without changing the machine state or warnings. Human approval and machine completion remain separate labels. Rejection/editing is deliberately not implemented; leaving the candidate pending is read-only.

Future indexing eligibility in the review API requires a matching human decision **and** the active pointer. The extraction endpoint no longer reports machine completion alone as indexing eligibility. This does not add an indexing endpoint, embeddings, retrieval or provider egress. A later machine-completed run may replace the active snapshot under existing extraction semantics, but has no human approval/indexing eligibility until explicitly reviewed itself.

## Manual migration gate — not applied

Apply `supabase/migrations/20261015000700_document_review_decisions.sql` **only after the existing document migrations 001–006**, in order:

1. `20261013000100_agent_documents.sql`
2. `20261013000200_document_extraction.sql`
3. `20261013000300_document_extraction_review.sql`
4. `20261013000400_document_reprocessing.sql`
5. `20261013000500_extraction_server_authority.sql` — mandatory; privileged extraction authority must already be installed.
6. `20261015000600_document_upload_finalization.sql` — existing upload-finalization prerequisite, not edited here.
7. `20261015000700_document_review_decisions.sql` — new, user-applied only.

Earlier platform-user, organization and agent migrations remain prerequisites. No previous migration was edited. 007 computes integrity hashes for stored evidence but **does not approve or promote any existing document**. It narrows browser SELECT to metadata columns on both run history and active snapshots; raw `pages` stays server-only. Decision rows are service-RPC-only and append-only, with an update/delete rejection trigger and restrictive references. The human decision marker exposed in metadata is a database-produced decision ID, not an authoritative browser boolean.

Deploy code and migration together. Before 007, the list's existing fallback keeps private upload/list available but extraction/review metadata can be unavailable. Unfingerprinted legacy runs require an explicit new extraction; hashes are not invented for unknown original/extractor identities.

## Boundaries and security controls

| Boundary / threat | Enforcement and evidence |
|---|---|
| Forged identity / BOLA (CWE-639) | Clerk access check, active owner/admin access, owned non-archived organization, scoped agent and document, then JWT-scoped exact run lookup before constructing the privileged evidence client. Privileged evidence/decision reads retain exact document/run filters. SQL RPC independently checks actor, creator organization, agent and document relationships. |
| Browser fabrication / mass assignment | No browser claim/finish/approval RPC grants. POST accepts only fixed attestation and three hashes; actor comes from server access context. No pages, storage path, role or permission flag accepted. |
| Stale approval / races (CWE-362) | Approval locks the same document as claim/finish, checks latest run version, terminal state, source/extractor/evidence hashes and absence of a decision. Decision, marker and active snapshot update are one SQL statement transaction. Synthetic snapshot failure proves rollback of the inserted decision. True multi-connection PostgreSQL concurrency was not exercised. |
| Original mismatch / traversal | Storage key derived from validated organization/agent/document IDs; stored path must match; source byte length and SHA-256 must equal the selected run. No arbitrary path, signed URL or public URL. |
| XSS / malicious PDF content (CWE-79) | React literal text/JSON/Markdown, no HTML renderer; PDF.js eval disabled; raster preview disables annotations and never invokes PDF JS/actions/link UI. Source is an attachment, not an iframe. Downloading and opening the PDF in an external reader remains the user's separate action. |
| CSRF (CWE-352) | Existing same-origin validator used before approval. JWT/RLS checks remain independent. |
| Confidentiality / diagnostics | JSON, image and source responses use `no-store`, `nosniff` and cookie/authorization Vary. PDF uses fixed safe disposition and sandbox CSP. User-facing errors do not return provider exceptions, raw query errors or credentials. |
| Resource exhaustion (CWE-400 / CWE-770) | PDF cap 10 MiB; page count 30; bounded page/dimensions/pixels; 384 MiB V8 child limit, 20-second child timeout, 8 MiB PNG/output cap; one render per application process at a time; POST body capped at 1024 bytes including chunked bodies. This is not a distributed rate limiter, durable queue, or native-memory sandbox. |
| Repudiation / tampering | Immutable decision actor, run/hash bindings, fixed all-pages-and-flags attestation and timestamp. Machine warnings are retained, not erased by human approval. Reprocessing a human-active review snapshot requires explicit reprocess intent. |

No additional confirmed high/critical exploit was found in the scoped local implementation. This is not an ASVS certification, a dependency-CVE assessment, or a guarantee of absolute security. Dependency versions were reused; no package was installed in the project.

## Verification

Tests were written/run RED before their corresponding production slices: missing decision/hash/renderer/API/UI, stale human-active reprocess handling, human approval history labeling and deployment tracing. GREEN verification includes:

- `tests/document-review-db.test.mjs`: disposable **real PGlite SQL execution** of document migrations 001–007, authenticated/service roles, wrong actor, wrong document, cross-tenant history denial, raw-page SELECT denial, hash mismatch, replaced candidate, blocked actor, immutable decision, separate machine state, explicit reprocess, failed attempt preservation and transactional rollback on snapshot write failure.
- `tests/document-review-api.test.mjs`: route execution with mocked Clerk/Supabase boundaries; scope checks precede service reads, source SHA-256 mismatch rejection, authenticated PDF stream headers/bytes, actual private-source PNG rendering through the real subprocess, page bounds, cross-origin/attestation/stale evidence rejection, write failure, decision/pointer readback failure. The real PNG test uses the authored synthetic corpus, not production content.
- `tests/document-review-render.test.mjs`: actual PDF raster output and page bounds; runtime tracing closure.
- `tests/document-review-ui.test.mjs` and extended reprocessing UI tests: actual JSX/SSR, escaped malicious text, blank-page navigation, warning/provenance display, active-version selector labels, no artificial Markdown, disabled approval without attestation/image and Clerk sign-out control wiring. Clearing a live Clerk session was **not** exercised.
- Lint: passes with seven pre-existing unrelated warnings (fixture generator, runtime-check script, portable-memory runtime).
- TypeScript: `npx tsc --noEmit` passes.
- Production build: `npm run build` passes and includes the new review page/API routes and local renderer runtime tracing. The built review `route.js.nft.json` was read back: it includes `scripts/pdf-review-render.mjs`, PDF.js legacy module and native canvas assets.

Final full-suite run: **105 normal-runtime tests passed, plus 4 dashboard server-condition tests passed; zero failures, skips or TODOs**. `git diff --check` passed (Git reported only existing Windows LF/CRLF notices).

The full suite requires two runtime modes: run all normal `tests/*.test.mjs` **except** `dashboard-data.test.mjs` normally, then run `node --conditions=react-server --test tests/dashboard-data.test.mjs`. The default one-command wildcard run hits the pre-existing dashboard `server-only` loader guard; using its required server condition passes. Do not globally enable React server conditions for JSX SSR tests.

PGlite was loaded from the existing scratch installation via `PGLITE_MODULE`; no remote DB, project env file or production identity was used. No SQL test was skipped.

### Visual smoke boundary

The browser helper could not copy the user's Chrome profile because it was locked. The real browser was **not closed**. An isolated headless Chrome profile instead rendered the actual review component's SSR with the existing synthetic `medio.pdf` and its saved extractor output. This verifies desktop two-column and 390px mobile stacked rendering, not authenticated live hydration or persistence. CDP mobile measurements: `innerWidth=390`, `scrollWidth=390`, `clientWidth=390`, original image loaded (`naturalWidth=893`). The initial CLI-only mobile screenshot was cropped by Chrome's minimum window size; CDP emulation corrected the measurement.

Scratch-only visual artifacts:

- `C:/Users/Usabit/AppData/Local/hermes/cache/scratch/review-smoke/review.html`
- `C:/Users/Usabit/AppData/Local/hermes/cache/scratch/review-smoke/review.png`
- `C:/Users/Usabit/AppData/Local/hermes/cache/scratch/review-smoke/review-mobile-cdp.png`

## Remaining deployment checks / limits

- User must apply 007 after 001–006 and confirm PostgREST schema reload/grants on the actual Supabase project. Production readback of `dificil.pdf` remains unverified and its stored run was not approved or modified.
- Confirm an authorized owner can open the original and every real page, switch versions, sign out, and explicitly approve a chosen candidate after actual review. Confirm the decision/hash/active pointer in production only after that deliberate approval.
- Node subprocess/native canvas portability and host memory/timeout constraints must be verified on the deployment host; build tracing does not prove platform execution capacity.
- Rendering is request-bound and reparses the bounded PDF per image; no persistent sensitive raster cache or durable worker was introduced. Distributed abuse controls and worker orchestration remain deferred.
- No remote migrations, uploads, production approvals, provider/embedding calls, commits or pushes were performed. Secret env/key files were not opened or printed. Existing unrelated working-tree changes remain untouched.
