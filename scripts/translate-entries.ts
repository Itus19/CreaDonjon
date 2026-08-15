// Traduction officielle par lot, generique (V1-A1b, suite) : prend un
// fichier JSON de candidats {nom anglais: nom francais propose} et un
// entry_type, verifie chaque candidat mot pour mot dans le texte officiel
// extrait (data/srd/fr-source/*.txt), n'ecrit que ce qui est confirme
// (source='official_srd'). Meme principe que translate-srd-official.ts,
// generalise pour ne pas reecrire ce mecanisme a chaque categorie
// (monstres, sorts, objets...).
//
// Lancement : npm run translate:entries -- <entry_type> <chemin_json>
// Exemple   : npm run translate:entries -- monster scripts/data/monster-fr.json

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local)."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESETS = {
  "5.1": { id: "41ebff94-aabc-4f5c-b437-28f2f7a195ee", textFile: "data/srd/fr-source/srd-5.1-fr.txt" },
  "5.2.1": { id: "110d20e9-dd80-4752-a57e-a957601b4eae", textFile: "data/srd/fr-source/srd-5.2.1-fr.txt" },
} as const;

async function listAllEntries(rulesetId: string, entryType: string) {
  const all: { id: string; source_raw: unknown }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, source_raw")
      .eq("ruleset_id", rulesetId)
      .eq("entry_type", entryType)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--force");
  const FORCE = process.argv.includes("--force");
  const [entryType, candidatesPath] = args;
  if (!entryType || !candidatesPath) {
    throw new Error("Usage: translate:entries -- <entry_type> <chemin_json_candidats> [--force]");
  }

  const candidates: Record<string, string> = JSON.parse(readFileSync(candidatesPath, "utf-8"));
  console.log(`${Object.keys(candidates).length} candidats charges pour entry_type='${entryType}'.`);

  let totalWritten = 0;
  const allSkipped: string[] = [];

  for (const [label, { id: rulesetId, textFile }] of Object.entries(RULESETS)) {
    console.log(`\n--- ${label} ---`);
    const text = readFileSync(textFile, "utf-8");
    // Repli pour les en-tetes coupes sur plusieurs lignes par la mise en
    // page du PDF (ex. "Conduit divin \r\r\n(1/repos)") : le texte brut
    // separe les mots par un saut de ligne plutot qu'une espace, donc
    // `text.includes(candidat)` echoue meme quand le terme est bien present.
    // Sans danger de faux positif malgre l'aplatissement de tout le
    // document : chaque candidat est une expression precise de plusieurs
    // mots, jamais un mot isole susceptible d'enjamber deux paragraphes
    // par coincidence.
    const flatText = text.replace(/\s+/g, " ");

    const verified: Record<string, string> = {};
    for (const [en, fr] of Object.entries(candidates)) {
      // Le texte officiel utilise l'apostrophe courbe (') partout ; un
      // candidat ecrit avec l'apostrophe droite ne matcherait jamais sinon.
      // On stocke la forme qui a reellement matche, jamais l'inverse.
      const curly = fr.replace(/'/g, "’");
      const frFlat = fr.replace(/\s+/g, " ");
      const curlyFlat = curly.replace(/\s+/g, " ");
      if (text.includes(fr)) verified[en] = fr;
      else if (text.includes(curly)) verified[en] = curly;
      else if (flatText.includes(frFlat)) verified[en] = fr;
      else if (flatText.includes(curlyFlat)) verified[en] = curly;
      else allSkipped.push(`${en} -> "${fr}" (non trouve dans ${textFile})`);
    }
    console.log(`${Object.keys(verified).length}/${Object.keys(candidates).length} verifies dans le texte officiel.`);

    const entries = await listAllEntries(rulesetId, entryType);
    const candidateEntryIds: string[] = [];
    for (const entry of entries) {
      const name = (entry.source_raw as { name?: unknown } | null)?.name;
      if (typeof name === "string" && verified[name]) candidateEntryIds.push(entry.id);
    }

    // Garde-fou (V1-D3b, troisieme incident du meme genre en une session) :
    // un candidat verifie peut matcher n'importe ou dans le texte aplati
    // (ex. un mot nu qui matche l'en-tete court d'une description, alors
    // qu'un nom deja en base venait de la ligne de tableau plus precise,
    // qualifiee) — jamais ecraser un nom EXISTANT et DIFFERENT sans le
    // signaler. Sans --force, ces cas sont ignores et listes, jamais
    // ecrits silencieusement.
    const existingNames = new Map<string, string | null>();
    for (let i = 0; i < candidateEntryIds.length; i += 200) {
      const chunk = candidateEntryIds.slice(i, i + 200);
      const { data, error } = await supabase.from("ruleset_entry_translations").select("entry_id, name").eq("locale", "fr").in("entry_id", chunk);
      if (error) throw new Error(error.message);
      for (const row of data) existingNames.set(row.entry_id, row.name);
    }

    const rows: { entry_id: string; locale: string; name: string; source: string }[] = [];
    const conflicts: string[] = [];
    for (const entry of entries) {
      const name = (entry.source_raw as { name?: unknown } | null)?.name;
      if (typeof name !== "string" || !verified[name]) continue;
      const newName = verified[name];
      const existing = existingNames.get(entry.id);
      if (existing && existing !== newName && !FORCE) {
        conflicts.push(`${name} : deja "${existing}" en base, candidat "${newName}" ignore (--force pour ecraser)`);
        continue;
      }
      rows.push({ entry_id: entry.id, locale: "fr", name: newName, source: "official_srd" });
    }

    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from("ruleset_entry_translations")
        .upsert(rows.slice(i, i + BATCH), { onConflict: "entry_id,locale" });
      if (error) throw new Error(error.message);
    }
    console.log(`${rows.length} traductions ecrites (source='official_srd').`);
    if (conflicts.length > 0) {
      console.log(`${conflicts.length} conflit(s) avec un nom deja en base, ignore(s) :`);
      for (const c of conflicts) console.log(`  - ${c}`);
    }
    totalWritten += rows.length;
  }

  console.log(`\nTermine : ${totalWritten} traductions ecrites au total pour '${entryType}'.`);
  if (allSkipped.length > 0) {
    console.log(`\nIgnores (${allSkipped.length}, terme non verifie) :`);
    for (const s of allSkipped) console.log(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
