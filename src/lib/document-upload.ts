type Operations = Record<'reserve' | 'upload' | 'finalize' | 'remove' | 'fail', () => Promise<boolean>>;
// A pending row is the durable recovery ledger even if the process dies mid-upload.
export async function coordinateUpload(ops: Operations): Promise<boolean> {
 const attempt = async (fn: () => Promise<boolean>) => { try { return await fn(); } catch { return false; } };
 if (!await attempt(ops.reserve)) return false;
 if (await attempt(ops.upload) && await attempt(ops.finalize)) return true;
 // Even an ambiguous network upload failure may have stored the object.
 await attempt(ops.remove);
 await attempt(ops.fail);
 return false;
}
