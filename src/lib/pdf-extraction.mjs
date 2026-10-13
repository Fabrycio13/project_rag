import { execFile } from 'node:child_process';
import path from 'node:path';
let active=false;
// Documents stay on stdin/stdout of a bounded local subprocess, never disk or network.
export function extractPdf(bytes, {timeout=120000}={}) {
 if(bytes.length>10485760 || bytes.length<8) return Promise.reject(new Error('invalid_pdf'));
 if(active) return Promise.reject(new Error('processing_busy'));
 active=true;
 return new Promise((resolve,reject)=>{
  const child=execFile(process.execPath,['--max-old-space-size=384',path.join(process.cwd(),'scripts/pdf-extract.mjs')],{timeout,maxBuffer:4*1024*1024,windowsHide:true},(error,stdout)=>{
   active=false;
   if(error) return reject(new Error(error.killed?'processing_timeout':'processing_failed'));
   try {const result=JSON.parse(stdout);if(result.error)reject(new Error(result.error));else resolve(result);}catch{reject(new Error('processing_failed'));}
  });
  child.stdin.on('error',()=>{});child.stdin.end(bytes);
 });
}
