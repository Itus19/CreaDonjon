// V1-D6 : reconstruit les stat-blocks anglais 2024 des monstres dont la
// donnee en base est en realite sourcee 2014 (source_raw.url contient
// "/2014/" alors que l'entree appartient au ruleset 5.2.1 — voir
// docs/BACKLOG_V1.md V1-D6). Lit data/srd/en-source/srd-5.2.1-en.txt
// (extrait sans -layout : le mode colonnes entrelace les monstres voisins,
// verifie sur le Loup).
//
// Structure du texte (etablie en investigant avant d'ecrire ce script,
// tache "Investiguer la structure de l'annexe des monstres 2024
// anglaise") : DEUX listes alphabetiques distinctes coexistent, "Monsters
// A-Z" (catalogue principal, Aboleth -> Zombie, avec des sous-groupes
// comme "Zombies" contenant Zombie + Ogre Zombie) puis "Animals" (creatures
// mondaines pour forme sauvage/familiers, Ape -> Wolf). Le bornage de zone
// ne suppose donc jamais un ordre alphabetique global : comme
// extract-monster-blocks-fr.ts, on localise chaque monstre par sa position
// physique reelle dans le texte, jamais par un tri suppose.
//
// Lancement : npm run extract:monster-statblocks-en -- [--only entry-key] [--limit N]
// Toujours en dry-run (rapport de couverture) : ecrit uniquement dans
// scripts/data/monster-statblocks-2024-en.json pour relecture manuelle
// avant toute ecriture en base (jamais directe : cf. V1-D6, la table est
// verrouillee pour les rulesets officiels, l'ecriture passera par
// data/srd/srd-2024.json + ingest-srd.ts, les seuls a contourner le verrou).

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESET_5_2_1 = "110d20e9-dd80-4752-a57e-a957601b4eae";
const SOURCE_FILE = "data/srd/en-source/srd-5.2.1-en.txt";
const OUTPUT_FILE = "scripts/data/monster-statblocks-2024-en.json";

const ONLY_KEY = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 ? process.argv[i + 1] : undefined;
})();
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;
// Retraite tout le bestiaire meme deja corrige — debogage/relecture d'un
// correctif du script uniquement (jamais utile en usage normal, ou seuls
// les monstres encore en 2014 doivent etre retraites).
const FORCE_ALL = process.argv.includes("--force-all");

const SIZE = "(?:Tiny|Small|Medium|Large|Huge|Gargantuan)";
const TYPE = "(?:Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead)";
// Ex. "Large Aberration, Lawful Evil" / "Medium or Small Undead, Neutral Evil"
// / "Medium Swarm of Tiny Beasts, Unaligned".
const TYPE_LINE_RE = new RegExp(`^(${SIZE}(?: or ${SIZE})?) (?:Swarm of ${SIZE} )?${TYPE}s?(?:\\s*\\([^)]*\\))?,\\s*.+$`);

function isFooterNoise(line: string): boolean {
  return /^=== page \d+ ===$/.test(line) || /^\d+ System Reference Document 5\.2\.1$/.test(line) || /^System Reference Document 5\.2\.1$/.test(line);
}

interface MonsterEntry {
  id: string;
  entry_key: string;
  englishName: string;
}

/**
 * 11 monstres genuinement renommes entre 2014 et 2024 (pas absents, juste
 * introuvables par une recherche sur leur ancien nom anglais) — verifie un
 * par un par lecture directe du texte 2024 avant d'etre inscrits ici,
 * jamais devine par ressemblance de concept (ex. "Quipper" -> "Piranha"
 * ecarte : deux poissons differents, pas une simple reetiquette du meme
 * monstre, contrairement aux onze ci-dessous). V1-D3b, passe "aller
 * plus loin".
 */
const RENAMED_2024: Record<string, string> = {
  androsphinx: "Sphinx of Valor",
  gynosphinx: "Sphinx of Lore",
  shrieker: "Shrieker Fungus",
  "giant-sea-horse": "Giant Seahorse",
  "sea-horse": "Seahorse",
  "cult-fanatic": "Cultist Fanatic",
  veteran: "Warrior Veteran",
  "acolyte-monster": "Priest Acolyte",
  "flying-sword": "Animated Flying Sword",
  "poisonous-snake": "Venomous Snake",
  "giant-poisonous-snake": "Giant Venomous Snake",
};

/**
 * Tous les monstres du ruleset servent de bornes de zone potentielles
 * (`needsFix: false` pour les 3 deja authentiquement 2024, ex. Aboleth) —
 * jamais seulement le sous-ensemble encore en 2014, sinon un monstre deja
 * corrige adjacent a un autre pas encore traite ne bornerait plus rien et
 * laisserait fuir du contenu. Seuls les `needsFix: true` sont effectivement
 * analyses et ecrits dans le rapport.
 */
async function fetchAllMonsters(): Promise<(MonsterEntry & { needsFix: boolean })[]> {
  const all: { id: string; entry_key: string; source_raw: unknown }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, entry_key, source_raw")
      .eq("ruleset_id", RULESET_5_2_1)
      .eq("entry_type", "monster")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < 1000) break;
  }
  const monsters: (MonsterEntry & { needsFix: boolean })[] = [];
  for (const e of all) {
    const raw = e.source_raw as { url?: unknown; name?: unknown } | null;
    const url = typeof raw?.url === "string" ? raw.url : "";
    const name = typeof raw?.name === "string" ? raw.name : undefined;
    if (!name) continue;
    monsters.push({ id: e.id, entry_key: e.entry_key, englishName: RENAMED_2024[e.entry_key] ?? name, needsFix: url.includes("/2014/") });
  }
  return monsters;
}

interface ZoneEntry {
  name: string;
  description: string;
}

interface ParsedMonster {
  entry_key: string;
  name: string;
  index: string;
  size: string;
  type: string;
  alignment: string;
  armor_class: number;
  hit_points: number;
  hit_dice: string;
  speed: Record<string, string>;
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  skills: { name: string; bonus: number }[];
  saving_throws: { ability: string; bonus: number }[];
  senses: Record<string, string>;
  languages: string;
  challenge_rating: number;
  xp: number;
  proficiency_bonus: number;
  traits: ZoneEntry[];
  actions: { name: string; description: string; attack_bonus?: number; damage?: { dice: string; type?: string }[] }[];
}

const ABILITY_NAMES = ["Str", "Dex", "Con", "Int", "Wis", "Cha"] as const;
const ABILITY_KEY: Record<(typeof ABILITY_NAMES)[number], keyof ParsedMonster["abilities"]> = {
  Str: "str",
  Dex: "dex",
  Con: "con",
  Int: "int",
  Wis: "wis",
  Cha: "cha",
};

function parseAbilities(preamble: string): ParsedMonster["abilities"] | null {
  const abilities: Partial<ParsedMonster["abilities"]> = {};
  for (const name of ABILITY_NAMES) {
    // Espace optionnel avant le nombre : coquille d'extraction PDF
    // rencontree sur le Dragon blanc adulte ("Con22" au lieu de "Con 22").
    const m = new RegExp(`\\b${name}\\s*(-?\\d+)\\b`).exec(preamble);
    if (!m) return null;
    abilities[ABILITY_KEY[name]] = Number(m[1]);
  }
  return abilities as ParsedMonster["abilities"];
}

function parseSpeed(preamble: string): Record<string, string> | null {
  const m = /\bSpeed ([^\n]+?)(?=\s*(?:MOD SAVE|Initiative|$))/.exec(preamble);
  if (!m) return null;
  const raw = m[1].trim();
  const speed: Record<string, string> = {};
  const parts = raw.split(",").map((p) => p.trim());
  for (const part of parts) {
    const named = /^(Burrow|Climb|Fly|Swim) (.+)$/.exec(part);
    if (named) speed[named[1].toLowerCase()] = named[2];
    else if (part.length > 0) speed.walk = part;
  }
  return Object.keys(speed).length > 0 ? speed : null;
}

// Ex. "Skills History +12, Perception +10 Senses Darkvision 120 ft.;
// Passive Perception 20 Languages Deep Speech; telepathy 120 ft. CR 10 (XP
// 5,900, or 7,200 in lair; PB +4)" — un seul bloc de texte, plusieurs
// rubriques introduites par un mot-cle en tete de phrase, jamais de
// separateur fiable entre elles (une virgule separe aussi bien deux
// competences qu'une competence de la rubrique suivante).
function parseTailFields(preamble: string) {
  // Deux ordres coexistent : "CR 10 (XP 5,900...)" pour la plupart des
  // monstres, "CR 3 (700 XP; PB +2)" observe sur les dragons juvéniles
  // (wyrmling) — jamais suppose, les deux motifs sont acceptes.
  const crMatch = /\bCR ([\d/]+) \((?:XP ([\d,]+)|([\d,]+) XP)(?:,[^;)]*)?;? ?PB \+(\d+)\)/.exec(preamble);
  if (!crMatch) return null;
  const crRaw = crMatch[1];
  const challenge_rating = crRaw.includes("/") ? Number(crRaw.split("/")[0]) / Number(crRaw.split("/")[1]) : Number(crRaw);
  const xp = Number((crMatch[2] ?? crMatch[3]).replace(/,/g, ""));
  const proficiency_bonus = Number(crMatch[4]);

  const languagesMatch = /\bLanguages (.+?)(?=\s*CR [\d/]+ \()/.exec(preamble);
  const languages = languagesMatch ? languagesMatch[1].trim().replace(/[.]$/, "") : "";

  const sensesMatch = /\bSenses (.+?)(?=\s*Languages )/.exec(preamble);
  const senses: Record<string, string> = {};
  if (sensesMatch) {
    for (const part of sensesMatch[1].split(";").map((s) => s.trim())) {
      const pp = /^Passive Perception (\d+)$/.exec(part);
      if (pp) {
        senses.passive_perception = pp[1];
        continue;
      }
      const named = /^(Blindsight|Darkvision|Telepathy|Tremorsense|Truesight) (.+)$/.exec(part);
      if (named) senses[named[1].toLowerCase()] = named[2];
    }
  }

  const skillsMatch = /\bSkills (.+?)(?=\s*(?:Resistances|Vulnerabilities|Immunities|Senses ))/.exec(preamble);
  const skills: { name: string; bonus: number }[] = [];
  if (skillsMatch) {
    for (const part of skillsMatch[1].split(",").map((s) => s.trim())) {
      const sm = /^([A-Za-z ]+?) \+(\d+)$/.exec(part);
      if (sm) skills.push({ name: sm[1].trim(), bonus: Number(sm[2]) });
    }
  }

  return { challenge_rating, xp, proficiency_bonus, languages, senses, skills };
}

// En-tete de trait/action : identique au motif deja etabli et verifie cote
// francais (extract-monster-blocks-fr.ts) — majuscule initiale, phrase
// courte close par un point suivi d'une espace, avant la description.
const HEADER_RE = /^([A-Z][^.!?:]{1,89}?)\.\s+(.*)$/;

// Un vrai nom de trait/action est un groupe nominal court, jamais une
// phrase complete (sujet + verbe) coupee par la mise en page au milieu
// d'un paragraphe — meme motif deja durci cote francais
// (SENTENCE_FRAGMENT_RE), jamais applique ici avant que Cloaker/Stirge/
// Giant Frog/Night Hag ne revelent le trou (V1-D3b, deuxieme passe) :
// "The cloaker can detach itself by spending 5 feet of movement." matchait
// a tort HEADER_RE, gonflant le compte d'actions attendu de 1 en trop.
const SENTENCE_FRAGMENT_RE = /^(The|A|An|If|When|While|This|It|They|She|He|You|Once|After|As|In|On|At|Each|Any|Some|Many|Most|All|Other)\b/;

function extractZoneEntries(lines: string[]): ZoneEntry[] {
  const headers: { index: number; name: string; rest: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = HEADER_RE.exec(lines[i].trim());
    if (m && !SENTENCE_FRAGMENT_RE.test(m[1].trim())) headers.push({ index: i, name: m[1].trim(), rest: m[2].trim() });
  }
  const entries: ZoneEntry[] = [];
  for (let h = 0; h < headers.length; h++) {
    const cur = headers[h];
    const next = headers[h + 1];
    const bodyStart = cur.index + 1;
    const bodyEnd = next ? next.index : lines.length;
    const bodyLines = lines
      .slice(bodyStart, bodyEnd)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !isFooterNoise(l));
    const description = [cur.rest, ...bodyLines].filter((s) => s.length > 0).join(" ");
    if (description.length === 0) continue;
    entries.push({ name: cur.name, description });
  }
  return entries;
}

function parseActionDamage(description: string): { attack_bonus?: number; damage?: { dice: string; type?: string }[] } {
  const attackMatch = /Attack Roll: \+(\d+)/.exec(description);
  const attack_bonus = attackMatch ? Number(attackMatch[1]) : undefined;
  const damage: { dice: string; type?: string }[] = [];
  const dmgRe = /\((\d+d\d+(?: ?[+-] ?\d+)?)\) (\w+) damage/g;
  let m: RegExpExecArray | null;
  while ((m = dmgRe.exec(description))) {
    damage.push({ dice: m[1].replace(/\s+/g, ""), type: m[2] });
  }
  return { attack_bonus, damage: damage.length > 0 ? damage : undefined };
}

function parseMonster(entry_key: string, name: string, zoneLines: string[]): { monster?: ParsedMonster; error?: string } {
  const typeLineIdx = zoneLines.findIndex((l) => TYPE_LINE_RE.test(l.trim()));
  if (typeLineIdx === -1) return { error: "ligne de type introuvable (taille/type/alignement)" };
  const typeLine = zoneLines[typeLineIdx].trim();
  const typeMatch = TYPE_LINE_RE.exec(typeLine)!;
  const size = typeMatch[1];
  const rest = typeLine.slice(size.length).trim();
  const [typeAndMaybeSwarm, alignment] = rest.split(/,\s*/, 2);
  const type = typeAndMaybeSwarm.replace(/s$/, "").trim();

  const traitsIdx = zoneLines.findIndex((l) => l.trim() === "Traits");
  const actionsIdx = zoneLines.findIndex((l) => l.trim() === "Actions");
  const preambleEnd = traitsIdx !== -1 ? traitsIdx : actionsIdx !== -1 ? actionsIdx : zoneLines.length;
  const preamble = zoneLines
    .slice(typeLineIdx + 1, preambleEnd)
    .filter((l) => !isFooterNoise(l.trim()))
    .join(" ");

  const acMatch = /\bAC (\d+)\b/.exec(preamble);
  const hpMatch = /\bHP (\d+) \((\d+d\d+)/.exec(preamble);
  if (!acMatch) return { error: "CA introuvable" };
  if (!hpMatch) return { error: "PV introuvables" };

  const abilities = parseAbilities(preamble);
  if (!abilities) return { error: "caracteristiques incompletes" };

  const speed = parseSpeed(preamble);
  if (!speed) return { error: "vitesse introuvable" };

  const tail = parseTailFields(preamble);
  if (!tail) return { error: "FP/PX/PB introuvables" };

  let traitsZone: string[] = [];
  let actionsZone: string[] = [];
  if (traitsIdx !== -1) {
    const end = actionsIdx !== -1 ? actionsIdx : zoneLines.length;
    traitsZone = zoneLines.slice(traitsIdx + 1, end);
  }
  if (actionsIdx !== -1) {
    // Le bloc `actions` du schema (comme pour la SRD 2014 deja importee,
    // cf. ingest-srd.ts actionsBlock) ne couvre que la section "Actions" —
    // jamais Bonus Actions/Reactions/Legendary Actions, qui suivent sans
    // separateur fiable sinon (verifie sur le Tarrasque).
    const rest = zoneLines.slice(actionsIdx + 1);
    const stopIdx = rest.findIndex((l) => /^(Bonus Actions|Reactions|Legendary Actions|Lair Actions)$/.test(l.trim()));
    actionsZone = stopIdx === -1 ? rest : rest.slice(0, stopIdx);
  }

  // Garde-fou contre la fuite d'un monstre voisin NON localise (donc jamais
  // une borne de zone) qui s'intercalerait avant le prochain monstre
  // localise : sa propre ligne de type ("Taille Type, Alignement") le
  // trahit meme sans connaitre son nom. Verifie sur le Tarrasque, dont les
  // Legendary Actions laissaient filer la zone jusque dans "Tough" (non
  // localise) puis au-dela.
  const traitsLeakIdx = traitsZone.findIndex((l) => TYPE_LINE_RE.test(l.trim()));
  if (traitsLeakIdx !== -1) traitsZone = traitsZone.slice(0, traitsLeakIdx);
  const actionsLeakIdx = actionsZone.findIndex((l) => TYPE_LINE_RE.test(l.trim()));
  if (actionsLeakIdx !== -1) actionsZone = actionsZone.slice(0, actionsLeakIdx);

  const traits = extractZoneEntries(traitsZone);
  const actionsRaw = extractZoneEntries(actionsZone);
  const actions = actionsRaw.map((a) => ({ name: a.name, description: a.description, ...parseActionDamage(a.description) }));

  return {
    monster: {
      entry_key,
      name,
      index: entry_key,
      size,
      type,
      alignment: (alignment ?? "").trim(),
      armor_class: Number(acMatch[1]),
      hit_points: Number(hpMatch[1]),
      hit_dice: hpMatch[2],
      speed,
      abilities,
      skills: tail.skills,
      saving_throws: [],
      senses: tail.senses,
      languages: tail.languages,
      challenge_rating: tail.challenge_rating,
      xp: tail.xp,
      proficiency_bonus: tail.proficiency_bonus,
      traits,
      actions,
    },
  };
}

async function main() {
  // Le fichier source contient des \r isoles (fins de ligne CRLF ou coupures
  // de mise en page PDF) : sans normalisation, un \r survit au milieu d'une
  // ligne logique reconstruite par join(" ") et casse le "." des regex (qui
  // ne matche jamais un terminateur de ligne, \r inclus) — verifie sur le
  // Squelette, dont les langues se retrouvaient vides a cause d'un \r
  // invisible entre "language" et "but can't speak".
  const raw = readFileSync(SOURCE_FILE, "utf-8").replace(/\r/g, "");
  const allLines = raw.split("\n");

  // ONLY_KEY/LIMIT ne filtrent jamais la liste des cibles utilisee pour le
  // bornage de zone : chaque monstre depend de la position de son voisin
  // suivant dans le texte (meme motif qu'extract-monster-blocks-fr.ts), le
  // retirer avant cette etape fausserait la borne de tous les autres. Meme
  // motif pour needsFix=false (deja corriges par une execution precedente,
  // ex. Aboleth) : reste une borne valide, seulement absent du rapport.
  const allMonstersRaw = await fetchAllMonsters();
  // --only force needsFix=true pour la cible visee, meme deja corrigee par
  // une execution precedente : seul moyen de reanalyser une entree pour
  // verifier un correctif du script (ex. re-verifier druid-monster apres
  // le correctif de fuite de nom, sans redemander a la base de "l'oublier").
  const allMonsters = FORCE_ALL
    ? allMonstersRaw.map((m) => ({ ...m, needsFix: true }))
    : ONLY_KEY
      ? allMonstersRaw.map((m) => (m.entry_key === ONLY_KEY ? { ...m, needsFix: true } : m))
      : allMonstersRaw;
  const targets = allMonsters.filter((m) => m.needsFix);
  console.log(`${targets.length} monstres cibles (donnee 2014 sous ruleset 5.2.1), ${allMonsters.length} au total pour le bornage.`);

  // Localise l'en-tete confirme de chaque monstre : nom isole en debut de
  // ligne, suivi de pres (fenetre de 5 lignes, motif du double en-tete
  // "Nom\n\nNom\nTaille Type, Alignement" observe sur Aboleth) par une
  // vraie ligne de type. Ecarte les mentions du nom en milieu de prose
  // (ex. "the Rat, Riding Horse ... Wolf are recommended").
  const nameLineIndices = new Map<string, number[]>();
  for (let i = 0; i < allLines.length; i++) {
    const t = allLines[i].trim();
    if (t.length === 0) continue;
    if (!nameLineIndices.has(t)) nameLineIndices.set(t, []);
    nameLineIndices.get(t)!.push(i);
  }

  const located: { entry_key: string; name: string; headerLine: number; needsFix: boolean }[] = [];
  const notLocated: string[] = [];
  for (const target of allMonsters) {
    const candidates = nameLineIndices.get(target.englishName) ?? [];
    const confirmedRaw = candidates.filter((idx) => {
      for (let j = idx + 1; j <= Math.min(idx + 5, allLines.length - 1); j++) {
        if (TYPE_LINE_RE.test(allLines[j].trim())) return true;
      }
      return false;
    });
    // Motif du double en-tete observe sur Aboleth/Commoner : le nom du
    // monstre apparait deux fois cote a cote ("Nom" en-tete de page courant,
    // ligne vide, "Nom" titre du bloc de caracteristiques suivi de la ligne
    // de type) — deux candidats confirmes distincts pour un seul et meme
    // monstre, jamais deux monstres reels. Fusionne les candidats separes
    // de 3 lignes au plus, ne garde que le dernier (le plus proche de la
    // ligne de type, donc le vrai debut du bloc).
    const confirmed: number[] = [];
    for (const idx of confirmedRaw) {
      if (confirmed.length > 0 && idx - confirmed[confirmed.length - 1] <= 3) confirmed[confirmed.length - 1] = idx;
      else confirmed.push(idx);
    }
    if (confirmed.length === 1) located.push({ entry_key: target.entry_key, name: target.englishName, headerLine: confirmed[0], needsFix: target.needsFix });
    else if (target.needsFix) {
      if (confirmed.length === 0) notLocated.push(`${target.entry_key} (${target.englishName}) : aucune occurrence confirmee sur ${candidates.length} candidate(s)`);
      else notLocated.push(`${target.entry_key} (${target.englishName}) : ${confirmed.length} occurrences confirmees, ambigu`);
    }
  }
  located.sort((a, b) => a.headerLine - b.headerLine);
  console.log(`${located.filter((l) => l.needsFix).length}/${targets.length} cibles localisees sans ambiguite (${located.length} au total, bornes incluses).`);
  if (notLocated.length > 0) {
    console.log(`\nNon localises (${notLocated.length}${notLocated.length > 40 ? ", liste tronquee" : ""}) :`);
    for (const n of notLocated.slice(0, 40)) console.log(`  - ${n}`);
  }

  const parsed: ParsedMonster[] = [];
  const failures: string[] = [];
  let processed = 0;
  for (let i = 0; i < located.length; i++) {
    const cur = located[i];
    // Les entrees needsFix=false ne servent qu'a borner leurs voisines
    // (deja corrigees par une execution precedente) — jamais reparses.
    if (!cur.needsFix) continue;
    if (LIMIT && !ONLY_KEY && processed >= LIMIT) break;
    processed++;
    let nextLine = i + 1 < located.length ? located[i + 1].headerLine : allLines.length;
    // Motif du double en-tete (voir plus haut, Aboleth/Commoner) : le
    // monstre SUIVANT pre-annonce son nom seul sur une ligne quelques
    // lignes avant sa vraie ligne de type, retenue comme headerLine. Sans
    // ce recul, cette pre-annonce (ex. "Dryad" avant l'entree du Dryade)
    // se fait avaler comme derniere phrase de la description courante —
    // touche 70/280 monstres, verifie sur druid-monster (finissait par
    // "... Moonbeam Dryad"). Recule juste avant la derniere occurrence du
    // nom du monstre suivant trouvee dans les 4 lignes precedentes.
    if (i + 1 < located.length) {
      const nextName = located[i + 1].name;
      for (let j = nextLine - 1; j >= Math.max(cur.headerLine, nextLine - 4); j--) {
        if (allLines[j].trim() === nextName) {
          nextLine = j;
          break;
        }
      }
    }
    const zoneLines = allLines.slice(cur.headerLine, nextLine).filter((l) => !isFooterNoise(l.trim()));
    const result = parseMonster(cur.entry_key, cur.name, zoneLines);
    if (result.error) failures.push(`${cur.entry_key} (${cur.name}) : ${result.error}`);
    else if (result.monster) parsed.push(result.monster);
  }

  console.log(`\n${parsed.length}/${processed} monstres localises analyses avec succes.`);
  console.log(`${failures.length} echecs d'analyse :`);
  for (const f of failures.slice(0, 60)) console.log(`  - ${f}`);
  if (failures.length > 60) console.log(`  ... et ${failures.length - 60} de plus.`);

  const zeroTraitsActions = parsed.filter((m) => m.traits.length === 0 && m.actions.length === 0);
  if (zeroTraitsActions.length > 0) {
    console.log(`\n⚠ ${zeroTraitsActions.length} monstre(s) sans aucun trait ni action (a verifier a la main) :`);
    for (const m of zeroTraitsActions.slice(0, 30)) console.log(`  - ${m.entry_key}`);
  }

  if (ONLY_KEY) {
    const target = parsed.find((m) => m.entry_key === ONLY_KEY);
    if (target) console.log("\n" + JSON.stringify(target, null, 2));
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`\nEcrit ${parsed.length} monstres dans ${OUTPUT_FILE} (relecture manuelle avant toute integration).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
