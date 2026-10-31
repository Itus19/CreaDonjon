/**
 * V3.1-53 — L'appel de l'or de départ à haut niveau, sorti de l'écran (même
 * motif que `initiativeApi.ts`) : les dés du palier sont lancés par le serveur
 * (règle 8). Le corps est STRICT : `{ count, faces }` et rien d'autre.
 * Renvoie `null` si le serveur refuse ; une panne réseau se propage à l'appelant.
 */
export async function lancerOrDeDepartApi(count: number, faces: number): Promise<number[] | null> {
  const res = await fetch("/api/character-creator/roll-starting-gold", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count, faces }),
  });
  if (!res.ok) return null;
  const corps = (await res.json()) as { rolls?: unknown };
  const jets = corps.rolls;
  if (!Array.isArray(jets) || !jets.every((j): j is number => typeof j === "number")) return null;
  return jets;
}
