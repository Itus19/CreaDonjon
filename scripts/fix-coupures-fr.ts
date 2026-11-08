// V3.1-180 : les traductions françaises du SRD (5.1 et 5.2.1) extraites du
// PDF gardent deux défauts de mise en page :
//   1. une phrase coupée en fin de ligne garde son retour (« deux sorts⏎mineurs ») :
//      le rendu en fait deux paragraphes ;
//   2. le dernier texte d'un chapitre a avalé le début du suivant
//      (« … ce tour. Roublard Traits de base du Roublard … »), ou un titre de
//      section est resté collé à la fin.
// Les règles de correction sont dans `src/core/text/coupuresPdf.ts` (testées).
// Le texte n'existe qu'à un endroit (`ruleset_entry_translations`) : la page de
// la règle, l'assistant, la fiche et le solo le lisent tous de là.
//
// À blanc par défaut : chaque correction est listée avec son contexte, pour
// relecture. `--write` écrit. Relançable après toute réimportation.
//
// Lancement : npx tsx --env-file=.env.local scripts/fix-coupures-fr.ts [--write]

import { createClient } from "@supabase/supabase-js";
import { couperDebordement, recollerCoupures } from "../src/core/text/coupuresPdf";

const RULESETS = [
  { id: "41ebff94-aabc-4f5c-b437-28f2f7a195ee", nom: "SRD 5.1" },
  { id: "110d20e9-dd80-4752-a57e-a957601b4eae", nom: "SRD 5.2.1" },
];

/** Recolle les coupures de toutes les chaînes d'un objet ; rend l'objet corrigé et les coupures trouvées. */
function recollerPartout(v: unknown, notes: string[]): unknown {
  if (typeof v === "string") {
    const r = recollerCoupures(v);
    for (const c of r.coupures) notes.push(`coupure : « ${c.avant}⏎${c.apres} »`);
    return r.texte;
  }
  if (Array.isArray(v)) return v.map((x) => recollerPartout(x, notes));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, recollerPartout(x, notes)]));
  return v;
}

type Blocs = { description?: { segments?: { text?: string }[] } } & Record<string, unknown>;

async function main() {
  const ecrire = process.argv.includes("--write");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  const supabase = createClient(url, cle, { auth: { persistSession: false } });

  let total = 0;
  for (const rs of RULESETS) {
    let fiches = 0;
    for (let from = 0; ; from += 1000) {
      const { data: entrees, error } = await supabase.from("ruleset_entries").select("id, entry_key").eq("ruleset_id", rs.id).order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      if (!entrees || entrees.length === 0) break;
      for (let i = 0; i < entrees.length; i += 200) {
        const lot = entrees.slice(i, i + 200);
        const { data: trads, error: e2 } = await supabase.from("ruleset_entry_translations").select("entry_id, blocks").eq("locale", "fr").in("entry_id", lot.map((x) => x.id));
        if (e2) throw new Error(e2.message);
        for (const t of trads ?? []) {
          const notes: string[] = [];
          const blocs = recollerPartout(t.blocks ?? {}, notes) as Blocs;
          for (const seg of blocs.description?.segments ?? []) {
            if (typeof seg.text !== "string") continue;
            const d = couperDebordement(seg.text);
            if (d.coupe) {
              notes.push(`débordement coupé : « ${d.coupe.slice(0, 70)}${d.coupe.length > 70 ? "…" : ""} »`);
              seg.text = d.texte;
            }
          }
          if (notes.length === 0) continue;
          fiches++;
          const cleEntree = lot.find((x) => x.id === t.entry_id)?.entry_key;
          console.log(`${rs.nom} · ${cleEntree}`);
          for (const n of notes) console.log(`    ${n}`);
          if (ecrire) {
            const { error: e3 } = await supabase.from("ruleset_entry_translations").update({ blocks: blocs }).eq("entry_id", t.entry_id).eq("locale", "fr");
            if (e3) throw new Error(`${cleEntree} : ${e3.message}`);
          }
        }
      }
    }
    console.log(`${rs.nom} : ${fiches} fiche(s) ${ecrire ? "corrigée(s)" : "à corriger"}.`);
    total += fiches;
  }
  if (!ecrire && total > 0) console.log("\nÀ blanc : rien n'est écrit. Relancer avec --write.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
