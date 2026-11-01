/**
 * V3.1-22 (ADR 0038, règle 5) — Le détail d'un jet tel que son lecteur a le
 * droit de le lire. Un jet du MJ contre un DD privé garde son verdict pour le
 * MJ ; un joueur ne le reçoit pas (il lit « contre DD ? », sans réussite ni
 * échec), au lieu d'un verdict envoyé puis caché à l'écran.
 */
export function rollDetailForReader<T>(detail: T, reader: { isGm: boolean }): T {
  if (reader.isGm || !detail || typeof detail !== "object" || Array.isArray(detail)) return detail;
  const d = detail as Record<string, unknown>;
  if (d.dcPrivate !== true || d.verdict === null || d.verdict === undefined) return detail;
  return { ...d, verdict: null } as T;
}
