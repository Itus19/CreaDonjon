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
  /** Nombre de lignes physiques que l'en-tete occupe dans le texte source (titre coupe par la mise en page du PDF, ex. "Porter et manier des objets" / "magiques") — 1 par defaut. */
  headerLines?: number;
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
  { entryKey: "saving-throws", nameFr: "Jets de sauvegarde", headerLine: 7658, nextHeaderLine: 7695 },
  // Pas un fragment orphelin : "Le passage du temps" est le vrai en-tete
  // francais de l'entree `time` ("Time") — jamais trouve par une recherche
  // sur "Temps" seul (qui ne matche que des composes comme "Temps
  // d'incantation"), repere en relisant la fin de Jets de sauvegarde avant
  // d'ecrire en base.
  { entryKey: "time", nameFr: "Le passage du temps", headerLine: 7695, nextHeaderLine: 7721 },
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
  // Borne haute a 9390, PAS 9400 (debut de "Qu'est-ce qu'un sort ?") : le
  // meme motif que Poisons/Harmonisation plus bas — un paragraphe
  // d'introduction sans en-tete propre ("Sorts", l'apercu du chapitre
  // incantation, 9390-9399) s'intercale et n'appartient pas au combat
  // subaquatique. Laisse hors des deux fiches plutot que mal attribue.
  { entryKey: "underwater-combat", nameFr: "Combat subaquatique", headerLine: 9363, nextHeaderLine: 9390 },
  { entryKey: "what-is-a-spell", nameFr: "Qu’est-ce qu’un sort ?", headerLine: 9400, nextHeaderLine: 9532 },
  // Borne haute = debut verifie de l'annexe "Listes de sorts" (par classe,
  // ligne 9873) : PAS le meme motif que l'entete initial cru correct au
  // premier passage (10754, debut du chapitre "Description des sorts") —
  // un premier essai avait inclus par erreur toute l'annexe des listes de
  // sorts dans la prose de la regle (repere en relisant la fin du texte
  // extrait avant d'ecrire en base, cf. docs/BACKLOG_V1.md V1-D3b).
  { entryKey: "casting-a-spell", nameFr: "Lancer un sort", headerLine: 9532, nextHeaderLine: 9873 },
];

// Second groupe contigu (V1-D3b, session suivante) : Pieges -> Poisons ->
// Harmonisation -> Porter et manier des objets magiques. Borne basse
// (19609) deja verifiee independamment par translate-spell-descriptions-fr.ts
// (CHAPTER_END, "juste avant Pieges"). Borne haute (20762) verifiee par
// lecture directe : "Les objets magiques de A à Z" marque le debut du
// catalogue d'objets, pas une regle suivie en base.
const SPANS_2: RuleSpan[] = [
  { entryKey: "traps", nameFr: "Pièges", headerLine: 19609, nextHeaderLine: 20041 },
  { entryKey: "diseases", nameFr: "Maladies", headerLine: 20041, nextHeaderLine: 20175 },
  { entryKey: "madness", nameFr: "Folie", headerLine: 20175, nextHeaderLine: 20336 },
  { entryKey: "objects", nameFr: "Objets", headerLine: 20336, nextHeaderLine: 20432 },
  // "Poisons" apparait deux fois : 20432 le vrai chapitre, 20468 le titre
  // d'une table de prix a l'interieur du meme chapitre (absorbee). Borne
  // haute a 20588, PAS 20595 (debut de Harmonisation) : un paragraphe
  // d'introduction sans en-tete propre ("Objets magiques", 20588-20594)
  // s'intercale entre les deux — repere en relisant la fin du texte
  // extrait, il ne parle pas de poisons et n'appartient pas non plus a
  // Harmonisation (c'est une transition de chapitre, pas une sous-section
  // de l'une ou l'autre regle) : laisse hors des deux plutot que mal
  // attribue.
  { entryKey: "poisons", nameFr: "Poisons", headerLine: 20432, nextHeaderLine: 20588 },
  { entryKey: "attunement", nameFr: "Harmonisation", headerLine: 20595, nextHeaderLine: 20648 },
  // Titre coupe sur deux lignes par la mise en page du PDF ("Porter et
  // manier des objets" / "magiques") — headerLines:2 pour ne pas inclure
  // "magiques" en tete du corps du texte.
  { entryKey: "wearing-and-wielding-items", nameFr: "Porter et manier des objets", headerLine: 20648, nextHeaderLine: 20762, headerLines: 2 },
];

// Troisieme groupe (V1-D3b, suite a une demande explicite sur la monnaie) :
// deux fiches isolees repondant directement a la question posee en
// conversation (equivalence des monnaies, "si il y a dans les srd") — le
// SRD porte bien un `standard-exchange-rates` distinct de `equipment`, verifie
// entree par entree dans le JSON (`Rule-Sections`) avant de chercher son
// texte. Plus deux fiches supplementaires trouvees en cherchant la borne de
// fin d'`equipment` : `sentient-magic-items` et `fantasy-historical-pantheons`
// (celle-ci deja nommee, jamais sa prose), et `the-planes-of-existence`.
const SPANS_3: RuleSpan[] = [
  // "Équipement" (deja nommee, 100%) : uniquement l'introduction sur les
  // pieces de monnaie (ce qu'elles valent, a quoi elles servent) — pas le
  // reste du chapitre (armures/armes/objets d'aventurier en tables), qui
  // relance immediatement apres "Armures" (5437) et fait double emploi avec
  // les blocs `weapon`/`armor`/`item_properties` (V1-D1/D2) et les noms deja
  // traduits (V1-A5) : capturer les tables ici serait une redite, pas une
  // nouvelle information.
  { entryKey: "equipment", nameFr: "Équipement", headerLine: 5350, nextHeaderLine: 5391 },
  // La demande de depart, exactement : le tableau de conversion PC/PA/PE/PO/PP
  // (verifie dans le JSON source, `Rule-Sections standard-exchange-rates`,
  // jamais trouve cote 2014 par une recherche sur "Pièces de monnaie" —
  // c'est le titre 2024, le 2014 dit "Taux de conversion"). "Revente du
  // trésor" (5398) absorbee ici plutot que dans `equipment` : meme famille
  // de sujet (l'argent, le troc), et ca evite de fragmenter `equipment` en
  // deux plages non contigues pour un paragraphe sans en-tete propre.
  { entryKey: "standard-exchange-rates", nameFr: "Taux de conversion", headerLine: 5391, nextHeaderLine: 5437 },
  // Titre coupe sur deux lignes ("Les objets magiques" / "intelligents").
  // Borne haute verifiee par lecture directe : "Les artefacts" (25925)
  // marque la reprise du catalogue d'objets nommes, pas une sous-section.
  { entryKey: "sentient-magic-items", nameFr: "Les objets magiques", headerLine: 25764, nextHeaderLine: 25925, headerLines: 2 },
  // Deja nommee (V1-D3b point 1) mais sans prose. Titre coupe sur trois
  // lignes ("Panthéons" / "historiques et" / "mythologiques"), precede
  // d'un prefixe d'annexe ("Annexe MdJ-B : ") volontairement exclu de la
  // verification d'en-tete (pas du contenu, juste une numerotation).
  { entryKey: "fantasy-historical-pantheons", nameFr: "Panthéons", headerLine: 36048, nextHeaderLine: 36240, headerLines: 3 },
  // Meme motif de prefixe d'annexe ("Annexe MdJ-C : "). Borne haute verifiee
  // par lecture directe : "Annexe MdM-A : Créatures diverses" (36479) est
  // deja le debut du Guide des monstres, pas une regle suivie en base.
  { entryKey: "the-planes-of-existence", nameFr: "Les plans d’existence", headerLine: 36242, nextHeaderLine: 36479 },
];

function extractBody(lines: string[], headerLine: number, nextHeaderLine: number, headerLines = 1): string {
  return lines
    .slice(headerLine + headerLines - 1, nextHeaderLine - 1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isFooterNoise(l))
    .join(" ");
}

const ALL_SPANS: RuleSpan[] = [...SPANS, ...SPANS_2, ...SPANS_3];

async function main() {
  const raw = readFileSync(SOURCE_FILE, "utf-8");
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
    const headerText = lines[span.headerLine - 1]?.trim();
    if (headerText !== span.nameFr) {
      throw new Error(`${span.entryKey} : en-tete attendu "${span.nameFr}" a la ligne ${span.headerLine}, trouve "${headerText}"`);
    }
    const description = extractBody(lines, span.headerLine, span.nextHeaderLine, span.headerLines ?? 1);
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
  console.log(`\nTermine : ${rows.length} descriptions de regle ecrites (SRD 5.1, ${ALL_SPANS.length} fiches).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
