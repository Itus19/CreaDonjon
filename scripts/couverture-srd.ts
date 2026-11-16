// V3.1-214 (ADR 0100) — le rapport de couverture de l'officiel SRD 5.2.
//
// Lecture seule : ce script n'écrit rien en base, seulement docs/couverture-srd.md.
// Le calcul vit dans src/core/rules/coverage.ts et coverageReport.ts (purs, testés).
//
// Coût (QUOTAS) : environ 2 requêtes pour les rulesets, une par tranche de 1 000
// fiches (quelques unités), puis, par lot de 300 fiches, une requête de noms français
// et une ou plusieurs de blocs (plafond de 1 000 lignes par requête : on pagine).
// Pour environ 1 300 fiches : de l'ordre de 40 à 60 requêtes de lecture au total.
// À lancer à la main seulement, une fois après un ticket de données : jamais dans
// l'app, jamais dans les tests, jamais en boucle.
//
// Lancement : npx tsx --env-file=.env.local scripts/couverture-srd.ts

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assembleCoverage, formatCoverageReport, type ReportEntry } from "../src/core/rules/coverageReport";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PAGE = 1000;
const LOT = 300;
const COMMANDE = "npx tsx --env-file=.env.local scripts/couverture-srd.ts";
const SORTIE = new URL("../docs/couverture-srd.md", import.meta.url);

interface FicheLue {
  id: string;
  entry_key: string;
  entry_type: string;
  source_raw: unknown;
}

async function lireFiches(rulesetId: string): Promise<FicheLue[]> {
  const fiches: FicheLue[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, entry_key, entry_type, source_raw")
      .eq("ruleset_id", rulesetId)
      .order("entry_key")
      .range(debut, debut + PAGE - 1);
    if (error) throw new Error(`Lecture des fiches : ${error.message}`);
    fiches.push(...data);
    if (data.length < PAGE) break;
  }
  return fiches;
}

function parLots<T>(items: readonly T[], taille: number): T[][] {
  const lots: T[][] = [];
  for (let i = 0; i < items.length; i += taille) lots.push(items.slice(i, i + taille));
  return lots;
}

async function main(): Promise<void> {
  const { data: rulesets, error: errRulesets } = await supabase
    .from("rulesets")
    .select("id, name")
    .eq("base_system", "dnd_srd_52")
    .eq("is_official_base", true);
  if (errRulesets) throw new Error(`Lecture des rulesets : ${errRulesets.message}`);
  if (rulesets.length !== 1) throw new Error(`Un seul ruleset officiel SRD 5.2 attendu, ${rulesets.length} trouvés.`);
  const ruleset = rulesets[0];
  console.log(`Ruleset : ${ruleset.name}`);

  const fiches = await lireFiches(ruleset.id);
  console.log(`${fiches.length} fiches lues.`);

  const noms = new Map<string, string>();
  const blocs = new Map<string, { block_type: string; data: unknown }[]>();
  for (const lot of parLots(
    fiches.map((f) => f.id),
    LOT,
  )) {
    const { data: tr, error: errTr } = await supabase
      .from("ruleset_entry_translations")
      .select("entry_id, name")
      .eq("locale", "fr")
      .in("entry_id", lot);
    if (errTr) throw new Error(`Lecture des noms : ${errTr.message}`);
    for (const t of tr) noms.set(t.entry_id, t.name);

    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase
        .from("ruleset_entry_blocks")
        .select("entry_id, block_type, data")
        .in("entry_id", lot)
        .order("entry_id")
        .order("display_order")
        .range(debut, debut + PAGE - 1);
      if (error) throw new Error(`Lecture des blocs : ${error.message}`);
      for (const b of data) {
        const liste = blocs.get(b.entry_id) ?? [];
        liste.push({ block_type: b.block_type, data: b.data });
        blocs.set(b.entry_id, liste);
      }
      if (data.length < PAGE) break;
    }
  }

  const entrees: ReportEntry[] = fiches.map((f) => ({
    id: f.id,
    key: f.entry_key,
    type: f.entry_type,
    name: noms.get(f.id) ?? f.entry_key,
    sourceRaw: f.source_raw,
    blocks: blocs.get(f.id) ?? [],
  }));

  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(SORTIE, formatCoverageReport(assembleCoverage(entrees), date, COMMANDE));
  console.log("docs/couverture-srd.md écrit.");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
