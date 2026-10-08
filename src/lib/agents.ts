import { normalizeOrganizationName } from "./organizations.ts";

// 20,000 Unicode code points bounds administrative instructions in both app and DB.
export const AGENT_INSTRUCTIONS_MAX = 20_000;
export const AGENT_INPUT_MESSAGE = "Informe um nome de 1 a 120 caracteres e instruções de 1 a 20.000 caracteres.";
export const AGENT_READINESS_MESSAGE = "A área de agentes está indisponível. Peça ao responsável para revisar a conexão e aplicar a migração de agentes.";
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validateAgentInput(value: unknown): { name: string; instructions: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = normalizeOrganizationName(Object.getOwnPropertyDescriptor(value, "name")?.value);
  const raw = Object.getOwnPropertyDescriptor(value, "instructions")?.value;
  if (!name || typeof raw !== "string") return null;
  const instructions = raw.trim();
  const length = Array.from(instructions).length;
  return length >= 1 && length <= AGENT_INSTRUCTIONS_MAX ? { name, instructions } : null;
}
