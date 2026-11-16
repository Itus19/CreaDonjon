import {
  COVERAGE_BRICKS,
  coverageCategoryOf,
  coverageOf,
  coverageTally,
  type CoverageCategory,
  type CoverageFacts,
  type CoverageResult,
  type RawGap,
} from "./coverage";

/**
 * V3.1-214 (ADR 0100) — l'assemblage des faits d'une fiche et la mise en forme du rapport
 * `docs/couverture-srd.md`. Pur : le script lit la base, ce fichier calcule et met en page.
 */

export interface ReportEntry {
  id: string;
  key: string;
  type: string;
  /** Le nom français, ou la clé à défaut. */
  name: string;
  sourceRaw: unknown;
  blocks: readonly { block_type: string; data: unknown }[];
}

export interface ReportRow {
  key: string;
  name: string;
  type: string;
  category: CoverageCategory;
  result: CoverageResult;
  /** Niveau de la règle (sort, aptitude de classe), quand on sait le lire. */
  level?: number;
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const chaine = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const blocDe = (e: ReportEntry, type: string): unknown => e.blocks.find((b) => b.block_type === type)?.data;

/** Le niveau : `level` numérique, ou `level.index` « classe-N », ou le bloc `spell_casting`. */
export function levelOfEntry(sourceRaw: unknown, blocks: readonly { block_type: string; data: unknown }[]): number | undefined {
  const raw = estObjet(sourceRaw) ? sourceRaw.level : undefined;
  if (typeof raw === "number") return raw;
  if (estObjet(raw)) {
    const m = /-(\d+)$/.exec(chaine(raw.index) ?? "");
    if (m) return Number(m[1]);
  }
  const sort = blocks.find((b) => b.block_type === "spell_casting")?.data;
  if (estObjet(sort) && typeof sort.level === "number") return sort.level;
  return undefined;
}

function lacunesDe(data: unknown): RawGap[] {
  if (!estObjet(data)) return [];
  const gaps: RawGap[] = [];
  for (const g of liste(data.gaps)) {
    if (!estObjet(g)) continue;
    const text = chaine(g.text);
    if (text === undefined) continue;
    gaps.push({ text, missing: chaine(g.missing) ?? "", brick: chaine(g.brick) });
  }
  return gaps;
}

function faitsSimples(e: ReportEntry, category: CoverageCategory): CoverageFacts {
  switch (category) {
    case "monster": {
      const actions = estObjet(blocDe(e, "actions")) ? liste((blocDe(e, "actions") as Record<string, unknown>).actions) : [];
      const traits = estObjet(blocDe(e, "traits")) ? liste((blocDe(e, "traits") as Record<string, unknown>).traits) : [];
      return {
        category: "monster",
        actions: actions.filter(estObjet).map((a) => ({
          name: chaine(a.name) ?? "",
          attack: a.attack_bonus !== undefined,
          damage: liste(a.damage).length > 0,
        })),
        traits: traits.filter(estObjet).map((t) => ({ name: chaine(t.name) ?? "" })),
      };
    }
    case "condition":
      return { category: "condition", key: e.key };
    case "feature":
    case "spell":
    case "magic_item":
    case "weapon":
    case "armor":
    case "class":
      return { category, blockTypes: e.blocks.map((b) => b.block_type), gaps: lacunesDe(blocDe(e, "coverage")) };
    default:
      return { category: "out_of_scope" };
  }
}

/** Les fiches simples d'abord, puis les espèces et sous-classes, qui agrègent des aptitudes. Tri par clé. */
export function assembleCoverage(entries: readonly ReportEntry[]): ReportRow[] {
  const tries = [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const parClé = new Map<string, ReportRow>();
  const rows: ReportRow[] = [];
  const ligne = (e: ReportEntry, category: CoverageCategory, result: CoverageResult): ReportRow => ({
    key: e.key,
    name: e.name,
    type: e.type,
    category,
    result,
    level: levelOfEntry(e.sourceRaw, e.blocks),
  });

  const agregees: { e: ReportEntry; category: CoverageCategory }[] = [];
  for (const e of tries) {
    const category = coverageCategoryOf(e.type);
    if (category === "species" || category === "subclass") {
      agregees.push({ e, category });
      continue;
    }
    const row = ligne(e, category, coverageOf(faitsSimples(e, category)));
    rows.push(row);
    if (category === "feature") parClé.set(e.key, row);
  }

  for (const { e, category } of agregees) {
    let parts: CoverageResult[];
    if (category === "species") {
      const traits = estObjet(blocDe(e, "species_traits")) ? liste((blocDe(e, "species_traits") as Record<string, unknown>).traits) : [];
      parts = traits
        .filter(estObjet)
        .filter((t) => t.kind === "rule")
        .map((t) => parClé.get(chaine(t.key) ?? ""))
        .filter((r): r is ReportRow => r !== undefined)
        .map((r) => r.result);
    } else {
      parts = tries
        .filter((f) => coverageCategoryOf(f.type) === "feature")
        .filter((f) => estObjet(f.sourceRaw) && estObjet(f.sourceRaw.subclass) && f.sourceRaw.subclass.index === e.key)
        .map((f) => parClé.get(f.key)?.result)
        .filter((r): r is CoverageResult => r !== undefined);
    }
    rows.push(ligne(e, category, coverageOf({ category: category as "species" | "subclass", parts })));
  }
  return rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const CATEGORIES: { category: CoverageCategory; label: string }[] = [
  { category: "feature", label: "Aptitudes et dons" },
  { category: "spell", label: "Sorts" },
  { category: "magic_item", label: "Objets magiques" },
  { category: "weapon", label: "Armes" },
  { category: "armor", label: "Armures" },
  { category: "class", label: "Classes" },
  { category: "subclass", label: "Sous-classes" },
  { category: "species", label: "Espèces" },
  { category: "monster", label: "Monstres" },
  { category: "condition", label: "États" },
];

const BRIQUES: Record<string, string> = {
  timing: "Moment ou limite",
  duration: "Durée",
  choice: "Choix",
  spell_slots: "Emplacements de sort",
  turn_restriction: "Restriction de tour",
  target_filter: "Cibles filtrées",
  scaling: "Progression par niveau",
  area_damage: "Dégâts de zone",
  equipment_condition: "Condition d'équipement",
  ending_event: "Événement de fin",
  monster_action: "Action de monstre",
  monster_trait: "Trait de monstre",
  other: "Autre",
};

const pct = (n: number, total: number): string => (total === 0 ? "–" : `${Math.round((n / total) * 100)} %`);
const cellule = (s: string): string => s.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
const compare = (a: ReportRow, b: ReportRow): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** Le Markdown du rapport. Ordre stable : la date tient sur une seule ligne, le reste ne dépend que des données. */
export function formatCoverageReport(rows: readonly ReportRow[], date: string, command: string): string {
  const triees = [...rows].sort(compare);
  const out: string[] = [];
  out.push("# Couverture du SRD 5.2");
  out.push("");
  out.push(`Généré le ${date}.`);
  out.push("");
  out.push(`Pour régénérer (lecture seule, à la main) : \`${command}\``);
  out.push("");
  out.push("Ce que « jouable » veut dire : voir l'ADR 0100. Fichier généré, ne pas l'éditer à la main.");
  out.push("");
  out.push("## Par catégorie");
  out.push("");
  out.push("| Catégorie | Jouables | Partielles | Non évaluées | Total | % jouable |");
  out.push("|---|---:|---:|---:|---:|---:|");
  const toutes = [];
  for (const { category, label } of CATEGORIES) {
    const resultats = triees.filter((r) => r.category === category).map((r) => r.result);
    toutes.push(...resultats);
    const t = coverageTally(resultats);
    out.push(`| ${label} | ${t.playable} | ${t.partial} | ${t.unevaluated} | ${t.total} | ${pct(t.playable, t.total)} |`);
  }
  const g = coverageTally(toutes);
  out.push(`| **Ensemble** | ${g.playable} | ${g.partial} | ${g.unevaluated} | ${g.total} | ${pct(g.playable, g.total)} |`);
  out.push("");

  out.push("## Lacunes par brique");
  out.push("");
  out.push("Chaque lacune compte une fois, sur la fiche qui la porte : une espèce ou une sous-classe est partielle à cause de ses aptitudes, sans recompter leurs lacunes.");
  out.push("");
  out.push("| Brique | Lacunes |");
  out.push("|---|---:|");
  // Les lacunes d'une espèce ou d'une sous-classe sont celles de ses aptitudes, déjà listées : ne pas les compter deux fois.
  const lacunes = triees.filter((r) => r.category !== "species" && r.category !== "subclass").flatMap((r) => r.result.gaps.map((gap) => ({ row: r, gap })));
  for (const b of COVERAGE_BRICKS) {
    out.push(`| \`${b}\` (${BRIQUES[b] ?? b}) | ${lacunes.filter((l) => l.gap.brick === b).length} |`);
  }
  out.push("");
  out.push("## Règles concernées, par brique");
  out.push("");
  for (const b of COVERAGE_BRICKS) {
    const ici = lacunes.filter((l) => l.gap.brick === b);
    if (ici.length === 0) continue;
    out.push(`### \`${b}\` (${BRIQUES[b] ?? b}) — ${ici.length}`);
    out.push("");
    for (const { row, gap } of ici) out.push(`- ${cellule(row.name)} (\`${row.key}\`) : ${cellule(gap.text)}`);
    out.push("");
  }

  out.push("## Fréquentes d'abord");
  out.push("");
  const frequentes = (cat: CoverageCategory, min: number, max: number) =>
    triees.filter((r) => r.category === cat && r.result.state !== "playable" && r.level !== undefined && r.level >= min && r.level <= max);
  const liste1 = (titre: string, items: ReportRow[]) => {
    out.push(`### ${titre} — ${items.length}`);
    out.push("");
    for (const r of items) {
      const etat = r.result.state === "partial" ? "partielle" : "non évaluée";
      out.push(`- niveau ${r.level} : ${cellule(r.name)} (\`${r.key}\`), ${etat}`);
    }
    out.push("");
  };
  liste1("Aptitudes non jouables, niveaux 1 à 5", frequentes("feature", 1, 5));
  liste1("Sorts non jouables, niveaux 0 à 3", frequentes("spell", 0, 3));
  return out.join("\n").replace(/\n+$/, "\n");
}
