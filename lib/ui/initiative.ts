import { OWN_INITIATIVE_MAX, OWN_INITIATIVE_MIN, sortByInitiative } from "@/src/core/rules/combat";
import { formatFormulaNode } from "@/src/core/formula/format";
import { zEffectsBlockData } from "@/src/core/schemas/rule-blocks";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import type { ParticipantCharacteristics } from "@/src/server/services/combats";
import type { SortieJet } from "@/lib/ui/outilDes";
import type { TargetedRollInput } from "@/lib/combats/schemas";
import type { RollDisplay } from "@/src/core/dice/diceTool";
import type { AdvantageState } from "@/src/core/rules/action";

/**
 * Logique pure de l'outil Initiative (V3.1-38) : la phase d'un combat, l'ordre,
 * qui manque aux jets, la menace restante, les PV et leur anneau, le nom
 * d'origine d'un adversaire renommé, les actions d'un participant et la forme
 * des jets ciblés. Rien ici ne lance un dé ni ne tranche une règle (règle 8) :
 * on décrit le jet que le serveur résoudra, et on lit ce qu'il a rendu.
 */

// ---- la phase d'un combat ----------------------------------------------------

export type PhaseCombat = "draft" | "rolling" | "running" | "paused" | "ended";

const PHASES: readonly PhaseCombat[] = ["draft", "rolling", "running", "paused", "ended"];

/** Le statut de la base, ramené à une phase connue (un statut inconnu vaut « pas engagé »). */
export function phaseDe(status: string): PhaseCombat {
  return PHASES.find((p) => p === status) ?? "draft";
}

// ---- l'ordre et les jets -----------------------------------------------------

/** Initiative décroissante, égalité par ordre d'ajout, sans score en dernier (noyau `sortByInitiative`). */
export function ordonner(participants: readonly CombatParticipantRow[]): CombatParticipantRow[] {
  return sortByInitiative(
    participants.map((row) => ({ id: row.id, initiative: row.initiative, displayOrder: row.display_order, row }))
  ).map((o) => o.row);
}

/** Un participant `entity` est un personnage de joueuse : c'est elle qui lance (ou le MJ à sa place). */
export function estUnPj(p: CombatParticipantRow): boolean {
  return p.source_kind === "entity";
}

/** Les joueuses dont le PJ n'a pas encore de score. */
export function joueusesEnAttente(participants: readonly CombatParticipantRow[]): CombatParticipantRow[] {
  return participants.filter((p) => estUnPj(p) && p.initiative === null);
}

/** Ce que le serveur lance au « Commencer » : tout ce qui n'est pas un PJ et n'a pas de score. */
export function adversairesSansInitiative(participants: readonly CombatParticipantRow[]): CombatParticipantRow[] {
  return participants.filter((p) => !estUnPj(p) && p.initiative === null);
}

/** « Round 1 » quand tout le monde a un score — et qu'il y a quelqu'un. */
export function peutCommencerRound(participants: readonly CombatParticipantRow[]): boolean {
  return participants.length > 0 && participants.every((p) => p.initiative !== null);
}

/** ▲▼ du score : un cran, dans les bornes que la base impose aux scores des joueuses. */
export function pasInitiative(valeur: number, sens: 1 | -1): number {
  return Math.max(OWN_INITIATIVE_MIN, Math.min(OWN_INITIATIVE_MAX, valeur + sens));
}

/** Le score de départ quand on touche un « … » : une valeur médiane plutôt qu'un champ vide. */
export const INITIATIVE_DE_DEPART = 10;

// ---- états ---------------------------------------------------------------------

/** Les états d'un participant (colonne JSON : on rétrécit, on ne suppose pas). */
export function etatsDe(p: CombatParticipantRow): string[] {
  return Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : [];
}

/** Le libellé de concentration d'un participant, s'il se concentre. */
export function concentrationDe(p: CombatParticipantRow): string | null {
  const c = p.concentration;
  if (c !== null && typeof c === "object" && !Array.isArray(c) && typeof (c as { label?: unknown }).label === "string") {
    return (c as { label: string }).label;
  }
  return null;
}

// ---- menace et fin ------------------------------------------------------------

/** Un adversaire est debout tant que ses PV ne sont pas tombés à 0 ; sans PV connus, il compte comme debout. */
function estDebout(p: CombatParticipantRow): boolean {
  return p.hp_max === null || p.hp_max <= 0 || (p.hp_current ?? p.hp_max) > 0;
}

export interface Menace {
  restant: number;
  total: number;
  pourcent: number;
}

/**
 * « Menace restante » : l'XP des adversaires encore debout rapportée à celle de
 * tous les adversaires de la rencontre. Un adversaire dont on ne connaît pas
 * l'XP (saisie libre) ne pèse rien ; sans rien à peser, pas de menace.
 */
export function menaceRestante(participants: readonly CombatParticipantRow[], xpParCle: Readonly<Record<string, number>>): Menace | null {
  let total = 0;
  let restant = 0;
  for (const p of participants) {
    if (p.is_ally || p.rule_key === null) continue;
    const xp = xpParCle[p.rule_key];
    if (xp === undefined || xp <= 0) continue;
    total += xp;
    if (estDebout(p)) restant += xp;
  }
  if (total === 0) return null;
  return { restant, total, pourcent: Math.round((100 * restant) / total) };
}

/**
 * Vrai quand tous les adversaires dont on connaît les PV sont tombés : le MJ
 * confirme alors la fin. Un piège sans PV ne bloque ni ne déclenche rien.
 */
export function tousAdversairesVaincus(participants: readonly CombatParticipantRow[]): boolean {
  const suivis = participants.filter((p) => !p.is_ally && p.hp_max !== null && p.hp_max > 0);
  return suivis.length > 0 && suivis.every((p) => (p.hp_current ?? 0) <= 0);
}

// ---- PV ------------------------------------------------------------------------

/** Les dégâts entament d'abord les PV temporaires ; un soin ne touche qu'aux PV, jusqu'au maximum. Jamais sous 0. */
export function appliquerPv(p: CombatParticipantRow, delta: number): { hpCurrent: number; tempHp: number } {
  const courant = p.hp_current ?? 0;
  const max = p.hp_max ?? courant;
  if (delta >= 0) return { hpCurrent: Math.min(max, courant + delta), tempHp: p.temp_hp };
  const absorbe = Math.min(p.temp_hp, -delta);
  const reste = -delta - absorbe;
  return { hpCurrent: Math.max(0, courant - reste), tempHp: p.temp_hp - absorbe };
}

export type TonAnneau = "plein" | "moyen" | "bas" | "hors";

export interface FractionsAnneau {
  /** 0 à 100 : l'arc des PV. */
  pv: number;
  /** 0 à 100 : l'arc bleu des PV temporaires, autour. */
  temp: number;
  ton: TonAnneau;
}

/** L'anneau d'un participant ; `null` sans PV maximum (rien à jauger). */
export function fractionsAnneau(p: CombatParticipantRow): FractionsAnneau | null {
  if (p.hp_max === null || p.hp_max <= 0) return null;
  const courant = Math.max(0, p.hp_current ?? 0);
  const ratio = Math.min(1, courant / p.hp_max);
  // Un tiers et deux tiers, comparés en entiers : 5 PV sur 15 est « bas », sans erreur d'arrondi.
  const ton: TonAnneau = courant <= 0 ? "hors" : courant * 3 <= p.hp_max ? "bas" : courant * 3 <= 2 * p.hp_max ? "moyen" : "plein";
  return { pv: Math.round(ratio * 100), temp: Math.min(100, Math.round((100 * p.temp_hp) / p.hp_max)), ton };
}

/** « 20/15 » : PV plus PV temporaires, sur le maximum. `null` sans PV maximum. */
export function libellePv(p: CombatParticipantRow): string | null {
  if (p.hp_max === null || p.hp_max <= 0) return null;
  return `${(p.hp_current ?? 0) + p.temp_hp}/${p.hp_max}`;
}

// ---- renommer -------------------------------------------------------------------

/**
 * Le nom d'origine d'un adversaire renommé, que seul le MJ voit. Le serveur ne
 * le garde pas : on le relit du monstre de la fiche de règle. Tant que le nom
 * affiché commence par celui du monstre (« Gobelin 1 »), il n'est pas renommé.
 */
export function nomOrigine(p: CombatParticipantRow, nomsParCle: Readonly<Record<string, string>>): string | null {
  if (p.source_kind !== "statblock" || p.rule_key === null) return null;
  const origine = nomsParCle[p.rule_key];
  if (!origine) return null;
  return p.label.trim().toLowerCase().startsWith(origine.trim().toLowerCase()) ? null : origine;
}

// ---- les actions d'un monstre ------------------------------------------------------

export interface ActionAffichee {
  nom: string;
  description: string;
  /** Bonus de touche (« Touche +5 ») ; `null` sans jet d'attaque. */
  touche: number | null;
  /** Les dés de dégâts (« 1d6 perçant ») ; `null` sans dégâts. */
  degats: string | null;
  /** Le DD d'une sauvegarde que la description annonce ; `null` sinon. */
  dd: number | null;
}

const MOTIF_DD = /\b(?:DD|DC)\s*(\d{1,2})\b/i;

/** Toutes les actions du bloc de monstre (actions, puis actions légendaires), prêtes à afficher. */
export function actionsDeMonstre(caracteristiques: ParticipantCharacteristics): ActionAffichee[] {
  if (caracteristiques.kind !== "monster") return [];
  const entrees = [...(caracteristiques.actions?.actions ?? []), ...(caracteristiques.legendaryActions?.actions ?? [])];
  return entrees.map((a) => ({
    nom: a.name,
    description: a.description,
    touche: a.attack_bonus ?? null,
    degats: a.damage && a.damage.length > 0 ? a.damage.map((d) => `${formatFormulaNode(d.dice)}${d.type ? ` ${d.type}` : ""}`).join(" + ") : null,
    dd: a.attack_bonus === undefined ? ddDeLaDescription(a.description) : null,
  }));
}

function ddDeLaDescription(description: string): number | null {
  const m = MOTIF_DD.exec(description);
  return m ? Number(m[1]) : null;
}

// ---- les actions d'un personnage ------------------------------------------------------

/** Ce que la fiche de règle d'une entrée dit d'elle (`useRuleEntryBlocks`). */
export interface BlocDeRegle {
  blockType: string;
  data: unknown;
}

/** Une arme : sa fiche de règle porte un bloc `weapon`. */
export function estUneArme(blocs: readonly BlocDeRegle[] | undefined): boolean {
  return blocs?.some((b) => b.blockType === "weapon") ?? false;
}

export type GenreSort = "spell_attack" | "spell_save" | "heal";

/**
 * Quel jet ciblé un sort sait faire, d'après son premier effet : un jet
 * d'attaque, une sauvegarde de la cible, ou une formule sans type de dégâts
 * (un soin). Sans l'un des trois, le sort n'a pas de bouton ici. Le niveau est
 * celui de la fiche (0 : sort mineur, jamais d'emplacement).
 */
export function classerSort(blocs: readonly BlocDeRegle[] | undefined): { genre: GenreSort | null; niveau: number } {
  const casting = blocs?.find((b) => b.blockType === "spell_casting")?.data;
  const niveauLu = casting !== null && typeof casting === "object" ? (casting as { level?: unknown }).level : undefined;
  const niveau = typeof niveauLu === "number" && Number.isInteger(niveauLu) && niveauLu >= 0 ? niveauLu : 0;
  const effets = zEffectsBlockData.safeParse(blocs?.find((b) => b.blockType === "effects")?.data);
  const effet = effets.success ? effets.data.effects[0] : undefined;
  if (effet?.attack) return { genre: "spell_attack", niveau };
  if (effet?.save) return { genre: "spell_save", niveau };
  if (effet?.formula && !effet.damage_type) return { genre: "heal", niveau };
  return { genre: null, niveau };
}

// ---- les jets ciblés -------------------------------------------------------------------

export type GenreJetCible = TargetedRollInput["kind"];

export interface DemandeJetCible {
  kind: GenreJetCible;
  acteur: TargetedRollInput["actor"];
  action: TargetedRollInput["action"];
  cibleId: string;
}

/**
 * Le corps de `POST …/targeted-roll` : il décrit le jet, jamais son résultat.
 * Le jet d'un monstre reste caché aux joueuses (le serveur le consigne en
 * secret) ; celui d'une fiche reste public.
 */
export function corpsJetCible(demande: DemandeJetCible, options: { avantage?: AdvantageState; critique?: boolean } = {}): TargetedRollInput {
  return {
    kind: demande.kind,
    actor: demande.acteur,
    action: demande.action,
    targetId: demande.cibleId,
    advantage: options.avantage ?? "normal",
    critical: options.critique ?? false,
    secret: demande.acteur.kind === "participant",
  };
}

/** Ce que `targeted-roll` rend quand il réussit (`TargetedRollResult`, côté serveur). */
export interface ReponseJetCible {
  ok: true;
  verdict: "hit" | "miss" | null;
  amount: number | null;
  facts: string[];
  changes: string[];
  hints: string[];
  ignored: string[];
  targetOutOfFight: boolean;
  /** Après une touche : les dégâts à lancer sur la même cible (`ChainedDamage`, côté serveur). */
  chained: { kind: "damage"; actor: TargetedRollInput["actor"]; action: TargetedRollInput["action"]; targetId: string; critical: boolean } | null;
  rollEventId: string;
  saveRequestId: string | null;
  /** V3.1-38 (suite) : les dés du jet (`RollDisplay`, côté serveur) ; `null` sans dés à montrer. */
  dice: RollDisplay | null;
}

/** Après une touche, les dégâts à lancer sur la même cible, critique compris ; `null` sinon. */
export function demandeDegatsApres(reponse: ReponseJetCible): { demande: DemandeJetCible; critique: boolean } | null {
  const suite = reponse.chained;
  if (!suite || suite.kind !== "damage") return null;
  return { demande: { kind: "damage", acteur: suite.actor, action: suite.action, cibleId: suite.targetId }, critique: suite.critical };
}

/**
 * V3.1-106 : l'effet d'un jet de dégâts ou de soin, lu dans les `changes` de la
 * réponse (« Worg : 7 → 4 PV »), sans la note entre parenthèses que le serveur
 * ajoute au journal. `null` quand rien n'a changé : on garde alors le libellé du jet.
 */
export function effetDesChanges(changes: readonly string[]): string | null {
  const lignes = changes.map((c) => c.replace(/\s*\([^)]*\)\s*$/, "").trim()).filter((c) => c !== "");
  return lignes.length > 0 ? lignes.join(" · ") : null;
}

/**
 * V3.1-106 : le MJ valide la touche d'un monstre ou d'un PNJ (acteur
 * « participant ») sur un allié (un PJ) avant que les dégâts ne partent.
 */
export function validationMjRequise(acteur: TargetedRollInput["actor"], cible: { is_ally: boolean } | undefined): boolean {
  return acteur.kind === "participant" && cible?.is_ally === true;
}

/**
 * Le jet ciblé, tel que l'outil de dés l'affiche : les dés que le serveur a
 * lancés (total de l'attaque ou des dégâts, paire d'avantage, d20 gardé) et le
 * verdict. Sans dés (un sort à sauvegarde, un soin), le montant seul. `libelle` donne le texte de la
 * ligne pour le genre de jet (traduit par l'appelant).
 */
export function sortieDepuisJetCible(
  reponse: ReponseJetCible,
  kind: GenreJetCible,
  contexte: { acteur: string; cible: string; libelle: (cle: "touche" | "rate" | "attaque" | "degats" | "sauvegarde" | "soin", cible: string) => string }
): SortieJet {
  const { acteur, cible, libelle } = contexte;
  let what: string;
  if (kind === "attack" || kind === "spell_attack") {
    what = libelle(reponse.verdict === "hit" ? "touche" : reponse.verdict === "miss" ? "rate" : "attaque", cible);
  } else if (kind === "damage") {
    // V3.1-106 : l'effet (« Worg : 7 → 4 PV ») à la place de « Dégâts — Worg ».
    what = effetDesChanges(reponse.changes) ?? libelle("degats", cible);
  } else if (kind === "spell_save") {
    what = libelle("sauvegarde", cible);
  } else {
    what = effetDesChanges(reponse.changes) ?? libelle("soin", cible);
  }
  return {
    who: acteur,
    what,
    chips: [],
    total: reponse.dice?.total ?? reponse.amount ?? 0,
    dc: null,
    verdict: reponse.verdict === "hit" ? "success" : reponse.verdict === "miss" ? "fail" : null,
    hidden: false,
    trace: reponse.dice?.trace ?? [],
    pair: reponse.dice?.pair ?? null,
    naturalD20: reponse.dice?.naturalD20 ?? null,
    dcPrivate: false,
  };
}

// ---- la grille de l'outil de dés (décorative) -------------------------------------

/**
 * Les dés et le modificateur que la grille verrouillée de l'outil montre pour
 * une formule de dégâts (« 2d6+3 perçant »). Décoratif : le serveur lance
 * (règle 8). Une formule illisible donne un d6, jamais un résultat.
 */
export function desDeLaFormule(formule: string | null): { dice: { d4?: number; d6?: number; d8?: number; d10?: number; d12?: number; d20?: number; d100?: number }; modifier: number } {
  const m = formule ? /(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/.exec(formule) : null;
  const faces = m ? Number(m[2]) : 6;
  if (!m || ![4, 6, 8, 10, 12, 20, 100].includes(faces)) return { dice: { d6: 1 }, modifier: 0 };
  return { dice: { [`d${faces}`]: Math.min(20, Number(m[1])) }, modifier: m[4] ? (m[3] === "-" ? -Number(m[4]) : Number(m[4])) : 0 };
}
