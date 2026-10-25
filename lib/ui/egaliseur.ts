/**
 * V3.1-114 — l'égaliseur de la fiche (planche « Emplacements et ressources de
 * classe — décidé ») : une seule ligne pour tout ce qui se dépense, en
 * groupes titrés. « Emplacements de sorts » (une colonne par niveau, puis la
 * réserve de pacte, à part : ADR 0045), « Classe » (les ressources dont la
 * source est une classe ou sous-classe du personnage), « Traits » (le reste :
 * dons, traits d'espèce, compteurs maison). Pur : l'écran ne fait que dessiner.
 */

/** Au-delà, une colonne de pastilles serait illisible : un compteur à commandes. */
export const SEUIL_COMPTEUR = 6;

export type Recharge = "short_rest" | "short_rest_one" | "long_rest" | "dawn" | "never";

/** Ce que le geste d'une colonne envoie : un emplacement (route `spell-slot`) ou une ressource (route `resource`). */
export type GesteColonne = { pool: "slots"; level: number } | { pool: "pact" } | { tracker: string };

export interface ColonneEgaliseur {
  cle: string;
  /** Le niveau d'un emplacement ou de la réserve de pacte. */
  niveau?: number;
  /** Le nom d'une ressource. */
  libelle?: string;
  total: number;
  restants: number;
  recharge: Recharge;
  genre: "emplacement" | "pacte" | "classe" | "trait";
  forme: "pastilles" | "compteur";
  geste: GesteColonne;
}

export interface GroupeEgaliseur {
  cle: "emplacements" | "classe" | "traits";
  colonnes: ColonneEgaliseur[];
}

export interface EntreeEgaliseur {
  slots: Record<number, number>;
  slotsUsed: Record<string, number>;
  pact: { count: number; slotLevel: number } | null;
  pactUsed: number;
  /** Les ressources, maximum déjà évalué. `sourceKey` : la clé de règle de la source, s'il y en a une. */
  trackers: { id: string; label: string; max: number; recharge: Recharge; sourceKey: string | null }[];
  resourcesUsed: Record<string, number>;
  /** Les classes et sous-classes du personnage (clés de règle). */
  classKeys: readonly string[];
}

function forme(total: number): ColonneEgaliseur["forme"] {
  return total > SEUIL_COMPTEUR ? "compteur" : "pastilles";
}

export function colonnesEgaliseur(entree: EntreeEgaliseur): GroupeEgaliseur[] {
  const emplacements: ColonneEgaliseur[] = Object.entries(entree.slots)
    .map(([niveau, total]) => ({ niveau: Number(niveau), total }))
    .filter((s) => s.total > 0)
    .sort((a, b) => a.niveau - b.niveau)
    .map(({ niveau, total }) => ({
      cle: `niv-${niveau}`,
      niveau,
      total,
      restants: Math.max(0, total - (entree.slotsUsed[String(niveau)] ?? 0)),
      recharge: "long_rest",
      genre: "emplacement",
      forme: forme(total),
      geste: { pool: "slots", level: niveau },
    }));
  if (entree.pact && entree.pact.count > 0) {
    emplacements.push({
      cle: "pacte",
      niveau: entree.pact.slotLevel,
      total: entree.pact.count,
      restants: Math.max(0, entree.pact.count - entree.pactUsed),
      recharge: "short_rest",
      genre: "pacte",
      forme: forme(entree.pact.count),
      geste: { pool: "pact" },
    });
  }

  const classes = new Set(entree.classKeys);
  const classe: ColonneEgaliseur[] = [];
  const traits: ColonneEgaliseur[] = [];
  for (const t of entree.trackers) {
    if (t.max <= 0) continue;
    const deClasse = t.sourceKey !== null && classes.has(t.sourceKey);
    (deClasse ? classe : traits).push({
      cle: `res-${t.id}`,
      libelle: t.label,
      total: t.max,
      restants: Math.max(0, t.max - (entree.resourcesUsed[t.id] ?? 0)),
      recharge: t.recharge,
      genre: deClasse ? "classe" : "trait",
      forme: forme(t.max),
      geste: { tracker: t.id },
    });
  }

  const groupes: GroupeEgaliseur[] = [
    { cle: "emplacements", colonnes: emplacements },
    { cle: "classe", colonnes: classe },
    { cle: "traits", colonnes: traits },
  ];
  return groupes.filter((g) => g.colonnes.length > 0);
}
