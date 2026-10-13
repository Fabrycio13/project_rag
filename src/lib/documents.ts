export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_BUCKET = 'agent-documents';
export const DOCUMENT_ERROR = 'Não foi possível concluir o envio. Atualize a lista para conferir o estado e tente novamente.';
export async function validatePdf(file: File): Promise<{ name: string; size: number } | null> {
 const name = file.name;
 if (!name || name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(name) || !/\.pdf$/i.test(name) || file.type !== 'application/pdf' || file.size < 8 || file.size > DOCUMENT_MAX_BYTES) return null;
 const signature = new TextDecoder().decode(await file.slice(0, 8).arrayBuffer());
 if (!/^%PDF-(1\.[0-7]|2\.0)/.test(signature)) return null;
 return { name, size: file.size };
}
