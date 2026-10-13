import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration='supabase/migrations/20261013000400_document_reprocessing.sql';
test('deployment includes exact local extraction hash closure',()=>{
 const config=read('next.config.ts');
 for(const name of ['ocr-borderless-table','ocr-borderless-numeric','package-lock.json','src/lib/pdf-extraction.mjs'])assert.ok(config.includes(name),name);
});
test('reprocessing has transactional history, exclusive claim and lease fencing',()=>{
 assert.ok(existsSync(new URL('../'+migration,import.meta.url)),'new versioned migration is required');
 const sql=read(migration);
 for(const s of ['for update','active_run_id','agent_document_extraction_runs','lease_until > clock_timestamp()','reprocess','revoke insert,update','can_access_agent_documents','security definer','pending review keeps the previous active result'])assert.ok(sql.includes(s),s);
});
test('explicit confirmed reprocessing uses authenticated existing PDF and metadata history only',()=>{
 const route=read('src/app/api/organizations/[id]/agents/[agentId]/documents/[documentId]/process/route.ts');
 for(const s of ['action','reprocess','finish_document_extraction','source_hash','extractor_hash','request.body?.getReader()','await reader.cancel()'])assert.ok(route.includes(s),s);
 const ui=read('src/app/organizations/[id]/agents/[agentId]/document-manager.tsx');
 for(const s of ['Reprocessar documento','window.confirm','Versão ativa','Histórico de versões'])assert.ok(ui.includes(s),s);
});
