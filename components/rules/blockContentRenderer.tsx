import type { ReactNode } from "react";
import Link from "next/link";
import { formatFormulaNode } from "@/src/core/formula";
import type {
  ActionsBlockData,
  ArmorBlockData,
  BlockType,
  ChargesBlockData,
  ClassBasicsBlockData,
  ClassProgressionBlockData,
  ConditionEffectsBlockData,
  CustomTableBlockData,
  DescriptionBlockData,
  EffectsBlockData,
  LegendaryActionsBlockData,
  ModifiersBlockData,
  PrerequisitesBlockData,
  ScalingBlockData,
  SpellCastingBlockData,
  SpellcastingProgressionBlockData,
  StatBlockBlockData,
  SubclassFeaturesBlockData,
  TraitsBlockData,
} from "@/src/core/schemas/rule-blocks";
import {
  ALIGNMENT_WORD_LABELS_FR,
  ARMOR_CATEGORY_LABELS_FR,
  CLASS_PROFICIENCY_LABELS_FR,
  CONDITION_LABELS_FR,
  CREATURE_TYPE_LABELS_FR,
  CURRENCY_LABELS_FR,
  DAMAGE_QUALIFIER_LABELS_FR,
  DAMAGE_TYPE_LABELS_FR,
  ITEM_RARITY_LABELS_FR,
  LANGUAGE_LABELS_FR,
  MAGIC_SCHOOL_LABELS_FR,
  MODIFIER_OP_LABELS_FR,
  modifierTargetLabel,
  SENSE_LABELS_FR,
  SIZE_LABELS_FR,
  SKILL_LABELS_FR,
  SPEED_LABELS_FR,
} from "@/src/i18n/fr";
import type { Skill } from "@/src/core/rules/sheet";
import { modifierOpNeedsValue } from "@/src/core/rules/modifierTargets";
import type { LanguageKey } from "@/src/core/rules/srdMapping";
import { ftToM, lbToKg } from "@/src/core/rules/encumbrance";
import MonsterRollButton from "./MonsterRollButton";
import Dropdown from "@/components/shared/Dropdown";
import type {
  ResolvedBackgroundBlockData,
  ResolvedBackgroundEquipmentOption,
  ResolvedClassEquipmentBlockData,
  ResolvedItemPropertiesBlockData,
  ResolvedSpeciesTraitsBlockData,
  ResolvedSubclassSlotBlockData,
  ResolvedWeaponBlockData,
  RuleRefView,
} from "@/src/server/services/rules";
import Chips from "./layouts/Chips";
import FormulaList from "./layouts/FormulaList";
import KeyValues from "./layouts/KeyValues";
import Prose, { renderMarkdownBoldText } from "./layouts/Prose";
import ProgressionTable from "./layouts/ProgressionTable";
import Table from "./layouts/Table";

/** `str`/`dex`/... -> abreviation FR (V1-D1). Concern d'affichage local a ce fichier, pas une donnee de domaine partagee — pas de raison de la faire vivre ailleurs. */
const ABILITY_ABBR_FR: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };
function abilityLabel(key: string): string {
  return ABILITY_ABBR_FR[key] ?? key.toUpperCase();
}

/** `EffectData.save.effect_on_success`/`ItemSaveData.effect_on_success` (V1-D1) — 3 valeurs vues sur le contenu importe (`none`/`half`/`other`), jamais traduites jusqu'ici : la fiche affichait le mot anglais brut. */
const EFFECT_ON_SUCCESS_LABELS_FR: Record<string, string> = { none: "aucun effet", half: "moitie degats", other: "autre effet" };
function effectOnSuccessLabel(value: string): string {
  return EFFECT_ON_SUCCESS_LABELS_FR[value] ?? value;
}

/**
 * Poids (lb) et distances (ft) du SRD converties en unites metriques a
 * l'affichage (V1-D7, sur retour utilisateur : "il faudrait que les poids
 * soient en kilogramme... pareil pour les mesures de distances") — meme
 * conversion que l'onglet Inventaire (`lbToKg`, deja demandee et posee la
 * pour cette meme raison), etendue ici a `ftToM` pour la portee d'arme.
 * La donnee stockee reste en unites SRD (lb/ft) ; seule cette fonction
 * d'affichage change. Toute autre unite (rare, ex. gp deja gere a part par
 * `costText`) passe telle quelle.
 */
function quantityText(q: { value: number; unit: string } | undefined): string | undefined {
  if (!q) return undefined;
  if (q.unit === "lb") return `${lbToKg(q.value)} kg`;
  if (q.unit === "ft") return `${ftToM(q.value)} m`;
  return `${q.value} ${q.unit}`;
}

/** Cout en pieces (V1-D1) -> memes abreviations FR que l'onglet Inventaire (V1-C11), au lieu des codes SRD bruts (gp/sp/...). */
function costText(cost: { value: number; unit: string } | undefined): string | undefined {
  return cost ? `${cost.value} ${CURRENCY_LABELS_FR[cost.unit] ?? cost.unit}` : undefined;
}

/**
 * Type de degats brut -> libelle FR (V1-D7, decouvert sur Arme). Deux
 * formats coexistent selon le bloc, verifie dans scripts/ingest-srd.ts :
 * `weapon.damage.type` stocke l'index SRD en minuscules ("piercing"), tandis
 * que `effects[].damage_type` et `actions[].damage[].type` stockent le nom
 * anglais capitalise ("Piercing") — mise en minuscules avant recherche
 * plutot que deux tables, meme jeu de 13 valeurs des deux cotes.
 */
function damageTypeLabel(type: string): string {
  return DAMAGE_TYPE_LABELS_FR[type.toLowerCase()] ?? type;
}

/**
 * `stat_block.damage_resistances`/`damage_vulnerabilities`/`damage_immunities`
 * (V1-E4 retour utilisateur) : chaque entree est soit un type de degats
 * simple ("lightning", deja couvert par `DAMAGE_TYPE_LABELS_FR`), soit une
 * phrase composee ("bludgeoning, piercing, and slashing from nonmagical
 * weapons", couverte par `DAMAGE_QUALIFIER_LABELS_FR` — les 7 variantes qui
 * existent dans le SRD 5.1). Le texte brut reste affiche si aucune des deux
 * tables ne correspond, plutot que d'inventer une traduction.
 */
function damageQualifierLabel(raw: string): string {
  const lower = raw.toLowerCase();
  return DAMAGE_TYPE_LABELS_FR[lower] ?? DAMAGE_QUALIFIER_LABELS_FR[lower] ?? raw;
}

/** `stat_block.condition_immunities` (V1-E4 retour utilisateur) -> libelle FR, memes 15 conditions que la barre laterale "CONDITION". */
function conditionLabel(raw: string): string {
  return CONDITION_LABELS_FR[raw] ?? raw;
}

/** `background.skill_proficiencies` (V1-D7, cles `Skill` snake_case) -> libelle FR, meme table que la fiche de personnage. */
function skillLabel(key: string): string {
  return SKILL_LABELS_FR[key as Skill] ?? key;
}

/**
 * `stat_block.skills[].name` (V1-E4 retour utilisateur point 3) n'est pas
 * une cle `Skill` snake_case comme `background.skill_proficiencies` : c'est
 * le libelle anglais brut du SRD, prefixe "Skill: " inclus (verifie dans
 * data/srd/srd-2014.json — le champ `proficiency.name` porte litteralement
 * "Skill: Perception"). On retire ce prefixe puis on normalise vers la
 * meme forme snake_case que `SKILL_LABELS_FR` avant de chercher le libelle.
 */
function monsterSkillLabel(raw: string): string {
  const stripped = raw.replace(/^Skill:\s*/i, "");
  const key = stripped.toLowerCase().replace(/\s+/g, "_") as Skill;
  return SKILL_LABELS_FR[key] ?? stripped;
}

/**
 * Convertit chaque occurrence "N ft." d'un texte en metres (V1-E4 retour
 * utilisateur point 4) — meme conversion que `quantityText` (`ftToM`),
 * etendue ici a des champs de texte libre (`speed`/`senses`/`languages` du
 * `stat_block`) plutot qu'a une `Quantity` structuree.
 */
function metricizeFeet(text: string): string {
  return text.replace(/(\d+(?:\.\d+)?)\s*ft\.?/gi, (_, n: string) => `${ftToM(Number(n))} m`);
}

/**
 * `stat_block.languages` (V1-E4 retour utilisateur point 3) est un texte
 * libre du SRD ("Deep Speech, telepathy 120 ft."), jamais une liste de
 * `LanguageKey` structuree — impossible a traduire par une simple recherche
 * de cle. On remplace les noms de langue connus (memes 16 valeurs que
 * `LANGUAGE_LABELS_FR`) et "telepathy" par leur forme FR, puis on convertit
 * les distances. Toute prose non reconnue (rare, quelques monstres a
 * langage particulier) reste en anglais plutot que d'inventer une
 * traduction — CLAUDE.md, contenu jamais invente.
 */
const LANGUAGE_EN_TO_FR: [string, string][] = (Object.keys(LANGUAGE_LABELS_FR) as LanguageKey[])
  .map((key): [string, string] => [
    key
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    LANGUAGE_LABELS_FR[key],
  ])
  .sort((a, b) => b[0].length - a[0].length);

function translateLanguagesText(text: string): string {
  let result = metricizeFeet(text);
  for (const [en, fr] of LANGUAGE_EN_TO_FR) {
    result = result.replace(new RegExp(`\\b${en}\\b`, "g"), fr);
  }
  return result.replace(/\btelepathy\b/gi, "télépathie");
}

/**
 * `stat_block.alignment` (V1-E4 retour utilisateur — badge "Alignement")
 * n'est pas non plus une valeur fermee : "lawful evil", "unaligned", mais
 * aussi "any non-good alignment" ou "neutral good (50%) or neutral evil
 * (50%)". Substitution mot a mot (`ALIGNMENT_WORD_LABELS_FR`) plutot qu'une
 * table de correspondance exacte — donne le meme resultat sur les neuf
 * alignements simples ("lawful evil" -> "loyal mauvais") et reste lisible
 * sur les formulations composees, sans jamais inventer de texte absent de
 * la source (CLAUDE.md).
 */
function alignmentLabel(raw: string): string {
  return raw
    .split(/([\s-]+)/)
    .map((token) => ALIGNMENT_WORD_LABELS_FR[token.toLowerCase()] ?? token)
    .join("");
}

/**
 * Meme alignement, en lignes empilables dans le badge (V1-E4 retour
 * utilisateur : « tu peux superposer les deux caracteristiques d'alignement
 * comme tu l'as fait pour la vitesse ? ») — une ligne par mot separe par un
 * espace dans la source ("lawful evil" -> "loyal"/"mauvais" sur deux lignes),
 * chaque mot traduit via `alignmentLabel`. Un alignement a un seul mot
 * ("unaligned") reste sur une seule ligne.
 */
function alignmentLines(raw: string): string[] {
  return raw.split(/\s+/).map((token) => alignmentLabel(token));
}


function localizedLabel(label: Record<string, string>, fallbackKey: string): string {
  return label.fr ?? label.en ?? Object.values(label)[0] ?? fallbackKey;
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  // "true"/"false" ne se seraient jamais affiches traduits (retour
  // utilisateur, V2-G1 : meme categorie de bug que les libelles anglais
  // deja corriges ailleurs) — un booleen dans une table (ex.
  // `weapon_mastery_melee_only`) est toujours une reponse oui/non, jamais
  // du texte a afficher tel quel.
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function SpellCasting({ data }: { data: SpellCastingBlockData }) {
  const items = [
    { label: "Niveau", value: data.level === 0 ? "Tour de magie" : String(data.level) },
    { label: "Ecole", value: MAGIC_SCHOOL_LABELS_FR[data.school] ?? data.school },
    { label: "Temps d'incantation", value: data.casting_time },
    { label: "Portee", value: data.range },
    {
      label: "Composantes",
      value: data.material ? `${data.components.join(", ")} (${data.material})` : data.components.join(", "),
    },
    { label: "Duree", value: data.concentration ? `${data.duration} (concentration)` : data.duration },
    { label: "Rituel", value: data.ritual ? "Oui" : "Non" },
  ];
  return <KeyValues items={items} />;
}

function Effects({ data }: { data: EffectsBlockData }) {
  const items = data.effects.map((effect) => ({
    id: effect.id,
    trigger: effect.trigger,
    damageType: effect.damage_type ? damageTypeLabel(effect.damage_type) : undefined,
    formulaText: effect.formula ? formatFormulaNode(effect.formula) : undefined,
    save: effect.save
      ? {
          ability: abilityLabel(effect.save.ability),
          effectOnSuccess: effect.save.effect_on_success ? effectOnSuccessLabel(effect.save.effect_on_success) : undefined,
        }
      : undefined,
  }));
  return <FormulaList items={items} />;
}

function Scaling({ data }: { data: ScalingBlockData }) {
  const rows = Object.entries(data.table ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([level, value]) => [
      { key: "level", value: level },
      { key: "value", value: <span className="mech">{value}</span> },
    ]);
  return (
    <ProgressionTable
      columns={[
        { key: "level", label: "Niveau", align: "center" },
        { key: "value", label: "Valeur", align: "center" },
      ]}
      rows={rows}
    />
  );
}

/**
 * Chaque grant lie vers sa propre fiche, avec `data-ref-path` identique au
 * chemin produit par extractDerivedRefs (src/core/rules/refs.ts) — c'est ce
 * que RefPathHighlighter cherche pour surligner l'element exact quand on
 * suit un renvoi entrant (V1-A3). Le nom affiche vient de outgoingRefs
 * (deja resolu par le service, traduction comprise) plutot que de la cle
 * brute — meme donnee que le panneau de renvois, pas de deuxieme resolution.
 */
function grantsCell(
  value: unknown,
  columnKey: string,
  level: unknown,
  worldSlug: string,
  refsByKey: Map<string, RuleRefView>
): ReactNode {
  if (!Array.isArray(value)) return "";
  const items = value
    .map((g, i) => {
      if (!g || typeof g !== "object") return null;
      const feature = (g as { feature?: unknown }).feature;
      const choice = (g as { choice?: unknown }).choice;
      if (typeof feature === "string") {
        const path = `blocks.class_progression.rows[${String(level)}].${columnKey}[${i}]`;
        const ref = refsByKey.get(feature);
        return (
          <Link key={i} href={`/m/${worldSlug}/regles/${feature}`} data-ref-path={path} className="hover:underline">
            {ref?.name ?? feature}
          </Link>
        );
      }
      if (typeof choice === "string") return <span key={i}>{choice}</span>;
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return items.flatMap((item, i) => (i === 0 ? [item] : [<span key={`sep-${i}`}>, </span>, item]));
}

function progressionCell(
  kind: string,
  value: unknown,
  columnKey: string,
  level: unknown,
  worldSlug: string,
  refsByKey: Map<string, RuleRefView>
): ReactNode {
  if (kind === "grants") return grantsCell(value, columnKey, level, worldSlug, refsByKey);
  if (kind === "formula" || kind === "value") return <span className="mech">{cellValue(value)}</span>;
  return cellValue(value);
}

function ClassProgression({
  data,
  worldSlug,
  outgoingRefs,
}: {
  data: ClassProgressionBlockData;
  worldSlug: string;
  outgoingRefs: RuleRefView[];
}) {
  const refsByKey = new Map(outgoingRefs.map((r) => [r.key, r]));
  const columns = data.columns.map((col) => {
    // Colonnes d'emplacement de sort ("spellcasting_spell_slots_level_N",
    // scripts/ingest-srd.ts) regroupees sous un seul en-tete "Emplacements"
    // avec un sous-libelle court par niveau (V1-D7, retour utilisateur :
    // la table etait trop large avec "Emplacements niv. N" repete sur
    // chaque colonne) — detecte sur la cle, jamais stocke ainsi.
    const slotMatch = col.key.match(/^spellcasting_spell_slots_level_(\d)$/);
    return {
      key: col.key,
      label: slotMatch ? `Niv. ${slotMatch[1]}` : localizedLabel(col.label, col.key),
      group: slotMatch ? "Emplacements" : undefined,
      // Valeurs numeriques centrees sous leur en-tete (V1-D7, retour
      // utilisateur) ; "grants" reste a gauche, une liste de liens de
      // longueur variable ne se centre pas lisiblement.
      align: (col.kind === "grants" ? "left" : "center") as "left" | "center",
    };
  });
  const rows = data.rows.map((row) =>
    data.columns.map((col) => ({
      key: col.key,
      value: progressionCell(col.kind, row[col.key], col.key, row.level, worldSlug, refsByKey),
    }))
  );
  return <ProgressionTable columns={columns} rows={rows} />;
}

function CustomTable({ data }: { data: CustomTableBlockData }) {
  const rows = data.rows.map((row) => {
    const stringRow: Record<string, string> = {};
    for (const col of data.columns) stringRow[col] = cellValue(row[col]);
    return stringRow;
  });
  return <Table columns={data.columns} rows={rows} />;
}

// --- V1-D1 : les onze blocs restants du catalogue, meme motif que ci-dessus
// (chaque fonction traduit un bloc type vers la forme generique attendue par
// sa mise en page — jamais un nouveau composant). -------------------------

/**
 * Un renvoi clique vers sa propre fiche (V1-D7, retour utilisateur —
 * proprietes/botte d'arme, traits d'espece, deja des fiches `feature`
 * existantes, jamais dupliquees ici). Taille de police explicite plutot
 * qu'heritee du conteneur (V1-D7, retour utilisateur : "la taille des
 * textes n'est pas coherente") — ce composant s'utilise tantot dans une
 * grille `KeyValues` (qui impose `text-xs` via `dd`), tantot dans un simple
 * `<div>` (`SpeciesTraits`, sans ce cadre) : sans classe a lui, le meme
 * composant rendait a deux tailles differentes selon l'appelant.
 */
function ResolvedRefLink({ worldSlug, refItem }: { worldSlug: string; refItem: { key: string; resolved_name: string } }) {
  return (
    <Link
      href={`/m/${worldSlug}/regles/${refItem.key}`}
      className="text-xs font-bold uppercase tracking-wide hover:underline"
      style={{ color: "var(--link-rule)" }}
    >
      {refItem.resolved_name}
    </Link>
  );
}

/** Nom (lien) + texte complet d'une propriete/botte d'arme ou d'un trait d'espece (V1-D7, retour utilisateur : "il faut que ce soit directement visible sur la fiche", meme motif que le Don d'un `background`). */
function ResolvedRefDetail({ worldSlug, refItem }: { worldSlug: string; refItem: { key: string; resolved_name: string; resolved_description: string } }) {
  return (
    <div className="flex flex-col gap-1">
      <ResolvedRefLink worldSlug={worldSlug} refItem={refItem} />
      {refItem.resolved_description && (
        <div className="text-sm text-ink-muted">{renderMarkdownBoldText(refItem.resolved_description, refItem.key)}</div>
      )}
    </div>
  );
}

function Weapon({ data, worldSlug }: { data: ResolvedWeaponBlockData; worldSlug: string }) {
  const items = [
    { label: "Categorie", value: data.category === "martial" ? "Martiale" : "Simple" },
    {
      label: "Degats",
      value: (
        <span className="mech">
          {formatFormulaNode(data.damage.dice)}
          {data.damage.type ? ` (${damageTypeLabel(data.damage.type)})` : ""}
        </span>
      ),
    },
    ...(data.versatile_damage
      ? [{ label: "Degats (2 mains)", value: <span className="mech">{formatFormulaNode(data.versatile_damage)}</span> }]
      : []),
    ...(data.range ? [{ label: "Portee", value: [quantityText(data.range.normal), quantityText(data.range.long)].filter(Boolean).join(" / ") }] : []),
    ...(data.weight ? [{ label: "Poids", value: quantityText(data.weight) as string }] : []),
    ...(data.cost ? [{ label: "Valeur", value: costText(data.cost) as string }] : []),
  ];
  const detailItems = [
    ...(data.properties.length > 0
      ? [
          {
            label: "Proprietes",
            fullWidth: true,
            value: (
              <div className="flex flex-col gap-3">
                {data.properties.map((p, i) => (
                  <ResolvedRefDetail key={i} worldSlug={worldSlug} refItem={p} />
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(data.mastery
      ? [{ label: "Botte d'arme", fullWidth: true, value: <ResolvedRefDetail worldSlug={worldSlug} refItem={data.mastery} /> }]
      : []),
  ];
  return (
    <div className="flex flex-col gap-5">
      <KeyValues items={items} />
      {detailItems.length > 0 && <KeyValues items={detailItems} />}
    </div>
  );
}

/**
 * Traits d'une espece ou d'une sous-espece (V1-D7, retour utilisateur —
 * meme motif que `Weapon` ci-dessus : faits courts en grille, traits en
 * blocs plein largeur nom+texte). `creature_type`/`size`/`speed` absents
 * pour une sous-espece (elle n'a pas sa propre taille/vitesse).
 */
/** Taille(s) possibles d'une espece (V1-D7, retour utilisateur : Type et Taille separes, fourchette precisee) — plusieurs lignes si l'espece a un choix (Humain, Tieffelin). */
function speciesSizeText(sizes: { label: string; range?: string }[]): ReactNode {
  return (
    <span className="flex flex-col gap-0.5">
      {sizes.map((s, i) => (
        <span key={i}>
          {SIZE_LABELS_FR[s.label] ?? s.label}
          {s.range ? ` (${s.range})` : ""}
        </span>
      ))}
    </span>
  );
}

function SpeciesTraits({ data, worldSlug }: { data: ResolvedSpeciesTraitsBlockData; worldSlug: string }) {
  const items = [
    ...(data.creature_type ? [{ label: "Type", value: CREATURE_TYPE_LABELS_FR[data.creature_type] ?? data.creature_type }] : []),
    ...(data.sizes && data.sizes.length > 0 ? [{ label: "Taille", value: speciesSizeText(data.sizes) }] : []),
    ...(data.speed ? [{ label: "Vitesse", value: quantityText(data.speed) as string }] : []),
    ...(data.lifespan ? [{ label: "Esperance de vie", value: data.lifespan }] : []),
  ];
  return (
    <div className="flex flex-col gap-5">
      {items.length > 0 && <KeyValues items={items} />}
      <div className="flex flex-col gap-3">
        {data.traits.map((t, i) => (
          <ResolvedRefDetail key={i} worldSlug={worldSlug} refItem={t} />
        ))}
      </div>
    </div>
  );
}

function Armor({ data }: { data: ArmorBlockData }) {
  const categoryLabel = ARMOR_CATEGORY_LABELS_FR[data.category.charAt(0).toUpperCase() + data.category.slice(1)] ?? data.category;
  const items = [
    { label: "Categorie", value: categoryLabel },
    { label: "CA de base", value: String(data.base_ac) },
    {
      label: "Bonus de Dexterite",
      value: data.dex_bonus ? (data.max_dex_bonus !== undefined ? `Oui (plafond +${data.max_dex_bonus})` : "Oui") : "Non",
    },
    ...(data.strength_minimum ? [{ label: "Force minimum", value: String(data.strength_minimum) }] : []),
    ...(data.stealth_disadvantage !== undefined
      ? [{ label: "Discretion", value: data.stealth_disadvantage ? "Desavantage" : "Aucun desavantage" }]
      : []),
    ...(data.weight ? [{ label: "Poids", value: quantityText(data.weight) as string }] : []),
    ...(data.cost ? [{ label: "Valeur", value: costText(data.cost) as string }] : []),
  ];
  return <KeyValues items={items} />;
}

/**
 * Bloc unique partage par item/magic_item/mount (V1-D7, passe Objet, retour
 * utilisateur) : chaque ligne n'apparait que si la fiche porte la donnee —
 * une monture n'a pas de rarete, un objet mondain n'a pas de capacite de
 * charge, un paquetage n'a ni l'un ni l'autre.
 */
function ItemProperties({ data, worldSlug }: { data: ResolvedItemPropertiesBlockData; worldSlug: string }) {
  const items = [
    ...(data.category ? [{ label: "Categorie", value: data.category }] : []),
    ...(data.weight ? [{ label: "Poids", value: quantityText(data.weight) as string }] : []),
    ...(data.cost ? [{ label: "Valeur", value: costText(data.cost) as string }] : []),
    ...(data.capacity ? [{ label: "Capacite de charge", value: data.capacity }] : []),
    ...(data.rarity ? [{ label: "Rarete", value: ITEM_RARITY_LABELS_FR[data.rarity] ?? data.rarity }] : []),
    ...(data.requires_attunement !== undefined ? [{ label: "Harmonisation", value: data.requires_attunement ? "Requise" : "Non requise" }] : []),
    ...(data.attunement_restriction ? [{ label: "Restriction d'harmonisation", value: data.attunement_restriction }] : []),
    ...(data.damage
      ? [
          {
            label: "Degats",
            value: (
              <span className="mech">
                {formatFormulaNode(data.damage.formula)}
                {data.damage.damage_type ? ` (${damageTypeLabel(data.damage.damage_type)})` : ""}
              </span>
            ),
          },
        ]
      : []),
    ...(data.save
      ? [
          {
            label: "Jet de sauvegarde",
            value: `${abilityLabel(data.save.ability)} DD ${data.save.dc}${data.save.effect_on_success ? ` (reussite : ${effectOnSuccessLabel(data.save.effect_on_success)})` : ""}`,
          },
        ]
      : []),
    ...(data.contents && data.contents.length > 0
      ? [
          {
            label: "Contenu",
            fullWidth: true,
            value: (
              <div className="flex flex-col gap-1">
                {data.contents.map((item, i) => (
                  <div key={i} className="flex items-baseline gap-1.5 text-sm">
                    <span className="mech shrink-0 text-ink-muted">×{item.quantity}</span>
                    {item.ref ? (
                      <Link href={`/m/${worldSlug}/regles/${item.ref.key}`} className="hover:underline" style={{ color: "var(--link-rule)" }}>
                        {item.resolved_label}
                      </Link>
                    ) : (
                      <span>{item.resolved_label}</span>
                    )}
                  </div>
                ))}
              </div>
            ),
          },
        ]
      : []),
  ];
  return <KeyValues items={items} />;
}

function Charges({ data }: { data: ChargesBlockData }) {
  const items = [
    { label: "Charges max", value: String(data.max) },
    ...(data.regain ? [{ label: "Regeneration", value: data.regain }] : []),
    ...(data.depleted_effect ? [{ label: "Si epuise", value: data.depleted_effect }] : []),
  ];
  return <KeyValues items={items} />;
}

const STAT_BLOCK_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtMod(mod: number): string {
  return `${mod >= 0 ? "+" : ""}${mod}`;
}

function StatBadge({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-[3.75rem] shrink-0 flex-col items-center gap-1">
      <span className="flex h-6 items-end justify-center text-center text-[9px] font-bold uppercase leading-tight tracking-widest text-ink-muted">
        {label}
      </span>
      <div className="flex min-h-14 min-w-full items-center justify-center rounded-md border border-edge bg-panel-raised px-1.5 py-1">
        <span className="mech whitespace-normal break-words text-center text-sm font-semibold text-ink">{value}</span>
      </div>
    </div>
  );
}

/**
 * Ligne point + libelle (+ valeur optionnelle a droite) — V1-E4 retour
 * utilisateur : meme esthetique pour Competences, Sens et Langues plutot
 * que du texte brut separe par des virgules. Le point est toujours plein
 * (pas de motif "choix"/"maitrise partielle" comme sur `PlayableCharacterSheet` :
 * une fiche de monstre ne liste que ce qu'elle possede deja).
 */
function DotRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="flex-1 text-ink">{label}</span>
      {value !== undefined && <span className="text-right font-medium text-ink">{value}</span>}
    </div>
  );
}

function FeatureCard({
  name,
  description,
  keyPrefix,
  meta,
}: {
  name: string;
  description: string;
  keyPrefix: string;
  meta?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-edge/60 bg-panel-raised p-2.5 text-sm text-ink">
      <span className="font-semibold">{name}.</span> {renderMarkdownBoldText(description, keyPrefix)}
      {meta && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
    </div>
  );
}

/** Formule "1d20 + N" (signe explicite) pour un jet de toucher — meme moteur/formule que `damage.dice`, jamais du texte statique. */
function attackFormula(bonus: number): string {
  return `1d20 ${bonus >= 0 ? "+" : "-"} ${Math.abs(bonus)}`;
}

/**
 * Boutons de jet d'une action (V1-E4 retour utilisateur point 6) —
 * remplace l'ancien texte statique "+9 pour toucher · 2d6+5" : un bouton
 * "Toucher" et un bouton "Dégâts" par ligne de dégâts, meme motif que les
 * boutons Attaquer/Dégâts de `PlayableCharacterSheet`/`InventoryPanel`, mais
 * autonomes (`MonsterRollButton`) puisqu'une fiche de regle SRD n'a ni
 * personnage ni campagne a s'accrocher.
 */
function ActionRolls({ action }: { action: ActionsBlockData["actions"][number] }) {
  if (action.attack_bonus === undefined && !action.damage?.length) return null;
  return (
    <>
      {action.attack_bonus !== undefined && <MonsterRollButton label="Toucher" formula={attackFormula(action.attack_bonus)} />}
      {action.damage?.map((d, i) => (
        <MonsterRollButton
          key={i}
          label={d.type ? `Dégâts (${damageTypeLabel(d.type)})` : "Dégâts"}
          formula={formatFormulaNode(d.dice)}
        />
      ))}
    </>
  );
}

/**
 * Fiche de créature (V1-E4 suite, retour utilisateur) — même architecture
 * visuelle que `PlayableCharacterSheet`/`MonsterStatblockSheet` (V1-B5/
 * V1-E4) : colonne de gauche fixe (caractéristiques en boîtes 2 colonnes ×
 * 3 lignes, compétences, sens/langues), colonne principale à droite —
 * jamais des onglets ici (demande explicite), Actions puis Aptitudes
 * spéciales à la suite l'une de l'autre. `traits`/`actions` fusionnés dans
 * CE même bloc visuel plutôt que rendus comme deux sections séparées :
 * `page.tsx` retire ces deux blocs de la liste normale quand un
 * `stat_block` est présent dans la même fiche et les passe ici. Modèle
 * validé sur Aboleth — lecture seule, aucune saisie : une fiche de règle
 * SRD ne s'édite jamais ici.
 *
 * Compromis assumé : un `traits`/`actions` surchargé isolément par une
 * variante (V1-A4) perd son propre badge « modifiée dans ta variante »
 * une fois fusionné ici (celui du `stat_block` reste, porté par
 * `RuleBlockRenderer` en amont) — cas marginal, pas dans le périmètre de
 * cette refonte visuelle.
 */
export function MonsterCard({
  statBlock,
  traits,
  actions,
  legendaryActions,
}: {
  statBlock: StatBlockBlockData;
  traits?: TraitsBlockData;
  actions?: ActionsBlockData;
  legendaryActions?: LegendaryActionsBlockData;
}) {
  const speedEntries = Object.entries(statBlock.speed).map(([kind, value]) => `${SPEED_LABELS_FR[kind] ?? kind} ${metricizeFeet(value)}`);
  const savingThrowByAbility = new Map((statBlock.saving_throws ?? []).map((s) => [s.ability, s.bonus]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="flex h-6 items-end justify-center text-[9px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
          <div
            className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
            style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
          >
            <span className="text-xl font-bold text-ink">{statBlock.armor_class}</span>
          </div>
        </div>
        <StatBadge label="Taille" value={SIZE_LABELS_FR[statBlock.size] ?? statBlock.size} />
        <StatBadge label="Type" value={CREATURE_TYPE_LABELS_FR[statBlock.creature_type] ?? statBlock.creature_type} />
        {statBlock.alignment && (
          <StatBadge
            label="Alignement"
            value={
              <span className="flex flex-col items-center gap-0.5">
                {alignmentLines(statBlock.alignment).map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </span>
            }
          />
        )}
        <StatBadge label="PV" value={String(statBlock.hit_points)} />
        <StatBadge label="Dés de vie" value={statBlock.hit_dice} />
        <StatBadge
          label="Vitesse"
          value={
            <span className="flex flex-col items-center gap-0.5">
              {speedEntries.map((s, i) => (
                <span key={i}>{s}</span>
              ))}
            </span>
          }
        />
        <StatBadge label="FP" value={String(statBlock.challenge_rating)} />
        <StatBadge label="Maîtrise" value={`+${statBlock.proficiency_bonus}`} />
        {statBlock.xp !== undefined && <StatBadge label="PX" value={String(statBlock.xp)} />}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <aside className="flex flex-col gap-3 md:w-48 md:shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {STAT_BLOCK_ABILITIES.map((ability) => {
              const score = statBlock.abilities[ability];
              const save = savingThrowByAbility.get(ability);
              return (
                <div
                  key={ability}
                  className="flex flex-col items-center gap-1 rounded-lg border border-edge/60 bg-panel-raised px-2 py-2.5 text-center"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{abilityLabel(ability)}</span>
                  <span className="text-xl font-bold text-ink">{fmtMod(abilityMod(score))}</span>
                  <span className="mech text-xs text-ink-muted">{score}</span>
                  {save !== undefined && (
                    <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-accent bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                      Sauv. {fmtMod(save)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {!!statBlock.skills?.length && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Compétences</span>
              <div className="flex flex-col gap-0.5">
                {statBlock.skills.map((s) => (
                  <DotRow key={s.name} label={monsterSkillLabel(s.name)} value={fmtMod(s.bonus)} />
                ))}
              </div>
            </div>
          )}

          {statBlock.senses && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Sens</span>
              <div className="flex flex-col gap-0.5">
                {Object.entries(statBlock.senses).map(([k, v]) => (
                  <DotRow key={k} label={SENSE_LABELS_FR[k] ?? k} value={metricizeFeet(v)} />
                ))}
              </div>
            </div>
          )}

          {!!statBlock.damage_vulnerabilities?.length && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Vulnérabilités</span>
              <div className="flex flex-col gap-0.5">
                {statBlock.damage_vulnerabilities.map((v, i) => (
                  <DotRow key={i} label={damageQualifierLabel(v)} />
                ))}
              </div>
            </div>
          )}

          {!!statBlock.damage_resistances?.length && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Résistances</span>
              <div className="flex flex-col gap-0.5">
                {statBlock.damage_resistances.map((v, i) => (
                  <DotRow key={i} label={damageQualifierLabel(v)} />
                ))}
              </div>
            </div>
          )}

          {!!statBlock.damage_immunities?.length && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Immunités (dégâts)</span>
              <div className="flex flex-col gap-0.5">
                {statBlock.damage_immunities.map((v, i) => (
                  <DotRow key={i} label={damageQualifierLabel(v)} />
                ))}
              </div>
            </div>
          )}

          {!!statBlock.condition_immunities?.length && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Immunités (états)</span>
              <div className="flex flex-col gap-0.5">
                {statBlock.condition_immunities.map((v, i) => (
                  <DotRow key={i} label={conditionLabel(v)} />
                ))}
              </div>
            </div>
          )}

          {statBlock.languages && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Langues</span>
              <div className="flex flex-col gap-0.5">
                {statBlock.languages
                  .split(",")
                  .map((seg) => seg.trim())
                  .filter(Boolean)
                  .map((seg, i) => (
                    <DotRow key={i} label={translateLanguagesText(seg)} />
                  ))}
              </div>
            </div>
          )}
        </aside>

        <div className="flex flex-1 flex-col gap-4">
          {!!actions?.actions.length && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Actions</span>
              {actions.actions.map((a, i) => (
                <FeatureCard key={i} name={a.name} description={a.description} keyPrefix={`action-${i}`} meta={<ActionRolls action={a} />} />
              ))}
            </div>
          )}
          {!!legendaryActions?.actions.length && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Actions légendaires</span>
              {legendaryActions.actions.map((a, i) => (
                <FeatureCard key={i} name={a.name} description={a.description} keyPrefix={`legendary-action-${i}`} meta={<ActionRolls action={a} />} />
              ))}
            </div>
          )}
          {!!traits?.traits.length && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Aptitudes spéciales</span>
              {traits.traits.map((t, i) => (
                <FeatureCard key={i} name={t.name} description={t.description} keyPrefix={`trait-${i}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Fallback quand `traits`/`actions` apparaissent sans `stat_block` dans la même fiche (rare — un bloc n'est pas réservé aux monstres) : mêmes cartes que `MonsterCard`, sans la colonne caractéristiques. */
function Traits({ data }: { data: TraitsBlockData }) {
  return (
    <div className="flex flex-col gap-2">
      {data.traits.map((t, i) => (
        <FeatureCard key={i} name={t.name} description={t.description} keyPrefix={`trait-${i}`} />
      ))}
    </div>
  );
}

/** Effets d'une condition (V1-D7, sur retour utilisateur) — meme patron que `Traits`, type distinct (`ConditionEffectsBlockData`, pas `TraitsBlockData`) pour rester nomme comme tel dans un futur formulaire MJ "creer une condition". */
function ConditionEffects({ data }: { data: ConditionEffectsBlockData }) {
  return (
    <KeyValues
      items={data.effects.map((e, i) => ({ label: e.name, value: renderMarkdownBoldText(e.description, `effect-${i}`) }))}
    />
  );
}

/**
 * Aptitudes accordees par une sous-classe, par niveau (V1-D7, sur retour
 * utilisateur — remplace la grille de cartes `key_values` par un vrai
 * tableau a lignes, une progression par niveau se lisant mieux ainsi,
 * meme mise en page que `class_progression`/`scaling`). Meme police que
 * les autres blocs conservee (nom en gras, memes classes que l'etiquette
 * `KeyValues`) — seul le conteneur change.
 */
function SubclassFeatures({ data }: { data: SubclassFeaturesBlockData }) {
  const sorted = [...data.features].sort((a, b) => a.level - b.level);
  const columns: { key: string; label: string; align?: "left" | "center" }[] = [
    { key: "level", label: "Niveau", align: "center" },
    { key: "feature", label: "Aptitude" },
  ];
  const rows = sorted.map((f, i) => [
    { key: "level", value: <span className="mech">{f.level}</span> },
    {
      key: "feature",
      value: (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink">{f.name}</span>
          <div className="text-ink-muted">{renderMarkdownBoldText(f.description, `feature-${i}`)}</div>
        </div>
      ),
    },
  ]);
  return <ProgressionTable columns={columns} rows={rows} />;
}

/** Fallback quand `actions` apparaît sans `stat_block` dans la même fiche — voir `Traits` ci-dessus. */
function Actions({ data }: { data: ActionsBlockData }) {
  return (
    <div className="flex flex-col gap-2">
      {data.actions.map((a, i) => (
        <FeatureCard key={i} name={a.name} description={a.description} keyPrefix={`action-${i}`} meta={<ActionRolls action={a} />} />
      ))}
    </div>
  );
}

/** Fallback quand `legendary_actions` apparaît sans `stat_block` dans la même fiche — voir `Traits` ci-dessus. */
function LegendaryActions({ data }: { data: LegendaryActionsBlockData }) {
  return (
    <div className="flex flex-col gap-2">
      {data.actions.map((a, i) => (
        <FeatureCard key={i} name={a.name} description={a.description} keyPrefix={`legendary-action-${i}`} meta={<ActionRolls action={a} />} />
      ))}
    </div>
  );
}

function Prerequisites({ data }: { data: PrerequisitesBlockData }) {
  return <Chips items={data.items} />;
}

/** Effets chiffres generalises (bloc `modifiers`, retour utilisateur "un don maison qui affecte reellement la fiche") — une carte par modificateur, meme mise en page `key_values` que le reste du catalogue. */
function Modifiers({ data }: { data: ModifiersBlockData }) {
  const items = data.modifiers.map((m) => ({
    label: modifierTargetLabel(m.target),
    value: modifierOpNeedsValue(m.op) ? (
      <span className="mech">{`${m.op === "set" ? "= " : m.value !== undefined && m.value >= 0 ? "+" : ""}${m.value ?? 0}`}</span>
    ) : (
      MODIFIER_OP_LABELS_FR[m.op]
    ),
  }));
  return <KeyValues items={items} />;
}

/** `armor_proficiencies`/`weapon_proficiencies`/`tool_proficiencies` (`class_basics`, V1-D1) -> libelles FR (V1-D3b point 3). */
function proficiencyLabel(value: string): string {
  return CLASS_PROFICIENCY_LABELS_FR[value] ?? value;
}

function ClassBasics({ data }: { data: ClassBasicsBlockData }) {
  const items = [
    { label: "De de vie", value: `1d${data.hit_die}` },
    { label: "Sauvegardes", value: data.saving_throw_proficiencies.map(abilityLabel).join(", ") },
    ...(data.armor_proficiencies?.length ? [{ label: "Maitrises d'armure", value: data.armor_proficiencies.map(proficiencyLabel).join(", ") }] : []),
    ...(data.weapon_proficiencies?.length ? [{ label: "Maitrises d'arme", value: data.weapon_proficiencies.map(proficiencyLabel).join(", ") }] : []),
    ...(data.tool_proficiencies?.length ? [{ label: "Maitrises d'outil", value: data.tool_proficiencies.map(proficiencyLabel).join(", ") }] : []),
  ];
  return <KeyValues items={items} />;
}

/**
 * Refonte (V1-D7, retour utilisateur : "la presentation n'est pas tres
 * lisible") — les deux faits courts (caracteristique, niveau de depart)
 * restent en `KeyValues`, mais chaque section d'`info` (plusieurs
 * paragraphes de regle, ex. "Sorts prepares du 1er niveau et plus") sort de
 * la grille a trois colonnes : un texte long ecrase dans un tiers de
 * largeur ne se lit pas. Empilees en pleine largeur avec un vrai
 * sous-titre, meme langage visuel que `SubclassFeatures` (nom en gras,
 * texte en dessous) plutot qu'une etiquette minuscule en majuscules.
 */
function SpellcastingProgression({ data }: { data: SpellcastingProgressionBlockData }) {
  return (
    <div className="flex flex-col gap-5">
      <KeyValues
        items={[
          { label: "Caracteristique d'incantation", value: abilityLabel(data.ability) },
          { label: "Debute au niveau", value: String(data.starts_at_level) },
        ]}
      />
      <div className="flex flex-col">
        {data.info.map((entry, i) => (
          <div key={i} className="flex flex-col gap-1.5 border-b border-edge/40 py-3 first:pt-0 last:border-b-0 last:pb-0">
            <h4 className="text-sm font-bold text-ink">{entry.name}</h4>
            <div className="text-sm leading-relaxed text-ink-muted">{renderMarkdownBoldText(entry.description, `info-${i}`)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubclassSlot({ data, worldSlug }: { data: ResolvedSubclassSlotBlockData; worldSlug: string }) {
  const items = [
    { label: "Choix", value: data.label },
    { label: "Niveau", value: String(data.chosen_at_level) },
    ...(data.options?.length
      ? [
          {
            label: "Options",
            value: (
              <span className="flex flex-wrap gap-x-2">
                {data.options.map((opt, i) => (
                  <Link key={i} href={`/m/${worldSlug}/regles/${opt.key}`} className="hover:underline" style={{ color: "var(--link-rule)" }}>
                    {opt.resolved_name}
                  </Link>
                ))}
              </span>
            ),
          },
        ]
      : []),
  ];
  return <KeyValues items={items} />;
}

/**
 * Un encadre par option d'equipement de depart (V1-D7, sur retour
 * utilisateur — remplace le texte "Choisissez A ou B" affiche tel quel) :
 * meme langage visuel que `ItemCard` de l'onglet Inventaire de la fiche
 * jouable (`components/blocks/PlayableCharacterSheet.tsx`), en simplifie
 * (pas d'equipement/quantite modifiable, pas de bouton d'action — cette
 * fiche n'est jamais l'inventaire de quelqu'un, seulement la description
 * d'un choix). `resolved_label` est deja traduit par le service quand
 * l'objet a sa propre fiche (`ResolvedBackgroundBlockData`) ; sans
 * reference (ex. « boite de jeux, au choix »), `resolved_label` reste le
 * libelle fige ecrit a l'import.
 *
 * `interaction` (optionnel, retour utilisateur V2-G1 : "remplacer les
 * boutons Choisir A/B par un clic direct sur l'encadre") rend tout
 * l'encadre cliquable — l'assistant de creation le fournit, une fiche de
 * regle en lecture seule (`/regles/<cle>`) ne le fournit jamais, l'encadre
 * y reste alors statique comme avant. `role="button"` plutot qu'un vrai
 * `<button>` : la carte contient deja un lien vers la fiche de chaque objet,
 * imbriquer un `<a>` dans un `<button>` est invalide — le lien appelle
 * `stopPropagation` pour naviguer sans selectionner l'option au passage.
 */
export interface EquipmentCardInteraction {
  isChosen: (optionLabel: string) => boolean;
  onSelect: (optionLabel: string) => void;
  /**
   * Choix du membre reel d'une categorie "au choix" (V2-G1, retour
   * utilisateur : transformer "Symbole sacre (au choix)" en vraie liste
   * choisissable) — seulement pour les items dont `resolved_category_options`
   * est non vide. `selectedKey` retourne "" tant que le joueur n'a rien
   * choisi (retour utilisateur suite : le bouton doit afficher le libelle
   * generique "au choix" par defaut, jamais presupposer le premier membre) —
   * la liste deroulante affiche alors `resolved_label` grace a une option
   * "placeholder" ajoutee par `BackgroundEquipmentCard`.
   */
  categoryChoice?: {
    selectedKey: (optionLabel: string, itemIndex: number) => string;
    onSelectKey: (optionLabel: string, itemIndex: number, key: string) => void;
  };
}

function BackgroundEquipmentCard({
  option,
  worldSlug,
  interaction,
}: {
  option: ResolvedBackgroundEquipmentOption;
  worldSlug: string;
  interaction?: EquipmentCardInteraction;
}) {
  const isChosen = interaction?.isChosen(option.label) ?? false;
  return (
    <div
      role={interaction ? "button" : undefined}
      tabIndex={interaction ? 0 : undefined}
      onClick={interaction ? () => interaction.onSelect(option.label) : undefined}
      onKeyDown={
        interaction
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                interaction.onSelect(option.label);
              }
            }
          : undefined
      }
      className={`flex flex-col gap-1.5 rounded-md border px-3 py-2.5 transition-colors ${
        interaction
          ? `cursor-pointer ${isChosen ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"}`
          : "border-edge/60 bg-panel-raised"
      }`}
    >
      <span className={`text-xs font-bold uppercase tracking-wide ${isChosen ? "text-accent" : "text-ink"}`}>Choix {option.label}</span>
      <div className="flex flex-col gap-1">
        {option.items.map((item, i) => {
          const categoryChoice = interaction?.categoryChoice;
          const categoryOptions = item.resolved_category_options;
          if (categoryChoice && categoryOptions && categoryOptions.length > 0) {
            // Option "placeholder" (valeur "") en tete de liste — affiche le
            // libelle generique "au choix" tant que rien n'est choisi (retour
            // utilisateur, V2-G1 suite), plutot que de presupposer le premier
            // membre reel de la categorie.
            const dropdownOptions = [
              { value: "", label: item.resolved_label },
              ...categoryOptions.map((c) => ({ value: c.key, label: c.resolved_label })),
            ];
            return (
              <div key={i} className="flex items-center gap-1.5 text-sm" onClick={(e) => e.stopPropagation()}>
                <span className="mech shrink-0 text-ink-muted">×{item.quantity}</span>
                <Dropdown
                  value={categoryChoice.selectedKey(option.label, i)}
                  options={dropdownOptions}
                  onChange={(key) => categoryChoice.onSelectKey(option.label, i, key)}
                  aria-label={item.resolved_label}
                  className="rounded-md border border-edge px-2 py-0.5 text-sm text-ink outline-none transition-colors hover:bg-panel"
                />
              </div>
            );
          }
          return (
            <div key={i} className="flex items-baseline gap-1.5 text-sm">
              <span className="mech shrink-0 text-ink-muted">×{item.quantity}</span>
              {item.ref ? (
                <Link
                  href={`/m/${worldSlug}/regles/${item.ref.key}`}
                  onClick={interaction ? (e) => e.stopPropagation() : undefined}
                  className="hover:underline"
                  style={{ color: "var(--link-rule)" }}
                >
                  {item.resolved_label}
                </Link>
              ) : (
                <span>{item.resolved_label}</span>
              )}
            </div>
          );
        })}
      </div>
      {option.gold && <div className="mech text-sm text-ink-muted">{costText(option.gold)}</div>}
    </div>
  );
}

/**
 * Le don accorde lie vers sa propre fiche ET reprend sa propre description
 * (V1-D7) — `data.feat_name`/`data.feat_description` sont ajoutes a la
 * lecture par le service (ResolvedBackgroundBlockData), jamais stockes tels
 * quels dans le bloc. Seul le don beneficie de cette resolution parmi les
 * champs simples : les maitrises de competence/outil n'ont pas de fiche
 * propre dans ce systeme (cf. commentaire de `zBackgroundBlockData`), un
 * simple libelle suffit.
 *
 * Mise en page (V1-D7, sur retour utilisateur) : trois sections nettement
 * separees (`gap-5`, plus aere que les autres blocs `key_values`) plutot
 * qu'une seule grille — caracteristiques/outil/competences sur une ligne,
 * le don seul sur la sienne (toujours `fullWidth`, mais dans son propre
 * `KeyValues` : un `gap` de conteneur, pas le `gap-y` interne de la grille,
 * separe mieux deux sections que deux lignes d'une meme grille), puis
 * l'equipement hors de `key_values` — deux encadres cote a cote, cf.
 * BackgroundEquipmentCard. Le libelle "Equipement de depart" reprend le
 * meme style que les etiquettes `KeyValues` (gras, majuscules) plutot que
 * l'ancien style muet a 10px, pour rester coherent avec le reste du bloc.
 */
function Background({
  data,
  worldSlug,
  equipmentInteraction,
}: {
  data: ResolvedBackgroundBlockData;
  worldSlug: string;
  equipmentInteraction?: EquipmentCardInteraction;
}) {
  const statItems = [
    { label: "Valeurs de caracteristique", value: data.ability_scores.map(abilityLabel).join(", ") },
    ...(data.tool_proficiency ? [{ label: "Maitrise d'outil", value: proficiencyLabel(data.tool_proficiency) }] : []),
    { label: "Maitrises de competence", value: data.skill_proficiencies.map(skillLabel).join(", ") },
  ];
  return (
    <div className="flex flex-col gap-5">
      <KeyValues items={statItems} />
      {/* Titre "DON : <nom>" plutot qu'une paire etiquette/valeur separee
          (retour utilisateur, V2-G1 : la hierarchie label "Don" + lien en
          valeur lisait mal) — meme gabarit que `ResolvedRefDetail` (lien
          gras en capitales + texte en dessous), pas un nouveau style. */}
      <div className="flex flex-col gap-1">
        <Link
          href={`/m/${worldSlug}/regles/${data.feat.key}`}
          className="text-xs font-bold uppercase tracking-wide hover:underline"
          style={{ color: "var(--link-rule)" }}
        >
          Don : {data.feat_name}
        </Link>
        {data.feat_description && <div className="text-sm text-ink-muted">{renderMarkdownBoldText(data.feat_description, "feat")}</div>}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ink">Equipement de depart</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.equipment_options.map((opt, i) => (
            <BackgroundEquipmentCard key={i} option={opt} worldSlug={worldSlug} interaction={equipmentInteraction} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Equipement de depart d'une classe (V2-G1, point 9 du retour utilisateur)
 * — `fixed` (toujours accorde, simple liste) puis un encadre `Choix N` par
 * element de `choices`, chacun affichant ses options en cartes
 * `BackgroundEquipmentCard` (memes cartes qu'un historique : un choix de
 * classe n'est jamais qu'un choix d'historique avec plusieurs choix
 * INDEPENDANTS au lieu d'un seul, jamais une deuxieme mise en page).
 */
function ClassEquipment({
  data,
  worldSlug,
  equipmentInteractions,
}: {
  data: ResolvedClassEquipmentBlockData;
  worldSlug: string;
  /** Un par element de `data.choices`, meme index — chaque choix de classe reste independant des autres. */
  equipmentInteractions?: EquipmentCardInteraction[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {data.fixed.length > 0 && (
        <div className="flex flex-col gap-1">
          {data.fixed.map((item, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-sm">
              <span className="mech shrink-0 text-ink-muted">×{item.quantity}</span>
              {item.ref ? (
                <Link href={`/m/${worldSlug}/regles/${item.ref.key}`} className="hover:underline" style={{ color: "var(--link-rule)" }}>
                  {item.resolved_label}
                </Link>
              ) : (
                <span>{item.resolved_label}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {data.choices.map((choice, i) => (
        <div key={i} className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink">Choix {i + 1}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {choice.options.map((opt, j) => (
              <BackgroundEquipmentCard key={j} option={opt} worldSlug={worldSlug} interaction={equipmentInteractions?.[i]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Repartiteur par block_type -> mise en page generique (specs/regles-blocs.md
 * §4-5). Aucun composant par type de bloc pour l'affichage lui-meme, les
 * six mises en page suffisent ; ce fichier ne fait que traduire chaque bloc
 * typé vers la forme generique attendue par sa mise en page.
 *
 * Module a part (pas dans RuleBlockRenderer.tsx) : ModifiedBlockBadge
 * (client, V1-A4) reutilise ce meme rendu pour afficher l'original a cote
 * de la variante — un import croise entre les deux fichiers aurait cree un
 * cycle serveur/client.
 */
export function renderBlockData(
  blockType: BlockType,
  data: unknown,
  worldSlug: string = "",
  outgoingRefs: RuleRefView[] = [],
  /** Consomme uniquement par "background" (un objet) et "class_equipment" (un tableau, un par choix) — cf. `EquipmentCardInteraction`. */
  equipmentInteraction?: EquipmentCardInteraction | EquipmentCardInteraction[]
): ReactNode {
  if (blockType === "description") {
    const descData = data as DescriptionBlockData;
    return <Prose segments={descData.segments} pageRef={descData.page_ref} />;
  }
  if (blockType === "spell_casting") return <SpellCasting data={data as SpellCastingBlockData} />;
  if (blockType === "effects") return <Effects data={data as EffectsBlockData} />;
  if (blockType === "scaling") return <Scaling data={data as ScalingBlockData} />;
  if (blockType === "class_progression")
    return <ClassProgression data={data as ClassProgressionBlockData} worldSlug={worldSlug} outgoingRefs={outgoingRefs} />;
  if (blockType === "custom_table") return <CustomTable data={data as CustomTableBlockData} />;
  if (blockType === "weapon") return <Weapon data={data as ResolvedWeaponBlockData} worldSlug={worldSlug} />;
  if (blockType === "species_traits") return <SpeciesTraits data={data as ResolvedSpeciesTraitsBlockData} worldSlug={worldSlug} />;
  if (blockType === "armor") return <Armor data={data as ArmorBlockData} />;
  if (blockType === "item_properties") return <ItemProperties data={data as ResolvedItemPropertiesBlockData} worldSlug={worldSlug} />;
  if (blockType === "charges") return <Charges data={data as ChargesBlockData} />;
  if (blockType === "stat_block") return <MonsterCard statBlock={data as StatBlockBlockData} />;
  if (blockType === "traits") return <Traits data={data as TraitsBlockData} />;
  if (blockType === "actions") return <Actions data={data as ActionsBlockData} />;
  if (blockType === "legendary_actions") return <LegendaryActions data={data as LegendaryActionsBlockData} />;
  if (blockType === "prerequisites") return <Prerequisites data={data as PrerequisitesBlockData} />;
  if (blockType === "class_basics") return <ClassBasics data={data as ClassBasicsBlockData} />;
  if (blockType === "spellcasting_progression") return <SpellcastingProgression data={data as SpellcastingProgressionBlockData} />;
  if (blockType === "subclass_slot") return <SubclassSlot data={data as ResolvedSubclassSlotBlockData} worldSlug={worldSlug} />;
  if (blockType === "background")
    return (
      <Background
        data={data as ResolvedBackgroundBlockData}
        worldSlug={worldSlug}
        equipmentInteraction={equipmentInteraction as EquipmentCardInteraction | undefined}
      />
    );
  if (blockType === "class_equipment")
    return (
      <ClassEquipment
        data={data as ResolvedClassEquipmentBlockData}
        worldSlug={worldSlug}
        equipmentInteractions={equipmentInteraction as EquipmentCardInteraction[] | undefined}
      />
    );
  if (blockType === "condition_effects") return <ConditionEffects data={data as ConditionEffectsBlockData} />;
  if (blockType === "subclass_features") return <SubclassFeatures data={data as SubclassFeaturesBlockData} />;
  if (blockType === "modifiers") return <Modifiers data={data as ModifiersBlockData} />;
  return null;
}
