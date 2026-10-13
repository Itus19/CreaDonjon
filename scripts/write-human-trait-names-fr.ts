// V3.1-116 (vérification du 11 octobre : « Polyvalente » listé parmi les
// traits de l'Humain). `translate-entries.ts` traduit par NOM anglais : le
// trait « Versatile » et la propriété d'arme « Versatile » ont reçu le même
// nom, « Polyvalente », celui de la propriété. La même table donnait
// « Polyvalent » à « Skillful » et « Compétent » à « Skilled ».
//
// Ici, la correction se fait par CLÉ d'entrée, sans ambiguïté possible.
// Noms vérifiés mot pour mot dans data/srd/fr-source/srd-5.2.1-fr.txt :
//  - « Compétent. Vous recevez la maîtrise d'une compétence » (trait humain) ;
//  - « Polyvalent. Vous recevez le don d'origines de votre choix » (trait humain) ;
//  - « Doué est recommandé » (le don Skilled).
// Contrairement aux autres scripts de noms, un nom existant DIFFÉRENT est
// écrasé : c'est précisément l'erreur à corriger.
//
// Lancement : npx tsx --env-file=.env.local scripts/write-human-trait-names-fr.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESET_5_2_1 = "110d20e9-dd80-4752-a57e-a957601b4eae";
const WRITE = process.argv.includes("--write");

const TARGETS: { entryKey: string; name: string }[] = [
  { entryKey: "versatile", name: "Polyvalent" },
  { entryKey: "skillful", name: "Compétent" },
  { entryKey: "skilled", name: "Doué" },
];

async function main() {
  for (const t of TARGETS) {
    const { data: entry, error: entryError } = await supabase
      .from("ruleset_entries")
      .select("id, entry_type")
      .eq("ruleset_id", RULESET_5_2_1)
      .eq("entry_key", t.entryKey)
      .maybeSingle();
    if (entryError) throw new Error(`${t.entryKey} : ${entryError.message}`);
    if (!entry) {
      console.log(`[introuvable] ${t.entryKey}`);
      continue;
    }
    const { data: existing, error: readError } = await supabase
      .from("ruleset_entry_translations")
      .select("name, blocks")
      .eq("entry_id", entry.id)
      .eq("locale", "fr")
      .maybeSingle();
    if (readError) throw new Error(`${t.entryKey} : ${readError.message}`);
    if (existing?.name === t.name) {
      console.log(`[deja juste] ${t.entryKey} -> ${t.name}`);
      continue;
    }
    console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} ${t.entryKey} : "${existing?.name ?? "(aucun)"}" -> "${t.name}"`);
    if (!WRITE) continue;
    const { error } = await supabase
      .from("ruleset_entry_translations")
      .upsert({ entry_id: entry.id, locale: "fr", name: t.name, blocks: existing?.blocks ?? {}, source: "official_srd" }, { onConflict: "entry_id,locale" });
    if (error) throw new Error(`${t.entryKey} : ${error.message}`);
  }
  if (!WRITE) console.log("\n(mode dry-run, relancer avec --write pour ecrire en base)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
