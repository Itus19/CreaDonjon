// V1-D3 : traduction officielle du bloc `spellcasting_progression` (V1-D1/D2)
// pour les huit classes qui incantent en SRD 5.1 — chaque `info[].description`
// est un vrai paragraphe de prose (« Sorts mineurs », « Caractéristique
// d'incantation »...), pas une donnée structurée : comme pour les sorts
// (translate-spell-descriptions-fr.ts), aucune traduction reconstruite,
// seulement du texte extrait mot pour mot du PDF officiel CC-BY-4.0.
//
// Contrairement au script des sorts, la détection automatique de bornes
// section par section n'est pas fiable ici (les en-têtes ne suivent pas un
// motif régulier assez distinctif pour être repérés sans faux positif sur
// 8 classes aux structures différentes) : chaque plage de lignes ci-dessous
// a été lue et vérifiée à la main dans
// `data/srd/fr-source/srd-5.1-fr.txt` avant d'être écrite (voir
// docs/BACKLOG_V1.md, V1-D3, pour le détail classe par classe).
//
// Portée de cette passe : SRD 5.1 (2014) uniquement, les huit classes qui
// incantent (Barbare/Guerrier/Moine/Roublard n'en ont pas). La SRD 5.2.1
// (2024) restructure ces mêmes classes différemment (en-têtes en partie
// différents, non vérifiés) — laissée à une prochaine passe plutôt que
// devinée.
//
// Lancement : npm run translate:class-spellcasting

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SOURCE_FILE = "data/srd/fr-source/srd-5.1-fr.txt";
const RULESET_ID = "41ebff94-aabc-4f5c-b437-28f2f7a195ee"; // SRD 5.1, meme id que translate-srd-official.ts

// Pied de page repete sur chaque page du PDF source (meme motif que
// translate-spell-descriptions-fr.ts) — jamais de la prose.
function isFooterNoise(line: string): boolean {
  return (
    /^=== page \d+ ===$/.test(line) ||
    line.startsWith("Interdit à la revente") ||
    line.startsWith("ce document pour votre strict usage personnel") ||
    /^Document de Référence du Système 5\.1(\s+\d+)?$/.test(line)
  );
}

interface InfoSpan {
  /** Nom anglais tel que present dans `spellcasting.info[].name` (SRD JSON, deja importe). */
  nameEn: string;
  /** Nom francais officiel : ligne d'en-tete verifiee dans le texte, devient le nouveau `info[].name`. */
  nameFr: string;
  /** Ligne (1-indexee, celle de l'en-tete francais) ou commence cette section. */
  headerLine: number;
  /** Ligne (1-indexee) de l'en-tete SUIVANT (section ou aptitude) : borne exclusive. */
  nextHeaderLine: number;
}

interface ClassManifest {
  classIndex: string;
  ability: string;
  startsAtLevel: number;
  spans: InfoSpan[];
}

// Chaque plage verifiee par lecture directe (Read) de data/srd/fr-source/srd-5.1-fr.txt
// avant d'etre inscrite ici — voir docs/BACKLOG_V1.md V1-D3 pour le detail.
const MANIFEST: ClassManifest[] = [
  {
    classIndex: "bard",
    ability: "cha",
    startsAtLevel: 1,
    spans: [
      { nameEn: "Cantrips", nameFr: "Sorts mineurs", headerLine: 921, nextHeaderLine: 927 },
      { nameEn: "Spell Slots", nameFr: "Emplacements de sort", headerLine: 927, nextHeaderLine: 940 },
      { nameEn: "Spells Known of 1st Level and Higher", nameFr: "Sorts connus du 1er niveau et plus", headerLine: 940, nextHeaderLine: 957 },
      { nameEn: "Spellcasting Ability", nameFr: "Caractéristique d’incantation", headerLine: 957, nextHeaderLine: 974 },
      { nameEn: "Ritual Casting", nameFr: "Incantation rituelle", headerLine: 974, nextHeaderLine: 978 },
      { nameEn: "Spellcasting Focus", nameFr: "Focaliseur d’incantation", headerLine: 978, nextHeaderLine: 982 },
    ],
  },
  {
    classIndex: "cleric",
    ability: "wis",
    startsAtLevel: 1,
    spans: [
      { nameEn: "Cantrips", nameFr: "Sorts mineurs", headerLine: 1228, nextHeaderLine: 1234 },
      { nameEn: "Preparing and Casting Spells", nameFr: "Préparation et incantation des sorts", headerLine: 1234, nextHeaderLine: 1264 },
      { nameEn: "Spellcasting Ability", nameFr: "Caractéristique d’incantation", headerLine: 1264, nextHeaderLine: 1279 },
      { nameEn: "Ritual Casting", nameFr: "Incantation rituelle", headerLine: 1279, nextHeaderLine: 1283 },
      { nameEn: "Spellcasting Focus", nameFr: "Focaliseur d’incantation", headerLine: 1283, nextHeaderLine: 1287 },
    ],
  },
  {
    classIndex: "druid",
    ability: "wis",
    startsAtLevel: 1,
    spans: [
      { nameEn: "Cantrips", nameFr: "Sorts mineurs", headerLine: 1541, nextHeaderLine: 1547 },
      { nameEn: "Preparing and Casting Spells", nameFr: "Préparation et incantation des sorts", headerLine: 1547, nextHeaderLine: 1577 },
      { nameEn: "Spellcasting Ability", nameFr: "Caractéristique d’incantation", headerLine: 1577, nextHeaderLine: 1593 },
      { nameEn: "Ritual Casting", nameFr: "Incantation rituelle", headerLine: 1593, nextHeaderLine: 1597 },
      { nameEn: "Spellcasting Focus", nameFr: "Focaliseur d’incantation", headerLine: 1597, nextHeaderLine: 1601 },
    ],
  },
  {
    classIndex: "sorcerer",
    ability: "cha",
    startsAtLevel: 1,
    spans: [
      { nameEn: "Cantrips", nameFr: "Sorts mineurs", headerLine: 1967, nextHeaderLine: 1973 },
      { nameEn: "Spell Slots", nameFr: "Emplacements de sort", headerLine: 1973, nextHeaderLine: 1986 },
      { nameEn: "Spells Known of 1st Level and Higher", nameFr: "Sorts connus du 1er niveau et plus", headerLine: 1986, nextHeaderLine: 2003 },
      { nameEn: "Spellcasting Ability", nameFr: "Caractéristique d’incantation", headerLine: 2003, nextHeaderLine: 2020 },
      { nameEn: "Spellcasting Focus", nameFr: "Focaliseur d’incantation", headerLine: 2020, nextHeaderLine: 2024 },
    ],
  },
  {
    classIndex: "wizard",
    ability: "int",
    startsAtLevel: 1,
    spans: [
      { nameEn: "Cantrips", nameFr: "Sorts mineurs", headerLine: 2501, nextHeaderLine: 2507 },
      { nameEn: "Spellbook", nameFr: "Grimoire", headerLine: 2507, nextHeaderLine: 2513 },
      { nameEn: "Preparing and Casting Spells", nameFr: "Préparation et incantation des sorts", headerLine: 2513, nextHeaderLine: 2545 },
      { nameEn: "Spellcasting Ability", nameFr: "Caractéristique d’incantation", headerLine: 2545, nextHeaderLine: 2559 },
      { nameEn: "Ritual Casting", nameFr: "Incantation rituelle", headerLine: 2559, nextHeaderLine: 2564 },
      { nameEn: "Spellcasting Focus", nameFr: "Focaliseur d’incantation", headerLine: 2564, nextHeaderLine: 2568 },
    ],
  },
  {
    classIndex: "warlock",
    ability: "cha",
    startsAtLevel: 1,
    spans: [
      { nameEn: "Cantrips", nameFr: "Sorts mineurs", headerLine: 3180, nextHeaderLine: 3186 },
      { nameEn: "Spell Slots", nameFr: "Emplacements de sort", headerLine: 3186, nextHeaderLine: 3201 },
      { nameEn: "Spells Known of 1st Level and Higher", nameFr: "Sorts connus du 1er niveau et plus", headerLine: 3201, nextHeaderLine: 3219 },
      { nameEn: "Spellcasting Ability", nameFr: "Caractéristique d’incantation", headerLine: 3219, nextHeaderLine: 3234 },
      { nameEn: "Spellcasting Focus", nameFr: "Focaliseur d’incantation", headerLine: 3234, nextHeaderLine: 3237 },
    ],
  },
  {
    classIndex: "paladin",
    ability: "cha",
    startsAtLevel: 2,
    spans: [
      { nameEn: "Preparing and Casting Spells", nameFr: "Préparation et incantation des sorts", headerLine: 3773, nextHeaderLine: 3803 },
      { nameEn: "Spellcasting Ability", nameFr: "Caractéristique d’incantation", headerLine: 3803, nextHeaderLine: 3823 },
      { nameEn: "Spellcasting Focus", nameFr: "Focaliseur d’incantation", headerLine: 3823, nextHeaderLine: 3826 },
    ],
  },
  {
    classIndex: "ranger",
    ability: "wis",
    startsAtLevel: 2,
    spans: [
      { nameEn: "Spell Slots", nameFr: "Emplacements de sort", headerLine: 4199, nextHeaderLine: 4212 },
      { nameEn: "Spells Known of 1st Level and Higher", nameFr: "Sorts connus du 1er niveau et plus", headerLine: 4212, nextHeaderLine: 4232 },
      { nameEn: "Spellcasting Ability", nameFr: "Caractéristique d’incantation", headerLine: 4232, nextHeaderLine: 4248 },
    ],
  },
];

function extractBody(lines: string[], headerLine: number, nextHeaderLine: number): string {
  // headerLine/nextHeaderLine sont 1-indexes ; le corps commence juste apres
  // l'en-tete (0-idx = headerLine) et s'arrete juste avant le prochain
  // en-tete (0-idx exclusif = nextHeaderLine - 1).
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
    .eq("entry_type", "class")
    .in("entry_key", MANIFEST.map((m) => m.classIndex));
  if (error) throw new Error(error.message);
  const entryIdByKey = new Map(entries.map((e) => [e.entry_key, e.id]));

  const rows: { entry_id: string; locale: string; name: string; blocks: Record<string, unknown>; source: string }[] = [];

  for (const cls of MANIFEST) {
    const entryId = entryIdByKey.get(cls.classIndex);
    if (!entryId) {
      console.warn(`  entree introuvable pour ${cls.classIndex} dans le ruleset 5.1, ignoree.`);
      continue;
    }

    // Verifie que l'en-tete lu correspond bien a un nom attendu, avant
    // d'ecrire quoi que ce soit — un decalage de ligne (le texte source a
    // change, ou une erreur de saisie du manifeste) doit faire echouer
    // bruyamment, jamais ecrire une description sous le mauvais nom.
    const info = cls.spans.map((span) => {
      const headerText = lines[span.headerLine - 1]?.trim();
      if (headerText !== span.nameFr) {
        throw new Error(
          `${cls.classIndex}/${span.nameEn} : en-tete attendu "${span.nameFr}" a la ligne ${span.headerLine}, trouve "${headerText}"`
        );
      }
      return { name: span.nameFr, description: extractBody(lines, span.headerLine, span.nextHeaderLine) };
    });

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
      // Nom deja traduit par V1-A5 ; jamais ecrase par ce script.
      name: existing?.name ?? cls.classIndex,
      blocks: {
        ...(existing?.blocks as Record<string, unknown> | undefined),
        spellcasting_progression: { ability: cls.ability, starts_at_level: cls.startsAtLevel, info },
      },
      source: "official_srd",
    });
    console.log(`  ${cls.classIndex} : ${info.length} sections extraites et verifiees.`);
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from("ruleset_entry_translations").upsert(rows, { onConflict: "entry_id,locale" });
    if (upsertError) throw new Error(upsertError.message);
  }
  console.log(`\nTermine : ${rows.length} traductions de spellcasting_progression ecrites (SRD 5.1 uniquement).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
