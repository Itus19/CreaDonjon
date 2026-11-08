// V3.1-188 : deux restes de l'extraction du PDF dans les traductions françaises
// du SRD (5.1 et 5.2.1), après V3.1-180 et 187 :
//   1. la fin du sous-titre d'un objet magique (rareté, harmonisation) a glissé
//      au début de sa description (« (bronze) ou légendaire (fer) Souffler… ») :
//      le sous-titre entier, relu dans la source, est remis en tête, en italique ;
//   2. *divination* (5.2.1) n'a pour description que la fin de son en-tête ; son
//      texte, déplacé par la mise en page au milieu du sort suivant, est relu.
// Règles dans `src/core/text/sousTitresPdf.ts` (testées) ; aucun texte de règle ici.
//
// À blanc par défaut ; `--write` écrit. Relançable.
// Lancement : npx tsx --env-file=.env.local scripts/fix-debuts-fr.ts [--write]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fragmentDeSousTitre, paragraphesDeLaSource, retrouverSousTitre } from "../src/core/text/sousTitresPdf";

const RULESETS = [
  { id: "41ebff94-aabc-4f5c-b437-28f2f7a195ee", nom: "SRD 5.1", source: "data/srd/fr-source/srd-5.1-fr.txt" },
  { id: "110d20e9-dd80-4752-a57e-a957601b4eae", nom: "SRD 5.2.1", source: "data/srd/fr-source/srd-5.2.1-fr.txt" },
];

/** Les passages déplacés : où commence le texte de la fiche dans la source, et la ligne qui le suit. */
const DEPLACES: Record<string, Record<string, { debut: string; jusqua: string }>> = {
  "SRD 5.2.1": { divination: { debut: "Ce sort vous met en contact avec un dieu ou ses serviteurs.", jusqua: "Doigt de mort" } },
};

type Blocs = { description?: { segments?: { text?: string }[] } } & Record<string, unknown>;

async function main() {
  const ecrire = process.argv.includes("--write");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  const supabase = createClient(url, cle, { auth: { persistSession: false } });
  const refus: string[] = [];

  for (const rs of RULESETS) {
    const lignes = readFileSync(rs.source, "utf-8").split(/\r\n|\n|\r/);
    let n = 0;
    for (let from = 0; ; from += 1000) {
      const { data: entrees, error } = await supabase.from("ruleset_entries").select("id, entry_key").eq("ruleset_id", rs.id).order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      if (!entrees || entrees.length === 0) break;
      for (let i = 0; i < entrees.length; i += 200) {
        const lot = entrees.slice(i, i + 200);
        const { data: trads, error: e2 } = await supabase.from("ruleset_entry_translations").select("entry_id, name, blocks").eq("locale", "fr").in("entry_id", lot.map((x) => x.id));
        if (e2) throw new Error(e2.message);
        for (const t of trads ?? []) {
          const entryKey = lot.find((x) => x.id === t.entry_id)!.entry_key;
          const blocs = (t.blocks ?? {}) as Blocs;
          const segs = blocs.description?.segments ?? [];
          if (segs.length === 0) continue;
          const premier = segs[0].text ?? "";
          let nouveau: string | null = null;
          let note = "";
          const deplace = DEPLACES[rs.nom]?.[entryKey];
          if (deplace) {
            const texte = paragraphesDeLaSource(lignes, deplace.debut, deplace.jusqua);
            if (!texte) refus.push(`${rs.nom} · ${entryKey} : passage introuvable dans la source`);
            else if (premier !== texte) {
              nouveau = texte;
              note = `texte relu dans la source (${texte.length} caractères)`;
            }
          } else {
            const f = fragmentDeSousTitre(premier);
            if (f) {
              const sousTitre = retrouverSousTitre(lignes, f.fragment, f.reste, t.name ?? undefined);
              if (!sousTitre) refus.push(`${rs.nom} · ${entryKey} (« ${t.name} ») : sous-titre introuvable sous son titre pour « ${f.fragment} »`);
              else {
                nouveau = `*${sousTitre}*\n${f.reste}`;
                note = `« ${f.fragment} » → *${sousTitre}*`;
              }
            }
          }
          if (nouveau === null) continue;
          n++;
          console.log(`${rs.nom} · ${entryKey} : ${note}`);
          if (ecrire) {
            const segments = deplace ? [{ ...segs[0], text: nouveau }] : segs.map((s, k) => (k === 0 ? { ...s, text: nouveau } : s));
            const { error: e3 } = await supabase.from("ruleset_entry_translations").update({ blocks: { ...blocs, description: { ...blocs.description, segments } } }).eq("entry_id", t.entry_id).eq("locale", "fr");
            if (e3) throw new Error(`${entryKey} : ${e3.message}`);
          }
        }
      }
    }
    console.log(`${rs.nom} : ${n} fiche(s) ${ecrire ? "corrigée(s)" : "à corriger"}.`);
  }
  if (refus.length) {
    console.log(`\n${refus.length} refus :`);
    for (const r of refus) console.log(`  ${r}`);
    process.exitCode = 1;
  }
  if (!ecrire) console.log("\nÀ blanc : rien n'est écrit. Relancer avec --write.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
