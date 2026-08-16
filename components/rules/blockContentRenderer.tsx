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
  CustomTableBlockData,
  DescriptionBlockData,
  EffectsBlockData,
  ItemPropertiesBlockData,
  PrerequisitesBlockData,
  ScalingBlockData,
  SpellCastingBlockData,
  SpellcastingProgressionBlockData,
  StatBlockBlockData,
  SubclassSlotBlockData,
  TraitsBlockData,
  WeaponBlockData,
} from "@/src/core/schemas/rule-blocks";
import {
  ARMOR_CATEGORY_LABELS_FR,
  CLASS_PROFICIENCY_LABELS_FR,
  CREATURE_TYPE_LABELS_FR,
  CURRENCY_LABELS_FR,
  ITEM_RARITY_LABELS_FR,
  SIZE_LABELS_FR,
  SKILL_LABELS_FR,
  WEAPON_PROPERTY_LABELS_FR,
} from "@/src/i18n/fr";
import type { Skill } from "@/src/core/rules/sheet";
import type { ResolvedBackgroundBlockData, ResolvedBackgroundEquipmentOption, RuleRefView } from "@/src/server/services/rules";
import Chips from "./layouts/Chips";
import FormulaList from "./layouts/FormulaList";
import KeyValues from "./layouts/KeyValues";
import Prose from "./layouts/Prose";
import ProgressionTable from "./layouts/ProgressionTable";
import Table from "./layouts/Table";

/** `str`/`dex`/... -> abreviation FR (V1-D1). Concern d'affichage local a ce fichier, pas une donnee de domaine partagee — pas de raison de la faire vivre ailleurs. */
const ABILITY_ABBR_FR: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };
function abilityLabel(key: string): string {
  return ABILITY_ABBR_FR[key] ?? key.toUpperCase();
}

function quantityText(q: { value: number; unit: string } | undefined): string | undefined {
  return q ? `${q.value} ${q.unit}` : undefined;
}

/** Cout en pieces (V1-D1) -> memes abreviations FR que l'onglet Inventaire (V1-C11), au lieu des codes SRD bruts (gp/sp/...). */
function costText(cost: { value: number; unit: string } | undefined): string | undefined {
  return cost ? `${cost.value} ${CURRENCY_LABELS_FR[cost.unit] ?? cost.unit}` : undefined;
}

/** Cle de reference `weapon-property-<index>` (V1-C12) -> libelle FR, en retirant le prefixe anti-collision. */
function propertyLabel(refKey: string): string {
  const index = refKey.replace(/^weapon-property-/, "");
  return WEAPON_PROPERTY_LABELS_FR[index] ?? index;
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
    damageType: effect.damage_type,
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
        { key: "level", label: "Niveau" },
        { key: "value", label: "Valeur" },
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
  const columns = data.columns.map((col) => ({ key: col.key, label: localizedLabel(col.label, col.key) }));
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

function Weapon({ data }: { data: WeaponBlockData }) {
  const items = [
    { label: "Categorie", value: data.category === "martial" ? "Martiale" : "Simple" },
    {
      label: "Degats",
      value: (
        <span className="mech">
          {formatFormulaNode(data.damage.dice)}
          {data.damage.type ? ` (${data.damage.type})` : ""}
        </span>
      ),
    },
    ...(data.versatile_damage
      ? [{ label: "Degats (2 mains)", value: <span className="mech">{formatFormulaNode(data.versatile_damage)}</span> }]
      : []),
    ...(data.properties.length > 0
      ? [{ label: "Proprietes", value: data.properties.map((p) => propertyLabel(p.key)).join(", ") }]
      : []),
    ...(data.range ? [{ label: "Portee", value: [quantityText(data.range.normal), quantityText(data.range.long)].filter(Boolean).join(" / ") }] : []),
    ...(data.weight ? [{ label: "Poids", value: quantityText(data.weight) as string }] : []),
    ...(data.cost ? [{ label: "Cout", value: costText(data.cost) as string }] : []),
  ];
  return <KeyValues items={items} />;
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
    ...(data.cost ? [{ label: "Cout", value: costText(data.cost) as string }] : []),
  ];
  return <KeyValues items={items} />;
}

function ItemProperties({ data }: { data: ItemPropertiesBlockData }) {
  const items = [
    ...(data.category ? [{ label: "Categorie", value: data.category }] : []),
    ...(data.weight ? [{ label: "Poids", value: quantityText(data.weight) as string }] : []),
    ...(data.cost ? [{ label: "Cout", value: costText(data.cost) as string }] : []),
    ...(data.rarity ? [{ label: "Rarete", value: ITEM_RARITY_LABELS_FR[data.rarity] ?? data.rarity }] : []),
    ...(data.requires_attunement !== undefined ? [{ label: "Attunement", value: data.requires_attunement ? "Requis" : "Non requis" }] : []),
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

function StatBlock({ data }: { data: StatBlockBlockData }) {
  const speedText = Object.entries(data.speed)
    .map(([kind, value]) => `${kind} ${value}`)
    .join(", ");
  const abilitiesText = (Object.keys(data.abilities) as (keyof typeof data.abilities)[])
    .map((k) => `${abilityLabel(k)} ${data.abilities[k]}`)
    .join(" · ");
  const items = [
    { label: "Taille / Type", value: `${SIZE_LABELS_FR[data.size] ?? data.size} ${CREATURE_TYPE_LABELS_FR[data.creature_type] ?? data.creature_type}`.trim() },
    ...(data.alignment ? [{ label: "Alignement", value: data.alignment }] : []),
    { label: "CA", value: String(data.armor_class) },
    { label: "PV", value: <span className="mech">{`${data.hit_points} (${data.hit_dice})`}</span> },
    { label: "Vitesse", value: speedText },
    { label: "Caracteristiques", value: <span className="mech">{abilitiesText}</span> },
    ...(data.saving_throws?.length ? [{ label: "Sauvegardes", value: data.saving_throws.map((s) => `${abilityLabel(s.ability)} +${s.bonus}`).join(", ") }] : []),
    ...(data.skills?.length ? [{ label: "Competences", value: data.skills.map((s) => `${s.name} +${s.bonus}`).join(", ") }] : []),
    ...(data.damage_vulnerabilities?.length ? [{ label: "Vulnerabilites", value: data.damage_vulnerabilities.join(", ") }] : []),
    ...(data.damage_resistances?.length ? [{ label: "Resistances", value: data.damage_resistances.join(", ") }] : []),
    ...(data.damage_immunities?.length ? [{ label: "Immunites (degats)", value: data.damage_immunities.join(", ") }] : []),
    ...(data.condition_immunities?.length ? [{ label: "Immunites (etats)", value: data.condition_immunities.join(", ") }] : []),
    ...(data.senses ? [{ label: "Sens", value: Object.entries(data.senses).map(([k, v]) => `${k} ${v}`).join(", ") }] : []),
    ...(data.languages ? [{ label: "Langues", value: data.languages }] : []),
    { label: "Facteur de puissance", value: String(data.challenge_rating) },
    { label: "Bonus de maitrise", value: `+${data.proficiency_bonus}` },
  ];
  return <KeyValues items={items} />;
}

function Traits({ data }: { data: TraitsBlockData }) {
  return <KeyValues items={data.traits.map((t) => ({ label: t.name, value: <p className="text-xs leading-relaxed">{t.description}</p> }))} />;
}

function Actions({ data }: { data: ActionsBlockData }) {
  return (
    <KeyValues
      items={data.actions.map((a) => ({
        label: a.name,
        value: (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs leading-relaxed">{a.description}</p>
            {(a.attack_bonus !== undefined || a.damage?.length) && (
              <p className="mech text-xs text-ink-muted">
                {a.attack_bonus !== undefined && `+${a.attack_bonus} pour toucher`}
                {a.attack_bonus !== undefined && a.damage?.length ? " · " : ""}
                {a.damage?.map((d) => `${formatFormulaNode(d.dice)}${d.type ? ` (${d.type})` : ""}`).join(", ")}
              </p>
            )}
          </div>
        ),
      }))}
    />
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

function SpellcastingProgression({ data }: { data: SpellcastingProgressionBlockData }) {
  const items = [
    { label: "Caracteristique d'incantation", value: abilityLabel(data.ability) },
    { label: "Debute au niveau", value: String(data.starts_at_level) },
    ...data.info.map((entry) => ({ label: entry.name, value: <p className="text-xs leading-relaxed">{entry.description}</p> })),
  ];
  return <KeyValues items={items} />;
}

function SubclassSlot({ data, worldSlug }: { data: SubclassSlotBlockData; worldSlug: string }) {
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
                    {opt.key}
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
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Choix {option.label}</span>
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
 * Mise en page (V1-D7, sur retour utilisateur) : caracteristiques/outil/
 * competences sur une meme ligne (trois faits courts, `key_values`
 * standard), le don en dessous sur toute la largeur (`fullWidth`, texte
 * long), l'equipement hors de `key_values` — deux encadres cote a cote
 * plutot qu'une paire etiquette/valeur de plus, cf. BackgroundEquipmentCard.
 */
function Background({ data, worldSlug }: { data: ResolvedBackgroundBlockData; worldSlug: string }) {
  const items = [
    { label: "Valeurs de caracteristique", value: data.ability_scores.map(abilityLabel).join(", ") },
    ...(data.tool_proficiency ? [{ label: "Maitrise d'outil", value: proficiencyLabel(data.tool_proficiency) }] : []),
    { label: "Maitrises de competence", value: data.skill_proficiencies.map(skillLabel).join(", ") },
    {
      label: "Don",
      fullWidth: true,
      value: (
        <div className="flex flex-col gap-0.5">
          <Link href={`/m/${worldSlug}/regles/${data.feat.key}`} className="hover:underline" style={{ color: "var(--link-rule)" }}>
            {data.feat_name}
          </Link>
          {data.feat_description && <p className="text-xs leading-relaxed">{data.feat_description}</p>}
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <KeyValues items={items} />
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Equipement de depart</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
  if (blockType === "description") return <Prose segments={(data as DescriptionBlockData).segments} />;
  if (blockType === "spell_casting") return <SpellCasting data={data as SpellCastingBlockData} />;
  if (blockType === "effects") return <Effects data={data as EffectsBlockData} />;
  if (blockType === "scaling") return <Scaling data={data as ScalingBlockData} />;
  if (blockType === "class_progression")
    return <ClassProgression data={data as ClassProgressionBlockData} worldSlug={worldSlug} outgoingRefs={outgoingRefs} />;
  if (blockType === "custom_table") return <CustomTable data={data as CustomTableBlockData} />;
  if (blockType === "weapon") return <Weapon data={data as WeaponBlockData} />;
  if (blockType === "armor") return <Armor data={data as ArmorBlockData} />;
  if (blockType === "item_properties") return <ItemProperties data={data as ItemPropertiesBlockData} />;
  if (blockType === "charges") return <Charges data={data as ChargesBlockData} />;
  if (blockType === "stat_block") return <StatBlock data={data as StatBlockBlockData} />;
  if (blockType === "traits") return <Traits data={data as TraitsBlockData} />;
  if (blockType === "actions") return <Actions data={data as ActionsBlockData} />;
  if (blockType === "prerequisites") return <Prerequisites data={data as PrerequisitesBlockData} />;
  if (blockType === "class_basics") return <ClassBasics data={data as ClassBasicsBlockData} />;
  if (blockType === "spellcasting_progression") return <SpellcastingProgression data={data as SpellcastingProgressionBlockData} />;
  if (blockType === "subclass_slot") return <SubclassSlot data={data as SubclassSlotBlockData} worldSlug={worldSlug} />;
  if (blockType === "background") return <Background data={data as ResolvedBackgroundBlockData} worldSlug={worldSlug} />;
  return null;
}
