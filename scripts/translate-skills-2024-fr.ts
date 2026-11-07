// V3.1-173 : le nom et l'explication française des dix-huit compétences du
// SRD 5.2.1, lus dans le tableau officiel « Compétences » du texte français
// (data/srd/fr-source/srd-5.2.1-fr.txt, CC-BY-4.0, attribution dans
// NOTICE.md). Rien n'est écrit à la main : chaque ligne du tableau est
// découpée en nom, caractéristique et « exemples d'application », et le nom
// doit correspondre à une compétence connue, sinon le script s'arrête.
//
// Les fiches `skill-<clé>` naissent de l'import (`ingest-srd.ts --only=Skills`).
// À blanc par défaut ; `--write` écrit les traductions.
//
// Lancement : npx tsx --env-file=.env.local scripts/translate-skills-2024-fr.ts [--write]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SOURCE_FILE = "data/srd/fr-source/srd-5.2.1-fr.txt";
const RULESET_ID = "110d20e9-dd80-4752-a57e-a957601b4eae"; // SRD 5.2.1
const ENTETE = "Compétence Caractéristique Exemples d’application";

/** Nom français officiel → index du SRD (celui de l'import, `skill-<index>`). */
const INDEX_PAR_NOM: Record<string, string> = {
  Acrobaties: "acrobatics",
  Arcanes: "arcana",
  Athlétisme: "athletics",
  Discrétion: "stealth",
  Dressage: "animal-handling",
  Escamotage: "sleight-of-hand",
  Histoire: "history",
  Intimidation: "intimidation",
  Intuition: "insight",
  Investigation: "investigation",
  Médecine: "medicine",
  Nature: "nature",
  Perception: "perception",
  Persuasion: "persuasion",
  Religion: "religion",
  Représentation: "performance",
  Survie: "survival",
  Tromperie: "deception",
};
const CARACTERISTIQUES = ["Force", "Dextérité", "Constitution", "Intelligence", "Sagesse", "Charisme"];

interface LigneCompetence {
  index: string;
  nom: string;
  description: string;
}

/** Découpe le tableau : une ligne commence par un nom de compétence ; les suivantes, jusqu'au prochain nom, la prolongent. */
export function lireTableau(texte: string): LigneCompetence[] {
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => l.trim() === ENTETE);
  if (debut < 0) throw new Error(`En-tête « ${ENTETE} » introuvable dans ${SOURCE_FILE}.`);
  const resultat: LigneCompetence[] = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    const ligne = lignes[i].trim();
    if (ligne === "" || ligne.startsWith("=== page")) break;
    const nom = Object.keys(INDEX_PAR_NOM).find((n) => ligne.startsWith(`${n} `));
    if (nom) {
      const reste = ligne.slice(nom.length + 1);
      const carac = CARACTERISTIQUES.find((c) => reste.startsWith(`${c} `));
      if (!carac) throw new Error(`Caractéristique illisible pour « ${nom} » : ${ligne}`);
      resultat.push({ index: INDEX_PAR_NOM[nom], nom, description: reste.slice(carac.length + 1).trim() });
    } else if (resultat.length > 0) {
      const dernier = resultat[resultat.length - 1];
      dernier.description = `${dernier.description} ${ligne}`.trim();
    }
  }
  if (resultat.length !== Object.keys(INDEX_PAR_NOM).length) {
    throw new Error(`${resultat.length} compétences lues, ${Object.keys(INDEX_PAR_NOM).length} attendues.`);
  }
  return resultat;
}

async function main() {
  const ecrire = process.argv.includes("--write");
  const competences = lireTableau(readFileSync(SOURCE_FILE, "utf-8"));
  for (const c of competences) console.log(`  ${c.nom.padEnd(16)} ${c.description}`);
  if (!ecrire) {
    console.log(`\n${competences.length} compétences lues. À blanc : relancer avec --write pour écrire.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  const supabase = createClient(url, cle, { auth: { persistSession: false } });

  const { data: entrees, error } = await supabase
    .from("ruleset_entries")
    .select("id, entry_key")
    .eq("ruleset_id", RULESET_ID)
    .in("entry_key", competences.map((c) => `skill-${c.index}`));
  if (error) throw new Error(error.message);
  const idParCle = new Map(entrees.map((e) => [e.entry_key, e.id]));
  const manquantes = competences.filter((c) => !idParCle.has(`skill-${c.index}`)).map((c) => c.index);
  if (manquantes.length > 0) throw new Error(`Fiches absentes (lancer d'abord ingest-srd --only=Skills) : ${manquantes.join(", ")}`);

  const lignes = competences.map((c) => ({
    entry_id: idParCle.get(`skill-${c.index}`)!,
    locale: "fr",
    name: c.nom,
    blocks: { description: { segments: [{ text: c.description }] } },
    source: "official_srd",
  }));
  const { error: ecriture } = await supabase.from("ruleset_entry_translations").upsert(lignes, { onConflict: "entry_id,locale" });
  if (ecriture) throw new Error(ecriture.message);
  console.log(`\n${lignes.length} traductions écrites (source 'official_srd').`);
}

if (process.argv[1]?.endsWith("translate-skills-2024-fr.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
