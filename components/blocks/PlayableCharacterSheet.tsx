"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import {
  characterSheet,
  SKILLS,
  SKILL_ABILITIES,
  type Ability,
  type CharacterBuild,
  type DerivedSheet,
  type EquippedItem,
  type ResolvedFeature,
} from "@/src/core/rules/sheet";
import {
  armorAcModifier,
  mapChosenSkillModifiers,
  SRD_LANGUAGES,
  type ArmorData,
  type ItemCost,
  type LanguageKey,
  type WeaponData,
} from "@/src/core/rules/srdMapping";
import { lbToKg, totalCarriedWeight } from "@/src/core/rules/encumbrance";
import { evaluate, type TraceStep } from "@/src/core/formula/evaluate";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import { weaponAttackAbilityMod, type AdvantageState } from "@/src/core/rules/action";
import { useResolvedRuleset, type RemainingChoiceView, type TraitGrantView } from "./useResolvedRuleset";
import { useReferenceChips, refIdentity, type ResolvedChipView } from "./useReferenceChips";
import { itemLabel, itemRef } from "./InventoryBlockEditor";
import ItemAutocomplete from "./ItemAutocomplete";
import { useWorldRuleEntries } from "./useWorldRuleEntries";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import Dropdown from "@/components/shared/Dropdown";
import ActionsMenu from "@/components/shared/ActionsMenu";
import {
  ARMOR_CATEGORY_LABELS_FR,
  CURRENCY_LABELS_FR,
  LANGUAGE_LABELS_FR,
  SKILL_LABELS_FR,
  WEAPON_PROPERTY_LABELS_FR,
} from "@/src/i18n/fr";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "FOR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "SAG",
  cha: "CHA",
};

/** Compétences triées par libellé FR (V1-C4 suite) — même ordre que la référence visuelle fournie par l'utilisateur. */
const SORTED_SKILLS = [...SKILLS].sort((a, b) => SKILL_LABELS_FR[a].localeCompare(SKILL_LABELS_FR[b]));

/** Langues triées par libellé FR (V1-C7), même motif que SORTED_SKILLS. */
const SORTED_LANGUAGES = [...SRD_LANGUAGES].sort((a, b) => LANGUAGE_LABELS_FR[a].localeCompare(LANGUAGE_LABELS_FR[b]));

/** Seuils de PX cumulés par niveau total (règle officielle 5e, identique SRD 2014/2024) — sert uniquement à dessiner la barre de progression ; aucune montée de niveau n'est automatisée à partir de ces valeurs. */
const XP_LEVEL_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000,
  265000, 305000, 355000,
];

const RECHARGE_LABELS: Record<string, string> = {
  short_rest: "repos court",
  long_rest: "repos long",
  dawn: "à l'aube",
  never: "jamais",
};

const SPECIES_TYPES = ["species"] as const;
const BACKGROUND_TYPES = ["background"] as const;
const CLASS_TYPES = ["class"] as const;
const SUBCLASS_TYPES = ["subclass"] as const;

const GENDER_OPTIONS = [
  { value: "unspecified", label: "Non précisé" },
  { value: "feminine", label: "Féminin" },
  { value: "masculine", label: "Masculin" },
  { value: "neutral", label: "Neutre" },
  { value: "custom", label: "Personnalisé" },
];

/** `unspecified` (on ne sait pas) et `neutral` (ni l'un ni l'autre) restent deux valeurs distinctes du menu — jamais fusionnees (V1-C4). */
function genderDropdownValue(gender: CharacterBlockData["gender"]): string {
  if (!gender) return "unspecified";
  if (typeof gender === "object") return "custom";
  return gender;
}

function ruleRef(key: string): BlockReference | null {
  return key.trim() ? { kind: "rule", key: key.trim() } : null;
}

type Tab = "actions" | "magie" | "inventaire" | "traits";

function toggleChoice(current: string[], option: string, max: number): string[] {
  if (current.includes(option)) return current.filter((o) => o !== option);
  if (current.length >= max) return current;
  return [...current, option];
}

function resourceMax(tracker: { max: { formula: import("@/src/core/formula/ast").FormulaNode } }): number {
  const neverRolls = { nextInt: () => { throw new Error("le mode max n'appelle jamais le RNG"); } };
  try {
    return evaluate(tracker.max.formula, {}, neverRolls, "max").value;
  } catch {
    return 0;
  }
}

/**
 * Sélecteur de règle (V1-C4 suite, sur retour utilisateur) : remplace le
 * champ texte libre + suggestions par une vraie liste déroulante tirée du
 * ruleset du monde. Revirement délibéré sur une décision précédente de ce
 * même complément (qui gardait un champ libre par analogie avec §B5
 * « avertir, ne pas interdire ») — vérification faite, §B5 concerne les
 * prérequis de personnage, pas l'existence d'une clé de référence. Pour
 * espèce/historique/classe/sous-classe, la clé n'a de sens que si une fiche
 * de règle existe déjà ; un MJ qui invente une race crée d'abord sa fiche,
 * qui apparaît alors naturellement dans cette liste — pas de valeur à
 * accepter une clé qui ne résout jamais. Le bouton affiche directement le
 * nom traduit (source de la même liste que l'ancien champ), donc plus
 * besoin d'un élément séparé pour la lisibilité — juste un petit lien vers
 * la fiche de règle à côté.
 */
function RuleSelect({
  worldSlug,
  entryTypes,
  value,
  onChange,
  emptyLabel,
  chip,
  filterFn,
}: {
  worldSlug: string;
  entryTypes: readonly string[];
  value: string;
  onChange: (key: string) => void;
  emptyLabel: string;
  chip: ResolvedChipView | undefined;
  /** Filtre additionnel (V1-C4 suite) — ex. restreindre les sous-classes à celles de la classe choisie sur la même ligne. */
  filterFn?: (entry: RuleEntrySummary) => boolean;
}) {
  const entries = useWorldRuleEntries(worldSlug);
  const options = useMemo(() => {
    const filtered = entries
      .filter((e) => entryTypes.includes(e.entryType))
      .filter((e) => (filterFn ? filterFn(e) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ value: e.key, label: e.name }));
    return [{ value: "", label: emptyLabel }, ...filtered];
  }, [entries, entryTypes, emptyLabel, filterFn]);

  return (
    <div className="flex items-center gap-1">
      <Dropdown value={value} options={options} onChange={onChange} />
      {chip?.found && (
        <Link
          href={chip.href}
          title={chip.summary ?? chip.name}
          className="shrink-0 text-xs no-underline transition-opacity hover:opacity-70"
          style={{ color: "var(--link-rule)" }}
        >
          ↗
        </Link>
      )}
    </div>
  );
}

/**
 * Badge de statistique (V1-C4 suite) : la charte interdit les couleurs
 * codées en dur (specs/coquille-et-design.md §2), donc CA/Initiative/
 * Vitesse/etc. se distinguent par forme et libellé plutôt que par une
 * couleur inventée par stat. Libellé au-dessus d'un encadré de hauteur fixe
 * (meme structure que le bouclier de CA, meme hauteur `h-14`) — sur retour
 * utilisateur, l'ancien libellé-dans-l'encadré donnait des hauteurs
 * variables selon que le libellé tenait sur une ou deux lignes.
 */
function StatBadge({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span
        className={`flex h-6 items-end justify-center text-center text-[9px] font-bold uppercase leading-tight tracking-widest ${
          danger ? "text-danger" : "text-ink-muted"
        }`}
      >
        {label}
      </span>
      <div
        className={`flex h-14 w-full items-center justify-center rounded-md border ${
          danger ? "border-danger/60 bg-danger/10" : "border-edge bg-panel-raised"
        }`}
      >
        <span className={`text-base font-semibold ${danger ? "text-danger" : "text-ink"}`}>{value}</span>
      </div>
    </div>
  );
}

/**
 * Bouton d'action a trois lignes (V1-C12, sur retour utilisateur) : verbe
 * (« Attaquer »), formule resolue en nombres (« 1d20+2+2 »), puis le detail
 * symbolique en police plus petite (« 1d20+DEX+maîtrise ») — tout dans le
 * bouton, plus rien en dehors. Les deux formules sont deja calculees par
 * l'appelant (memes valeurs que celles reellement envoyees au serveur au
 * clic, jamais une seconde regle qui pourrait diverger).
 */
function ActionButton({
  label,
  resolvedFormula,
  detailFormula,
  busy,
  onClick,
}: {
  label: string;
  resolvedFormula: string;
  detailFormula: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex min-w-[6.5rem] flex-col items-center gap-0.5 rounded-md border border-edge px-3 py-1.5 text-ink hover:bg-panel disabled:opacity-50"
    >
      {/* `.mech` (globals.css) impose son propre `font-size: 0.9em`, hors de
          tout `@layer` Tailwind — il l'emporte toujours sur une classe
          `text-[Npx]` combinee sur le meme element, peu importe l'ordre
          ecrit ici (regle CSS Cascade Layers : le non-layer bat tout layer).
          Seul un style en ligne (priorite maximale, avant `!important`) peut
          fixer une taille exacte a cote de `mech` — d'ou son usage ici,
          jamais une classe Tailwind seule. */}
      <span className="text-[10px] font-medium">{label}</span>
      <span className="mech" style={{ fontSize: "0.875rem" }}>
        {resolvedFormula}
      </span>
      <span className="mech text-ink-muted" style={{ fontSize: "0.625rem" }}>
        {detailFormula}
      </span>
    </button>
  );
}

/** Ajoute un modificateur signe a une notation de de (`"1d20"` + 2 -> `"1d20+2"`), omis si nul. */
function withModifier(base: string, mod: number): string {
  if (mod === 0) return base;
  return `${base}${mod > 0 ? "+" : ""}${mod}`;
}

/**
 * Retire le prefixe redondant d'un `ai_digest` (toujours `"<nom> (<type>) —
 * <texte>"`, cf. `scripts/ingest-srd.ts`) — sans ca, une propriete d'arme
 * affichee a cote de son propre badge FR redirait deux fois son nom (« Light
 * — Light (feature) — A light weapon... »). Repli sur le texte complet si le
 * motif attendu n'est pas trouve, jamais une chaine vide.
 */
function stripDigestPrefix(digest: string): string {
  const match = digest.match(/^.*? \([a-z]+\) — ([\s\S]*)$/);
  return match ? match[1] : digest;
}

/**
 * Encadre d'objet d'inventaire (V1-C11/V1-C12, sur retours utilisateur
 * successifs) : meme langage visuel que les encadres de l'onglet Traits
 * (V1-C9). Reutilise par l'onglet Actions (`onToggleEquipped`/`onChangeQty`/
 * `onRemove` omis dans ce contexte : gerer l'inventaire n'est pas le role de
 * cet onglet, seulement l'utiliser) — l'encadre d'une arme equipee y est
 * donc litteralement le meme composant, pas une copie.
 *
 * Bascule Equiper en bandeau vertical (V1-C12) : `writing-mode` + rotation
 * plutot qu'un bouton en ligne — occupe toute la hauteur de l'encadre a
 * gauche, `items-stretch` (comportement flex par defaut) fait le reste.
 */
function ItemCard({
  worldSlug,
  item,
  chip,
  weapon,
  armor,
  weightLb,
  cost,
  strMod,
  dexMod,
  proficiencyBonus,
  isMonk,
  collapsible,
  busy,
  onAttack,
  onDamage,
  onToggleEquipped,
  onChangeQty,
  onRemove,
}: {
  worldSlug: string;
  item: InventoryItem;
  chip: ResolvedChipView | undefined;
  weapon: WeaponData | null;
  armor: ArmorData | null;
  weightLb: number | null;
  cost: ItemCost | null;
  strMod: number;
  dexMod: number;
  proficiencyBonus: number;
  /** Masque la propriete "monk" (V1-C12 suite, sur retour utilisateur) : pertinente seulement pour un personnage qui a des niveaux de Moine, contrairement aux autres proprietes d'arme qui restent des faits sur l'objet lui-meme. */
  isMonk: boolean;
  /** Repliable (V1-C13, onglet Inventaire seulement) : l'onglet Actions garde ses boutons toujours visibles, c'est son seul role. Replie par defaut — les descriptions/boutons restent a un clic, pas caches definitivement. */
  collapsible: boolean;
  busy: boolean;
  onAttack?: () => void;
  onDamage?: (versatile: boolean) => void;
  onToggleEquipped?: () => void;
  onChangeQty?: (qty: number) => void;
  onRemove?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(collapsible);
  const title = chip?.found ? chip.name : itemLabel(item);

  /**
   * Cle de reference + libelle FR de chaque propriete d'arme (V1-C12) — la
   * cle sert a resoudre sa fiche de regle (`Weapon-Properties`, importee
   * depuis ce ticket, `entry_type: "feature"` comme `Traits`/`Feats`) pour
   * en tirer la vraie description SRD (`chip.summary`, non traduite comme
   * le reste des descriptions d'aptitude, cf. V1-C9). Prefixe
   * `weapon-property-` (pas l'index brut, ex. "light") : ces index sont des
   * mots ordinaires qui percutent un sort/une classe/un objet du meme nom
   * (verifie a l'import : "light", "monk", "ammunition", "versatile" y sont
   * deja pris) — sans prefixe, la fiche resolue serait celle du sort
   * "Light", pas de la propriete. Armure : un seul badge de categorie, sans
   * fiche de regle correspondante (aucune categorie `Armor-Categories` dans
   * le SRD) — pas de description a reporter.
   */
  function weaponPropertyRefKey(property: string): string {
    return `weapon-property-${property}`;
  }
  const propertyRefs = weapon
    ? weapon.properties.filter((p) => p !== "monk" || isMonk).map((p) => ({ key: p, label: WEAPON_PROPERTY_LABELS_FR[p] ?? p }))
    : [];
  const armorLabel = armor ? (ARMOR_CATEGORY_LABELS_FR[armor.category] ?? armor.category) : null;
  // Tableau recree a chaque rendu, sans useMemo : `useReferenceChips` deduplique
  // deja en interne sur la cle jointe des refs (`dedupeKey`), pas sur
  // l'identite du tableau — un useMemo ici n'aurait rien evite de reel.
  const propertyChips = useReferenceChips(
    worldSlug,
    propertyRefs.map((p) => ({ kind: "rule" as const, key: weaponPropertyRefKey(p.key) }))
  );

  // Meme regle que le serveur (`weaponAttackAbilityMod`, resolveAction.ts) —
  // le libelle affiche ici doit refleter la meme caracteristique que celle
  // reellement utilisee au clic, jamais une supposition separee.
  const abilityMod = weapon ? weaponAttackAbilityMod(weapon.properties, weapon.isRanged, strMod, dexMod) : 0;
  const abilityLabel = weapon ? (weapon.isRanged || (weapon.properties.includes("finesse") && dexMod > strMod) ? "DEX" : "FOR") : "";
  const attackResolved = withModifier(withModifier("1d20", abilityMod), proficiencyBonus);
  const attackDetail = `1d20+${abilityLabel}+maîtrise`;
  const damageResolved = (dice: string) => withModifier(dice, abilityMod);
  const damageDetail = (dice: string) => (abilityMod !== 0 ? `${dice}+${abilityLabel}` : dice);

  const hasCollapsibleContent = propertyRefs.length > 0 || Boolean(weapon && (onAttack || onDamage));
  const showDetails = !collapsible || !collapsed;

  return (
    <div className="flex overflow-hidden rounded-md border border-edge/60 bg-panel-raised">
      {onToggleEquipped && (
        <button
          type="button"
          onClick={onToggleEquipped}
          title={item.equipped ? "Cliquer pour déséquiper" : "Cliquer pour équiper"}
          className={`w-7 shrink-0 border-r text-[10px] font-semibold uppercase tracking-widest transition-colors ${
            item.equipped ? "border-accent/50 bg-accent/20 text-accent" : "border-edge/60 bg-panel text-ink-muted hover:bg-panel-raised"
          }`}
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {item.equipped ? "Équipé" : "Équiper"}
        </button>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        {/* Grille 3 colonnes (1fr/auto/1fr) plutot qu'un flex : la fleche de
            pliage doit rester au centre exact de l'encadre (demande
            explicite), pas juste "avant le bouton supprimer" — une colonne
            centrale `auto` entre deux colonnes egales fait ca sans jamais
            deriver selon la largeur du titre ou du nombre de badges. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {chip?.found ? (
              <Link href={chip.href} className="text-sm font-semibold no-underline hover:underline" style={{ color: "var(--link-rule)" }}>
                {title}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-ink">{title || "Sans nom"}</span>
            )}
            {weightLb !== null && (
              <span className="mech text-ink-muted" style={{ fontSize: "0.625rem" }}>
                {lbToKg(weightLb)} kg
              </span>
            )}
            {cost && (
              <span className="mech text-ink-muted" style={{ fontSize: "0.625rem" }}>
                {cost.quantity} {CURRENCY_LABELS_FR[cost.unit] ?? cost.unit}
              </span>
            )}
            {onChangeQty ? (
              <input
                type="number"
                min={0}
                value={item.qty}
                onChange={(e) => onChangeQty(Number(e.target.value) || 0)}
                className="w-12 rounded-md border border-edge bg-transparent px-1 py-0.5 text-center text-xs text-ink outline-none"
                aria-label="Quantité"
              />
            ) : (
              <span className="text-[10px] text-ink-muted">× {item.qty}</span>
            )}
          </div>
          {collapsible && hasCollapsibleContent ? (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Déplier" : "Replier"}
              aria-label={collapsed ? "Déplier" : "Replier"}
              className="shrink-0 px-1 text-ink-muted transition-colors hover:text-ink"
            >
              {collapsed ? "▾" : "▴"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex justify-end">
            {onRemove && (
              <button type="button" onClick={onRemove} className="shrink-0 text-xs text-danger hover:underline">
                ×
              </button>
            )}
          </div>
        </div>

        {propertyRefs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {propertyRefs.map((p) => (
              <span key={p.key} className="rounded-full border border-edge px-1.5 py-0 text-[10px] text-ink-muted">
                {p.label}
              </span>
            ))}
          </div>
        )}
        {armorLabel && (
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full border border-edge px-1.5 py-0 text-[10px] text-ink-muted">{armorLabel}</span>
          </div>
        )}

        {showDetails && propertyRefs.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {propertyRefs.map((p) => {
              const propChip = propertyChips.get(refIdentity({ kind: "rule", key: weaponPropertyRefKey(p.key) }));
              const description = propChip?.found && propChip.summary ? stripDigestPrefix(propChip.summary) : null;
              return description ? (
                <p key={p.key} className="text-xs leading-relaxed text-ink-muted">
                  <span className="font-semibold text-ink">{p.label}</span> — {description}
                </p>
              ) : null;
            })}
          </div>
        )}

        {showDetails && weapon && (onAttack || onDamage) && (
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            {onAttack && (
              <ActionButton label="Attaquer" resolvedFormula={attackResolved} detailFormula={attackDetail} busy={busy} onClick={onAttack} />
            )}
            {onAttack && weapon.properties.includes("thrown") && (
              <ActionButton label="Lancer" resolvedFormula={attackResolved} detailFormula={attackDetail} busy={busy} onClick={onAttack} />
            )}
            {onDamage && (
              <ActionButton
                label="Dégâts"
                resolvedFormula={damageResolved(weapon.damageDice)}
                detailFormula={damageDetail(weapon.damageDice)}
                busy={busy}
                onClick={() => onDamage(false)}
              />
            )}
            {onDamage && weapon.versatileDamageDice && (
              <ActionButton
                label="Dégâts (2 mains)"
                resolvedFormula={damageResolved(weapon.versatileDamageDice)}
                detailFormula={damageDetail(weapon.versatileDamageDice)}
                busy={busy}
                onClick={() => onDamage(true)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ajout d'objet par recherche de regle (V1-C11, remplace le couple menu
 * "Objet en ligne/Reference de regle" + champ separe) : un seul champ, une
 * quantite, un bouton. Une suggestion choisie cree une reference ; un texte
 * libre sans suggestion choisie cree un objet en ligne (homebrew) — les deux
 * flux restent possibles, `ItemAutocomplete` gere deja ce repli cote UI.
 */
function AddItemRow({ worldSlug, onAdd }: { worldSlug: string; onAdd: (item: InventoryItem) => void }) {
  const [resetKey, setResetKey] = useState(0);
  const [ref, setRef] = useState<BlockReference | null>(null);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState(1);

  function submit() {
    const trimmed = query.trim();
    if (!ref && trimmed === "") return;
    const item: InventoryItem = ref ? { id: crypto.randomUUID(), qty, ref } : { id: crypto.randomUUID(), qty, label: trimmed };
    onAdd(item);
    setRef(null);
    setQuery("");
    setQty(1);
    setResetKey((k) => k + 1);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <ItemAutocomplete key={resetKey} worldSlug={worldSlug} value={ref} onChange={setRef} onQueryChange={setQuery} />
      </div>
      <input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
        aria-label="Quantité"
      />
      <button
        type="button"
        onClick={submit}
        className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter
      </button>
    </div>
  );
}

interface RollLogEntry {
  id: string;
  label: string;
  total: number;
  trace: TraceStep[];
  isCritical?: boolean;
  isCriticalFail?: boolean;
}

interface SheetApiResponse {
  sheet: DerivedSheet;
  hitDiceTotals: Record<string, number>;
  runtimeState: { state: RuntimeState; hpMax: number; hitDiceTotals: Record<string, number> };
}

/**
 * Fiche de personnage jouable (V1-B5, specs/fiche-personnage-interactive.md).
 * Remplace `CharacterSheetPreview` (V1-B4) : le calcul d'affichage en direct
 * (CA/PV max/aptitudes/choix restants) reste le meme, cote client, pour la
 * reactivite immediate (§B4 "se recalcule a chaque modification"). Tout ce
 * qui touche au jeu (attaque, sort, repos, PV courants) passe par
 * `/api/entities/[id]/actions/*` et `/api/entities/[id]/sheet` — le serveur
 * relance ses propres calculs, jamais confiance dans un nombre envoye par
 * ce composant (CLAUDE.md regle 6 : les des sont lances par le serveur).
 *
 * Decision de perimetre : aucun contexte de campagne n'est encore
 * accessible depuis la fiche du wiki (rien ne lie une page d'entite a une
 * campagne dans l'URL aujourd'hui) — `campaignId` reste `null` ici, les
 * jets sont donc des essais non enregistres (specs §A1). Le brancher sur
 * une vraie campagne est un cablage de navigation a part, pas ce ticket.
 *
 * Mise en page (V1-C4 suite, sur retour utilisateur avec captures d'ecran de
 * reference) : colonne gauche persistante (caracteristiques + competences,
 * visible quel que soit l'onglet actif) + fenetre a onglets a droite
 * (Actions/Magie/Inventaire/Traits), au lieu d'un seul bloc qui remplacait
 * tout son contenu par onglet. Empile en une colonne sous `md` pour
 * preserver la lisibilite a 375px (critere deja acquis en V1-B5).
 */
export default function PlayableCharacterSheet({
  worldSlug,
  entityId,
  character,
  inventory,
  spellcasting,
  resources,
  onUpdateCharacter,
  onUpdateInventory,
  onUpdateSpellcasting,
}: {
  worldSlug: string;
  entityId: string;
  character: CharacterBlockData;
  inventory: InventoryBlockData | undefined;
  spellcasting: SpellcastingBlockData | undefined;
  resources: ResourcesBlockData | undefined;
  onUpdateCharacter: (data: CharacterBlockData) => void;
  onUpdateInventory: (data: InventoryBlockData) => void;
  onUpdateSpellcasting: (data: SpellcastingBlockData) => void;
}) {
  const campaignId: string | null = null;
  const [tab, setTab] = useState<Tab>("actions");
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");
  const [remote, setRemote] = useState<SheetApiResponse | null>(null);
  const [rollLog, setRollLog] = useState<RollLogEntry[]>([]);
  const [pendingCrit, setPendingCrit] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpDelta, setXpDelta] = useState("");
  const [hpDelta, setHpDelta] = useState("");

  /** Onglet Traits (V1-C4 suite) : meme bloc `character` que le reste de la fiche, une seule donnee, plusieurs vues — meme motif que `onUpdateInventory`. */
  function patchCharacter(fields: Partial<CharacterBlockData>) {
    onUpdateCharacter({ ...character, ...fields });
  }

  function updateClass(index: number, patchFields: Partial<CharacterBlockData["classes"][number]>) {
    patchCharacter({ classes: character.classes.map((c, i) => (i === index ? { ...c, ...patchFields } : c)) });
  }

  function removeClass(index: number) {
    patchCharacter({ classes: character.classes.filter((_, i) => i !== index) });
  }

  function addClass() {
    patchCharacter({ classes: [...character.classes, { class: { kind: "rule", key: "" }, level: 1, subclass: null }] });
  }

  /** Onglet Inventaire (V1-C11) : cree le bloc `inventory` a la volee s'il n'existe pas encore — meme motif que `updateInventory` dans `EntityBlocks.tsx` (bootstrap-si-absent). */
  function inventoryBase(): InventoryBlockData {
    return inventory ?? { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } };
  }

  function updateInventoryItem(index: number, patch: Partial<InventoryItem>) {
    const base = inventoryBase();
    onUpdateInventory({ ...base, items: base.items.map((it, i) => (i === index ? ({ ...it, ...patch } as InventoryItem) : it)) });
  }

  function removeInventoryItem(index: number) {
    const base = inventoryBase();
    onUpdateInventory({ ...base, items: base.items.filter((_, i) => i !== index) });
  }

  function addInventoryItem(item: InventoryItem) {
    const base = inventoryBase();
    onUpdateInventory({ ...base, items: [...base.items, item] });
  }

  const speciesKey = character.species?.kind === "rule" ? character.species.key : undefined;
  const backgroundKey = character.background?.kind === "rule" ? character.background.key : undefined;
  const classSelections = useMemo(
    () =>
      character.classes
        .filter((c) => c.class.kind === "rule" && c.class.key)
        .map((c) => ({ key: (c.class as { kind: "rule"; key: string }).key, level: c.level })),
    [character.classes]
  );
  /** Sur retour utilisateur (V1-C12 suite) : la propriete d'arme "monk" n'a de sens que pour un personnage qui a des niveaux de Moine. */
  const isMonk = classSelections.some((c) => c.key === "monk");
  const equipmentKeys = useMemo(
    () => (inventory?.items ?? []).map(itemRef).filter((r): r is { kind: "rule"; key: string } => r?.kind === "rule").map((r) => r.key),
    [inventory]
  );
  const spellKeys = useMemo(
    () => (spellcasting?.known ?? []).map((k) => k.ref).filter((r): r is { kind: "rule"; key: string } => r.kind === "rule").map((r) => r.key),
    [spellcasting]
  );

  const { ruleset, remainingChoices, proficiencies, languages, equipment, weaponByKey, weight, cost, spellLevels } = useResolvedRuleset(worldSlug, {
    species: speciesKey,
    background: backgroundKey,
    classes: classSelections,
    equipmentKeys,
    spellKeys,
  });

  const carriedWeight = useMemo(() => totalCarriedWeight(inventory?.items ?? [], weight), [inventory, weight]);

  const dexScore = character.abilities.base.dex;
  const dexMod = Math.floor((dexScore - 10) / 2);

  const equippedItems: EquippedItem[] = useMemo(
    () =>
      (inventory?.items ?? []).map((item) => {
        const ref = itemRef(item);
        const armor = ref?.kind === "rule" ? equipment[ref.key] : null;
        return {
          key: item.id,
          label: itemLabel(item),
          equipped: item.equipped ?? false,
          modifiers: armor ? [armorAcModifier(armor, dexMod, `item:${item.id}`, itemLabel(item))] : [],
        };
      }),
    [inventory, equipment, dexMod]
  );

  const choiceFeatures: Record<string, ResolvedFeature> = {};
  const choiceFeatureKeys: string[] = [];
  for (const choice of remainingChoices) {
    const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
    const key = `choice:${choice.id}`;
    choiceFeatures[key] = { key, label: choice.label, source: "choice", modifiers: mapChosenSkillModifiers(chosen, choice.id, choice.label) };
    choiceFeatureKeys.push(key);
  }

  const build: CharacterBuild = {
    species: speciesKey ?? "",
    classes: character.classes
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => ({
        key: (c.class as { kind: "rule"; key: string }).key,
        level: c.level,
        subclass: c.subclass?.kind === "rule" ? c.subclass.key : undefined,
      })),
    abilities: { assigned: character.abilities.base },
    featureKeys: [...Object.keys(ruleset.features), ...choiceFeatureKeys],
  };

  const sheet = characterSheet(
    build,
    { classes: ruleset.classes, features: { ...ruleset.features, ...choiceFeatures } },
    equippedItems,
    [],
    carriedWeight
  );

  /**
   * Toutes les aptitudes accordees au personnage (V1-C9) : bundle espece,
   * bundle historique, aptitudes de classe, dons accordes par un historique
   * (V1-C8) — `ruleset.features` ne contient rien d'autre que ces familles,
   * plus besoin de filtrer par source litterale.
   */
  const traits = Object.values(ruleset.features);

  /**
   * Cle de reference reelle d'un trait (V1-C9). Les bundles espece/historique
   * portent une cle synthetique identique a leur source (`species:tiefling`),
   * pas une cle `ruleset_entries` — on retire le prefixe pour retomber sur la
   * vraie cle resolvable (`tiefling`). Aptitudes de classe et dons accordes
   * portent deja leur vraie cle dans `f.key` (`f.key !== f.source` alors).
   */
  function traitRefKey(f: ResolvedFeature): string {
    return f.key === f.source && f.source.includes(":") ? f.source.slice(f.source.indexOf(":") + 1) : f.key;
  }

  /**
   * Libelle de source d'un trait, pour affichage (V1-C9) : nom traduit de
   * l'espece/l'historique/la classe qui l'accorde plutot que le prefixe brut
   * (`species:tiefling` -> « Demi-elfe », `class:fighter` -> « Guerrier »).
   * Pour le bundle espece/historique lui-meme, source et titre coincident —
   * le SRD ne decoupe pas les traits raciaux en entrees individuelles, donc
   * pas de distinction plus fine possible avec les donnees actuelles.
   */
  function traitSourceLabel(f: ResolvedFeature): string {
    if (f.source.startsWith("class:")) return ruleset.classes[f.source.slice(6)]?.label ?? f.source;
    return ruleset.features[f.source]?.label ?? f.source;
  }

  const traitRefs = useMemo(() => traits.map((f) => ({ kind: "rule" as const, key: traitRefKey(f) })), [traits]);
  const traitChips = useReferenceChips(worldSlug, traitRefs);

  const knownSpellRefs = useMemo(
    () => (spellcasting?.known ?? []).map((k) => k.ref),
    [spellcasting]
  );
  const spellChips = useReferenceChips(worldSlug, knownSpellRefs);

  /** Tri par niveau puis ordre alphabetique (V1-C6) — niveau resolu via `spellLevels` (0 par defaut si non resolu, ex. reference cassee). */
  const sortedKnownSpells = useMemo(() => {
    return (spellcasting?.known ?? [])
      .map((known) => {
        const chip = spellChips.get(refIdentity(known.ref));
        const label = chip?.found ? chip.name : known.ref.kind === "rule" ? known.ref.key : known.ref.id;
        const level = known.ref.kind === "rule" ? spellLevels[known.ref.key] ?? 0 : 0;
        return { known, label, level };
      })
      .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  }, [spellcasting, spellChips, spellLevels]);

  const preparedSpells = sortedKnownSpells.filter((s) => s.known.ref.kind === "rule" && (spellcasting?.prepared ?? []).includes(s.known.ref.key));

  function togglePrepared(key: string) {
    if (!spellcasting) return;
    const prepared = spellcasting.prepared.includes(key)
      ? spellcasting.prepared.filter((k) => k !== key)
      : [...spellcasting.prepared, key];
    onUpdateSpellcasting({ ...spellcasting, prepared });
  }

  const buildRefs = useMemo(() => {
    const refs: BlockReference[] = [];
    if (character.species) refs.push(character.species);
    if (character.background) refs.push(character.background);
    for (const c of character.classes) {
      refs.push(c.class);
      if (c.subclass) refs.push(c.subclass);
    }
    return refs;
  }, [character.species, character.background, character.classes]);
  const buildChips = useReferenceChips(worldSlug, buildRefs);

  /** Renvois des objets d'inventaire references par une regle (onglet Inventaire, V1-C11) — nom traduit + lien de fiche pour chaque encadre. */
  const inventoryRefs = useMemo(
    () => (inventory?.items ?? []).map(itemRef).filter((r): r is BlockReference => r !== null),
    [inventory]
  );
  const itemChips = useReferenceChips(worldSlug, inventoryRefs);

  /**
   * Competences liees a un choix non resolu (V1-C4 suite, sur retour
   * utilisateur) : evite la double UI "Choix restants" + liste de
   * competences — les ronds de la liste deviennent le point d'interaction
   * unique. Filtre sur `kind` (V1-C7) : les choix de langues ont leur propre
   * liste d'options (SORTED_LANGUAGES, onglet Traits), pas la liste fixe des
   * competences — les deux ne doivent jamais se croiser dans cette map.
   */
  const skillChoices = useMemo(() => {
    const map = new Map<string, RemainingChoiceView>();
    for (const choice of remainingChoices) {
      if (choice.kind !== "skill") continue;
      for (const option of choice.options) {
        if (!map.has(option)) map.set(option, choice);
      }
    }
    return map;
  }, [remainingChoices]);

  /** Meme motif que `skillChoices`, pour les choix de langues (V1-C7) — rendu dans l'onglet Traits, a cote des langues fixes. */
  const languageChoices = useMemo(() => {
    const map = new Map<string, RemainingChoiceView>();
    for (const choice of remainingChoices) {
      if (choice.kind !== "language") continue;
      for (const option of choice.options) {
        if (!map.has(option)) map.set(option, choice);
      }
    }
    return map;
  }, [remainingChoices]);

  /** Langues fixes (espece/historique, V1-C6) + langues choisies (V1-C7) — meme liste affichee dans l'onglet Traits, source deduite du libellé du choix (« Acolyte — langues » -> « Acolyte »). */
  const allLanguages = useMemo(() => {
    const chosenGrants: TraitGrantView[] = [];
    for (const choice of new Set(languageChoices.values())) {
      const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
      const source = choice.label.replace(/ — langues$/, "");
      for (const key of chosen) {
        chosenGrants.push({ key, name: LANGUAGE_LABELS_FR[key as LanguageKey] ?? key, source });
      }
    }
    return [...languages, ...chosenGrants];
  }, [languages, languageChoices, character.choices]);

  async function reloadRemote() {
    const res = await fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId ?? ""}`);
    if (res.ok) setRemote(await res.json());
  }

  // Chargement initial en ligne (pas d'appel a reloadRemote ici) : le rendu
  // d'effet ne doit jamais appeler une fonction qui pourrait mettre a jour
  // l'etat de facon synchrone du point de vue de l'analyse statique — meme
  // motif que useReferenceChips.ts/useWorldRuleEntries.ts.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId ?? ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: SheetApiResponse | null) => {
        if (!cancelled && body) setRemote(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entityId, campaignId]);

  function pushLog(entry: Omit<RollLogEntry, "id">) {
    setRollLog((prev) => [{ ...entry, id: crypto.randomUUID() }, ...prev].slice(0, 8));
  }

  async function postAction<T>(path: string, body: unknown): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/actions/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.error ?? "Action impossible.");
        return null;
      }
      if (res.status === 204) return {} as T;
      return (await res.json()) as T;
    } finally {
      setBusy(false);
    }
  }

  async function attack(item: InventoryItem) {
    const result = await postAction<{
      weaponLabel: string;
      attack?: { total: number; isCritical: boolean; isCriticalFail: boolean; trace: TraceStep[] };
    }>("attack", { campaignId, itemId: item.id, advantage });
    if (!result?.attack) return;
    setPendingCrit((prev) => ({ ...prev, [item.id]: result.attack!.isCritical }));
    pushLog({
      label: `${result.weaponLabel} — attaque`,
      total: result.attack.total,
      trace: result.attack.trace,
      isCritical: result.attack.isCritical,
      isCriticalFail: result.attack.isCriticalFail,
    });
  }

  async function damage(item: InventoryItem, versatile: boolean) {
    const critical = pendingCrit[item.id] ?? false;
    const result = await postAction<{ weaponLabel: string; damage?: { total: number; trace: TraceStep[] } }>("damage", {
      campaignId,
      itemId: item.id,
      critical,
      versatile,
    });
    if (!result?.damage) return;
    pushLog({ label: `${result.weaponLabel} — dégâts${critical ? " (critique)" : ""}`, total: result.damage.total, trace: result.damage.trace });
  }

  async function cast(spellKey: string, spellLabel: string, slotLevel: number) {
    const result = await postAction<{ remainingSlots: number; damage?: { total: number; trace: TraceStep[] } }>("cast-spell", {
      campaignId,
      spellKey,
      slotLevel,
    });
    if (!result) return;
    pushLog({
      label: result.damage ? `${spellLabel} (niv. ${slotLevel})` : `${spellLabel} (niv. ${slotLevel}) lancé`,
      total: result.damage?.total ?? 0,
      trace: result.damage?.trace ?? [],
    });
    reloadRemote();
  }

  async function rest(kind: "short" | "long") {
    if (kind === "long") {
      await postAction("long-rest", { campaignId });
    } else {
      await postAction("short-rest", { campaignId, hitDiceSpent: {} });
    }
    reloadRemote();
  }

  /** Reflete le delta immediatement (§4.5 recalcul client) avant meme la reponse serveur — les boutons +/- semblaient lents car rien ne s'affichait avant le second aller-retour (`postAction` puis `reloadRemote`). Le serveur reste la verite : `reloadRemote()` corrige ensuite si besoin. */
  function patchRuntimeState(mutate: (state: RuntimeState) => RuntimeState) {
    setRemote((prev) => (prev ? { ...prev, runtimeState: { ...prev.runtimeState, state: mutate(prev.runtimeState.state) } } : prev));
  }

  async function changeHp(delta: number) {
    patchRuntimeState((state) => ({ ...state, hp: { ...state.hp, current: Math.max(0, state.hp.current + delta) } }));
    await postAction("hp", { campaignId, delta });
    reloadRemote();
  }

  async function changeXp(delta: number) {
    patchRuntimeState((state) => ({ ...state, xp: Math.max(0, state.xp + delta) }));
    await postAction("xp", { campaignId, delta });
    reloadRemote();
  }

  async function changeExhaustion(delta: number) {
    patchRuntimeState((state) => ({ ...state, exhaustion: Math.max(0, Math.min(6, state.exhaustion + delta)) }));
    await postAction("exhaustion", { campaignId, delta });
    reloadRemote();
  }

  /** Champ + boutons (V1-C4 suite, sur retour utilisateur) : remplace les anciens boutons a montant fixe (+100) — on tape le montant une fois, "+"/"-" l'appliquent puis vident le champ. Un champ laisse vide vaut 1 (sur retour utilisateur) plutot que de ne rien faire. */
  function applyXpDelta(sign: 1 | -1) {
    const amount = xpDelta.trim() === "" ? 1 : Math.abs(Math.trunc(Number(xpDelta)));
    if (!amount) return;
    changeXp(sign * amount);
    setXpDelta("");
  }

  /** Meme motif que `applyXpDelta` (V1-C4 suite, sur retour utilisateur) : remplace les boutons +1/-1 par un champ + boutons, coherent avec l'XP. */
  function applyHpDelta(sign: 1 | -1) {
    const amount = hpDelta.trim() === "" ? 1 : Math.abs(Math.trunc(Number(hpDelta)));
    if (!amount) return;
    changeHp(sign * amount);
    setHpDelta("");
  }

  function exportJson() {
    const a = document.createElement("a");
    a.href = `/api/entities/${entityId}/export`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function changeResource(trackerId: string, delta: number) {
    await postAction("resource", { campaignId, trackerId, delta });
    reloadRemote();
  }

  const runtimeState = remote?.runtimeState.state;
  const hpMax = remote?.runtimeState.hpMax ?? sheet.hitPoints.max;
  const equippedWeapons = (inventory?.items ?? []).filter((item) => {
    if (!item.equipped) return false;
    const ref = itemRef(item);
    return ref?.kind === "rule" && Boolean(weaponByKey[ref.key]);
  });

  const exhaustion = runtimeState?.exhaustion ?? 0;
  const hpCurrent = runtimeState?.hp.current ?? hpMax;
  const hpPct = hpMax > 0 ? Math.min(100, Math.max(0, (hpCurrent / hpMax) * 100)) : 0;
  const hpLow = hpMax > 0 && hpCurrent / hpMax <= 0.25;

  const totalLevel = Math.max(1, character.classes.reduce((sum, c) => sum + c.level, 0));
  const levelIndex = Math.min(totalLevel, XP_LEVEL_THRESHOLDS.length) - 1;
  const xpFloor = XP_LEVEL_THRESHOLDS[levelIndex] ?? 0;
  const xpCeiling = XP_LEVEL_THRESHOLDS[levelIndex + 1] ?? xpFloor;
  const xpCurrent = runtimeState?.xp ?? 0;
  const xpPct = xpCeiling > xpFloor ? Math.min(100, Math.max(0, ((xpCurrent - xpFloor) / (xpCeiling - xpFloor)) * 100)) : 100;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Espèce
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={SPECIES_TYPES}
              value={character.species?.kind === "rule" ? character.species.key : ""}
              onChange={(key) => patchCharacter({ species: ruleRef(key) })}
              emptyLabel="Aucune espèce"
              chip={character.species ? buildChips.get(refIdentity(character.species)) : undefined}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Historique
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={BACKGROUND_TYPES}
              value={character.background?.kind === "rule" ? character.background.key : ""}
              onChange={(key) => patchCharacter({ background: ruleRef(key) })}
              emptyLabel="Aucun historique"
              chip={character.background ? buildChips.get(refIdentity(character.background)) : undefined}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Genre
            <Dropdown
              value={genderDropdownValue(character.gender)}
              options={GENDER_OPTIONS}
              onChange={(v) =>
                patchCharacter({
                  gender:
                    v === "custom"
                      ? { custom: typeof character.gender === "object" ? character.gender.custom : "" }
                      : (v as Exclude<CharacterBlockData["gender"], { custom: string } | undefined>),
                })
              }
              aria-label="Genre"
            />
            {typeof character.gender === "object" && (
              <input
                value={character.gender.custom}
                onChange={(e) => patchCharacter({ gender: { custom: e.target.value } })}
                placeholder="préciser…"
                className="w-24 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
            )}
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Pronoms
            <input
              value={character.pronouns ?? ""}
              onChange={(e) => patchCharacter({ pronouns: e.target.value })}
              placeholder="elle, il, iel…"
              className="w-24 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          </label>
          <div className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Classes
            <div className="flex flex-wrap items-center gap-2">
              {character.classes.map((c, index) => {
                const classKey = c.class.kind === "rule" ? c.class.key : "";
                return (
                  <div key={index} className={`flex items-center gap-1 ${index > 0 ? "border-l border-edge/50 pl-2" : ""}`}>
                    <RuleSelect
                      worldSlug={worldSlug}
                      entryTypes={CLASS_TYPES}
                      value={classKey}
                      onChange={(key) => updateClass(index, { class: { kind: "rule", key }, subclass: null })}
                      emptyLabel="Aucune classe"
                      chip={buildChips.get(refIdentity(c.class))}
                    />
                    <input
                      type="number"
                      min={1}
                      value={c.level}
                      title="Niveau"
                      onChange={(e) => updateClass(index, { level: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-9 rounded-md border border-edge bg-transparent px-1 py-1 text-sm text-ink outline-none"
                    />
                    <RuleSelect
                      worldSlug={worldSlug}
                      entryTypes={SUBCLASS_TYPES}
                      value={c.subclass?.kind === "rule" ? c.subclass.key : ""}
                      onChange={(key) => updateClass(index, { subclass: ruleRef(key) })}
                      emptyLabel="Aucune sous-classe"
                      chip={c.subclass ? buildChips.get(refIdentity(c.subclass)) : undefined}
                      filterFn={(entry) => (classKey ? entry.parentClassKey === classKey : false)}
                    />
                    {character.classes.length > 1 && (
                      <button type="button" onClick={() => removeClass(index)} className="text-xs text-danger hover:underline">
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addClass}
                title="Ajouter une classe"
                className="rounded-full border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
              >
                +
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => rest("short")} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel disabled:opacity-50">
            Repos court
          </button>
          <button type="button" disabled={busy} onClick={() => rest("long")} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel disabled:opacity-50">
            Repos long
          </button>
          <ActionsMenu
            label="Exporter"
            triggerClassName="rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel"
            aria-label="Exporter la fiche"
            items={[
              { label: "Exporter en JSON", onSelect: exportJson },
              { label: "Exporter en PDF", onSelect: () => window.print() },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="flex h-6 items-end justify-center text-[9px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
          <div
            className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
            style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
            title="Classe d'armure — calculée automatiquement (10 + Dex + équipement)"
          >
            <span className="text-xl font-bold text-ink">{sheet.ac.value}</span>
          </div>
        </div>
        <StatBadge label="Initiative" value={`${sheet.abilities.dex.mod >= 0 ? "+" : ""}${sheet.abilities.dex.mod}`} />
        <StatBadge label="Vitesse" value={`${sheet.speed.value} m`} />
        <StatBadge label="Perception passive" value={String(10 + sheet.skills.perception.mod)} />
        <StatBadge label="Maîtrise" value={`+${sheet.proficiencyBonus}`} />
        <StatBadge label="Dés de vie" value={sheet.hitPoints.hitDice} />
        <div className="flex w-[6.5rem] shrink-0 flex-col items-center gap-1">
          <span
            className={`flex h-6 items-end justify-center text-center text-[9px] font-bold uppercase leading-tight tracking-widest ${
              exhaustion > 0 ? "text-danger" : "text-ink-muted"
            }`}
          >
            Épuisement
          </span>
          <div
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-full border px-1.5 ${
              exhaustion > 0 ? "border-danger/60 bg-danger/10" : "border-edge bg-panel-raised"
            }`}
          >
            <button
              type="button"
              disabled={busy || exhaustion <= 0}
              onClick={() => changeExhaustion(-1)}
              className="rounded-full border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-30"
            >
              −
            </button>
            <span className={`text-base font-semibold ${exhaustion > 0 ? "text-danger" : "text-ink"}`}>{exhaustion}</span>
            <button
              type="button"
              disabled={busy || exhaustion >= 6}
              onClick={() => changeExhaustion(1)}
              className="rounded-full border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          <span>Points de vie</span>
          <span className={hpLow ? "text-danger" : "text-ink-muted"}>
            {hpCurrent}/{hpMax}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-sunken">
            <div className={`h-full rounded-full transition-[width] ${hpLow ? "bg-danger" : "bg-accent"}`} style={{ width: `${hpPct}%` }} />
          </div>
          <input
            type="number"
            value={hpDelta}
            onChange={(e) => setHpDelta(e.target.value)}
            placeholder="1"
            className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
          <button type="button" disabled={busy} onClick={() => applyHpDelta(-1)} className="rounded border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-50">
            −
          </button>
          <button type="button" disabled={busy} onClick={() => applyHpDelta(1)} className="rounded border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-50">
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-b border-edge/60 pb-3">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          <span>Expérience</span>
          <span>
            {xpCurrent} XP{totalLevel < XP_LEVEL_THRESHOLDS.length ? ` · niveau ${totalLevel + 1} à ${xpCeiling}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-sunken">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${xpPct}%` }} />
          </div>
          <input
            type="number"
            value={xpDelta}
            onChange={(e) => setXpDelta(e.target.value)}
            placeholder="1"
            className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
          <button type="button" disabled={busy} onClick={() => applyXpDelta(-1)} className="rounded border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-50">
            −
          </button>
          <button type="button" disabled={busy} onClick={() => applyXpDelta(1)} className="rounded border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-50">
            +
          </button>
        </div>
      </div>

      {sheet.warnings.length > 0 && (
        <div className="rounded-md border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
          <p className="font-semibold">Personnage illégal — enregistrable quand même :</p>
          <ul className="list-inside list-disc">
            {sheet.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-col gap-4 md:flex-row">
        <aside className="flex flex-col gap-3 md:w-48 md:shrink-0">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Caractéristiques</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => {
                const save = sheet.savingThrows[ability];
                return (
                  <div key={ability} className="flex flex-col items-center gap-1 rounded-lg border border-edge/60 bg-panel-raised px-2 py-2.5 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{ABILITY_LABELS[ability]}</span>
                    <span className="text-xl font-bold text-ink">
                      {sheet.abilities[ability].mod >= 0 ? "+" : ""}
                      {sheet.abilities[ability].mod}
                    </span>
                    <input
                      type="number"
                      value={character.abilities.base[ability]}
                      onChange={(e) =>
                        patchCharacter({
                          abilities: {
                            ...character.abilities,
                            base: { ...character.abilities.base, [ability]: Number(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-10 rounded-full border border-edge bg-panel-sunken px-1 py-0.5 text-center text-xs text-ink-muted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span
                      className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        save.proficient ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${save.proficient ? "bg-accent" : "bg-edge"}`} aria-hidden="true" />
                      Sauv. {save.mod >= 0 ? "+" : ""}
                      {save.mod}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
              Compétences · maîtrise {sheet.proficiencyBonus >= 0 ? "+" : ""}
              {sheet.proficiencyBonus}
            </span>
            {remainingChoices.some((c) => c.kind === "skill") && (
              <div className="flex flex-col gap-0.5">
                {remainingChoices
                  .filter((c) => c.kind === "skill")
                  .map((choice) => {
                    const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
                    return (
                      <p key={choice.id} className="text-xs text-ink-muted">
                        {choice.label} : {chosen.length}/{choice.count} choisie(s) — cliquez les ronds clairs ci-dessous
                      </p>
                    );
                  })}
              </div>
            )}
            <div className="flex flex-col gap-1">
              {SORTED_SKILLS.map((skill) => {
                const result = sheet.skills[skill];
                const choice = skillChoices.get(skill);
                const chosenForChoice = choice ? ((character.choices[choice.id] as string[] | undefined) ?? []) : [];
                const isChosen = choice ? chosenForChoice.includes(skill) : false;
                const canPick = choice ? isChosen || chosenForChoice.length < choice.count : false;

                function toggle() {
                  if (!choice) return;
                  patchCharacter({ choices: { ...character.choices, [choice.id]: toggleChoice(chosenForChoice, skill, choice.count) } });
                }

                const dotClass = choice
                  ? isChosen
                    ? "bg-accent"
                    : canPick
                      ? "border-2 border-ink bg-transparent"
                      : "border border-edge bg-transparent opacity-40"
                  : result.proficiency === "expertise"
                    ? "bg-accent"
                    : result.proficiency === "proficient"
                      ? "border border-accent bg-accent/40"
                      : "border border-edge bg-transparent";

                const dotTitle = choice
                  ? isChosen
                    ? `${choice.label} — choisie, cliquer pour retirer`
                    : canPick
                      ? `${choice.label} — cliquer pour choisir (${chosenForChoice.length}/${choice.count})`
                      : `${choice.label} — choix déjà complet (${choice.count}/${choice.count})`
                  : result.proficiency === "expertise"
                    ? "Expertise"
                    : result.proficiency === "proficient"
                      ? "Maîtrisée"
                      : "Non maîtrisée";

                return (
                  <div key={skill} className="flex items-center gap-2 text-sm">
                    {choice ? (
                      <button
                        type="button"
                        onClick={toggle}
                        disabled={!canPick}
                        title={dotTitle}
                        className="flex h-4 w-4 shrink-0 items-center justify-center disabled:cursor-not-allowed"
                      >
                        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                      </button>
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center" title={dotTitle}>
                        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                      </span>
                    )}
                    <span className="flex-1 text-ink">{SKILL_LABELS_FR[skill]}</span>
                    <span className="text-[10px] uppercase text-ink-muted">{ABILITY_LABELS[SKILL_ABILITIES[skill]]}</span>
                    <span className="w-8 text-right font-medium text-ink">
                      {result.mod >= 0 ? "+" : ""}
                      {result.mod}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">Points de vie</span>
            <Dropdown
              value={character.hp_method}
              options={[
                { value: "fixed", label: "Valeur fixe" },
                { value: "rolled", label: "Jetés" },
              ]}
              onChange={(v) => patchCharacter({ hp_method: v as CharacterBlockData["hp_method"] })}
              aria-label="Méthode de points de vie"
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex gap-1 border-b border-edge/60 text-xs">
            {(["actions", "magie", "inventaire", "traits"] as Tab[])
              .filter((t) => t !== "magie" || spellcasting)
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-t-md px-3 py-1.5 capitalize transition-colors ${
                    tab === t ? "border-b-2 border-accent text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
          </div>

          {tab === "actions" && (
            <div className="flex flex-col gap-3 pt-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-ink-muted">Prochain jet :</span>
                {(["disadvantage", "normal", "advantage"] as AdvantageState[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAdvantage(a)}
                    className={`rounded-full border px-2 py-0.5 ${advantage === a ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
                  >
                    {a === "normal" ? "normal" : a === "advantage" ? "avantage" : "désavantage"}
                  </button>
                ))}
              </div>

              {equippedWeapons.length === 0 && <p className="text-sm text-ink-muted">Aucune arme équipée.</p>}
              {equippedWeapons.map((item) => {
                const ref = itemRef(item);
                const weapon = ref?.kind === "rule" ? weaponByKey[ref.key] : null;
                return (
                  <ItemCard
                    key={item.id}
                    worldSlug={worldSlug}
                    item={item}
                    chip={ref ? itemChips.get(refIdentity(ref)) : undefined}
                    weapon={weapon}
                    armor={null}
                    weightLb={null}
                    cost={null}
                    strMod={sheet.abilities.str.mod}
                    dexMod={sheet.abilities.dex.mod}
                    proficiencyBonus={sheet.proficiencyBonus}
                    isMonk={isMonk}
                    collapsible={false}
                    busy={busy}
                    onAttack={() => attack(item)}
                    onDamage={(versatile) => damage(item, versatile)}
                  />
                );
              })}

              {spellcasting && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Sorts préparés</span>
                  {preparedSpells.length === 0 && (
                    <p className="text-sm text-ink-muted">Aucun sort préparé — sélectionnez-les dans l&apos;onglet Magie.</p>
                  )}
                  {preparedSpells.map(({ known, label }) => (
                    <div key={refIdentity(known.ref)} className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 px-2.5 py-1.5 text-sm">
                      <span className="flex-1 text-ink">{label}</span>
                      {Object.entries(sheet.spellcasting?.slots ?? {}).map(([level, total]) => {
                        const used = runtimeState?.spell_slots_used[level] ?? 0;
                        const available = total - used > 0;
                        return (
                          <button
                            key={level}
                            type="button"
                            disabled={busy || !available}
                            title={available ? `Lancer au niveau ${level}` : "Aucun emplacement disponible"}
                            onClick={() => known.ref.kind === "rule" && cast(known.ref.key, label, Number(level))}
                            className="rounded-full border border-edge px-2 py-0.5 text-xs disabled:opacity-30"
                          >
                            niv. {level} ({Math.max(0, total - used)}/{total})
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {(resources?.trackers.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Ressources</span>
                  {resources!.trackers.map((tracker) => {
                    const max = resourceMax(tracker);
                    const used = runtimeState?.resources[tracker.id] ?? 0;
                    return (
                      <div key={tracker.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 text-ink">{tracker.label}</span>
                        <span className="text-ink-muted">
                          {Math.max(0, max - used)}/{max} · {RECHARGE_LABELS[tracker.recharge] ?? tracker.recharge}
                        </span>
                        <button type="button" disabled={busy || used >= max} onClick={() => changeResource(tracker.id, 1)} className="rounded border border-edge px-1.5 text-xs disabled:opacity-50">
                          utiliser
                        </button>
                        <button type="button" disabled={busy || used <= 0} onClick={() => changeResource(tracker.id, -1)} className="rounded border border-edge px-1.5 text-xs disabled:opacity-50">
                          annuler
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {rollLog.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-md border border-edge/60 bg-panel-sunken p-2">
                  {rollLog.map((entry) => (
                    <div key={entry.id} className="text-xs">
                      <p className="text-ink">
                        <span className="font-semibold">{entry.label} : {entry.total}</span>
                        {entry.isCritical && <span className="ml-1 text-accent">critique !</span>}
                        {entry.isCriticalFail && <span className="ml-1 text-danger">échec critique</span>}
                      </p>
                      {entry.trace.length > 0 && <p className="text-ink-muted">{entry.trace.map((s) => s.text).join(" ; ")}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "magie" && spellcasting && (
            <div className="flex flex-col gap-2 pt-3">
              <p className="text-[10px] italic text-ink-muted">
                Sorts connus, triés par niveau. Cochez « Préparé » pour les retrouver dans l&apos;onglet Actions.
              </p>
              {sortedKnownSpells.map(({ known, label, level }) => (
                <div key={refIdentity(known.ref)} className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 px-2.5 py-1.5 text-sm">
                  <span className="w-10 shrink-0 text-xs text-ink-muted">{level === 0 ? "Tour" : `Niv. ${level}`}</span>
                  <span className="flex-1 text-ink">{label}</span>
                  <label className="flex items-center gap-1 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={known.ref.kind === "rule" && spellcasting.prepared.includes(known.ref.key)}
                      onChange={() => known.ref.kind === "rule" && togglePrepared(known.ref.key)}
                    />
                    Préparé
                  </label>
                </div>
              ))}
              {sortedKnownSpells.length === 0 && <p className="text-sm text-ink-muted">Aucun sort connu.</p>}
            </div>
          )}

          {tab === "inventaire" && (
            <div className="flex flex-col gap-3 pt-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                  <span>Charge</span>
                  <span className={sheet.encumbrance.tier !== "none" ? "text-danger" : "text-ink-muted"}>
                    {lbToKg(sheet.encumbrance.carried)}/{lbToKg(sheet.encumbrance.capacity)} kg
                    {sheet.encumbrance.tier === "encumbered" && " · Encombré (vitesse −10)"}
                    {sheet.encumbrance.tier === "heavily_encumbered" && " · Lourdement encombré (vitesse −20, désavantage FOR/DEX/CON)"}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-panel-sunken">
                  <div
                    className={`h-full rounded-full transition-[width] ${sheet.encumbrance.tier !== "none" ? "bg-danger" : "bg-accent"}`}
                    style={{
                      width: `${Math.min(100, sheet.encumbrance.capacity > 0 ? (sheet.encumbrance.carried / sheet.encumbrance.capacity) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {(["pp", "gp", "ep", "sp", "cp"] as const).map((coin) => (
                  <label key={coin} className="flex flex-col gap-1 text-xs text-ink-muted">
                    {CURRENCY_LABELS_FR[coin]}
                    <input
                      type="number"
                      min={0}
                      value={inventory?.currency[coin] ?? 0}
                      onChange={(e) => {
                        const base = inventoryBase();
                        onUpdateInventory({ ...base, currency: { ...base.currency, [coin]: Number(e.target.value) || 0 } });
                      }}
                      className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                    />
                  </label>
                ))}
              </div>

              <AddItemRow worldSlug={worldSlug} onAdd={addInventoryItem} />

              <div className="flex flex-col gap-2">
                {(inventory?.items ?? []).map((item, index) => {
                  const ref = itemRef(item);
                  const weapon = ref?.kind === "rule" ? weaponByKey[ref.key] : null;
                  const armor = ref?.kind === "rule" ? equipment[ref.key] : null;
                  return (
                    <ItemCard
                      key={item.id}
                      worldSlug={worldSlug}
                      item={item}
                      chip={ref ? itemChips.get(refIdentity(ref)) : undefined}
                      weapon={weapon}
                      armor={armor}
                      weightLb={ref?.kind === "rule" ? (weight[ref.key] ?? null) : null}
                      cost={ref?.kind === "rule" ? (cost[ref.key] ?? null) : null}
                      strMod={sheet.abilities.str.mod}
                      dexMod={sheet.abilities.dex.mod}
                      proficiencyBonus={sheet.proficiencyBonus}
                      isMonk={isMonk}
                      collapsible={true}
                      busy={busy}
                      onAttack={item.equipped && weapon ? () => attack(item) : undefined}
                      onDamage={item.equipped && weapon ? (versatile) => damage(item, versatile) : undefined}
                      onToggleEquipped={() => updateInventoryItem(index, { equipped: !item.equipped })}
                      onChangeQty={(qty) => updateInventoryItem(index, { qty })}
                      onRemove={() => removeInventoryItem(index)}
                    />
                  );
                })}
                {(inventory?.items.length ?? 0) === 0 && <p className="text-sm text-ink-muted">Aucun objet pour l&apos;instant.</p>}
              </div>
            </div>
          )}

          {tab === "traits" && (
            <div className="flex flex-col gap-1 pt-3 text-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Aptitudes accordées</span>
              {traits.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {traits.map((f) => {
                    const chip = traitChips.get(refIdentity({ kind: "rule", key: traitRefKey(f) }));
                    return (
                      <div key={f.key} className="rounded-md border border-edge/60 bg-panel-raised p-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          {chip?.found ? (
                            <Link
                              href={chip.href}
                              className="text-sm font-semibold no-underline hover:underline"
                              style={{ color: "var(--link-rule)" }}
                            >
                              {chip.name}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold italic text-ink-muted">{f.label}</span>
                          )}
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">{traitSourceLabel(f)}</span>
                        </div>
                        {chip?.found && chip.summary && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{chip.summary}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Aucune aptitude accordée pour l&apos;instant.</p>
              )}

              <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-ink-muted">Maîtrises</span>
              {proficiencies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {proficiencies.map((p) => (
                    <span
                      key={`${p.source}:${p.key}`}
                      title={`Source : ${p.source}`}
                      className="inline-flex items-center gap-1 rounded-full border border-edge px-2 py-0.5 text-sm text-ink"
                    >
                      {p.name}
                      <span className="text-[10px] text-ink-muted">· {p.source}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Aucune maîtrise d&apos;armure/arme/outil pour l&apos;instant.</p>
              )}

              <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-ink-muted">Langues</span>
              {[...new Set(languageChoices.values())].map((choice) => {
                const chosenForChoice = (character.choices[choice.id] as string[] | undefined) ?? [];
                return (
                  <div key={choice.id} className="flex flex-col gap-1">
                    <p className="text-xs text-ink-muted">
                      {choice.label} : {chosenForChoice.length}/{choice.count} choisie(s) — cliquez pour choisir
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SORTED_LANGUAGES.map((lang) => {
                        const isChosen = chosenForChoice.includes(lang);
                        const canPick = isChosen || chosenForChoice.length < choice.count;
                        return (
                          <button
                            key={lang}
                            type="button"
                            disabled={!canPick}
                            onClick={() =>
                              patchCharacter({
                                choices: { ...character.choices, [choice.id]: toggleChoice(chosenForChoice, lang, choice.count) },
                              })
                            }
                            className={`rounded-full border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              isChosen ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                            }`}
                          >
                            {LANGUAGE_LABELS_FR[lang]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {allLanguages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allLanguages.map((l) => (
                    <span
                      key={`${l.source}:${l.key}`}
                      title={`Source : ${l.source}`}
                      className="inline-flex items-center gap-1 rounded-full border border-edge px-2 py-0.5 text-sm text-ink"
                    >
                      {l.name}
                      <span className="text-[10px] text-ink-muted">· {l.source}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Aucune langue accordée sans choix pour l&apos;instant.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
