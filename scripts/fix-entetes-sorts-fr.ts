// V3.1-189 : l'en-tête de sorts mal lu à l'import dans les traductions
// françaises du SRD (5.1 et 5.2.1) — durée vide, composante matérielle perdue,
// texte du sort pris pour l'en-tête. Chaque en-tête est relu dans la source
// française (CC-BY-4.0, attribution dans NOTICE.md) par
// `src/core/text/enTeteSortPdf.ts` (testé), en cherchant le sort par son titre
// français, et seuls les champs qui diffèrent sont réécrits (le niveau et
// l'école ne sont pas touchés). Aucun texte de règle dans ce fichier.
//
// À blanc par défaut (chaque écart listé) ; `--write` écrit. Relançable.
// Lancement : npx tsx --env-file=.env.local scripts/fix-entetes-sorts-fr.ts [--write]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { lireEnTeteDeSort, type EnTeteSort } from "../src/core/text/enTeteSortPdf";

const RULESETS = [
  { id: "41ebff94-aabc-4f5c-b437-28f2f7a195ee", nom: "SRD 5.1", source: "data/srd/fr-source/srd-5.1-fr.txt" },
  { id: "110d20e9-dd80-4752-a57e-a957601b4eae", nom: "SRD 5.2.1", source: "data/srd/fr-source/srd-5.2.1-fr.txt" },
];

const CHAMPS: (keyof EnTeteSort)[] = ["casting_time", "range", "components", "material", "duration", "concentration", "ritual"];
const egal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function main() {
  const ecrire = process.argv.includes("--write");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  const supabase = createClient(url, cle, { auth: { persistSession: false } });
  const introuvables: string[] = [];

  for (const rs of RULESETS) {
    const lignes = readFileSync(rs.source, "utf-8").split(/\r\n|\n|\r/);
    const { data: sorts, error } = await supabase.from("ruleset_entries").select("id, entry_key").eq("ruleset_id", rs.id).eq("entry_type", "spell").order("id");
    if (error) throw new Error(error.message);
    let n = 0;
    for (let i = 0; i < (sorts ?? []).length; i += 200) {
      const lot = sorts!.slice(i, i + 200);
      const { data: trads, error: e2 } = await supabase.from("ruleset_entry_translations").select("entry_id, name, blocks").eq("locale", "fr").in("entry_id", lot.map((x) => x.id));
      if (e2) throw new Error(e2.message);
      for (const t of trads ?? []) {
        const entryKey = lot.find((x) => x.id === t.entry_id)!.entry_key;
        const blocs = (t.blocks ?? {}) as Record<string, unknown> & { spell_casting?: Record<string, unknown> };
        if (!blocs.spell_casting || !t.name) continue;
        const lu = lireEnTeteDeSort(lignes, t.name);
        if (!lu) {
          introuvables.push(`${rs.nom} · ${entryKey} (« ${t.name} »)`);
          continue;
        }
        const ecarts = CHAMPS.filter((c) => !egal(blocs.spell_casting![c], lu[c]));
        if (ecarts.length === 0) continue;
        n++;
        console.log(`${rs.nom} · ${entryKey} (« ${t.name} »)`);
        for (const c of ecarts) console.log(`    ${c} : ${JSON.stringify(blocs.spell_casting[c] ?? null)} → ${JSON.stringify(lu[c] ?? null)}`);
        if (ecrire) {
          const sc: Record<string, unknown> = { ...blocs.spell_casting };
          for (const c of CHAMPS) sc[c] = lu[c];
          if (lu.material === undefined) delete sc.material;
          const { error: e3 } = await supabase.from("ruleset_entry_translations").update({ blocks: { ...blocs, spell_casting: sc } }).eq("entry_id", t.entry_id).eq("locale", "fr");
          if (e3) throw new Error(`${entryKey} : ${e3.message}`);
        }
      }
    }
    console.log(`${rs.nom} : ${n} sort(s) ${ecrire ? "corrigé(s)" : "à corriger"}.\n`);
  }
  if (introuvables.length) {
    console.log(`${introuvables.length} sort(s) dont l'en-tête n'a pas été trouvé dans la source (non touchés) :`);
    for (const x of introuvables) console.log(`  ${x}`);
  }
  if (!ecrire) console.log("\nÀ blanc : rien n'est écrit. Relancer avec --write.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
