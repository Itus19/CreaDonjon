/**
 * « À qui le tour » (V3.1-43) : la personne à proposer pour le prochain
 * devoir du Livre de sessions. Ordre : qui n'a jamais écrit, puis qui a écrit
 * son dernier texte il y a le plus longtemps ; à égalité, par nom. Un devoir
 * en attente n'est pas un texte écrit. `null` si personne n'est candidat.
 */
export interface WriterCandidate {
  userId: string;
  name: string;
}

export interface WriterEntry {
  assignedTo: string;
  status: "pending" | "written";
  writtenAt: string | null;
}

export function nextWriter(roster: readonly WriterCandidate[], entries: readonly WriterEntry[]): string | null {
  const lastWritten = new Map<string, number>();
  for (const e of entries) {
    if (e.status !== "written" || !e.writtenAt) continue;
    const t = Date.parse(e.writtenAt);
    if (Number.isNaN(t)) continue;
    lastWritten.set(e.assignedTo, Math.max(lastWritten.get(e.assignedTo) ?? -Infinity, t));
  }
  const ordered = [...roster].sort((a, b) => {
    const ta = lastWritten.get(a.userId) ?? -Infinity;
    const tb = lastWritten.get(b.userId) ?? -Infinity;
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name, "fr");
  });
  return ordered[0]?.userId ?? null;
}
