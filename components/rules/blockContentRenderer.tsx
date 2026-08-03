import type { ReactNode } from "react";
import Link from "next/link";
import { formatFormulaNode } from "@/src/core/formula";
import type {
  BlockType,
  ClassProgressionBlockData,
  CustomTableBlockData,
  DescriptionBlockData,
  EffectsBlockData,
  ScalingBlockData,
  SpellCastingBlockData,
} from "@/src/core/schemas/rule-blocks";
import type { RuleRefView } from "@/src/server/services/rules";
import FormulaList from "./layouts/FormulaList";
import KeyValues from "./layouts/KeyValues";
import Prose from "./layouts/Prose";
import ProgressionTable from "./layouts/ProgressionTable";
import Table from "./layouts/Table";

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
  return null;
}
