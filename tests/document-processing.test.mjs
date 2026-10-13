import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('review-required pages survive persistence and are exposed without source text',()=>{
 const route=read('src/app/api/organizations/[id]/agents/[agentId]/documents/[documentId]/process/route.ts');
 assert.ok(route.includes("result.reviewRequired?'review_required':'completed'"));
 assert.ok(route.includes('extractor_version:result.extractorVersion'));
 assert.ok(route.includes('reviewRequired:result.reviewRequired'));
 assert.ok(route.includes('indexingEligible:result.indexingEligible'));
 const listing=read('src/app/api/organizations/[id]/agents/[agentId]/documents/route.ts');
 assert.ok(listing.includes('extractor_version'));
 const ui=read('src/app/organizations/[id]/agents/[agentId]/document-manager.tsx');
 assert.ok(ui.includes("state==='review_required'"));
 assert.ok(ui.includes('Revisão necessária'));
 const sql=read('supabase/migrations/20261013000300_document_extraction_review.sql');
 assert.ok(sql.includes("state in ('completed','review_required')"));
 assert.ok(sql.includes("state='review_required'"));
 assert.ok(!/security definer|service_role/.test(sql));
});
test('explicit extraction action is authenticated and never returns raw text',()=>{
 const route=read('src/app/api/organizations/[id]/agents/[agentId]/documents/[documentId]/process/route.ts');
 for(const fragment of ['isSameOriginRequest','getOrganizationAccess','findOrganization','findAgent',"eq('organization_id',id)","eq('agent_id',agentId)",'claim_document_extraction','extractPdf'])assert.ok(route.includes(fragment),fragment);
 assert.ok(route.indexOf('findAgent(')<route.indexOf('.download('));
 assert.ok(!/Response.json\(result\)|service_role|createSignedUrl|getPublicUrl/.test(route));
});
test('processing persistence stays RLS scoped with reclaim and fencing',()=>{
 const sql=read('supabase/migrations/20261013000200_document_extraction.sql');
 for(const fragment of ['enable row level security','security invoker','can_access_agent_documents','on conflict(document_id)',"interval '3 minutes'","state='failed'",'lease_until<now()','revoke all'])assert.ok(sql.includes(fragment),fragment);
 assert.ok(!/security definer|service_role/.test(sql));
 const route=read('src/app/api/organizations/[id]/agents/[agentId]/documents/[documentId]/process/route.ts');
 assert.ok(route.includes("privileged.rpc('finish_document_extraction'"));
 assert.ok(route.includes('doc:documentId,run,token'));
 const listing=read('src/app/api/organizations/[id]/agents/[agentId]/documents/route.ts');
 assert.ok(listing.includes('processingAvailable:false'));
 assert.ok(!/extraction:agent_document_extractions\([^)]*pages/.test(listing));
});
