// V1-D3b (point 1) : traduction officielle du bloc `description` des fiches
// de règle — jamais fait jusqu'ici (V1-A5 l'avait identifié sans le
// traiter : contrairement au sort ou à l'objet magique, le contenu des
// règles est dispersé dans tout le document plutôt que dans un chapitre
// unique et bien délimité).
//
// Portée de cette passe : un seul groupe contigu de regles, celui qui
// couvre « Utiliser les caracteristiques » -> « Aventure » -> « Combat »
// -> « Incantation » (SRD 5.1 uniquement, 18 entrees). Chaque borne a ete
// verifiee a la main (lecture directe du texte, cf. docs/BACKLOG_V1.md
// V1-D3b) avant d'etre ecrite dans le manifeste ci-dessous — la decision
// produit retenue est de capturer le CHAPITRE ENTIER de chaque regle,
// sous-sections non suivies en base comprises (ex. "Opposition" sous
// Tests de caracteristique), pas seulement le paragraphe d'ouverture.
// Le reste des ~30 fiches de regle (les groupes isoles, plus loin dans le
// document, et toute la SRD 5.2.1) reste a traiter dans une prochaine
// session de ce meme point.
//
// Lancement : npm run translate:rules

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SOURCE_FILE = "data/srd/fr-source/srd-5.1-fr.txt";
const RULESET_ID = "41ebff94-aabc-4f5c-b437-28f2f7a195ee"; // SRD 5.1

function isFooterNoise(line: string): boolean {
  return (
    /^=== page \d+ ===$/.test(line) ||
    line.startsWith("Interdit à la revente") ||
    line.startsWith("ce document pour votre strict usage personnel") ||
    /^Document de Référence du Système 5\.1(\s+\d+)?$/.test(line)
  );
}

interface RuleSpan {
  entryKey: string;
  /** Ligne (1-indexee) de l'en-tete francais, verifiee dans le texte avant d'ecrire cette entree. */
  headerLine: number;
  nameFr: string;
  /** Ligne (1-indexee) de l'en-tete SUIVANT (regle suivie en base, ou borne fixe verifiee) : borne exclusive. */
  nextHeaderLine: number;
}

// Chaque ligne verifiee par lecture directe avant d'etre inscrite. Deux cas
// d'homonymie reels rencontres et resolus par lecture de contexte, pas par
// hypothese : "Lancer un sort" apparait deux fois (8673, une mention
// courte dans les actions de combat, absorbee dans `actions-in-combat` ;
// 9532, la vraie sous-section "Comment lancer un sort", utilisee ici) et
// "Jets de sauvegarde" de meme (7658, le vrai chapitre "Saving Throws" ;
// 9784, une sous-section sur les jets de sauvegarde IMPOSES PAR un sort,
// absorbee dans `casting-a-spell`).
const SPANS: RuleSpan[] = [
  { entryKey: "advantage-and-disadvantage", nameFr: "Avantage et désavantage", headerLine: 6931, nextHeaderLine: 6975 },
  { entryKey: "proficiency-bonus", nameFr: "Bonus de maîtrise", headerLine: 6975, nextHeaderLine: 7011 },
  { entryKey: "ability-checks", nameFr: "Tests de caractéristique", headerLine: 7011, nextHeaderLine: 7658 },
  { entryKey: "saving-throws", nameFr: "Jets de sauvegarde", headerLine: 7658, nextHeaderLine: 7721 },
  { entryKey: "movement", nameFr: "Déplacement", headerLine: 7721, nextHeaderLine: 7885 },
  { entryKey: "the-environment", nameFr: "L’environnement", headerLine: 7885, nextHeaderLine: 8050 },
  { entryKey: "resting", nameFr: "Repos", headerLine: 8050, nextHeaderLine: 8103 },
  { entryKey: "between-adventures", nameFr: "Entre les aventures", headerLine: 8103, nextHeaderLine: 8250 },
  { entryKey: "the-order-of-combat", nameFr: "L’ordre du combat", headerLine: 8250, nextHeaderLine: 8415 },
  { entryKey: "movement-and-position", nameFr: "Déplacement et position", headerLine: 8415, nextHeaderLine: 8604 },
  { entryKey: "actions-in-combat", nameFr: "Actions au combat", headerLine: 8604, nextHeaderLine: 8730 },
  { entryKey: "activating-an-item", nameFr: "Utiliser un objet", headerLine: 8730, nextHeaderLine: 8738 },
  { entryKey: "making-an-attack", nameFr: "Effectuer une attaque", headerLine: 8738, nextHeaderLine: 9008 },
  { entryKey: "damage-and-healing", nameFr: "Dégâts et soins", headerLine: 9008, nextHeaderLine: 9302 },
  { entryKey: "mounted-combat", nameFr: "Combat monté", headerLine: 9302, nextHeaderLine: 9363 },
  { entryKey: "underwater-combat", nameFr: "Combat subaquatique", headerLine: 9363, nextHeaderLine: 9400 },
  { entryKey: "what-is-a-spell", nameFr: "Qu’est-ce qu’un sort ?", headerLine: 9400, nextHeaderLine: 9532 },
  // Borne haute = debut verifie de l'annexe "Listes de sorts" (par classe,
  // ligne 9873) : PAS le meme motif que l'entete initial cru correct au
  // premier passage (10754, debut du chapitre "Description des sorts") —
  // un premier essai avait inclus par erreur toute l'annexe des listes de
  // sorts dans la prose de la regle (repere en relisant la fin du texte
  // extrait avant d'ecrire en base, cf. docs/BACKLOG_V1.md V1-D3b).
  { entryKey: "casting-a-spell", nameFr: "Lancer un sort", headerLine: 9532, nextHeaderLine: 9873 },
];

function extractBody(lines: string[], headerLine: number, nextHeaderLine: number): string {
  return lines
    .slice(headerLine, nextHeaderLine - 1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isFooterNoise(l))
    .join(" ");
}

async function main() {
  const raw = readFileSync(SOURCE_FILE, "utf-8");
  const lines = raw.split("\n");

  const { data: entries, error } = await supabase
    .from("ruleset_entries")
    .select("id, entry_key")
    .eq("ruleset_id", RULESET_ID)
    .eq("entry_type", "rule")
    .in("entry_key", SPANS.map((s) => s.entryKey));
  if (error) throw new Error(error.message);
  const entryIdByKey = new Map(entries.map((e) => [e.entry_key, e.id]));

  const rows: { entry_id: string; locale: string; name: string; blocks: Record<string, unknown>; source: string }[] = [];

  for (const span of SPANS) {
    const entryId = entryIdByKey.get(span.entryKey);
    if (!entryId) {
      console.warn(`  entree introuvable pour ${span.entryKey}, ignoree.`);
      continue;
    }
    const headerText = lines[span.headerLine - 1]?.trim();
    if (headerText !== span.nameFr) {
      throw new Error(`${span.entryKey} : en-tete attendu "${span.nameFr}" a la ligne ${span.headerLine}, trouve "${headerText}"`);
    }
    const description = extractBody(lines, span.headerLine, span.nextHeaderLine);
    if (description.length === 0) {
      throw new Error(`${span.entryKey} : corps vide entre les lignes ${span.headerLine} et ${span.nextHeaderLine}`);
    }

    const { data: existing, error: readError } = await supabase
      .from("ruleset_entry_translations")
      .select("name, blocks")
      .eq("entry_id", entryId)
      .eq("locale", "fr")
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    rows.push({
      entry_id: entryId,
      locale: "fr",
      name: existing?.name ?? span.nameFr,
      blocks: {
        ...(existing?.blocks as Record<string, unknown> | undefined),
        description: { segments: [{ text: description }] },
      },
      source: "official_srd",
    });
    console.log(`  ${span.entryKey} : ${description.length} caracteres extraits et verifies.`);
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from("ruleset_entry_translations").upsert(rows, { onConflict: "entry_id,locale" });
    if (upsertError) throw new Error(upsertError.message);
  }
  console.log(`\nTermine : ${rows.length} descriptions de regle ecrites (SRD 5.1, un seul groupe contigu).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
