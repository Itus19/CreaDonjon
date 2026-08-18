// V1-E3 (specs/outils-mj.md §4.1) : ecrit l'entree de ruleset
// `encounter-budget` (entry_type "rule") pour le SRD 5.2.1 — la table
// "Budget de PX par personnage", verifiee mot pour mot dans
// data/srd/fr-source/srd-5.2.1-fr.txt, lignes 20805-20829 (section
// « Difficulte d'une rencontre de combat »).
//
// Le SRD 5.1 (2014) sous licence dans ce depot NE CONTIENT PAS cette
// table (contenu du Guide du Maitre, jamais republie dans les Regles de
// base couvertes par la licence libre 2014) — volontairement absent ici,
// aucune valeur inventee.
//
// Bloc `custom_table` en-tetes deja en francais (meme convention que les
// tables de progression de classe : `components/rules/layouts/Table.tsx`
// lit `row[colonne]`, les cles SONT les en-tetes affiches).
//
// Lancement : npx tsx --env-file=.env.local scripts/write-encounter-budget-2024.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESET_5_2_1 = "110d20e9-dd80-4752-a57e-a957601b4eae";
const ENTRY_KEY = "encounter-budget";
const WRITE = process.argv.includes("--write");

// [niveau, faible, moderee, elevee] — table complete, verifiee ligne par
// ligne contre le texte source.
const ROWS: [number, number, number, number][] = [
  [1, 50, 75, 100],
  [2, 100, 150, 200],
  [3, 150, 225, 400],
  [4, 250, 375, 500],
  [5, 500, 750, 1100],
  [6, 600, 1000, 1400],
  [7, 750, 1300, 1700],
  [8, 1000, 1700, 2100],
  [9, 1300, 2000, 2600],
  [10, 1600, 2300, 3100],
  [11, 1900, 2900, 4100],
  [12, 2200, 3700, 4700],
  [13, 2600, 4200, 5400],
  [14, 2900, 4900, 6200],
  [15, 3300, 5400, 7800],
  [16, 3800, 6100, 9800],
  [17, 4500, 7200, 11700],
  [18, 5000, 8700, 14200],
  [19, 5500, 10700, 17200],
  [20, 6400, 13200, 22000],
];

const COLUMNS = ["Niveau", "Faible", "Modérée", "Élevée"];
const TABLE_DATA = {
  __v: 1,
  columns: COLUMNS,
  rows: ROWS.map(([level, low, moderate, high]) => ({
    Niveau: String(level),
    Faible: String(low),
    Modérée: String(moderate),
    Élevée: String(high),
  })),
};

const ENTRY_NAME_FR = "Budget de rencontre par personnage";

async function main() {
  const { data: existing, error: existingError } = await supabase
    .from("ruleset_entries")
    .select("id")
    .eq("ruleset_id", RULESET_5_2_1)
    .eq("entry_key", ENTRY_KEY)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    console.log(`entry_key "${ENTRY_KEY}" existe deja (id ${existing.id}) — rien a creer, relire manuellement si une correction est necessaire.`);
    return;
  }

  console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} ruleset_entries : ${ENTRY_KEY} (rule, SRD 5.2.1)`);
  console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} ruleset_entry_blocks : custom_table, ${TABLE_DATA.rows.length} lignes`);
  console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} ruleset_entry_translations : fr, "${ENTRY_NAME_FR}"`);

  if (!WRITE) {
    console.log("\n(mode dry-run, relancer avec --write pour ecrire en base)");
    return;
  }

  const { data: entry, error: entryError } = await supabase
    .from("ruleset_entries")
    .insert({
      ruleset_id: RULESET_5_2_1,
      entry_key: ENTRY_KEY,
      entry_type: "rule",
      source_attribution: "SRD 5.2.1",
    })
    .select("id")
    .single();
  if (entryError || !entry) throw new Error(entryError?.message ?? "insertion de l'entree echouee");

  const { error: blockError } = await supabase.from("ruleset_entry_blocks").insert({
    entry_id: entry.id,
    block_type: "custom_table",
    display: { label: ENTRY_NAME_FR, layout: "table" },
    data: TABLE_DATA,
    display_order: 100,
  });
  if (blockError) throw new Error(blockError.message);

  const { error: translationError } = await supabase.from("ruleset_entry_translations").upsert(
    { entry_id: entry.id, locale: "fr", name: ENTRY_NAME_FR, source: "official_srd" },
    { onConflict: "entry_id,locale" }
  );
  if (translationError) throw new Error(translationError.message);

  console.log(`\n[ecrit] entree "${ENTRY_KEY}" creee (id ${entry.id}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
