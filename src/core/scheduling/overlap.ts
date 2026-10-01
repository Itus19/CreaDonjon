/**
 * Heures et durée d'une séance (V2.1-4). Temps en minutes depuis minuit tout
 * du long : entier, comparable, pas de piège de fuseau horaire pour un calcul
 * purement local à la journée. Le classement des dates a quitté ce fichier en
 * V3.1-16 : l'intersection de TOUTES les réponses d'un jour (`computeOverlap`)
 * a cédé la place au meilleur créneau du plus grand groupe
 * (`bestWindow.ts`).
 */

export type SessionCategory = "full" | "short" | "none";

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** `targetMinutes` : durée de session visée, réglable par le MJ (retour utilisateur : pas figée à 5h pour toutes les tables). */
export function classifySession(durationMinutes: number, targetMinutes: number): SessionCategory {
  if (durationMinutes <= 0) return "none";
  return durationMinutes >= targetMinutes ? "full" : "short";
}
