type UploadStage = 'reserve' | 'upload' | 'finalize' | 'remove' | 'fail';
type StepResult = { success: boolean; error?: unknown };
// Server route only. Never log messages/details/hints, payloads, IDs, paths or JWTs.
export async function observeUploadStep(stage: UploadStage, operation: () => Promise<StepResult>): Promise<boolean> {
 let error: unknown;
 try {
  const result = await operation();
  if (result.success) return true;
  error = result.error;
 } catch (caught) { error = caught; }
 const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {};
 const codes = [fields.code, fields.error];
 const storageCodes = new Set(['DatabaseError', 'AccessDenied', 'InvalidRequest', 'InvalidJWT', 'EntityTooLarge', 'KeyAlreadyExists', 'NoSuchBucket', 'NoSuchKey', 'InvalidMimeType', 'InternalError']);
 const providerCode = codes.find((code): code is string => typeof code === 'string' && (/^[0-9A-Z]{5}$/.test(code) || storageCodes.has(code))) ?? null;
 const rawStatus = fields.status ?? fields.statusCode;
 const httpStatus = typeof rawStatus === 'number' && Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : typeof rawStatus === 'string' && /^[1-5][0-9]{2}$/.test(rawStatus) ? Number(rawStatus) : null;
 console.error('[document-upload]', { stage, providerCode, httpStatus });
 return false;
}
