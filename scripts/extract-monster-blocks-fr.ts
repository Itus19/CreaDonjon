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
// Lancement : npm run extract:monster-blocks -- [--limit N] [--only entry-key] [--write]
// Sans --write : mode dry-run, rapport de couverture uniquement.
// --only + DEBUG_ZONE=1 (variable d'environnement) : affiche le detail
// zone/entetes/resultat d'un seul monstre pour deboguer un echec, sans
// jamais retirer les autres du calcul des bornes de zone (necessaires au
// monstre cible lui-meme).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// --srd 5.2.1 bascule le script sur la SRD 2024 (meme logique d'extraction,
// juste la source et le ruleset cible qui changent) ; par defaut la 5.1.
const srdArgIdx = process.argv.indexOf("--srd");
const SRD_VERSION = srdArgIdx >= 0 ? process.argv[srdArgIdx + 1] : "5.1";
const SOURCE_FILE = SRD_VERSION === "5.2.1" ? "data/srd/fr-source/srd-5.2.1-fr.txt" : "data/srd/fr-source/srd-5.1-fr.txt";
const RULESET_ID = SRD_VERSION === "5.2.1" ? "110d20e9-dd80-4752-a57e-a957601b4eae" : "41ebff94-aabc-4f5c-b437-28f2f7a195ee";

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
    // 5.1 met le numero de page APRES le titre ("...5.1 363"), 5.2.1 le met
    // AVANT ("58 Document de Référence...") — les deux formats coexistent
    // puisque le script sert desormais aux deux editions (--srd 5.2.1).
    /^Document de Référence du Système 5\.(1|2\.1)(\s+\d+)?$/.test(line) ||
    /^\d+ Document de Référence du Système 5\.(1|2\.1)$/.test(line)
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
  legendaryActions: EnglishEntry[];
}

// En-tete de trait/action : debut de ligne, majuscule initiale, phrase
// courte (<=90 car.) se terminant par un point suivi d'une espace, avant la
// suite de la description. Jamais tout en majuscules (evite les codes de
// mise en page), jamais un chiffre en tete (evite les lignes de table).
const HEADER_RE = /^([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ][^.!?:]{1,89}?)\.\s+(.*)$/;
// Meme motif, mais l'entete occupe sa ligne SEULE jusqu'au point final —
// sa description commence sur la ligne suivante (ex. "Nuage d'encre
// (recharge après un repos court ou long)." puis "Un nuage d'encre...").
// Repli de dernier recours seulement (voir findAloneHeaders) : sans le
// texte qui suit sur la meme ligne, ce motif matche aussi de courtes
// phrases isolees qui ne sont pas des entetes.
const HEADER_ALONE_RE = /^([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ][^.!?:]{1,89}?)\.$/;

// Un vrai nom de trait/action est presque toujours un groupe nominal SANS
// article initial ("Absorption de l'acide", "Résistance légendaire",
// "Souffle de feu"), jamais un fragment de phrase introduit par une
// conjonction/locution subordonnante (faux positif en milieu de paragraphe,
// ex. "Sur un résultat de 6, il devient fou.", Golem d'argile) ni par un
// article defini/indefini (premiere phrase d'un paragraphe d'ambiance
// generique apres la derniere action reelle, ex. "Les ecclésiastiques
// livrent au peuple...", Ecclésiastique — V1-D3b).
// "En cas " ajoute (Cube gélatineux, SRD 5.2.1, V1-D3b) : "En cas de
// réussite, la cible s'évade..." coupe par la mise en page en plein milieu
// d'une phrase de resolution de degats, matchait a tort le motif d'en-tete
// faute d'un prefixe "En " generique dans la liste (seul "En outre" y figurait).
const SENTENCE_FRAGMENT_RE =
  /^(Sur |Si |Quand |Lorsqu|Tant que|Après avoir|Alors que|Ainsi|Ensuite|Toutefois|Cependant|Par ailleurs|En outre|En cas |De plus|Dans ce cas|Les |Des |Une |Un |L’|La |Le |Ces |Cette |Chaque |Certains |Certaines |Tout |Tous |Toute |Toutes |Beaucoup |Plusieurs |Il |Elle |Ils |Elles |Vous |On )/;

function rejectsAsHeader(name: string): boolean {
  return (
    // "Sens vision..."/"Sens Perception..."/"Sens perception..."
    // precisement (jamais un simple "Sens " nu) : un motif trop large
    // rejetait a tort de vrais traits comme "Sens aiguisés" ou "Sens
    // diminués" (pseudodragon, torve, V1-D3b).
    /^(Facteur de puissance|Sens (vision|[Pp]erception)|Langues|Compétences |Jets de sauvegarde|Vitesse \d|Classe d.armure|Points de vie \d)/.test(name) ||
    // "aux dégâts" precisement (jamais un simple "au"/"aux" nu) : la
    // preambule du bloc de caracteristiques dit toujours "Résistances aux
    // dégâts...", jamais autre chose apres "au"/"aux" — un motif plus
    // large rejetait a tort de vrais traits comme "Résistance au renvoi"
    // (Résistance au renvoi des morts-vivants, Liche, V1-D3b).
    /^(Vulnérabilité|Résistance|Immunité)s? (aux dégâts|\()/.test(name) ||
    // "DD 13." ou "DD 15 à condition que..." coupe par la mise en page du
    // PDF au milieu d'une phrase ("test de Force (Athlétisme) \nDD 13. À
    // son tour...", "...DD 15 à condition que le golem l'entende.") matche
    // a tort le motif "Nom. description" — jamais un vrai nom de
    // trait/action, toujours une reference de DD en cours de phrase
    // (Manteleur/Mante obscure, Golem de chair, V1-D3b, SRD 5.2.1).
    /^DD \d+\b/.test(name) ||
    SENTENCE_FRAGMENT_RE.test(name)
  );
}

function isHeaderLine(line: string): { name: string; rest: string } | null {
  const trimmed = line.trim();
  const m = HEADER_RE.exec(trimmed);
  if (!m) return null;
  const name = m[1].trim();
  // Rejette les lignes de preambule du bloc de caracteristiques, jamais des
  // traits/actions. Motifs precis (pas de simple prefixe "Résistance" ou
  // "Immunité" : ça rejetterait a tort de vrais traits comme "Résistance
  // légendaire" ou "Immunité aux ombres").
  if (rejectsAsHeader(name)) return null;
  return { name, rest: m[2].trim() };
}

function isHeaderAloneLine(line: string): { name: string; rest: string } | null {
  const trimmed = line.trim();
  const m = HEADER_ALONE_RE.exec(trimmed);
  if (!m) return null;
  const name = m[1].trim();
  if (rejectsAsHeader(name)) return null;
  return { name, rest: "" };
}

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
/**
 * Repli pour la fin d'une liste de sorts innes ("À volonté : ...",
 * "N/jour chacun : ..."), qui se termine par un simple nom de sort SANS
 * point final avant l'entete suivant (ex. "...mot de pouvoir étourdissant,
 * \nvol\nRésistance à la magie." — glabrezu). Verifie sur glabrezu, efreeti,
 * oni, night-hag (V1-D3b) : cherche un marqueur de frequence ("volonté",
 * "chacun", "/jour", "/repos") dans les quelques lignes qui precedent la
 * ligne non ponctuee, jamais au-dela d'une vraie fin de phrase anterieure
 * (qui signalerait un tout autre paragraphe, pas la meme liste).
 */
function precededBySpellFrequencyListTail(lines: string[], fromIndex: number): boolean {
  for (let j = fromIndex; j >= Math.max(0, fromIndex - 6); j--) {
    const t = lines[j].trim();
    if (/(volonté|chacun|\/jour|\/repos)/i.test(t)) return true;
    if (j < fromIndex && /[.!?)]\s*$/.test(t)) return false;
  }
  return false;
}

function precededByParagraphEnd(lines: string[], i: number): boolean {
  for (let j = i - 1; j >= 0; j--) {
    const prev = lines[j].trim();
    if (prev.length === 0) continue;
    // ":" accepte comme fin de "paragraphe" en plus de ".!?)" : un trait
    // parent peut introduire une sous-liste de sous-traits nommes par un
    // deux-points ("Faiblesses des vampires. ... suivantes :"), chacun un
    // vrai en-tete distinct dans le decompte anglais (Vampirien, V1-D3b,
    // SRD 5.2.1 — "Défense d'entrer" suivait sans etre reconnu, faisant
    // echouer le compte de 6 traits attendus a 5 trouves).
    if (/[.!?):]\s*$/.test(prev)) return true;
    return precededBySpellFrequencyListTail(lines, j);
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
    // Plafond releve de 45 a 50 (chain-devil, V1-D3b) : "Chaînes animées
    // (recharge après un repos court" fait 46 caracteres, un vrai entete
    // coupe par la mise en page comme les autres, juste plus long a cause
    // de son qualificatif de recharge entre parentheses.
    if (line.length === 0 || line.length > 50 || /[.!?:]$/.test(line)) continue;
    if (!/^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ]/.test(line)) continue;
    if (!precededByParagraphEnd(lines, i)) continue;
    const merged = `${line} ${lines[i + 1].trim()}`;
    const h = isHeaderLine(merged);
    if (h) results.push({ index: i, name: h.name, rest: h.rest, consumed: 2 });
  }
  return results;
}

/**
 * Repli de dernier recours : un entete seul sur sa ligne, description sur
 * la suivante (ex. "Nuage d'encre (recharge après un repos court ou
 * long)."). N'est tente que si les paliers precedents (direct + coupe sur
 * deux lignes) ne suffisent pas a atteindre le compte attendu — matche
 * aussi de courtes phrases isolees qui n'en sont pas, donc jamais utilise
 * en premier.
 */
function findAloneHeaders(lines: string[], usedIndices: Set<number>): { index: number; name: string; rest: string; consumed: number }[] {
  const results: { index: number; name: string; rest: string; consumed: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (usedIndices.has(i)) continue;
    const h = isHeaderAloneLine(lines[i]);
    if (h && precededByParagraphEnd(lines, i)) results.push({ index: i, name: h.name, rest: h.rest, consumed: 1 });
  }
  return results;
}

type HeaderCandidate = { index: number; name: string; rest: string; consumed: number };

/**
 * Motif rencontre chez les dragons metalliques (V1-D3b) : un souffle
 * generique introduit par deux points ("... recourt a l'un des souffles
 * suivants :") suivi de plusieurs options nommees ("Souffle de feu.",
 * "Souffle soporifique."...), chacune une vraie phrase se terminant par un
 * point — donc detectee comme un entete a part entiere par les regles
 * normales, alors que la source anglaise (deja importee) ne compte cela
 * que comme UNE seule action. Fusionne les options excedentaires dans le
 * dernier entete dont le corps se termine par ":" (introduction d'une
 * liste), en ne consommant que le nombre d'entetes surnumeraires reelement
 * present — jamais une fusion aveugle du reste de la zone.
 */
function mergeColonIntroducedLists(lines: string[], headers: HeaderCandidate[], expectedCount: number): HeaderCandidate[] | null {
  const surplus = headers.length - expectedCount;
  if (surplus <= 0) return null;

  for (let h = 0; h < headers.length; h++) {
    // Ne regarde que le DEBUT du corps (l'introduction de la liste, avant
    // le premier sous-element absorbe comme simple texte) : le corps
    // complet fusionne se termine par la derniere phrase du dernier
    // sous-element, jamais par les deux points qui n'apparaissent qu'au
    // tout debut ("... recourt a l'un des souffles \nsuivants :"), parfois
    // coupes sur deux lignes par la mise en page — on accumule donc jusqu'a
    // 3 lignes avant d'abandonner.
    const next = headers[h + 1];
    const bodyStart = headers[h].index + headers[h].consumed;
    const bodyEnd = next ? next.index : lines.length;
    const bodyLinesForIntro = lines.slice(bodyStart, bodyEnd).map((l) => l.trim()).filter((l) => l.length > 0);
    // Accumule ligne par ligne et s'arrete des qu'un ":" de fin de phrase
    // apparait — jamais au-dela des 3 premieres lignes, pour ne pas
    // confondre avec un ":" qui apparaitrait plus loin dans une phrase
    // sans rapport (ex. "Attaque ... : +4 pour toucher").
    let intro = headers[h].rest;
    let isWrapperIntro = /:$/.test(intro.trim());
    for (let k = 0; !isWrapperIntro && k < Math.min(3, bodyLinesForIntro.length); k++) {
      intro = `${intro} ${bodyLinesForIntro[k]}`.trim();
      isWrapperIntro = /:$/.test(intro);
    }
    if (!isWrapperIntro) continue;
    if (h + 1 + surplus > headers.length) continue;

    // consumed reste celui du seul entete conserve : les entetes
    // surnumeraires sont simplement retires du tableau, donc leur texte
    // (nom, reste de ligne, corps) est desormais lu comme la suite ordinaire
    // du corps de l'entete fusionne jusqu'au PROCHAIN entete restant (ou la
    // fin de zone), exactement comme le fait extractEntries pour tout corps.
    const merged: HeaderCandidate = { index: headers[h].index, name: headers[h].name, rest: headers[h].rest, consumed: headers[h].consumed };
    return [...headers.slice(0, h), merged, ...headers.slice(h + 1 + surplus)];
  }
  return null;
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
    let combined = [...headers, ...wrapped].sort((a, b) => a.index - b.index);
    if (combined.length !== expectedCount) {
      // Repli de dernier recours seulement si les paliers precedents ne
      // suffisent pas : matche aussi de courtes phrases isolees, donc
      // jamais tente en premier (risque de faux positifs plus eleve).
      const usedAfterWrapped = new Set(combined.map((h) => h.index));
      const alone = findAloneHeaders(lines, usedAfterWrapped);
      const withAlone = [...combined, ...alone].sort((a, b) => a.index - b.index);
      if (withAlone.length === expectedCount) combined = withAlone;
    }
    if (combined.length === expectedCount) headers = combined;
    else {
      const merged = mergeColonIntroducedLists(lines, combined, expectedCount);
      if (merged) headers = merged;
      else return null;
    }
  }

  const entries: { name: string; description: string }[] = [];
  for (let h = 0; h < headers.length; h++) {
    const cur = headers[h];
    const next = headers[h + 1];
    const bodyStart = cur.index + cur.consumed;
    const bodyEnd = next ? next.index : lines.length;
    const bodyLines = lines.slice(bodyStart, bodyEnd).map((l) => l.trim()).filter((l) => l.length > 0);
    let description = [cur.rest, ...bodyLines].filter((s) => s.length > 0).join(" ");
    // Dernier entete de la zone seulement : un sous-titre d'espece isole
    // ("Dragon d'argent") peut se glisser juste avant le nom du monstre
    // suivant, quand celui-ci marque deja la borne de zone (donc invisible
    // aux troncatures qui reperent "de taille" ou "Classe d'armure" DANS
    // la zone). Signature : fragment final court, sans ponctuation de fin
    // de phrase, apres le dernier point reel — jamais coupe si la
    // description entiere se termine deja normalement.
    if (h === headers.length - 1 && !/[.!?]$/.test(description)) {
      const lastSentenceEnd = description.lastIndexOf(". ");
      if (lastSentenceEnd !== -1) {
        const tail = description.slice(lastSentenceEnd + 2);
        if (tail.length > 0 && tail.length < 40 && /^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ][^.!?]*$/.test(tail)) {
          description = description.slice(0, lastSentenceEnd + 1);
        }
      }
    }
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
    .in("block_type", ["stat_block", "traits", "actions", "legendary_actions"]);
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
    const legendaryActions = ((b?.legendary_actions as { actions?: EnglishEntry[] } | undefined)?.actions ?? []) as EnglishEntry[];
    rows.push({
      id: entry.id,
      entry_key: entry.entry_key,
      frenchName,
      armorClass: statBlock.armor_class,
      hitPoints: statBlock.hit_points,
      traits,
      actions,
      legendaryActions,
    });
  }
  // ONLY_KEY ne filtre jamais `rows` ici : la localisation de chaque
  // monstre depend de son voisin suivant dans le texte (borne de zone), le
  // retirer avant cette etape fausserait la borne de tous les autres.
  // ONLY_KEY ne sert qu'a limiter l'AFFICHAGE de debogage plus bas.
  if (LIMIT) rows = rows.slice(0, LIMIT);

  // Localise l'en-tete confirme de chaque monstre : parmi toutes les
  // occurrences de son nom francais en debut de ligne, celle suivie de sa
  // CA et ses PV (depuis stat_block, deja importe) dans les ~20 lignes
  // suivantes. Formes differentes entre editions : 5.1 dit "Classe
  // d'armure X"/"Points de vie X (", 5.2.1 abrege en "CA X"/"Pv X (" — les
  // deux motifs sont acceptes, jamais un seul suppose, puisque le script
  // sert desormais aux deux (--srd 5.2.1).
  const CA_RE = (ac: number) => new RegExp(`(?:Classe d.armure|CA) ${ac}\\b`);
  const HP_RE = (hp: number) => new RegExp(`(?:Points de vie|Pv) ${hp} \\(`);

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
    const confirmedRaw = candidates.filter((idx) => {
      const window = allLines.slice(idx, idx + 20).join(" ");
      return CA_RE(row.armorClass).test(window) && HP_RE(row.hitPoints).test(window);
    });
    // Motif du double en-tete (SRD 5.2.1, meme cause que sur
    // extract-monster-statblocks-en.ts cote anglais) : le nom du monstre
    // apparait deux fois cote a cote ("Nom" en-tete de page courant, ligne
    // vide, "Nom" titre du bloc de caracteristiques) — les DEUX occurrences
    // passent la verification CA/PV puisque le bloc de caracteristiques
    // reel se trouve dans la fenetre de 20 lignes des deux, donc jamais un
    // vrai doublon "identicalDuplicate" (le contenu filtre diverge d'un mot
    // "Nom" en tete). Touchait 146/324 monstres avant ce correctif. Fusionne
    // les candidats confirmes separes de 3 lignes au plus, ne garde que le
    // dernier (le plus proche du vrai bloc).
    const confirmed: number[] = [];
    for (const idx of confirmedRaw) {
      if (confirmed.length > 0 && idx - confirmed[confirmed.length - 1] <= 3) confirmed[confirmed.length - 1] = idx;
      else confirmed.push(idx);
    }
    // Fenetre de lignes brutes plus large que necessaire (30, pas 20) : le
    // bruit de bas de page consomme des lignes brutes sans ajouter de
    // contenu, donc deux occurrences identiques peuvent avoir une longueur
    // de contenu filtre differente sur une fenetre a taille fixe si le
    // decoupage en pages ne tombe pas au meme endroit relatif — compare
    // seulement les 300 premiers caracteres de contenu utile, suffisant
    // pour confirmer qu'il s'agit du meme monstre sans etre sensible a ça.
    const windowContent = (idx: number) =>
      allLines
        .slice(idx, idx + 30)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !isFooterNoise(l))
        .join(" ")
        .slice(0, 300);
    const identicalDuplicate = confirmed.length > 1 && confirmed.every((idx) => windowContent(idx) === windowContent(confirmed[0]));
    if (confirmed.length === 1) {
      located.push({ ...row, headerLine: confirmed[0] });
    } else if (confirmed.length === 0 && candidates.length === 1) {
      // Le nom n'a qu'une seule occurrence dans tout le texte : aucune
      // ambiguite possible a lever, la verification CA/PV (utile
      // uniquement pour departager plusieurs occurrences) est ici sans
      // objet. Un ecart CA/PV a cet endroit vient plutot d'une divergence
      // connue entre le JSON source et le texte officiel (armure variable,
      // etc.), pas d'un mauvais candidat.
      located.push({ ...row, headerLine: candidates[0] });
    } else if (identicalDuplicate) {
      // Le monstre apparait deux fois mot pour mot dans le texte officiel
      // (verifie sur Cervidé géant, present a deux endroits avec un bloc de
      // caracteristiques identique) : n'importe laquelle des deux occurrences
      // donne le meme resultat, la premiere est prise sans ambiguite reelle.
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
    let nextHeaderLine = i + 1 < located.length ? located[i + 1].headerLine : allLines.length;
    // Motif du double en-tete (voir plus haut) applique cette fois a la
    // borne de fin de zone : le monstre SUIVANT peut pre-annoncer son nom
    // seul sur une ligne quelques lignes avant sa vraie ligne de type,
    // retenue comme headerLine. Sans ce recul, cette pre-annonce se fait
    // avaler comme derniere phrase/action de la description courante (ex.
    // Aboleth -> "Âme-en-peine" avalait deux de ses actions, Coup de
    // tentacule et Succion psychique). Recule juste avant la derniere
    // occurrence du nom du monstre suivant trouvee dans les 4 lignes
    // precedentes.
    if (i + 1 < located.length) {
      const nextName = located[i + 1].frenchName;
      for (let j = nextHeaderLine - 1; j >= Math.max(row.headerLine + 1, nextHeaderLine - 4); j--) {
        if (allLines[j].trim() === nextName) {
          nextHeaderLine = j;
          break;
        }
      }
    }
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
    // Ancre en DEBUT de ligne sur un vrai mot de type de creature (jamais
    // un simple " de taille X," nu) : une prose de trait/action peut
    // mentionner un changement de taille en cours de phrase (ex. Duergar,
    // Agrandissement : "le duergar est de taille G, double ses dés...") —
    // un faux positif confirme en debogant duergar (V1-D3b), le motif nu
    // comptait cette mention comme un deuxieme monstre intercale et
    // tronquait la zone en plein milieu de sa propre action.
    // "de taille [A-Z]{1,3}(?: ou [A-Z]{1,3})?," : la SRD 5.2.1 introduit des
    // tailles composees ("de taille M ou P", ex. Garde) pour les monstres
    // dont le gabarit varie — motif absent en 2014, jamais rencontre avant
    // cette passe. Sans le second groupe optionnel, "Capitaine de la garde"
    // (taille M ou P) ne declenchait pas la troncature de fuite et se
    // faisait avaler en entier dans la derniere action de "Garde".
    const sizeLineIndices = zoneLines.reduce<number[]>((acc, l, idx) => {
      if (/^(Aberration|Artificiel|Bête|Céleste|Dragon|Fiélon|Fée|Géant|Humanoïde|Monstruosité|Mort-vivant|Plante|Vase|Élémentaire)(\s*\([^)]*\))?\s+de taille [A-Z]{1,3}(?: ou [A-Z]{1,3})?,/.test(l.trim()))
        acc.push(idx);
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
    // Meme motif pour le tout dernier monstre du bestiaire (ex. Zombie) :
    // la zone continue jusqu'a la fin de fichier faute de monstre suivant
    // localise, et deborde dans l'annexe suivante ("Annexe MdJ-A : États").
    const appendixIdx = zoneLines.findIndex((l) => /^Annexe (MdJ|MdM)-[A-Z] ?:/.test(l.trim()));
    if (appendixIdx !== -1) zoneLines = zoneLines.slice(0, appendixIdx);

    const actionsIdx = zoneLines.findIndex((l) => l.trim() === "Actions");
    if (row.actions.length > 0 && actionsIdx === -1) {
      failures.push(`${row.entry_key} : entete "Actions" introuvable (${row.actions.length} action(s) attendue(s))`);
      continue;
    }

    const traitsZoneEnd = actionsIdx === -1 ? zoneLines.length : actionsIdx;
    let traitsZone = zoneLines.slice(0, traitsZoneEnd);
    // SRD 5.2.1 (2024) uniquement : un en-tete litteral "Traits" precede
    // desormais la section, absent en 2014 (les traits suivaient le
    // preambule directement). Jamais retire, le premier trait qui suit
    // etait rejete a tort par precededByParagraphEnd (la ligne "Traits"
    // seule ne se termine par aucune ponctuation de fin de phrase) — meme
    // motif que "Actions", deja retire de la zone plus bas.
    const traitsHeaderIdx = traitsZone.findIndex((l) => l.trim() === "Traits");
    if (traitsHeaderIdx !== -1) traitsZone = traitsZone.slice(traitsHeaderIdx + 1);

    // "Variante : ..." (ex. Nuée d'insectes) precede des sous-variantes sans
    // bloc de caracteristiques propre (giant-rat-diseased, meme motif) :
    // leur contenu n'est jamais compte dans les traits/actions du monstre de
    // base par la source anglaise, jamais une action a extraire ici.
    // "Actions Bonus" (SRD 5.2.1 uniquement, absent en 2014) manquait a
    // cette liste : sans lui, la derniere action "normale" avalait tout
    // jusqu'au prochain arret reconnu, y compris le monstre suivant en
    // entier quand aucun des trois autres arrets n'intervenait avant lui
    // (verifie sur Prêtre -> Pseudodragon, detecte par le garde-fou de fuite
    // existant plus bas). "Actions Légendaires" (Aboleth) porte une
    // majuscule a "Légendaires" contrairement a la plupart des autres
    // monstres ("Actions légendaires") — incoherence de casse dans la mise
    // en page source, jamais uniforme. Compare insensible a la casse pour ce
    // seul terme plutot que d'ajouter une troisieme variante figee au hasard.
    const isLegendaryMarker = (t: string) => t === "Aptitudes légendaires" || /^Actions légendaires$/i.test(t);
    const isOtherSectionMarker = (t: string) => t === "Réactions" || t === "Actions Bonus" || /^Variante ?:/.test(t);

    let actionsZone: string[] = [];
    // V1-E4b (retour utilisateur : "il manque les actions legendaires") :
    // au lieu de simplement s'arreter au marqueur "Actions légendaires"
    // (auparavant un simple point d'arret jamais exploite), on releve
    // TOUTES les positions de marqueur de section dans l'ordre pour isoler
    // la zone "Actions légendaires" elle-meme, bornee par le marqueur
    // suivant (ou la fin de la zone du monstre) — jamais une hypothese sur
    // l'ordre relatif de Réactions/Actions légendaires, meme si l'ordre
    // canonique du SRD place toujours les actions legendaires en dernier.
    let legendaryActionsZone: string[] = [];
    if (actionsIdx !== -1) {
      const rest = zoneLines.slice(actionsIdx + 1);
      const markers: { idx: number; legendary: boolean }[] = [];
      rest.forEach((l, idx) => {
        const t = l.trim();
        if (isLegendaryMarker(t)) markers.push({ idx, legendary: true });
        else if (isOtherSectionMarker(t)) markers.push({ idx, legendary: false });
      });
      const firstMarkerIdx = markers.length > 0 ? markers[0].idx : rest.length;
      actionsZone = rest.slice(0, firstMarkerIdx);

      const legendaryPos = markers.findIndex((m) => m.legendary);
      if (legendaryPos !== -1) {
        const zoneStart = markers[legendaryPos].idx + 1;
        const zoneEnd = legendaryPos + 1 < markers.length ? markers[legendaryPos + 1].idx : rest.length;
        legendaryActionsZone = rest.slice(zoneStart, zoneEnd);
      }
    }

    if (row.entry_key === ONLY_KEY && process.env.DEBUG_ZONE) {
      console.log(`headerLine=${row.headerLine} nextHeaderLine=${nextHeaderLine} next-in-located=${located[i + 1]?.entry_key}`);
      console.log(`--- traitsZone (attendu ${row.traits.length}) ---`);
      console.log(traitsZone.join("\n"));
      console.log("headers:", findHeaders(traitsZone).map((h) => h.name));
      console.log(`--- actionsZone (attendu ${row.actions.length}) ---`);
      console.log(actionsZone.join("\n"));
      console.log("headers:", findHeaders(actionsZone).map((h) => h.name));
      console.log(`--- legendaryActionsZone (attendu ${row.legendaryActions.length}) ---`);
      console.log(legendaryActionsZone.join("\n"));
      console.log("headers:", findHeaders(legendaryActionsZone).map((h) => h.name));
    }

    const traitsResult = extractEntries(traitsZone, row.traits.length);
    const actionsResult = extractEntries(actionsZone, row.actions.length);
    const legendaryActionsResult = extractEntries(legendaryActionsZone, row.legendaryActions.length);

    if (traitsResult === null) {
      failures.push(`${row.entry_key} : ${row.traits.length} trait(s) attendu(s), decoupage echoue`);
      continue;
    }
    if (actionsResult === null) {
      failures.push(`${row.entry_key} : ${row.actions.length} action(s) attendue(s), decoupage echoue`);
      continue;
    }
    if (legendaryActionsResult === null) {
      failures.push(`${row.entry_key} : ${row.legendaryActions.length} action(s) legendaire(s) attendue(s), decoupage echoue`);
      continue;
    }

    successCount++;
    if (row.entry_key === ONLY_KEY && process.env.DEBUG_ZONE) {
      console.log(JSON.stringify({ traits: traitsResult, actions: actionsResult, legendaryActions: legendaryActionsResult }, null, 2));
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
    if (legendaryActionsResult.length > 0) {
      blockData.legendary_actions = {
        actions: legendaryActionsResult.map((a, idx) => ({
          name: a.name,
          description: a.description,
          attack_bonus: row.legendaryActions[idx]?.attack_bonus,
          damage: row.legendaryActions[idx]?.damage,
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
  const CREATURE_TYPE_WORDS = /\b(Monstruosité|Humanoïde|Aberration|Dragon|Fiélon|Élémentaire|Fée|Géant|Mort-vivant|Vase|Artificiel|Céleste) de taille [A-Z]{1,3}(?: ou [A-Z]{1,3})?,/;
  const suspicious: string[] = [];
  for (const u of upserts) {
    const traitsData = (u.blocks.traits as { traits?: { name: string; description: string }[] } | undefined)?.traits ?? [];
    const actionsData = (u.blocks.actions as { actions?: { name: string; description: string }[] } | undefined)?.actions ?? [];
    const legendaryActionsData =
      (u.blocks.legendary_actions as { actions?: { name: string; description: string }[] } | undefined)?.actions ?? [];
    for (const e of [...traitsData, ...actionsData, ...legendaryActionsData]) {
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
