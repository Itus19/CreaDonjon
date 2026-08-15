// V1-D3b (suite), sur controle explicite demande par l'utilisateur pour Sort :
// translate-spell-descriptions-fr.ts (V1-A5) ecrit le meme texte de
// description sur LES DEUX rulesets, faute de categorie "Spells" independante
// dans data/srd/srd-2024.json (voir son commentaire d'en-tete). Verifie faux
// au niveau du texte source lui-meme : data/srd/fr-source/srd-5.2.1-fr.txt
// porte un vrai chapitre "Description des sorts" (ligne 10477-18144), avec
// une prose complete par sort -- meme angle mort que Regle et Monstre avant
// qu'un extracteur dedie leur soit construit cette session.
//
// Verifie concretement avant d'ecrire quoi que ce soit : au moins un sort
// (Agrandissement/rapetissement) a une VRAIE difference mecanique entre
// editions (2014 double la taille/x8 le poids ; 2024 augmente d'une seule
// categorie de taille + bonus de degats) -- pas une simple reformulation.
//
// Structure d'en-tete 2024, differente de 2014 :
//   - Liste des classes directement sur la ligne ecole/niveau, entre
//     parentheses, parfois etalee sur 2-3 lignes physiques (mise en page) :
//     "Transmutation du 2e niveau (Barde, Druide, \nEnsorceleur, Magicien)".
//   - Sorts mineurs : "Ecole mineure (Classes)" (accord de genre selon
//     l'ecole : "Enchantement mineur" mais "Evocation mineure"), jamais
//     "Sort mineur d'Ecole" comme en 2014.
//   - Le rituel n'est plus indique par "(rituel)" sur la ligne ecole/niveau :
//     il apparait dans "Temps d'incantation : ... ou rituel" (ex. Alarme).
//   - "Temps d'incantation : action" (2024) contre "1 action" (2014).
//
// Lancement : npx tsx --env-file=.env.local scripts/translate-spell-descriptions-2024-fr.ts [--write]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESET_5_2_1 = "110d20e9-dd80-4752-a57e-a957601b4eae";
const WRITE = process.argv.includes("--write");

const SOURCE_FILE = "data/srd/fr-source/srd-5.2.1-fr.txt";
// "Description des sorts" (10477) -> "Glossaire de regles" (18144), juste
// apres "Zone de verite", derniere entree du chapitre (verifie par lecture
// directe).
const CHAPTER_START = 10477;
const CHAPTER_END = 18144;

const SCHOOLS = ["Abjuration", "Évocation", "Enchantement", "Illusion", "Invocation", "Nécromancie", "Divination", "Transmutation"];
// Debut de ligne seulement -- la liste des classes entre parentheses peut
// s'etaler sur plusieurs lignes physiques, accumulee separement avant le
// parsing final (voir accumulateMetaLine).
// "niveau" est parfois colle au suffixe ordinal par un artefact d'extraction
// PDF (ex. "1erniveau" au lieu de "1er niveau", ligne 12872 de
// srd-5.2.1-fr.txt) : espace rendu optionnel, jamais suppose sans preuve
// (verifie sur cette occurrence precise avant de relacher la regle).
const META_START_RE = new RegExp(`^(${SCHOOLS.join("|")})(?: du (\\d+)(?:er|e)\\s*niveau| (mineure?))\\s*\\(`);
const LEVEL_RE = new RegExp(`^(${SCHOOLS.join("|")}) du (\\d+)(?:er|e)\\s*niveau \\(([^)]*)\\)$`);
const CANTRIP_RE = new RegExp(`^(${SCHOOLS.join("|")}) mineure? \\(([^)]*)\\)$`);

// Pied de page repete sur chaque page du PDF source — jamais de la prose.
function isFooterNoise(line: string): boolean {
  return (
    /^=== page \d+ ===$/.test(line) ||
    line.startsWith("Interdit à la revente") ||
    line.startsWith("ce document pour votre strict usage personnel") ||
    /^\d*\s?Document de Référence du Système 5\.2\.1(\s+\d+)?$/.test(line)
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

/** "V, S, M (une pincee de poudre de fer)" -> lettres + composant materiel. */
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

/**
 * Accumule les lignes physiques a partir de `startIdx` jusqu'a obtenir des
 * parentheses equilibrees (la liste de classes peut s'etaler sur 2-3 lignes,
 * coupee par la mise en page du PDF) -- jamais plus de 4 lignes (garde-fou,
 * un motif malforme doit lever une erreur plutot que fusionner en silence
 * avec la ligne de metadonnee suivante).
 */
function accumulateMetaLine(lines: string[], startIdx: number): { text: string; consumedLines: number } {
  let text = lines[startIdx];
  let consumed = 1;
  while ((text.match(/\(/g)?.length ?? 0) !== (text.match(/\)/g)?.length ?? 0)) {
    if (consumed >= 4) throw new Error(`Parentheses jamais equilibrees a partir de la ligne ${startIdx} : "${text}"`);
    text += ` ${lines[startIdx + consumed]}`;
    consumed++;
  }
  return { text, consumedLines: consumed };
}

function extractSpells(): ExtractedSpell[] {
  const raw = readFileSync(SOURCE_FILE, "utf-8");
  const lines = raw
    .split("\n")
    .slice(CHAPTER_START, CHAPTER_END)
    .map((l) => l.trim())
    .filter((l) => !isFooterNoise(l));

  const headings: { name: string; index: number; metaLine: string; metaLineSpan: number }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!line || line.length > 60) continue;
    if (!META_START_RE.test(lines[i + 1])) continue;
    const { text, consumedLines } = accumulateMetaLine(lines, i + 1);
    headings.push({ name: line, index: i, metaLine: text, metaLineSpan: consumedLines });
  }

  const result: ExtractedSpell[] = [];
  for (let h = 0; h < headings.length; h++) {
    const { metaLine, metaLineSpan } = headings[h];
    const bodyStart = headings[h].index + 1 + metaLineSpan;
    const bodyEnd = headings[h + 1]?.index ?? lines.length;

    const cantripMatch = metaLine.match(CANTRIP_RE);
    const levelMatch = metaLine.match(LEVEL_RE);
    if (!cantripMatch && !levelMatch) {
      throw new Error(`Ligne meta non reconnue pour "${headings[h].name}" : "${metaLine}"`);
    }
    const school = cantripMatch ? cantripMatch[1] : levelMatch![1];
    const level = levelMatch ? Number(levelMatch[2]) : 0;

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
    const castingTimeRaw = metaValues.castingTime ?? "";
    result.push({
      frenchName: headings[h].name,
      prose,
      school,
      level,
      ritual: /rituel/i.test(castingTimeRaw),
      castingTime: castingTimeRaw,
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
  console.log(`Entrees extraites depuis ${SOURCE_FILE} (${CHAPTER_START}-${CHAPTER_END}) : ${extracted.length}`);
  const byFrenchName = new Map(extracted.map((e) => [e.frenchName, e]));

  const allEntries: { id: string; entry_key: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, entry_key")
      .eq("ruleset_id", RULESET_5_2_1)
      .eq("entry_type", "spell")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    allEntries.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`Sorts en base (ruleset 5.2.1) : ${allEntries.length}`);

  const translations: { entry_id: string; name: string; blocks: unknown }[] = [];
  for (let i = 0; i < allEntries.length; i += 200) {
    const batch = allEntries.slice(i, i + 200).map((e) => e.id);
    const { data, error } = await supabase.from("ruleset_entry_translations").select("entry_id, name, blocks").eq("locale", "fr").in("entry_id", batch);
    if (error) throw new Error(error.message);
    translations.push(...data);
  }

  const matched = translations.filter((t) => byFrenchName.has(t.name));
  const unmatchedInDb = translations.filter((t) => !byFrenchName.has(t.name));
  const unmatchedInText = [...byFrenchName.keys()].filter((n) => !translations.some((t) => t.name === n));

  console.log(`\nNoms francais en base sans correspondance dans le texte 2024 extrait (${unmatchedInDb.length}) :`);
  for (const t of unmatchedInDb.slice(0, 40)) console.log(`  - ${t.name}`);
  console.log(`\nEntrees extraites du texte 2024 sans correspondance en base (${unmatchedInText.length}) :`);
  for (const n of unmatchedInText.slice(0, 40)) console.log(`  - ${n}`);

  const rows = matched.map((t) => {
    const e = byFrenchName.get(t.name)!;
    const existingBlocks = (t.blocks as Record<string, unknown> | null) ?? {};
    return {
      entry_id: t.entry_id,
      locale: "fr",
      name: t.name,
      blocks: {
        ...existingBlocks,
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

  console.log(`\n${rows.length}/${allEntries.length} descriptions 2024 pretes a ecrire (nom deja traduit + entree extraite du texte 2024).`);

  if (!WRITE) {
    console.log("\n(mode dry-run, relancer avec --write pour ecrire en base)");
    return;
  }

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
