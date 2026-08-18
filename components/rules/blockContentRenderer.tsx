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
  PrerequisitesBlockData,
  ScalingBlockData,
  SpellCastingBlockData,
  SpellcastingProgressionBlockData,
  StatBlockBlockData,
  SubclassFeaturesBlockData,
  TraitsBlockData,
} from "@/src/core/schemas/rule-blocks";
import {
  ARMOR_CATEGORY_LABELS_FR,
  CLASS_PROFICIENCY_LABELS_FR,
  CREATURE_TYPE_LABELS_FR,
  CURRENCY_LABELS_FR,
  DAMAGE_TYPE_LABELS_FR,
  ITEM_RARITY_LABELS_FR,
  SIZE_LABELS_FR,
  SKILL_LABELS_FR,
} from "@/src/i18n/fr";
import type { Skill } from "@/src/core/rules/sheet";
import { ftToM, lbToKg } from "@/src/core/rules/encumbrance";
import type {
  ResolvedBackgroundBlockData,
  ResolvedBackgroundEquipmentOption,
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

/** `background.skill_proficiencies` (V1-D7, cles `Skill` snake_case) -> libelle FR, meme table que la fiche de personnage. */
function skillLabel(key: string): string {
  return SKILL_LABELS_FR[key as Skill] ?? key;
}


function localizedLabel(label: Record<string, string>, fallbackKey: string): string {
  return label.fr ?? label.en ?? Object.values(label)[0] ?? fallbackKey;
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function SpellCasting({ data }: { data: SpellCastingBlockData }) {
  const items = [
    { label: "Niveau", value: data.level === 0 ? "Tour de magie" : String(data.level) },
    { label: "Ecole", value: data.school },
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
      ? { ability: effect.save.ability, effectOnSuccess: effect.save.effect_on_success }
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
            value: `${abilityLabel(data.save.ability)} DD ${data.save.dc}${data.save.effect_on_success ? ` (reussite : ${data.save.effect_on_success})` : ""}`,
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

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span className="flex h-6 items-end justify-center text-center text-[9px] font-bold uppercase leading-tight tracking-widest text-ink-muted">
        {label}
      </span>
      <div className="flex h-14 min-w-full items-center justify-center rounded-md border border-edge bg-panel-raised px-2">
        <span className="mech whitespace-normal break-words text-center text-sm font-semibold text-ink">{value}</span>
      </div>
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
  meta?: string;
}) {
  return (
    <div className="rounded-md border border-edge/60 bg-panel-raised p-2.5 text-sm text-ink">
      <span className="font-semibold">{name}.</span> {renderMarkdownBoldText(description, keyPrefix)}
      {meta && <p className="mech text-xs text-ink-muted">{meta}</p>}
    </div>
  );
}

function actionMeta(a: ActionsBlockData["actions"][number]): string | undefined {
  if (a.attack_bonus === undefined && !a.damage?.length) return undefined;
  const parts: string[] = [];
  if (a.attack_bonus !== undefined) parts.push(`+${a.attack_bonus} pour toucher`);
  if (a.damage?.length) parts.push(a.damage.map((d) => `${formatFormulaNode(d.dice)}${d.type ? ` (${damageTypeLabel(d.type)})` : ""}`).join(", "));
  return parts.join(" · ");
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
}: {
  statBlock: StatBlockBlockData;
  traits?: TraitsBlockData;
  actions?: ActionsBlockData;
}) {
  const speedText = Object.entries(statBlock.speed)
    .map(([kind, value]) => `${kind} ${value}`)
    .join(", ");
  const savingThrowByAbility = new Map((statBlock.saving_throws ?? []).map((s) => [s.ability, s.bonus]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
        <span>{`${SIZE_LABELS_FR[statBlock.size] ?? statBlock.size} ${CREATURE_TYPE_LABELS_FR[statBlock.creature_type] ?? statBlock.creature_type}`.trim()}</span>
        {statBlock.alignment && <span>· {statBlock.alignment}</span>}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="flex h-6 items-end justify-center text-[9px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
          <div
            className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
            style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
          >
            <span className="text-xl font-bold text-ink">{statBlock.armor_class}</span>
          </div>
        </div>
        <StatBadge label="PV" value={`${statBlock.hit_points} (${statBlock.hit_dice})`} />
        <StatBadge label="Vitesse" value={speedText} />
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
              <div className="flex flex-col gap-0.5 text-sm">
                {statBlock.skills.map((s) => (
                  <span key={s.name} className="text-ink">
                    {s.name} <span className="mech text-ink-muted">{fmtMod(s.bonus)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(statBlock.senses || statBlock.languages) && (
            <div className="flex flex-col gap-1 text-sm">
              {statBlock.senses && (
                <p>
                  <span className="text-ink-muted">Sens </span>
                  {Object.entries(statBlock.senses)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ")}
                </p>
              )}
              {statBlock.languages && (
                <p>
                  <span className="text-ink-muted">Langues </span>
                  {statBlock.languages}
                </p>
              )}
            </div>
          )}

          {(!!statBlock.damage_vulnerabilities?.length ||
            !!statBlock.damage_resistances?.length ||
            !!statBlock.damage_immunities?.length ||
            !!statBlock.condition_immunities?.length) && (
            <div className="flex flex-col gap-1 text-sm">
              {!!statBlock.damage_vulnerabilities?.length && (
                <p>
                  <span className="text-ink-muted">Vulnérabilités </span>
                  {statBlock.damage_vulnerabilities.join(", ")}
                </p>
              )}
              {!!statBlock.damage_resistances?.length && (
                <p>
                  <span className="text-ink-muted">Résistances </span>
                  {statBlock.damage_resistances.join(", ")}
                </p>
              )}
              {!!statBlock.damage_immunities?.length && (
                <p>
                  <span className="text-ink-muted">Immunités (dégâts) </span>
                  {statBlock.damage_immunities.join(", ")}
                </p>
              )}
              {!!statBlock.condition_immunities?.length && (
                <p>
                  <span className="text-ink-muted">Immunités (états) </span>
                  {statBlock.condition_immunities.join(", ")}
                </p>
              )}
            </div>
          )}
        </aside>

        <div className="flex flex-1 flex-col gap-4">
          {!!actions?.actions.length && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Actions</span>
              {actions.actions.map((a, i) => (
                <FeatureCard key={i} name={a.name} description={a.description} keyPrefix={`action-${i}`} meta={actionMeta(a)} />
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
        <FeatureCard key={i} name={a.name} description={a.description} keyPrefix={`action-${i}`} meta={actionMeta(a)} />
      ))}
    </div>
  );
}

function Prerequisites({ data }: { data: PrerequisitesBlockData }) {
  return <Chips items={data.items} />;
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
 */
function BackgroundEquipmentCard({ option, worldSlug }: { option: ResolvedBackgroundEquipmentOption; worldSlug: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-edge/60 bg-panel-raised px-3 py-2.5">
      <span className="text-xs font-bold uppercase tracking-wide text-ink">Choix {option.label}</span>
      <div className="flex flex-col gap-1">
        {option.items.map((item, i) => (
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
function Background({ data, worldSlug }: { data: ResolvedBackgroundBlockData; worldSlug: string }) {
  const statItems = [
    { label: "Valeurs de caracteristique", value: data.ability_scores.map(abilityLabel).join(", ") },
    ...(data.tool_proficiency ? [{ label: "Maitrise d'outil", value: proficiencyLabel(data.tool_proficiency) }] : []),
    { label: "Maitrises de competence", value: data.skill_proficiencies.map(skillLabel).join(", ") },
  ];
  const donItem = {
    label: "Don",
    fullWidth: true,
    value: (
      <div className="flex flex-col gap-1">
        <Link href={`/m/${worldSlug}/regles/${data.feat.key}`} className="hover:underline" style={{ color: "var(--link-rule)" }}>
          {data.feat_name}
        </Link>
        {data.feat_description && renderMarkdownBoldText(data.feat_description, "feat")}
      </div>
    ),
  };
  return (
    <div className="flex flex-col gap-5">
      <KeyValues items={statItems} />
      <KeyValues items={[donItem]} />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ink">Equipement de depart</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.equipment_options.map((opt, i) => (
            <BackgroundEquipmentCard key={i} option={opt} worldSlug={worldSlug} />
          ))}
        </div>
      </div>
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
  outgoingRefs: RuleRefView[] = []
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
  if (blockType === "prerequisites") return <Prerequisites data={data as PrerequisitesBlockData} />;
  if (blockType === "class_basics") return <ClassBasics data={data as ClassBasicsBlockData} />;
  if (blockType === "spellcasting_progression") return <SpellcastingProgression data={data as SpellcastingProgressionBlockData} />;
  if (blockType === "subclass_slot") return <SubclassSlot data={data as ResolvedSubclassSlotBlockData} worldSlug={worldSlug} />;
  if (blockType === "background") return <Background data={data as ResolvedBackgroundBlockData} worldSlug={worldSlug} />;
  if (blockType === "condition_effects") return <ConditionEffects data={data as ConditionEffectsBlockData} />;
  if (blockType === "subclass_features") return <SubclassFeatures data={data as SubclassFeaturesBlockData} />;
  return null;
}
