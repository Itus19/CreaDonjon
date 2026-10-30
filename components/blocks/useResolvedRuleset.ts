"use client";

import { useEffect, useState } from "react";
import type { ResolvedRuleset } from "@/src/core/rules/sheet";
import type { ChoiceSource, FeatChoiceData } from "@/src/core/rules/choices";
import type { ArmorData, ItemCost, WeaponData } from "@/src/core/rules/srdMapping";
import { creerChargeurParLots } from "@/lib/chargement/chargeurParLots";
import { selectionBody, selectionHasAnything, selectionKey, type RulesetSelection } from "@/lib/resolvedRuleset/selection";

export interface RemainingChoiceView {
  id: string;
  label: string;
  count: number;
  options: string[];
  /**
   * Distingue le rendu cote client (V1-C7) : la liste de competences est
   * fixe et deja affichee par ailleurs, la liste de langues ne l'est pas ;
   * `weapon_mastery` (retour utilisateur, V2-G1) porte des cles de fiche
   * d'arme plutot qu'un code statique. Comme skill/language, emis par
   * `assembleResolvedRuleset` (server) — la fiche jouable l'ignore pour
   * l'instant (son filtre explicite `kind === "skill"`), rien ne l'empeche
   * de l'afficher plus tard sans changer ce type.
   */
  kind: "skill" | "language" | "weapon_mastery";
  /** V3.1-49 : l'étape de création qui fait naître ce choix (« character » : les langues du personnage, sous Identité). */
  origin: "species" | "class" | "background" | "character";
}

/** Maitrise ou langue accordee, avec sa source pour affichage (onglet Traits, V1-C6). */
export interface TraitGrantView {
  key: string;
  name: string;
  source: string;
}

export interface ResolvedRulesetView {
  ruleset: ResolvedRuleset;
  remainingChoices: RemainingChoiceView[];
  proficiencies: TraitGrantView[];
  languages: TraitGrantView[];
  equipment: Record<string, ArmorData | null>;
  /** Donnees d'arme par cle de regle (onglet Actions, V1-C10) — se recalcule avec l'inventaire comme `equipment`, contrairement a l'ancienne source (`remote.weaponByKey`, un instantane fige au premier chargement). */
  weaponByKey: Record<string, WeaponData | null>;
  /** Poids en livres, par cle de regle (encombrement, V1-C4 suite). */
  weight: Record<string, number | null>;
  /** Cout (quantite + unite de monnaie), par cle de regle (onglet Inventaire, V1-C11). */
  cost: Record<string, ItemCost | null>;
  /** Niveau de sort (0 = tour de magie), par cle de regle (tri Magie, V1-C6). */
  spellLevels: Record<string, number | null>;
  /** Niveaux ou chaque classe accorde une amelioration de caracteristique, par cle de classe (V2-G1, montee de niveau accompagnee). */
  asiGrantedLevels: Record<string, number[]>;
  /** Les trois caracteristiques de l'historique choisi (V2-G7, bonus +2/+1) — `null` si aucun historique choisi ou si sa fiche n'en porte aucune. */
  backgroundAbilityScores: string[] | null;
  /** V3.1-116 : fiches qui portent des choix, réponses imposées, dons désignables — résolus dans le navigateur par `resolveChoices`. */
  choiceSources: ChoiceSource[];
  choicePresets: Record<string, string[]>;
  featCatalog: Record<string, FeatChoiceData>;
}

export type { RulesetSelection };

const EMPTY: ResolvedRulesetView = {
  ruleset: { classes: {}, features: {} },
  remainingChoices: [],
  proficiencies: [],
  languages: [],
  equipment: {},
  weaponByKey: {},
  weight: {},
  cost: {},
  spellLevels: {},
  asiGrantedLevels: {},
  backgroundAbilityScores: null,
  choiceSources: [],
  choicePresets: {},
  featCatalog: {},
};


/**
 * V3.1-62 (docs/CABLAGE.md, C2) : la fiche de personnage demandait 6 fois le
 * meme ruleset resolu (un par bloc qui l'utilise), environ 5 s de serveur
 * chacun. Une meme selection ne part plus qu'une fois : les demandes
 * simultanees partagent la meme attente, et la reponse sert 30 s.
 */
const DUREE_CACHE_MS = 30_000;
const corpsParCle = new Map<string, unknown>();
const chargeurRuleset = creerChargeurParLots<ResolvedRulesetView>({
  tailleMax: 1,
  dureeCacheMs: DUREE_CACHE_MS,
  chargerLot: async ([cle]) => {
    const [worldSlug] = JSON.parse(cle) as [string, string];
    const res = await fetch(`/api/worlds/${worldSlug}/resolved-ruleset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpsParCle.get(cle)),
    });
    if (!res.ok) throw new Error(`resolved-ruleset : ${res.status}`);
    return new Map([[cle, (await res.json()) as ResolvedRulesetView]]);
  },
});

/**
 * V3.1-62 (ADR 0056) : la page lance le calcul du ruleset en meme temps
 * qu'elle (promesse en flux) ; la fiche l'adopte ici AVANT sa propre
 * demande, qui attend alors cette promesse au lieu d'appeler la route. La
 * cle doit etre celle que la fiche calculera (`selectionKey`, module partage).
 */
export function amorcerRulesetResolu(worldSlug: string, cleSelection: string, promesse: Promise<ResolvedRulesetView | undefined>): void {
  chargeurRuleset.amorcer(JSON.stringify([worldSlug, cleSelection]), promesse);
}

async function chargerRulesetResolu(worldSlug: string, dedupeKey: string, body: unknown): Promise<ResolvedRulesetView> {
  const cle = JSON.stringify([worldSlug, dedupeKey]);
  corpsParCle.set(cle, body);
  return (await chargeurRuleset.charger([cle])).get(cle) ?? EMPTY;
}

/**
 * Assemble un `ResolvedRuleset` reel des que l'espece/l'historique/les
 * classes/l'equipement change (V1-B4) — la fiche derivee, elle, se
 * recalcule a chaque rendu a partir du dernier resultat en cache, sans
 * refetch (`characterSheet()` est pure et instantanee, §4.5).
 */
export function useResolvedRuleset(worldSlug: string, selection: RulesetSelection): ResolvedRulesetView & { pret: boolean } {
  const dedupeKey = selectionKey(selection);
  // V3.1-26 : l'etat de depart est TOUJOURS `EMPTY`, jamais lu dans le cache.
  // Il lisait `lireSiPret` ici : le serveur (sans cache) rendait la fiche avec
  // des regles vides (CA 11), le navigateur (cache chaud) avec les vraies
  // (CA 16) — erreur d'hydratation de React. Maintenant les deux premiers
  // rendus sont identiques ; `pret` dit quand les regles sont arrivees (le
  // cache les rend dans la foulee de l'effet, sans nouvelle requete).
  const [data, setData] = useState<ResolvedRulesetView>(EMPTY);
  const [pret, setPret] = useState(false);
  /**
   * L'equipement se resout independamment du personnage (V1-C18) : le poids
   * et le cout d'un objet SRD ne dependent pas de qui le porte — un bloc
   * d'inventaire seul, sur une entite sans fiche de personnage (boutique,
   * coffre), doit pouvoir les afficher lui aussi.
   */
  const hasAnything = selectionHasAnything(selection);

  useEffect(() => {
    let cancelled = false;
    const body = selectionBody(selection);
    const request: Promise<ResolvedRulesetView> = hasAnything ? chargerRulesetResolu(worldSlug, dedupeKey, body) : Promise.resolve(EMPTY);

    request
      .then((resultat) => {
        if (cancelled) return;
        setData(resultat);
        setPret(true);
      })
      .catch((erreur: unknown) => {
        // Jamais muet : la fiche se calcule sans ruleset (valeurs de base), et l'erreur se voit.
        console.error("Ruleset resolu non charge", erreur);
        if (cancelled) return;
        setData(EMPTY);
        setPret(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSlug, dedupeKey]);

  return { ...data, pret };
}
