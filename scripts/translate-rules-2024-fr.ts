// V1-D3b (point 10, suite) : traduction officielle du bloc `description` des
// fiches de règle pour la SRD 5.2.1 (2024) — jamais fait jusqu'ici (0/39).
// Même principe que translate-rules-fr.ts (SRD 5.1), méthodologie identique :
// chaque borne vérifiée par lecture directe avant d'être inscrite ci-dessous,
// jamais devinée. Contrairement à une première hypothèse (glossaire partout),
// le texte 2024 porte bien un chapitre "Comment jouer" aussi développé qu'en
// 2014 — juste réorganisé et régulièrement traversé de sous-sections sans
// fiche propre en base (absorbées dans la fiche suivie qui les précède,
// même convention que le script 5.1).
//
// Premier lot : le chapitre "Comment jouer" en entier (lignes 548-1973),
// jusqu'au début de "Création de personnage" (chapitre suivant, hors
// périmètre). Les fiches scattered plus loin dans le document (Équipement,
// Objets, Poison, Sorts...) restent à traiter dans un lot suivant.
//
// Lancement : npm run translate:rules-2024

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SOURCE_FILE = "data/srd/fr-source/srd-5.2.1-fr.txt";
const RULESET_ID = "110d20e9-dd80-4752-a57e-a957601b4eae"; // SRD 5.2.1

function isFooterNoise(line: string): boolean {
  return (
    /^=== page \d+ ===$/.test(line) ||
    /^Document de Référence du Système 5\.2\.1(\s+\d+)?$/.test(line) ||
    /^\d+ Document de Référence du Système 5\.2\.1$/.test(line)
  );
}

interface RuleRange {
  /** Ligne (1-indexee) de l'en-tete francais, verifiee dans le texte avant d'ecrire cette entree. */
  headerLine: number;
  headerText: string;
  /** Ligne (1-indexee) de l'en-tete SUIVANT : borne exclusive. */
  nextHeaderLine: number;
  headerLines?: number;
}

interface RuleSpan {
  entryKey: string;
  /** Une ou plusieurs plages (une fiche peut absorber une plage, puis reprendre apres une sous-section qui appartient a une AUTRE fiche suivie, ex. Couvert au milieu d'Effectuer une attaque). */
  ranges: RuleRange[];
}

// Chapitre "Comment jouer" (Playing the Game), lignes 548-1973 : verifie en
// lecture continue avant d'ecrire quoi que ce soit. Nombreuses sous-sections
// sans fiche propre en base (Jets d'attaque, Classe d'armure, Inspiration
// héroïque, Actions, Actions Bonus, Réactions, Interactions sociales,
// Exploration, Dangers, Voyage...) : absorbées dans la fiche suivie qui les
// precede immediatement, jamais dans une fiche sans rapport de sujet.
const SPANS: RuleSpan[] = [
  // "Les six caractéristiques" ouvre le contenu sur les caracteristiques
  // (valeurs, modificateurs, Tests d20) — le nom en base ("Caractéristiques")
  // ne correspond a aucun en-tete exact du texte 2024, la table des
  // matieres anglaise dit "The Six Abilities" : c'est le vrai debut du
  // sujet, verifie par lecture directe, pas un intitule invente.
  { entryKey: "ability-scores-and-modifiers", ranges: [{ headerLine: 579, headerText: "Les six caractéristiques", nextHeaderLine: 676 }] },
  { entryKey: "ability-checks", ranges: [{ headerLine: 676, headerText: "Tests de caractéristique", nextHeaderLine: 730 }] },
  // Absorbe Jets d'attaque/Classe d'armure/Resultat de 20 ou 1/Inspiration
  // héroïque : sous-sections des Tests d20 sans fiche propre, qui suivent
  // immediatement Jets de sauvegarde dans le texte.
  { entryKey: "saving-throws", ranges: [{ headerLine: 730, headerText: "Jets de sauvegarde", nextHeaderLine: 847 }] },
  { entryKey: "advantage-and-disadvantage", ranges: [{ headerLine: 847, headerText: "Avantage et Désavantage", nextHeaderLine: 884 }] },
  // "Maîtrise" est le vrai chapitre ; "Bonus de maîtrise" (nom en base) n'en
  // est qu'une sous-section/table interne — absorbe Maîtrises de
  // compétence/d'équipement, jusqu'a "Actions" (sans fiche propre, debut
  // d'un tout autre sujet, laisse hors de toute fiche).
  { entryKey: "proficiency-bonus", ranges: [{ headerLine: 884, headerText: "Maîtrise", nextHeaderLine: 1007 }] },
  { entryKey: "combat", ranges: [{ headerLine: 1343, headerText: "Combat", nextHeaderLine: 1347 }] },
  { entryKey: "the-order-of-combat", ranges: [{ headerLine: 1347, headerText: "L’ordre du combat", nextHeaderLine: 1445 }] },
  { entryKey: "movement-and-position", ranges: [{ headerLine: 1445, headerText: "Déplacement et position", nextHeaderLine: 1551 }] },
  // Coupe en deux par "Abri" (Couvert), qui a sa propre fiche : reprend
  // juste apres jusqu'a Combat monte.
  {
    entryKey: "making-an-attack",
    ranges: [
      { headerLine: 1551, headerText: "Effectuer une attaque", nextHeaderLine: 1571 },
      { headerLine: 1619, headerText: "Attaques à distance", nextHeaderLine: 1682 },
    ],
  },
  // Nom en base "Couvert", mais le texte 2024 dit "Abri" — verifie par
  // lecture directe (meme concept, terme different de la 5.1). nameFr sert
  // uniquement a verifier CE texte, le nom existant en base n'est jamais ecrase.
  { entryKey: "cover", ranges: [{ headerLine: 1571, headerText: "Abri", nextHeaderLine: 1619 }] },
  // Coupe par "Repos", qui a sa propre fiche (courte, renvoie au glossaire
  // pour le detail) : reprend juste apres jusqu'a Combat subaquatique.
  {
    entryKey: "mounted-combat",
    ranges: [
      { headerLine: 1682, headerText: "Combat monté", nextHeaderLine: 1711 },
      { headerLine: 1719, headerText: "Chuter de monture", nextHeaderLine: 1726 },
    ],
  },
  { entryKey: "resting", ranges: [{ headerLine: 1711, headerText: "Repos", nextHeaderLine: 1719 }] },
  { entryKey: "underwater-combat", ranges: [{ headerLine: 1726, headerText: "Combat subaquatique", nextHeaderLine: 1740 }] },
  // Borne haute verifiee par lecture directe : "Création de personnage"
  // (1975, coupe sur deux lignes par la mise en page) ouvre le chapitre
  // suivant, hors perimetre de cette fiche.
  { entryKey: "damage-and-healing", ranges: [{ headerLine: 1740, headerText: "Dégâts et soins", nextHeaderLine: 1973 }] },
];

// Second lot (V1-D3b point 10, suite) : fiches eparpillees plus loin dans le
// document (chapitres Équipement/Objets magiques/Sorts, puis Boîte à outils
// ludique), chacune localisee et bornee independamment plutot que par
// lecture continue (bien plus loin les unes des autres que le premier lot).
const SPANS_2: RuleSpan[] = [
  // "Pièces de monnaie" suit immediatement l'en-tete "Équipement" (8744),
  // lui-meme sans corps propre (juste avant, "Vente d'équipement" 8738-8743
  // appartient a la phrase qui precede le titre, pas a son corps — laisse
  // hors de toute fiche plutot que mal attribue). Borne haute verifiee :
  // "Armes" (8762) ouvre le tableau d'armes, deja couvert par les blocs
  // `weapon` importes (V1-D1/D2), pas une redite a capturer ici.
  { entryKey: "standard-exchange-rates", ranges: [{ headerLine: 8745, headerText: "Pièces de monnaie", nextHeaderLine: 8762 }] },
  { entryKey: "attunement", ranges: [{ headerLine: 10032, headerText: "Harmonisation", nextHeaderLine: 10073 }] },
  // Nom en base sans "magiques" ("Porter et manier des objets"), texte 2024
  // complet sur une seule ligne (contrairement a la 5.1, coupee en deux).
  // Borne haute : "Fabrication d'objets non magiques" (10100), un tout
  // autre sujet (artisanat) sans fiche propre, laisse hors de cette fiche.
  { entryKey: "wearing-and-wielding-items", ranges: [{ headerLine: 10073, headerText: "Porter et manier des objets magiques", nextHeaderLine: 10100 }] },
  // Pas d'en-tete "Lancer un sort" dans le texte 2024 : "Sorts" (10185,
  // debut du chapitre) couvre exactement l'acquisition/preparation des
  // sorts, contenu equivalent a la fiche `casting-a-spell` en base.
  { entryKey: "casting-a-spell", ranges: [{ headerLine: 10185, headerText: "Sorts", nextHeaderLine: 10217 }] },
  // Chapitre long (niveau du sort, emplacements, ecoles, temps
  // d'incantation, portee, composantes, duree, cibles, JS/jets d'attaque de
  // sort, combiner les effets). Borne haute verifiee par lecture directe :
  // "Description des sorts" (10477) ouvre le catalogue alphabetique des
  // sorts, deja couvert par les fiches `spell` individuelles.
  { entryKey: "spellcasting", ranges: [{ headerLine: 10217, headerText: "Incantation", nextHeaderLine: 10477 }] },
  // Borne haute verifiee : "Exemples de poisons" (20328) ouvre le
  // catalogue alphabetique des poisons nommes, deja importes comme items.
  { entryKey: "poisons", ranges: [{ headerLine: 20277, headerText: "Poison", nextHeaderLine: 20328 }] },
  // Meme motif : "Exemples de pièges" (20473) ouvre un catalogue nomme,
  // pas une regle suivie en base.
  { entryKey: "traps", ranges: [{ headerLine: 20438, headerText: "Pièges", nextHeaderLine: 20473 }] },
  // Borne haute verifiee : "Objets magiques de A à Z" (21416) ouvre le
  // catalogue alphabetique des objets magiques, deja importe comme items.
  { entryKey: "sentient-magic-items", ranges: [{ headerLine: 21275, headerText: "Objets magiques intelligents", nextHeaderLine: 21416 }] },
];

// Troisieme lot (V1-D3b, suite explicite sur "objects" apres l'avoir laisse
// de cote la premiere fois) : trouve dans le "Glossaire de règles" lui-meme,
// pas dans un chapitre narratif — mais un vrai contenu mecanique substantiel
// (CA/PV/seuil de degats des objets, deux tables), pas une simple definition
// d'une phrase comme la plupart des entrees de glossaire deja ecartees.
// Nom en base "Objets", texte reel "Bris des objets" (verifie par lecture
// directe) — meme convention que Couvert/Abri plus haut, nameFr sert
// uniquement a verifier ce texte, jamais a ecraser le nom deja en base.
const SPANS_3: RuleSpan[] = [
  // Absorbe "Classe d'armure"/"Points de vie"/"Types de dégâts et
  // objets"/"Seuil de dégâts"/"Absence de valeurs de caractéristique",
  // tous des sous-puces du meme article de glossaire (motif "Label.
  // contenu", verifie par lecture continue). Borne haute : "Campagne"
  // (18488) ouvre une entree alphabetique suivante sans rapport (le
  // glossaire est trie A -> Z), pas une sous-partie de Bris des objets.
  { entryKey: "objects", ranges: [{ headerLine: 18441, headerText: "Bris des objets", nextHeaderLine: 18488 }] },
];

const ALL_SPANS: RuleSpan[] = [...SPANS, ...SPANS_2, ...SPANS_3];

function extractBody(lines: string[], range: RuleRange): string {
  const headerLines = range.headerLines ?? 1;
  return lines
    .slice(range.headerLine + headerLines - 1, range.nextHeaderLine - 1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isFooterNoise(l))
    .join(" ");
}

async function main() {
  const raw = readFileSync(SOURCE_FILE, "utf-8").replace(/\r/g, "");
  const lines = raw.split("\n");

  const { data: entries, error } = await supabase
    .from("ruleset_entries")
    .select("id, entry_key")
    .eq("ruleset_id", RULESET_ID)
    .eq("entry_type", "rule")
    .in("entry_key", ALL_SPANS.map((s) => s.entryKey));
  if (error) throw new Error(error.message);
  const entryIdByKey = new Map(entries.map((e) => [e.entry_key, e.id]));

  const rows: { entry_id: string; locale: string; name: string; blocks: Record<string, unknown>; source: string }[] = [];

  for (const span of ALL_SPANS) {
    const entryId = entryIdByKey.get(span.entryKey);
    if (!entryId) {
      console.warn(`  entree introuvable pour ${span.entryKey}, ignoree.`);
      continue;
    }

    const parts: string[] = [];
    for (const range of span.ranges) {
      const headerText = lines[range.headerLine - 1]?.trim();
      if (headerText !== range.headerText) {
        throw new Error(`${span.entryKey} : en-tete attendu "${range.headerText}" a la ligne ${range.headerLine}, trouve "${headerText}"`);
      }
      const body = extractBody(lines, range);
      if (body.length === 0) {
        throw new Error(`${span.entryKey} : corps vide entre les lignes ${range.headerLine} et ${range.nextHeaderLine}`);
      }
      parts.push(body);
    }
    const description = parts.join(" ");

    const { data: existing, error: readError } = await supabase
      .from("ruleset_entry_translations")
      .select("name, blocks")
      .eq("entry_id", entryId)
      .eq("locale", "fr")
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing?.name) {
      console.warn(`  ${span.entryKey} : pas de nom francais existant, ignoree (le nom doit deja etre traduit).`);
      continue;
    }

    rows.push({
      entry_id: entryId,
      locale: "fr",
      name: existing.name,
      blocks: {
        ...(existing.blocks as Record<string, unknown> | undefined),
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
  console.log(`\nTermine : ${rows.length} descriptions de regle ecrites (SRD 5.2.1, ${ALL_SPANS.length} fiches dans ce lot).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
