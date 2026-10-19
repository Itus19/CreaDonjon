import type { EncounterPartyMember } from "@/src/server/services/encounterWorkshop";

/** Les trois paliers 2024 : le budget de PX du groupe à chacun. */
export type BudgetsParPalier = { low: number; moderate: number; high: number };

/**
 * PJ qui comptent dans le budget : cochés (pas dans `absents`) ET dont la part
 * est connue. Un PJ sans niveau connu (`shares === null`) ne compte jamais.
 */
export function membresComptes(party: readonly EncounterPartyMember[], absents: ReadonlySet<string>): EncounterPartyMember[] {
  return party.filter((m) => !absents.has(m.entityId) && m.shares !== null);
}

/** Budget du groupe : somme des parts serveur, palier par palier. Aucune règle recalculée ici. */
export function budgetDuGroupe(party: readonly EncounterPartyMember[], absents: ReadonlySet<string>): BudgetsParPalier {
  const total: BudgetsParPalier = { low: 0, moderate: 0, high: 0 };
  for (const m of membresComptes(party, absents)) {
    if (!m.shares) continue;
    total.low += m.shares.low;
    total.moderate += m.shares.moderate;
    total.high += m.shares.high;
  }
  return total;
}

/** Moyenne arrondie des niveaux, bornée à 1..20 (bornes de la route de sauvegarde). */
export function niveauMoyenArrondi(niveaux: readonly number[]): number {
  if (niveaux.length === 0) return 1;
  const moyenne = niveaux.reduce((s, n) => s + n, 0) / niveaux.length;
  return Math.min(20, Math.max(1, Math.round(moyenne)));
}

interface MonstreCatalogue {
  name: string;
  type: string;
}

/**
 * Le type de base d'une créature : la donnée SRD mêle casses et sous-types
 * (« Humanoid (Cleric) », « Beast (Dinosaur) », « humanoid »). Les filtres
 * regroupent par base, en minuscules ; une nuée (« Swarm of Tiny Beast ») est
 * une nuée.
 */
export function typeDeBase(type: string): string {
  const base = type.split("(")[0].trim().toLowerCase();
  return base.startsWith("swarm") ? "swarm" : base;
}

/** Filtre du catalogue côté client : recherche par nom (sans casse) et, si fourni, type de base. */
export function filtrerCatalogue<T extends MonstreCatalogue>(monstres: readonly T[], recherche: string, type: string | null): T[] {
  const q = recherche.trim().toLowerCase();
  return monstres.filter((m) => (!type || typeDeBase(m.type) === type) && (!q || m.name.toLowerCase().includes(q)));
}

/** Types de base distincts présents dans le catalogue, triés (les filtres). */
export function typesDuCatalogue(monstres: readonly MonstreCatalogue[]): string[] {
  return Array.from(new Set(monstres.map((m) => typeDeBase(m.type)).filter((t) => t))).sort((a, b) => a.localeCompare(b));
}
