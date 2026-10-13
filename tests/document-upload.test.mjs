import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
test('coordinator never reports partial failure as success', async () => {
 const target = new URL('../src/lib/document-upload.ts', import.meta.url);
 assert.ok(existsSync(target), 'upload coordinator missing');
 const { coordinateUpload } = await import(target);
 const calls = [];
 const ops = { reserve:async()=>true, upload:async()=>true, finalize:async()=>false, remove:async()=>{calls.push('remove');return false;}, fail:async()=>{calls.push('fail');return true;} };
 assert.equal(await coordinateUpload(ops),false);
 assert.deepEqual(calls,['remove','fail']);
 assert.equal(await coordinateUpload({...ops,finalize:async()=>true}),true);
 assert.equal(await coordinateUpload({...ops,reserve:async()=>false}),false);
});
