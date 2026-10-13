# Private agent PDFs — implementation and security review

Date: 2026-10-13. Branch: master; starting commit 6734c52 (clean).

## Contract
- Upload/list only on agent detail. PDF extension, exact application/pdf MIME, leading PDF 1.0–1.7/2.0 signature, safe filename up to 180 characters, 10 MiB cap. This is a format gate, not a full PDF parser or malware scanner.
- Multipart body is bounded to 10 MiB + 64 KiB, including chunked requests. Hosting providers may impose a lower request limit; deployment transport was not tested.
- Existing Clerk session/accessToken Supabase client, active owner/admin, creator-owned nonarchived organization and matching agent. Server checks precede reading the body; SQL and Storage repeat tenant authorization. No service-role client, public/signed URLs, extraction, embeddings, provider calls, chat, or processing status.
- Path is generated from organization/agent/document UUIDs; filename is metadata, never a path.

## Manual migration
Apply `supabase/migrations/20261013000100_agent_documents.sql` after `20261008000300_organization_agents.sql`. This creates private bucket `agent-documents`, `agent_documents`, scoped policies and state validation. Not applied remotely by this task.

## Partial failure / recovery
A pending metadata row is inserted before Storage upload. Storage upload has upsert disabled. Finalization requires an existing matching Storage object's size and MIME at the database boundary, and reads back the updated row. Only then does API return success. Upload/finalization failure attempts object removal, then marks the row failed; the row and generated storage_path are never deleted. If cleanup or status persistence fails, pending/failed rows retain the exact recovery key. Interrupted requests may remain pending; no automated reconciliation is included. An administrator should inspect the corresponding object and record before manual cleanup, using authorized operational tooling. Failed rows can retain a private object when cleanup is unavailable; UI deliberately says incomplete, not removed. Revocation/archival can block compensation; retained metadata is the recovery ledger. A lost finalize response may have committed stored; API still returns failure conservatively and refreshed list shows persisted state.

## Verification
28 node tests passed (24 existing + 4 new). Validator and coordinator missing-feature failures were observed before implementation. Boundary/UI checks are static assertions, not executed RLS or browser tests. ESLint passed; `npx tsc --noEmit` passed; production Next build passed; `git diff --check` passed. Existing Node module-type warnings remain. No authenticated E2E, remote upload, SQL execution, policy role tests, or real user data creation was performed. Next build reads its configured local environment internally; no credentials or .env.local were opened by tools.

## Residual boundaries
Direct authorized Storage clients are MIME/size/path constrained but Storage RLS cannot inspect PDF magic bytes. No antivirus scanning; no aggregate quota/rate limit. List follows the configured PostgREST row cap; no pagination in this minimal slice. Creator-only access retained: platform owner is not a global tenant bypass. SELECT on objects supports compensation and permits authorized object reads at the API layer; no download UI added. Trigger checks rely on Storage metadata `size`/`mimetype`; must be verified against deployed Storage with a real authorized upload after migration.

## Primary references checked
- Supabase Storage Access Control: storage.objects RLS, INSERT upload policy; removal needs SELECT/DELETE (verify deployed policies).
- Supabase Clerk integration: accessToken callback/session JWT and auth.jwt()->>'sub' for Storage/database RLS; current session integration preserved, no legacy JWT template introduced.
- Local Next 16.3.8 route handler documentation: promise params and standard Request/Response APIs.

Documentation extraction backend failed; official Supabase search results were retrieved using the tool's fallback backend. No deployment configuration was changed.
