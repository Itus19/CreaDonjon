// V1-A5 : traduction officielle du texte de description des sorts (pas
// seulement leur nom), et de leurs metadonnees d'incantation (ecole, temps
// d'incantation, portee, composantes, duree). Contrairement aux noms
// (translate-entries.ts, simple verification de sous-chaine), un paragraphe
// de prose ne peut pas se deviner puis se verifier mot pour mot : on extrait
// directement le texte officiel depuis le PDF CC-BY-4.0, jamais une
// traduction reconstruite. Les metadonnees suivent la meme logique : elles
// sont deja en francais juste au-dessus de la prose dans le texte source,
// aucune raison de les laisser en anglais.
//
// Lancement : npm run translate:spell-descriptions
//
// Methode :
//   1. Parcourt le chapitre "Description des sorts" du texte extrait
//      (data/srd/fr-source/srd-5.1-fr.txt) et detecte chaque entree par son
//      motif fixe (nom seul sur une ligne, suivi d'une ligne "Ecole du Ne
//      niveau" ou "Sort mineur d'Ecole", eventuellement "(rituel)").
//   2. Capture les quatre lignes de metadonnees qui suivent (Temps
//      d'incantation/Portee/Composantes/Duree, avec suite sur plusieurs
//      lignes geree pour Composantes), puis la prose jusqu'au debut de
//      l'entree suivante.
//   3. Associe chaque entree extraite a une ruleset_entries via son nom
//      francais deja verifie (ruleset_entry_translations.name) — jamais un
//      rapprochement suppose.
//   4. Ecrit `blocks: { description: {...}, spell_casting: {...} }` sur la
//      traduction existante (le nom reste inchange). Le service applique ces
//      surcharges a la base AVANT resolution des surcharges de variante
//      (V1-A4, voir getRuleEntryForWorld) : une surcharge de MJ l'emporte
//      toujours sur le meme bloc.
//
// Ne couvre que le texte extrait de la SRD 5.1 : la SRD 5.2.1 n'a pas de
// categorie Spells independante (fusionnee depuis 2014, voir ingest-srd.ts),
// et quelques noms deja verifies l'ont ete contre le texte 5.2.1 specifiquement
// (terminologie revisee) — ceux-la restent hors de portee de ce script.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SOURCE_FILE = "data/srd/fr-source/srd-5.1-fr.txt";
// "Description des sorts" -> juste avant "Pieges" (fin reelle de la
// derniere entree, Zone de verite — au-dela commence un autre chapitre).
const CHAPTER_START = 10754;
const CHAPTER_END = 19608;

const SCHOOLS = ["Abjuration", "Évocation", "Enchantement", "Illusion", "Invocation", "Nécromancie", "Divination", "Transmutation"];
const LEVEL_RE = new RegExp(`^(${SCHOOLS.join("|")}) du (\\d+)(?:er|e) niveau(?: \\(rituel\\))?$`);
const CANTRIP_RE = new RegExp(`^Sort mineur (?:d[’']|de )([a-zéA-ZÉ]+)(?: \\(rituel\\))?$`);

function isHeadingMeta(line: string): boolean {
  return LEVEL_RE.test(line) || CANTRIP_RE.test(line);
}

// Pied de page repete sur chaque page du PDF source — jamais de la prose.
function isFooterNoise(line: string): boolean {
  return (
    /^=== page \d+ ===$/.test(line) ||
    line.startsWith("Interdit à la revente") ||
    line.startsWith("ce document pour votre strict usage personnel") ||
    /^Document de Référence du Système 5\.1(\s+\d+)?$/.test(line)
  );
}

const METADATA_LABELS = [
  { key: "castingTime", labels: ["Temps d’incantation", "Temps d'incantation"] },
  { key: "range", labels: ["Portée"] },
  { key: "components", labels: ["Composantes"] },
  { key: "duration", labels: ["Durée"] },
] as const;
type MetaKey = (typeof METADATA_LABELS)[number]["key"];

function matchMetadataLabel(line: string): { key: MetaKey; value: string } | null {
  for (const { key, labels } of METADATA_LABELS) {
    for (const label of labels) {
      if (line.startsWith(`${label} :`)) return { key, value: line.slice(label.length + 2).trim() };
    }
  }
  return null;
}

/** "V, S, M (une petite boule de guano...)" -> lettres + composant materiel. */
function parseComponents(raw: string): { letters: string[]; material?: string } {
  const parenMatch = raw.match(/^([^(]+?)\s*\(([\s\S]+)\)\s*$/);
  const lettersPart = parenMatch ? parenMatch[1] : raw;
  const material = parenMatch ? parenMatch[2].trim() : undefined;
  const letters = lettersPart
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is "V" | "S" | "M" => s === "V" || s === "S" || s === "M");
  return { letters, material };
}

interface ExtractedSpell {
  frenchName: string;
  prose: string;
  school: string;
  level: number;
  ritual: boolean;
  castingTime: string;
  range: string;
  components: { letters: string[]; material?: string };
  duration: string;
  concentration: boolean;
}

function extractSpells(): ExtractedSpell[] {
  const raw = readFileSync(SOURCE_FILE, "utf-8");
  const lines = raw
    .split("\n")
    .slice(CHAPTER_START, CHAPTER_END)
    .map((l) => l.trim())
    .filter((l) => !isFooterNoise(l));

  const headings: { name: string; index: number; metaLine: string }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!line || line.length > 60) continue;
    if (isHeadingMeta(lines[i + 1])) headings.push({ name: line, index: i, metaLine: lines[i + 1] });
  }

  const result: ExtractedSpell[] = [];
  for (let h = 0; h < headings.length; h++) {
    const { metaLine } = headings[h];
    const bodyStart = headings[h].index + 2;
    const bodyEnd = headings[h + 1]?.index ?? lines.length;

    const cantripMatch = metaLine.match(CANTRIP_RE);
    const levelMatch = metaLine.match(LEVEL_RE);
    const school = cantripMatch ? cantripMatch[1] : (levelMatch?.[1] ?? "");
    const level = levelMatch ? Number(levelMatch[2]) : 0;
    const ritual = metaLine.includes("(rituel)");

    const metaValues: Partial<Record<MetaKey, string>> = {};
    let currentKey: MetaKey | null = null;
    let idx = bodyStart;
    while (idx < bodyEnd) {
      const l = lines[idx];
      const match = matchMetadataLabel(l);
      if (match) {
        metaValues[match.key] = match.value;
        currentKey = match.key;
        idx++;
        continue;
      }
      // ligne de continuation d'une metadonnee (ex: composant materiel entre
      // parentheses etale sur plusieurs lignes) : pas encore le debut d'une
      // phrase franche.
      if (currentKey && /^[a-zà-ÿ(]/.test(l)) {
        metaValues[currentKey] = `${metaValues[currentKey]} ${l}`;
        idx++;
        continue;
      }
      break;
    }

    const prose = lines
      .slice(idx, bodyEnd)
      .filter((l) => l.length > 0)
      .join(" ");

    const durationRaw = metaValues.duration ?? "";
    result.push({
      frenchName: headings[h].name,
      prose,
      school,
      level,
      ritual,
      castingTime: metaValues.castingTime ?? "",
      range: metaValues.range ?? "",
      components: parseComponents(metaValues.components ?? ""),
      duration: durationRaw,
      concentration: /concentration/i.test(durationRaw),
    });
  }
  return result;
}

async function main() {
  const extracted = extractSpells();
  console.log(`Entrees extraites depuis ${SOURCE_FILE} : ${extracted.length}`);
  const byFrenchName = new Map(extracted.map((e) => [e.frenchName, e]));

  const allEntries: { id: string; entry_type: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("ruleset_entries").select("id, entry_type").eq("entry_type", "spell").range(from, from + 999);
    if (error) throw new Error(error.message);
    allEntries.push(...data);
    if (data.length < 1000) break;
  }

  const translations: { entry_id: string; name: string }[] = [];
  for (let i = 0; i < allEntries.length; i += 200) {
    const batch = allEntries.slice(i, i + 200).map((e) => e.id);
    const { data, error } = await supabase.from("ruleset_entry_translations").select("entry_id, name").eq("locale", "fr").in("entry_id", batch);
    if (error) throw new Error(error.message);
    translations.push(...data);
  }

  const rows = translations
    .filter((t) => byFrenchName.has(t.name))
    .map((t) => {
      const e = byFrenchName.get(t.name)!;
      return {
        entry_id: t.entry_id,
        locale: "fr",
        name: t.name,
        blocks: {
          description: { segments: [{ text: e.prose }] },
          spell_casting: {
            level: e.level,
            school: e.school,
            casting_time: e.castingTime,
            range: e.range,
            components: e.components.letters,
            material: e.components.material,
            duration: e.duration,
            concentration: e.concentration,
            ritual: e.ritual,
          },
        },
        source: "official_srd",
      };
    });

  console.log(`Descriptions + metadonnees a ecrire (nom deja traduit + entree extraite) : ${rows.length}`);
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("ruleset_entry_translations").upsert(rows.slice(i, i + 200), { onConflict: "entry_id,locale" });
    if (error) throw new Error(error.message);
  }
  console.log("Termine.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
