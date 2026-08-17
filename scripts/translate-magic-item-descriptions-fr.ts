// V1-D7 (passe Objet magique) : traduction officielle du texte de
// description des objets magiques, sur le meme motif que
// translate-spell-descriptions-fr.ts pour les sorts. La categorie/rarete/
// harmonisation ne sont PAS re-extraites d'ici : deja posees correctement
// par l'import depuis les champs structures du JSON anglais
// (rarity.name/limited-to) — ce script ne touche que blocks.description.
//
// Lancement : npx tsx --env-file=.env.local scripts/translate-magic-item-descriptions-fr.ts
//
// Methode (chapitre "Objets magiques de A a Z"/"Les objets magiques de A a
// Z" des deux fichiers source) :
//   1. Detecte chaque entree par son motif fixe : une ligne courte (nom),
//      suivie d'une ligne "Categorie, rarete[ (Harmonisation requise...)]"
//      — le prefixe ", <rarete>" est le signal fiable, jamais une simple
//      recherche de mot-cle isole (le chapitre Monstres qui suit reemploie
//      le mot "rarete" dans un tout autre sens, verifie en ecrivant ce
//      script). La clause d'Harmonisation peut courir sur une deuxieme
//      ligne (parenthese non refermee) : gerée en tentant 1 puis 2 lignes.
//   2. Les tableaux de variantes integres dans la prose de certains objets
//      (ex. "Ceinturon de force de geant", 5 paliers de rarete dans une
//      seule fiche) ne sont jamais confondus avec une nouvelle entree :
//      leurs lignes de repetition du nom ne sont suivies d'aucune ligne
//      "Categorie, rarete" valide, donc ignorees par construction.
//   3. Associe chaque entree extraite a une ruleset_entries via son nom
//      francais deja verifie (ruleset_entry_translations.name, meme
//      precedent que les sorts) — jamais un rapprochement suppose.
//   4. Ecrit uniquement blocks.description (fusionne avec les eventuelles
//      autres cles deja presentes), source='official_srd'.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESETS = {
  "5.1": {
    id: "41ebff94-aabc-4f5c-b437-28f2f7a195ee",
    textFile: "data/srd/fr-source/srd-5.1-fr.txt",
    // "Amulette d'antidétection" -> "distance, tant que leur largeur est
    // d'au moins 60 cm." (Yeux de lynx, dernier objet avant "Les objets
    // magiques intelligents").
    chapterStart: 20766,
    chapterEnd: 25760,
    footerRe: /^Document de Référence du Système 5\.1(\s+\d+)?$/,
  },
  "5.2.1": {
    id: "110d20e9-dd80-4752-a57e-a957601b4eae",
    textFile: "data/srd/fr-source/srd-5.2.1-fr.txt",
    chapterStart: 21423,
    chapterEnd: 26141,
    footerRe: /^\d+ Document de Référence du Système 5\.2\.1$/,
  },
} as const;

// "e?" sur courant/commun : accord feminin obligatoire en francais
// ("Baguette, peu courante" vs "Anneau, peu courant") — bug trouve en
// verifiant pourquoi plusieurs baguettes bien presentes dans le texte
// (ex. "Baguette de detection de la magie") n'etaient jamais detectees.
const RARITY_WORD_RE = /,\s*(peu courante?|commune?|très rare|légendaire|artéfact|rareté variable|rare)\b/i;

function isFooterNoise(line: string, footerRe: RegExp): boolean {
  return (
    /^=== page \d+ ===$/.test(line) ||
    line.startsWith("Interdit à la revente") ||
    line.startsWith("ce document pour votre strict usage personnel") ||
    footerRe.test(line)
  );
}

interface ExtractedItem {
  frenchName: string;
  prose: string;
}

function extractMagicItems(config: (typeof RULESETS)[keyof typeof RULESETS]): ExtractedItem[] {
  const raw = readFileSync(config.textFile, "utf-8");
  const lines = raw
    .split("\n")
    .slice(config.chapterStart, config.chapterEnd)
    .map((l) => l.trim())
    .filter((l) => !isFooterNoise(l, config.footerRe));

  // Heading = ligne courte, sans ponctuation finale de phrase, suivie (sur
  // 1 ou 2 lignes) d'un motif "Categorie, rarete[ (Harmonisation...)]".
  const parensBalanced = (s: string) => (s.match(/\(/g) ?? []).length === (s.match(/\)/g) ?? []).length;
  const headings: { name: string; index: number; metaLineCount: number }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!line || line.length > 70 || /[.,:;]$/.test(line)) continue;
    if (!/^[A-ZÀ-Ü0-9]/.test(line)) continue;

    const oneLine = lines[i + 1] ?? "";
    const twoLines = `${oneLine} ${lines[i + 2] ?? ""}`;
    if (RARITY_WORD_RE.test(oneLine) && parensBalanced(oneLine)) {
      headings.push({ name: line, index: i, metaLineCount: 1 });
    } else if (RARITY_WORD_RE.test(twoLines) && parensBalanced(twoLines)) {
      headings.push({ name: line, index: i, metaLineCount: 2 });
    }
  }

  const result: ExtractedItem[] = [];
  for (let h = 0; h < headings.length; h++) {
    const bodyStart = headings[h].index + 1 + headings[h].metaLineCount;
    const bodyEnd = headings[h + 1]?.index ?? lines.length;
    const prose = lines
      .slice(bodyStart, bodyEnd)
      .filter((l) => l.length > 0)
      .join(" ");
    if (prose.length === 0) continue; // heading mal detecte (faux positif) : pas de corps -> ignore
    result.push({ frenchName: headings[h].name, prose });
    result.push(...extractNestedVariants(prose));
  }
  return result;
}

/**
 * Certains objets (Pierre de Ioun, Figurine merveilleuse, Sac a malices...)
 * regroupent plusieurs variantes sous UNE seule entree du chapitre, chaque
 * variante avec son propre paragraphe complet introduit en ligne par
 * "Nom (rarete). Texte..." plutot que par le motif "Nom / Categorie,
 * rarete" du niveau superieur — verifie sur Pierre de Ioun (13 variantes,
 * chacune un paragraphe a part entiere) et Figurine merveilleuse. Chaque
 * variante EST une entree distincte cote base (ex. `ioun-stone-of-absorption`
 * -> nom francais "Absorption", sans le prefixe "Pierre de Ioun"), donc son
 * nom de variante seul est la bonne cle de correspondance. Des sous-titres
 * imbriques sans parenthese de rarete (ex. "Chevre industrieuse." dans
 * Chevres d'ivoire) ne matchent jamais ce motif — ils restent a juste titre
 * dans le corps de leur variante parente.
 */
function extractNestedVariants(prose: string): ExtractedItem[] {
  const VARIANT_RE = /([A-ZÀ-Ü][^().]{1,50}?) \((commun|peu courant|rare|très rare|légendaire|artéfact)\)\.\s+/g;
  const matches = [...prose.matchAll(VARIANT_RE)];
  if (matches.length === 0) return [];
  const result: ExtractedItem[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = matches[i + 1]?.index ?? prose.length;
    const text = prose.slice(start, end).trim();
    if (text.length === 0) continue;
    result.push({ frenchName: matches[i][1].trim(), prose: text });
  }
  return result;
}

async function main() {
  let totalWritten = 0;
  const allUnmatchedExtracted: string[] = [];
  const allUndescribedEntries: string[] = [];

  for (const [label, config] of Object.entries(RULESETS)) {
    console.log(`\n--- ${label} ---`);
    const extracted = extractMagicItems(config);
    console.log(`Entrees extraites depuis ${config.textFile} : ${extracted.length}`);

    // Doublons de nom (rare mais possible si deux entrees SRD partagent un
    // nom, ex. variantes) : garde la premiere occurrence, jamais un merge
    // silencieux qui perdrait du texte.
    const byFrenchName = new Map<string, ExtractedItem>();
    for (const e of extracted) {
      if (!byFrenchName.has(e.frenchName)) byFrenchName.set(e.frenchName, e);
    }

    const { data: entries, error: entriesError } = await supabase
      .from("ruleset_entries")
      .select("id")
      .eq("ruleset_id", config.id)
      .in("entry_type", ["magic_item", "mount"]);
    if (entriesError) throw new Error(entriesError.message);

    const translations: { entry_id: string; name: string; blocks: unknown }[] = [];
    for (let i = 0; i < entries.length; i += 200) {
      const batch = entries.slice(i, i + 200).map((e) => e.id);
      const { data, error } = await supabase
        .from("ruleset_entry_translations")
        .select("entry_id, name, blocks")
        .eq("locale", "fr")
        .in("entry_id", batch);
      if (error) throw new Error(error.message);
      translations.push(...data);
    }

    const matchedNames = new Set<string>();
    const rows = translations
      .filter((t) => byFrenchName.has(t.name))
      .map((t) => {
        matchedNames.add(t.name);
        const e = byFrenchName.get(t.name)!;
        return {
          entry_id: t.entry_id,
          locale: "fr",
          name: t.name,
          blocks: { ...(t.blocks as object), description: { segments: [{ text: e.prose }] } },
          source: "official_srd",
        };
      });

    const unmatchedExtracted = [...byFrenchName.keys()].filter((n) => !matchedNames.has(n));
    const undescribedEntries = translations.filter((t) => !matchedNames.has(t.name)).map((t) => t.name);
    console.log(`Correspondances trouvees : ${rows.length}`);
    console.log(`Extraites sans entree correspondante : ${unmatchedExtracted.length}`);
    console.log(`Entrees sans description trouvee : ${undescribedEntries.length}`);
    allUnmatchedExtracted.push(...unmatchedExtracted.map((n) => `${label}: ${n}`));
    allUndescribedEntries.push(...undescribedEntries.map((n) => `${label}: ${n}`));

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("ruleset_entry_translations").upsert(rows.slice(i, i + 200), { onConflict: "entry_id,locale" });
      if (error) throw new Error(error.message);
    }
    totalWritten += rows.length;
  }

  console.log(`\nTermine : ${totalWritten} descriptions ecrites au total.`);
  if (allUnmatchedExtracted.length > 0) {
    console.log(`\nExtraites du texte mais sans entree DB correspondante (${allUnmatchedExtracted.length}) :`);
    for (const s of allUnmatchedExtracted) console.log(`  - ${s}`);
  }
  if (allUndescribedEntries.length > 0) {
    console.log(`\nEntrees DB sans description trouvee dans le texte (${allUndescribedEntries.length}) :`);
    for (const s of allUndescribedEntries) console.log(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
