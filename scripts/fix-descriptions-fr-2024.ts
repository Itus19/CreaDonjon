// V3.1-172 : deux défauts de texte français relevés en dépliant les traits
// dans l'assistant de création. Correction par CLÉ d'entrée, sans écrire de
// texte de règle à la main.
//
// 1. Le trait « Polyvalent » de l'Humain (`versatile`) porte le texte de la
//    propriété d'arme Polyvalente : `translate-entries.ts` traduisait par nom
//    anglais, et `write-human-trait-names-fr.ts` (V3.1-116) n'a corrigé que le
//    NOM. Le texte est relu ici dans la source française (CC-BY-4.0,
//    attribution dans NOTICE.md), dans la section de l'Humain : la ligne
//    « Polyvalent. … » jusqu'à la fin de sa phrase.
// 2. Le dernier don d'une section a gardé le titre de la section suivante
//    (« … l'état Neutralisé. Dons généraux ») : le titre est retiré.
//
// À blanc par défaut ; `--write` écrit. Ne touche que le bloc `description`
// des traductions françaises nommées, rien d'autre.
//
// Lancement : npx tsx --env-file=.env.local scripts/fix-descriptions-fr-2024.ts [--write]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SOURCE_FILE = "data/srd/fr-source/srd-5.2.1-fr.txt";
const RULESET_ID = "110d20e9-dd80-4752-a57e-a957601b4eae"; // SRD 5.2.1

/** Titres de section du chapitre des dons, tels qu'ils figurent dans la source. */
const TITRES_DE_SECTION = ["Dons généraux", "Dons de style de combat", "Dons de faveur épique", "Dons d’origines"];

/** Le paragraphe d'un trait d'espèce : après `introduction`, la ligne `<nom>. …` jusqu'à la fin de sa phrase (une ligne finie par un point). */
export function lireTrait(texte: string, introduction: string, nom: string): string {
  const lignes = texte.split("\n").map((l) => l.trim());
  const debutSection = lignes.findIndex((l) => l.startsWith(introduction));
  if (debutSection < 0) throw new Error(`« ${introduction} » introuvable dans ${SOURCE_FILE}.`);
  const debut = lignes.findIndex((l, i) => i > debutSection && l.startsWith(`${nom}. `));
  if (debut < 0) throw new Error(`Trait « ${nom} » introuvable après « ${introduction} ».`);
  const morceaux: string[] = [];
  for (let i = debut; i < lignes.length; i++) {
    morceaux.push(lignes[i]);
    if (lignes[i].endsWith(".")) break;
  }
  return morceaux.join(" ").slice(nom.length + 2).replace(/\s+/g, " ").trim();
}

/** Retire un titre de section collé à la fin d'un texte ; rend le texte inchangé s'il n'y en a pas. */
export function sansTitreFinal(texte: string): string {
  const titre = TITRES_DE_SECTION.find((t) => texte.trimEnd().endsWith(` ${t}`));
  return titre ? texte.trimEnd().slice(0, -titre.length).trimEnd() : texte;
}

type Blocs = { description?: { segments?: { text?: string }[] } } & Record<string, unknown>;

async function main() {
  const ecrire = process.argv.includes("--write");
  const source = readFileSync(SOURCE_FILE, "utf-8");
  const polyvalent = lireTrait(source, "En tant qu’humain", "Polyvalent");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  const supabase = createClient(url, cle, { auth: { persistSession: false } });

  const cibles: { entryKey: string; corriger: (ancien: string) => string }[] = [
    { entryKey: "versatile", corriger: () => polyvalent },
    { entryKey: "alert", corriger: sansTitreFinal },
    { entryKey: "defense", corriger: sansTitreFinal },
    { entryKey: "fighting-style-defense-2", corriger: sansTitreFinal },
  ];

  for (const c of cibles) {
    const { data: entree, error } = await supabase.from("ruleset_entries").select("id").eq("ruleset_id", RULESET_ID).eq("entry_key", c.entryKey).maybeSingle();
    if (error) throw new Error(`${c.entryKey} : ${error.message}`);
    if (!entree) throw new Error(`${c.entryKey} : fiche introuvable.`);
    const { data: trad, error: erreurLecture } = await supabase
      .from("ruleset_entry_translations")
      .select("name, blocks")
      .eq("entry_id", entree.id)
      .eq("locale", "fr")
      .maybeSingle();
    if (erreurLecture) throw new Error(`${c.entryKey} : ${erreurLecture.message}`);
    if (!trad) throw new Error(`${c.entryKey} : pas de traduction française à corriger.`);
    const blocs = (trad.blocks ?? {}) as Blocs;
    const ancien = (blocs.description?.segments ?? []).map((s) => s.text ?? "").join(" ");
    const nouveau = c.corriger(ancien);
    if (nouveau === ancien) {
      console.log(`[déjà juste] ${c.entryKey}`);
      continue;
    }
    console.log(`${ecrire ? "[écrit]" : "[à écrire]"} ${c.entryKey} (${trad.name})\n  avant : …${ancien.slice(-90)}\n  après : …${nouveau.slice(-90)}`);
    if (!ecrire) continue;
    const { error: erreurEcriture } = await supabase
      .from("ruleset_entry_translations")
      .update({ blocks: { ...blocs, description: { ...blocs.description, segments: [{ text: nouveau }] } } })
      .eq("entry_id", entree.id)
      .eq("locale", "fr");
    if (erreurEcriture) throw new Error(`${c.entryKey} : ${erreurEcriture.message}`);
  }
  if (!ecrire) console.log("\nÀ blanc : relancer avec --write pour écrire.");
}

if (process.argv[1]?.endsWith("fix-descriptions-fr-2024.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
