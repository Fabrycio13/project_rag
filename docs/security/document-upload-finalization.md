# PDF upload finalization repair — 2026-10-15

## Confirmed defect

The upload route reserves `agent_documents`, uploads a private object, then updates `upload_state` from `pending` to `stored`. Migration 001 checks the object's existence, size and MIME in `check_document_storage_state()`, a **BEFORE UPDATE** trigger.

That trigger compares `storage.objects.name` to `NEW.storage_path`. `storage_path` is a stored generated column and is NULL at this point in the update lifecycle. Consequently, even an existing, correctly scoped object with matching numeric size and `application/pdf` fails with PostgreSQL **P0001: Stored object missing or metadata mismatch**. The coordinator then removes the object and marks the reservation failed. This matches the reported pre-OCR symptom; it is not an OCR failure.

The disposable PostgreSQL regression installs the actual migrations **001–005**, uses the `authenticated` role and a synthetic Clerk subject, reserves a PDF, inserts the matching Storage row under RLS, and performs the route's terminal update. An observation-only BEFORE trigger explicitly verifies that `NEW.storage_path` is NULL. With 006 disabled (`UPLOAD_DB_RED=1`), the matching-object finalization fails with P0001. With 006, it succeeds. No service-role bypass is used for upload operations.

## Changes

- New migration `supabase/migrations/20261015000600_document_upload_finalization.sql` derives the prospective path from `NEW.organization_id`, `NEW.agent_id` and `NEW.id` instead of reading the not-yet-generated column. It retains invoker security, empty search path, exact size/MIME checks, transition checks, existing RLS and grants. It does not rewrite existing rows or edit applied migrations.
- The documents API now observes failures at reserve/upload/finalize/remove/fail. Structured server logs contain only the stage, an allowlisted provider code or SQLSTATE, and HTTP status when supplied by the provider. No raw messages/details/hints, tokens, filenames, IDs or bodies are logged. Public PT-BR responses and compensation behavior remain unchanged; HTTP 201 still requires stored-state readback.
- Added SQL, API and diagnostic regressions. SQL tests cover numeric and string metadata size, missing object, incorrect size/MIME, zero-byte rejection, failed compensation state, immutable metadata, cross-tenant denial and the actual generated-column lifecycle. API tests use realistic PostgREST/Storage error shapes and assert cleanup order and response privacy.

## Verification actually run

Runtime: disposable PGlite installed under Hermes scratch, not project dependencies. No `.env.local` contents were opened. The normal Next build loads its configured environment internally.

```bash
PGLITE_MODULE='C:/Users/Usabit/AppData/Local/hermes/cache/scratch/upload-db/node_modules/@electric-sql/pglite/dist/index.js' node --test tests/document-upload-api.test.mjs tests/document-upload-db.test.mjs tests/document-upload-diagnostics.test.mjs tests/document-upload.test.mjs tests/documents.test.mjs tests/document-boundaries.test.mjs
```

- Focused suite: **8 passed, 0 failed, 0 skipped**.
- Red control with `UPLOAD_DB_RED=1`: fails at the original finalization trigger with **P0001**, as expected.
- Full `tests/*.test.mjs` suite executed after final code changes: fails only at pre-existing, untracked `tests/dashboard-data.test.mjs`, which imports a `server-only` module under ordinary Node conditions. Earlier full run printed that exact import error; no unrelated dashboard code was changed.
- `npm.cmd run lint`: passes, with 7 existing warnings outside the changed files.
- TypeScript `tsc --noEmit`, production `npm.cmd run build`, and `git diff --check`: pass. Existing CRLF and Node module-type warnings remain.

## Size display

The UI formats `size_bytes / 1048576` with at most two fractional digits. The regression verifies that a **1,234-byte** document is displayed as **0 MiB** by that exact expression, while the database rejects an actual zero-byte reservation. The screenshot does not establish that the original PDF has zero bytes; its actual byte size was not retrieved.

## Deployment prerequisite and remaining integration limit

Migrations through 005 are user-confirmed applied. **006 must be reviewed and applied separately to the same target Supabase database** before the live upload can benefit. No remote SQL, migrations, provider calls, data writes, upload, commit or push were performed in this task. Existing failed reservations are not relabeled as stored; compensation may already have removed their objects. Do not fabricate successful state or manually mark them stored.

A server was listening on local port 3000. Safe local dev-log inspection found no captured upload POST/finalize error details. Read-only access using the user's local browser was blocked because Chrome's real profile was locked; the browser was not closed or its session altered. Therefore the original Fab / Teste01 / medio.pdf transaction has **not** been verified live, and no claim is made that P0001 was retrieved from that specific request. The class-level defect is independently reproduced with real PostgreSQL execution and directly explains a valid upload failing before OCR. After authorized application of 006, retry the existing workflow with the user's authenticated session and verify the returned 201 and persisted stored state; if it still fails, collect only the new `[document-upload]` structured event.

Pre-existing dashboard work, pilot evaluation documents, AGENTS.md and memory files were preserved.
