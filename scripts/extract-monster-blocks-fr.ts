// V1-D3b (points 7-8) : extraction generique des blocs `traits`/`actions`
// des monstres depuis le texte officiel francais. Motif observe (verifie a
// la main sur une trentaine de monstres avant d'ecrire ce script, cf.
// docs/BACKLOG_V1.md V1-D3b) : chaque trait/action est un en-tete en gras
// EN DEBUT DE LIGNE physique, immediatement suivi d'un point puis de sa
// description sur la meme ligne logique — jamais une ligne isolee comme les
// titres de regle/objet. Contrairement a une regle ou un objet, aucune
// verification de nom par avance n'est possible (334 monstres, noms de
// trait jamais catalogues) : la seule garde-fou est le COMPTE. Le nombre
// d'entetes candidats detectes dans une zone doit correspondre exactement
// au nombre de traits/actions attendus (source_raw anglais, deja importe
// dans ruleset_entry_blocks) — sinon le monstre est ignore et liste en fin
// d'execution, jamais devine.
//
// Bornes du bloc d'un monstre : de son nom (deja traduit, V1-A5/V1-D3b) au
// nom du monstre suivant dans le texte (position physique, pas alphabetique).
// Desambiguise par la classe d'armure + les points de vie du bloc
// `stat_block` deja importe quand le nom apparait plusieurs fois (homonymes
// de sous-titre, ex. "Poisons" table de prix vs chapitre) — memes le motif
// deja rencontre en V1-D3b point 1.
//
// Lancement : npm run extract:monster-blocks -- [--limit N] [--write]
// Sans --write : mode dry-run, rapport de couverture uniquement.

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

const WRITE = process.argv.includes("--write");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;
const ONLY_KEY = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 ? process.argv[i + 1] : undefined;
})();

function isFooterNoise(line: string): boolean {
  return (
    /^=== page \d+ ===$/.test(line) ||
    line.startsWith("Interdit à la revente") ||
    line.startsWith("ce document pour votre strict usage personnel") ||
    /^Document de Référence du Système 5\.1(\s+\d+)?$/.test(line)
  );
}

interface EnglishEntry {
  name: string;
  description: string;
  attack_bonus?: number;
  damage?: unknown;
}

interface MonsterRow {
  id: string;
  entry_key: string;
  frenchName: string;
  armorClass: number;
  hitPoints: number;
  traits: EnglishEntry[];
  actions: EnglishEntry[];
}

// En-tete de trait/action : debut de ligne, majuscule initiale, phrase
// courte (<=90 car.) se terminant par un point suivi d'une espace, avant la
// suite de la description. Jamais tout en majuscules (evite les codes de
// mise en page), jamais un chiffre en tete (evite les lignes de table).
const HEADER_RE = /^([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ][^.!?:]{1,89}?)\.\s+(.*)$/;

function isHeaderLine(line: string): { name: string; rest: string } | null {
  const m = HEADER_RE.exec(line.trim());
  if (!m) return null;
  const name = m[1].trim();
  // Rejette les lignes de preambule du bloc de caracteristiques, jamais des
  // traits/actions. Motifs precis (pas de simple prefixe "Résistance" ou
  // "Immunité" : ça rejetterait a tort de vrais traits comme "Résistance
  // légendaire" ou "Immunité aux ombres").
  if (
    /^(Facteur de puissance|Sens |Langues|Compétences |Jets de sauvegarde|Vitesse \d|Classe d.armure|Points de vie \d)/.test(name) ||
    /^(Vulnérabilité|Résistance|Immunité)s? (aux? |\()/.test(name)
  )
    return null;
  return { name, rest: m[2].trim() };
}

/** Detecte les entetes dans une zone de lignes ; tente d'abord ligne par ligne, puis un repli qui fusionne les lignes courtes sans ponctuation finale avec la suivante (entete coupe sur deux lignes par la mise en page). */
/**
 * Un vrai en-tete ne peut suivre qu'une ligne qui clot une phrase ou le
 * bloc de caracteristiques (point, point d'exclamation/interrogation, ou
 * parenthese fermante comme "(15 000 PX)") — jamais un mot de liaison en
 * fin de ligne ("sa", "la", "de"...), signe que la ligne suivante n'est
 * qu'une coupure de mise en page au milieu d'une phrase (ex. "recourir a sa
 * \nPrésence terrifiante." — une mention en cours de phrase, pas un
 * nouveau trait). Premiere ligne de la zone toujours acceptee : rien avant
 * elle a verifier.
 */
function precededByParagraphEnd(lines: string[], i: number): boolean {
  for (let j = i - 1; j >= 0; j--) {
    const prev = lines[j].trim();
    if (prev.length === 0) continue;
    return /[.!?)]\s*$/.test(prev);
  }
  return true;
}

function findHeaders(lines: string[]): { index: number; name: string; rest: string; consumed: number }[] {
  const direct: { index: number; name: string; rest: string; consumed: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const h = isHeaderLine(lines[i]);
    if (h && precededByParagraphEnd(lines, i)) direct.push({ index: i, name: h.name, rest: h.rest, consumed: 1 });
  }
  return direct;
}

function findWrappedHeaders(lines: string[], usedIndices: Set<number>): { index: number; name: string; rest: string; consumed: number }[] {
  const results: { index: number; name: string; rest: string; consumed: number }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (usedIndices.has(i)) continue;
    const line = lines[i].trim();
    // Ligne courte sans ponctuation finale = candidat a une fusion avec la suivante.
    if (line.length === 0 || line.length > 45 || /[.!?:]$/.test(line)) continue;
    if (!/^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ]/.test(line)) continue;
    if (!precededByParagraphEnd(lines, i)) continue;
    const merged = `${line} ${lines[i + 1].trim()}`;
    const h = isHeaderLine(merged);
    if (h) results.push({ index: i, name: h.name, rest: h.rest, consumed: 2 });
  }
  return results;
}

/** Extrait N entrees {name, description} d'une zone de texte, ou null si le compte ne correspond pas exactement au nombre attendu. */
function extractEntries(lines: string[], expectedCount: number): { name: string; description: string }[] | null {
  // Zero attendu : tout contenu present ici est forcement le preambule du
  // bloc de caracteristiques (Competences, Sens, Langues...), jamais un
  // trait/une action a extraire — rien a verifier de plus.
  if (expectedCount === 0) return [];

  let headers = findHeaders(lines);
  if (headers.length !== expectedCount) {
    const used = new Set(headers.map((h) => h.index));
    const wrapped = findWrappedHeaders(lines, used);
    const combined = [...headers, ...wrapped].sort((a, b) => a.index - b.index);
    if (combined.length === expectedCount) headers = combined;
    else return null;
  }

  const entries: { name: string; description: string }[] = [];
  for (let h = 0; h < headers.length; h++) {
    const cur = headers[h];
    const next = headers[h + 1];
    const bodyStart = cur.index + cur.consumed;
    const bodyEnd = next ? next.index : lines.length;
    const bodyLines = lines.slice(bodyStart, bodyEnd).map((l) => l.trim()).filter((l) => l.length > 0);
    const description = [cur.rest, ...bodyLines].filter((s) => s.length > 0).join(" ");
    if (description.length === 0) return null;
    entries.push({ name: cur.name, description });
  }
  return entries;
}

async function main() {
  const raw = readFileSync(SOURCE_FILE, "utf-8");
  const allLines = raw.split("\n");

  const { data: entries, error } = await supabase
    .from("ruleset_entries")
    .select("id, entry_key")
    .eq("ruleset_id", RULESET_ID)
    .eq("entry_type", "monster");
  if (error) throw new Error(error.message);

  const { data: translations, error: e2 } = await supabase
    .from("ruleset_entry_translations")
    .select("entry_id, name")
    .eq("locale", "fr")
    .in("entry_id", entries.map((e) => e.id));
  if (e2) throw new Error(e2.message);
  const frenchNameByEntry = new Map(translations.filter((t) => t.name).map((t) => [t.entry_id, t.name as string]));

  const { data: blocks, error: e3 } = await supabase
    .from("ruleset_entry_blocks")
    .select("entry_id, block_type, data")
    .in("entry_id", entries.map((e) => e.id))
    .in("block_type", ["stat_block", "traits", "actions"]);
  if (e3) throw new Error(e3.message);

  const blocksByEntry = new Map<string, Record<string, unknown>>();
  for (const b of blocks) {
    const m = blocksByEntry.get(b.entry_id) ?? {};
    m[b.block_type] = b.data;
    blocksByEntry.set(b.entry_id, m);
  }

  let rows: MonsterRow[] = [];
  for (const entry of entries) {
    const frenchName = frenchNameByEntry.get(entry.id);
    if (!frenchName) continue;
    const b = blocksByEntry.get(entry.id);
    const statBlock = b?.stat_block as { armor_class?: number; hit_points?: number } | undefined;
    if (!statBlock || typeof statBlock.armor_class !== "number" || typeof statBlock.hit_points !== "number") continue;
    const traits = ((b?.traits as { traits?: EnglishEntry[] } | undefined)?.traits ?? []) as EnglishEntry[];
    const actions = ((b?.actions as { actions?: EnglishEntry[] } | undefined)?.actions ?? []) as EnglishEntry[];
    rows.push({
      id: entry.id,
      entry_key: entry.entry_key,
      frenchName,
      armorClass: statBlock.armor_class,
      hitPoints: statBlock.hit_points,
      traits,
      actions,
    });
  }
  if (ONLY_KEY) rows = rows.filter((r) => r.entry_key === ONLY_KEY);
  if (LIMIT) rows = rows.slice(0, LIMIT);

  // Localise l'en-tete confirme de chaque monstre : parmi toutes les
  // occurrences de son nom francais en debut de ligne, celle suivie de sa
  // CA et ses PV (depuis stat_block, deja importe) dans les ~20 lignes
  // suivantes.
  const CA_RE = (ac: number) => new RegExp(`Classe d.armure ${ac}\\b`);
  const HP_RE = (hp: number) => new RegExp(`Points de vie ${hp} \\(`);

  const nameLineIndices = new Map<string, number[]>();
  for (let i = 0; i < allLines.length; i++) {
    const t = allLines[i].trim();
    if (t.length === 0) continue;
    if (!nameLineIndices.has(t)) nameLineIndices.set(t, []);
    nameLineIndices.get(t)!.push(i);
  }

  const located: (MonsterRow & { headerLine: number })[] = [];
  const notLocated: string[] = [];
  for (const row of rows) {
    const candidates = nameLineIndices.get(row.frenchName) ?? [];
    const confirmed = candidates.filter((idx) => {
      const window = allLines.slice(idx, idx + 20).join(" ");
      return CA_RE(row.armorClass).test(window) && HP_RE(row.hitPoints).test(window);
    });
    if (confirmed.length === 1) {
      located.push({ ...row, headerLine: confirmed[0] });
    } else {
      notLocated.push(`${row.entry_key} (${row.frenchName}) : ${confirmed.length} occurrence(s) confirmee(s) sur ${candidates.length} candidate(s)`);
    }
  }
  located.sort((a, b) => a.headerLine - b.headerLine);

  console.log(`${located.length}/${rows.length} monstres localises sans ambiguite dans le texte.`);
  if (notLocated.length > 0 && notLocated.length <= 40) {
    console.log(`\nNon localises (${notLocated.length}) :`);
    for (const n of notLocated) console.log(`  - ${n}`);
  } else if (notLocated.length > 0) {
    console.log(`\n${notLocated.length} non localises (liste tronquee).`);
  }

  const upserts: { entry_id: string; locale: string; blocks: Record<string, unknown>; source: string }[] = [];
  const failures: string[] = [];
  let successCount = 0;

  for (let i = 0; i < located.length; i++) {
    const row = located[i];
    const nextHeaderLine = i + 1 < located.length ? located[i + 1].headerLine : allLines.length;
    let zoneLines = allLines.slice(row.headerLine + 1, nextHeaderLine).filter((l) => !isFooterNoise(l.trim()));
    // Garde-fou supplementaire : si un ou plusieurs monstres non localises
    // (nom pas encore traduit, ou homonyme ambigu) s'intercalent avant le
    // prochain monstre localise, leur ligne "Classe d'armure" les trahit
    // meme sans connaitre leur nom — tronque la zone juste avant elle
    // plutot que d'avaler leur contenu dans la description de la derniere
    // entree detectee. Verifie sur Hibou-ours -> Hippogriffe et Mimique ->
    // Minotaure (V1-D3b) : sans cette troncature, "Griffes"/"Pseudopode"
    // absorbaient tout le debut du monstre suivant alors que le compte de
    // traits/actions restait correct — un piege silencieux que le seul
    // comptage ne detecte pas. La PREMIERE occurrence est celle du monstre
    // courant (des le debut de son propre preambule).
    // Ancre sur "de taille" (ligne type/gabarit/alignement, juste apres le
    // nom) plutot que "Classe d'armure" (une ligne plus loin) : coupe au
    // plus pres du nom du monstre intercale, pour ne laisser fuir dans la
    // derniere description que son nom seul (1 ligne, sans ponctuation —
    // n'affecte pas le sens), jamais ses stats.
    const sizeLineIndices = zoneLines.reduce<number[]>((acc, l, idx) => {
      if (/ de taille [A-Z]{1,3},/.test(l)) acc.push(idx);
      return acc;
    }, []);
    if (sizeLineIndices.length >= 2) {
      let cut = sizeLineIndices[1];
      // Recule d'une ligne supplementaire pour exclure aussi le nom du
      // monstre intercale, s'il est bien seul sur sa ligne (pas de point).
      if (cut > 0 && zoneLines[cut - 1].trim().length > 0 && !/[.!?]$/.test(zoneLines[cut - 1].trim())) cut -= 1;
      zoneLines = zoneLines.slice(0, cut);
    }
    // Meme motif pour la ligne de titre de section alphabetique ("Monstres
    // (O)") qui separe deux lettres — jamais le contenu d'un monstre, donc
    // une seule occurrence suffit a couper (contrairement a "de taille" et
    // "Classe d'armure", jamais presente dans le bloc du monstre courant).
    const sectionTitleIdx = zoneLines.findIndex((l) => /^Monstres \([A-ZÀ-Ü]\)$/.test(l.trim()));
    if (sectionTitleIdx !== -1) zoneLines = zoneLines.slice(0, sectionTitleIdx);

    const actionsIdx = zoneLines.findIndex((l) => l.trim() === "Actions");
    if (row.actions.length > 0 && actionsIdx === -1) {
      failures.push(`${row.entry_key} : entete "Actions" introuvable (${row.actions.length} action(s) attendue(s))`);
      continue;
    }

    const traitsZoneEnd = actionsIdx === -1 ? zoneLines.length : actionsIdx;
    const traitsZone = zoneLines.slice(0, traitsZoneEnd);

    let actionsZone: string[] = [];
    if (actionsIdx !== -1) {
      const rest = zoneLines.slice(actionsIdx + 1);
      const stopIdx = rest.findIndex((l) => l.trim() === "Réactions" || l.trim() === "Aptitudes légendaires" || l.trim() === "Actions légendaires");
      actionsZone = stopIdx === -1 ? rest : rest.slice(0, stopIdx);
    }

    const traitsResult = extractEntries(traitsZone, row.traits.length);
    const actionsResult = extractEntries(actionsZone, row.actions.length);

    if (traitsResult === null) {
      failures.push(`${row.entry_key} : ${row.traits.length} trait(s) attendu(s), decoupage echoue`);
      continue;
    }
    if (actionsResult === null) {
      failures.push(`${row.entry_key} : ${row.actions.length} action(s) attendue(s), decoupage echoue`);
      continue;
    }

    successCount++;
    if (ONLY_KEY && process.env.DEBUG_ZONE) {
      console.log(JSON.stringify({ traits: traitsResult, actions: actionsResult }, null, 2));
    }
    const blockData: Record<string, unknown> = {};
    if (traitsResult.length > 0) blockData.traits = { traits: traitsResult };
    if (actionsResult.length > 0) {
      blockData.actions = {
        actions: actionsResult.map((a, idx) => ({
          name: a.name,
          description: a.description,
          attack_bonus: row.actions[idx]?.attack_bonus,
          damage: row.actions[idx]?.damage,
        })),
      };
    }
    if (Object.keys(blockData).length === 0) continue;

    upserts.push({ entry_id: row.id, locale: "fr", blocks: blockData, source: "official_srd" });
  }

  // Garde-fou de dernier recours : les mots de type de creature (verifies
  // au § stat_block, V1-D1/D2) ne devraient jamais apparaitre au MILIEU
  // d'une description de trait/action — leur presence signale une fuite de
  // contenu du monstre suivant que les troncatures ci-dessus n'auraient pas
  // attrapee (ex. deux monstres non localises consecutifs). Alerte
  // seulement, n'empeche pas l'ecriture — chaque cas releve doit etre
  // verifie a la main plutot que suppose sans preuve.
  const CREATURE_TYPE_WORDS = /\b(Monstruosité|Humanoïde|Aberration|Dragon|Fiélon|Élémentaire|Fée|Géant|Mort-vivant|Vase|Artificiel|Céleste) de taille [A-Z]{1,3},/;
  const suspicious: string[] = [];
  for (const u of upserts) {
    const traitsData = (u.blocks.traits as { traits?: { name: string; description: string }[] } | undefined)?.traits ?? [];
    const actionsData = (u.blocks.actions as { actions?: { name: string; description: string }[] } | undefined)?.actions ?? [];
    for (const e of [...traitsData, ...actionsData]) {
      if (CREATURE_TYPE_WORDS.test(e.description)) suspicious.push(`${u.entry_id} / ${e.name}`);
    }
  }
  if (suspicious.length > 0) {
    console.log(`\n⚠ ${suspicious.length} description(s) suspecte(s) (fuite possible du monstre suivant) :`);
    for (const s of suspicious) console.log(`  - ${s}`);
  }

  console.log(`\n${successCount}/${located.length} monstres localises extraits avec succes (comptage traits/actions verifie).`);
  console.log(`${failures.length} echecs de decoupage (comptage non concordant, jamais devine) :`);
  for (const f of failures.slice(0, 60)) console.log(`  - ${f}`);
  if (failures.length > 60) console.log(`  ... et ${failures.length - 60} de plus.`);

  if (!WRITE) {
    console.log("\n(mode dry-run, rien ecrit — relancer avec --write pour ecrire en base)");
    return;
  }

  // Preserve le bloc `description` existant (deja rempli a l'import, jamais ecrase).
  for (const u of upserts) {
    const { data: existing } = await supabase
      .from("ruleset_entry_translations")
      .select("name, blocks")
      .eq("entry_id", u.entry_id)
      .eq("locale", "fr")
      .maybeSingle();
    u.blocks = { ...(existing?.blocks as Record<string, unknown> | undefined), ...u.blocks };
    (u as unknown as { name?: string }).name = existing?.name;
  }

  const BATCH = 200;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const { error: upsertError } = await supabase
      .from("ruleset_entry_translations")
      .upsert(upserts.slice(i, i + BATCH), { onConflict: "entry_id,locale" });
    if (upsertError) throw new Error(upsertError.message);
  }
  console.log(`\n${upserts.length} fiches ecrites en base.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
