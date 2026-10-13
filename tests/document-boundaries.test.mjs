import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('documents enforce private scoped authorization at API and database boundaries',()=>{
 const route=read('src/app/api/organizations/[id]/agents/[agentId]/documents/route.ts');
 assert.ok(route.indexOf('findOrganization(')<route.indexOf('request.body.getReader'));
 assert.ok(route.indexOf('findAgent(')<route.indexOf('request.body.getReader'));
 for(const fragment of ['isSameOriginRequest','randomUUID()','upsert:false',"eq('organization_id',id)","eq('agent_id',agentId)",'reader.cancel()'])assert.ok(route.includes(fragment),fragment);
 const sql=read('supabase/migrations/20261013000100_agent_documents.sql');
 for(const fragment of ["false, 10485760",'enable row level security',"p.role in ('owner','admin')","p.status='active'",'o.archived_at is null',"o.owner_clerk_user_id=(select auth.jwt()->>'sub')",'a.organization_id=o.id','generated always as','security invoker',"d.upload_state='pending'",'Stored object missing or metadata mismatch'])assert.ok(sql.includes(fragment),fragment);
 assert.ok(!/service_role|security definer|auth\.uid\(/i.test(sql.replace(/--[^\n]*/g,'')));
 assert.ok(!/getPublicUrl|createSignedUrl|service_role/.test(route));
});
test('document UI has explicit PDF input, upload guard and honest storage states',()=>{
 const ui=read('src/app/organizations/[id]/agents/[agentId]/document-manager.tsx');
 for(const fragment of ['accept=".pdf,application/pdf"','busy.current','Armazenado','Envio pendente','Envio não concluído','Carregando documentos','role="alert"'])assert.ok(ui.includes(fragment),fragment);
 assert.ok(!/processado|embedding/i.test(ui));
});
