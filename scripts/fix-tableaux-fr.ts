// Tableaux aplatis (suite de V3.1-180) : dans les traductions françaises du
// SRD 5.2.1, un tableau du PDF est devenu une seule phrase (« 1d10 Type de
// dégâts 1d10 Type de dégâts 1 Acide 6 Nécrotiques … »), et la dernière
// rangée manque souvent. Chaque tableau est relu dans la source française
// (data/srd/fr-source/srd-5.2.1-fr.txt, CC-BY-4.0, attribution dans NOTICE.md),
// où une rangée tient sur sa ligne, puis réécrit en lignes « a | b » que le
// rendu des textes de règle affiche en tableau. Les listes à puces écrites
// sur une ligne (« • a • b ») reprennent une ligne par puce.
//
// Ce fichier ne contient aucun texte de règle : seulement, pour chaque
// tableau, ses repères dans la source (titre, en-tête, ligne qui le suit) et
// la façon de découper une rangée (`src/core/text/tableauxPdf.ts`, testé).
// Un tableau qui ne se lit pas exactement est refusé, jamais deviné.
//
// À blanc par défaut (chaque tableau reconstruit est affiché) ; `--write` écrit.
// Lancement : npx tsx --env-file=.env.local scripts/fix-tableaux-fr.ts [--write]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { blocEnTexte, lireBloc, puceParLigne, type SpecBloc } from "../src/core/text/tableauxPdf";

const SOURCE = "data/srd/fr-source/srd-5.2.1-fr.txt";
const RULESET_ID = "110d20e9-dd80-4752-a57e-a957601b4eae"; // SRD 5.2.1

const PLAGE = /^\d\d–\d\d /;
const NOMBRE = /^\d+ /;
const TOUTE = /./;
const deuxPar = (plage: string) => new RegExp(`^(${plage}) (.+?) (${plage}) (.+)$`);

interface Correction {
  cles: string[];
  /** Le titre de l'entrée dans la source : la recherche commence là. */
  ancre: string;
  blocs: SpecBloc[];
}

const sortsDeSousClasse = (ancre: string, titre: string, entete: string[], colonne: string, jusqua: string, rangees: number): Correction["blocs"][number] => ({
  type: "tableau", titre, entete, colonnes: [colonne, entete[entete.length - 1].split(" ").slice(1).join(" ")], jusqua, debutRangee: NOMBRE, decoupe: /^(\d+) (.+)$/, rangees,
});

const CORRECTIONS: Correction[] = [
  { cles: ["armor-of-resistance"], ancre: "Armure de résistance", blocs: [{ type: "tableau", entete: ["1d10 Type de dégâts 1d10 Type de dégâts"], colonnes: ["1d10", "Type de dégâts"], jusqua: "Armure de vulnérabilité", debutRangee: NOMBRE, decoupe: deuxPar("\\d+"), parLigne: 2, rangees: 10 }] },
  { cles: ["potion-of-resistance"], ancre: "Potion de résistance", blocs: [{ type: "tableau", entete: ["1d10 Type de dégâts 1d10 Type de dégâts"], colonnes: ["1d10", "Type de dégâts"], jusqua: "Potion de respiration aquatique", debutRangee: NOMBRE, decoupe: deuxPar("\\d+"), parLigne: 2, rangees: 10 }] },
  { cles: ["ring-of-resistance"], ancre: "Anneau de résistance", blocs: [{ type: "tableau", entete: ["1d10 Type de dégâts Gemme"], colonnes: ["1d10", "Type de dégâts", "Gemme"], jusqua: "Anneau de saut", debutRangee: NOMBRE, decoupe: /^(\d+) (\S+) (.+)$/, rangees: 10 }] },
  { cles: ["horn-of-valhalla", "horn-of-valhalla-1", "horn-of-valhalla-2", "horn-of-valhalla-3", "horn-of-valhalla-4"], ancre: "Cor du Valhalla", blocs: [{ type: "tableau", entete: ["1d100 Type de cor Esprits Prérequis"], colonnes: ["1d100", "Type de cor", "Esprits", "Prérequis"], jusqua: "Corde d’ascension", debutRangee: PLAGE, decoupe: /^(\d\d–\d\d) (\S+) (\d+) (.+)$/, rangees: 4 }] },
  { cles: ["life-domain-spells"], ancre: "Niveau 3 : Sorts du Domaine de la Vie", blocs: [sortsDeSousClasse("", "Sorts du Domaine de la Vie", ["Niveau de", "Clerc Sorts préparés"], "Niveau de Clerc", "Niveau 3 : Survivance", 4)] },
  { cles: ["devotion-oath-of-devotion-spells"], ancre: "Niveau 3 : Sorts du Serment de Dévotion", blocs: [sortsDeSousClasse("", "Sorts du Serment de Dévotion", ["Niveau de", "Paladin Sorts"], "Niveau de Paladin", "Niveau 3 : Arme sacrée", 5)] },
  { cles: ["draconic-sorcery-draconic-spells"], ancre: "Niveau 3 : Sorts draconiques", blocs: [sortsDeSousClasse("", "Sorts draconiques", ["Niveau", "d’Ensorceleur Sorts"], "Niveau d’Ensorceleur", "Niveau 6 : Affinité élémentaire", 4)] },
  { cles: ["fiend-patron-fiend-spells"], ancre: "Niveau 3 : Sorts du Fiélon", blocs: [sortsDeSousClasse("", "Sorts du Fiélon", ["Niveau", "d’Occultiste Sorts"], "Niveau d’Occultiste", "Niveau 6 : Chance du ténébreux", 4)] },
  {
    cles: ["land-circle-of-the-land-spells"],
    ancre: "Niveau 3 : Sorts du Cercle de la Terre",
    blocs: [
      sortsDeSousClasse("", "Terres arides", ["Niveau de", "Druide Sorts de cercle"], "Niveau de Druide", "Terres polaires", 4),
      sortsDeSousClasse("", "Terres polaires", ["Niveau de", "Druide Sorts de cercle"], "Niveau de Druide", "Terres tempérées", 4),
      sortsDeSousClasse("", "Terres tempérées", ["Niveau de", "Druide Sorts de cercle"], "Niveau de Druide", "Terres tropicales", 4),
      sortsDeSousClasse("", "Terres tropicales", ["Niveau de", "Druide Sorts de cercle"], "Niveau de Druide", "Niveau 3 : Aval de la terre", 4),
    ],
  },
  { cles: ["land-natures-ward", "natures-ward"], ancre: "Niveau 10 : Protégé de dame Nature", blocs: [{ type: "tableau", titre: "Protégé de dame Nature", entete: ["Environnement Résistance"], colonnes: ["Environnement", "Résistance"], jusqua: "Niveau 14 : Sanctuaire de dame Nature", debutRangee: TOUTE, decoupe: /^(\S+) (\S+)$/, rangees: 4 }] },
  {
    cles: ["font-of-magic", "sorcerer-font-of-magic"],
    ancre: "Création d’emplacements de sort",
    blocs: [{ type: "tableau", entete: ["Niveau", "d’emplacement", "de sort", "Coût en points", "de Sorcellerie", "Niveau", "d’Ensorceleur", "minimum"], colonnes: ["Niveau d’emplacement de sort", "Coût en points de Sorcellerie", "Niveau d’Ensorceleur minimum"], jusqua: "Niveau 2 : Métamagie", debutRangee: NOMBRE, decoupe: /^(\d) (\d+) (\d+)$/, rangees: 5 }],
  },
  { cles: ["ammunition-of-slaying", "arrow-of-slaying"], ancre: "Projectile tueur", blocs: [{ type: "tableau", entete: ["1d100", "Type de", "créature 1d100", "Type de", "créature"], colonnes: ["1d100", "Type de créature"], jusqua: "Puits des mondes", debutRangee: PLAGE, decoupe: deuxPar("\\d\\d–\\d\\d"), parLigne: 2, rangees: 14 }] },
  { cles: ["amulet-of-the-planes"], ancre: "Amulette des plans", blocs: [{ type: "tableau", entete: ["1d100 Destination"], colonnes: ["1d100", "Destination"], jusqua: "Anneau d’action libre", debutRangee: PLAGE, decoupe: /^(\d\d–\d\d) (.+)$/, rangees: 5 }] },
  {
    cles: ["bag-of-tricks"],
    ancre: "Sac à malices",
    blocs: (
      [
        ["Sac à malices gris", "Sac à malices rouille"],
        ["Sac à malices rouille", "Sac à malices brun"],
        ["Sac à malices brun", "Sac de haricots magiques"],
      ] as const
    ).map(([titre, jusqua]): SpecBloc => ({ type: "tableau", titre, entete: ["1d8 Créature 1d8 Créature"], colonnes: ["1d8", "Créature"], jusqua, debutRangee: NOMBRE, decoupe: deuxPar("\\d"), parLigne: 2, rangees: 8 })),
  },
  { cles: ["candle-of-invocation"], ancre: "Cierge d’invocation", blocs: [{ type: "tableau", entete: ["1d100 Plan Extérieur 1d100 Plan Extérieur"], colonnes: ["1d100", "Plan Extérieur"], jusqua: "Cimeterre de célérité", debutRangee: PLAGE, decoupe: deuxPar("\\d\\d–\\d\\d"), parLigne: 2, rangees: 16 }] },
  { cles: ["carpet-of-flying"], ancre: "Tapis volant", blocs: [{ type: "tableau", entete: ["1d100 Taille Capacité Vitesse de vol"], colonnes: ["1d100", "Taille", "Capacité", "Vitesse de vol"], jusqua: "Tarot fantasmagorique", debutRangee: PLAGE, decoupe: /^(\d\d–\d\d) (.+?) (\d+ kg) (\d+ m)$/, rangees: 4 }] },
  {
    cles: ["control-weather"],
    ancre: "Contrôle du climat",
    blocs: (
      [
        ["Précipitations", "Température", 5],
        ["Température", "Vent", 6],
        ["Vent", "Convocation de dragon", 5],
      ] as const
    ).map(([titre, jusqua, rangees]): SpecBloc => ({ type: "tableau", titre, entete: ["Stade Conditions"], colonnes: ["Stade", "Conditions"], jusqua, debutRangee: NOMBRE, decoupe: /^(\d) (.+)$/, rangees })),
  },
  { cles: ["cube-of-force"], ancre: "Cube de force", blocs: [{ type: "tableau", titre: "Faces du cube de force", entete: ["Sort Coût en charges"], colonnes: ["Sort", "Coût en charges"], jusqua: "Cube des plans", debutRangee: TOUTE, decoupe: /^(.+) (\d+)$/, rangees: 6 }] },
  { cles: ["dragon-scale-mail"], ancre: "Armure d’écailles de dragon", blocs: [{ type: "tableau", entete: ["Dragon Résistance Dragon Résistance"], colonnes: ["Dragon", "Résistance"], jusqua: "Armure d’invulnérabilité", debutRangee: TOUTE, decoupe: /^(\S+) (\S+) (\S+) (\S+)$/, parLigne: 2, rangees: 10 }] },
  { cles: ["elemental-gem"], ancre: "Gemme élémentaire", blocs: [{ type: "tableau", entete: ["Gemme Élémentaire convoqué"], colonnes: ["Gemme", "Élémentaire convoqué"], jusqua: "Hache du berserker", debutRangee: TOUTE, decoupe: /^(.+?) (Élémentaire .+)$/, rangees: 4 }] },
  { cles: ["feather-token", "feather-token-bird"], ancre: "Plume magique", blocs: [{ type: "tableau", titre: "Plumes magiques", entete: ["1d100 Plume Rareté"], colonnes: ["1d100", "Plume", "Rareté"], jusqua: "Potion d’agrandissement", debutRangee: PLAGE, decoupe: /^(\d\d–\d\d) (.+?) (Peu courante|Rare|Très rare)$/, rangees: 6 }] },
  {
    cles: ["figurine-of-wondrous-power", "figurine-of-wondrous-power-ebony-fly"],
    ancre: "Figurine merveilleuse",
    blocs: [
      { type: "lignes", debut: "Mouche géante", jusqua: "MOD JS MOD JS MOD JS" },
      { type: "tableau", entete: ["MOD JS MOD JS MOD JS"], colonnes: ["Car.", "Valeur", "MOD", "JS"], jusqua: "Sens Vision dans le noir 18 m, Perception passive 10", debutRangee: /^(For|Int) /, decoupe: new RegExp(`^${"(\\S+) (\\d+) ([+−-]\\d+) ([+−-]\\d+)".repeat(3).replace(/\)\(/g, ") (")}$`), parLigne: 3, ordreLignes: true, rangees: 6 },
      { type: "lignes", debut: "Sens Vision dans le noir 18 m, Perception passive 10", jusqua: "Flasque de fer", gras: false },
    ],
  },
  { cles: ["manual-of-golems"], ancre: "Manuel des golems", blocs: [{ type: "tableau", entete: ["1d20 Golem Temps Prix"], colonnes: ["1d20", "Golem", "Temps", "Prix"], jusqua: "Marteau de tonnerre", debutRangee: /^\d/, decoupe: /^(\d+(?:–\d+)?) (.+?) (\d+ jours) (.+ po)$/, rangees: 4 }] },
  { cles: ["potion-of-giant-strength"], ancre: "Potion de force de géant", blocs: [{ type: "tableau", entete: ["Potion Force Rareté"], colonnes: ["Potion", "Force", "Rareté"], jusqua: "Potion de forme gazeuse", debutRangee: /^Potion de force/, decoupe: /^(.+?\)) (\d+) (.+)$/, rangees: 5 }] },
  { cles: ["ring-of-shooting-stars"], ancre: "Anneau de feu d’étoiles", blocs: [{ type: "tableau", entete: ["Nombre de", "sphères", "Dégâts de", "foudre", "Nombre de", "sphères", "Dégâts de", "foudre"], colonnes: ["Nombre de sphères", "Dégâts de foudre"], jusqua: "Anneau de feuille morte", debutRangee: NOMBRE, decoupe: /^(\d) (\S+) (\d) (\S+)$/, parLigne: 2, rangees: 4 }] },
  { cles: ["robe-of-useful-items"], ancre: "Robe du camelot", blocs: [{ type: "tableau", entete: ["1d100 Pièce"], colonnes: ["1d100", "Pièce"], jusqua: "Robe prismatique", debutRangee: PLAGE, decoupe: /^(\d\d–\d\d) (.+)$/, rangees: 13 }] },
];

/** Où le tableau commence dans le texte aplati : son titre, ou la première ligne de son en-tête (espaces souples). */
function debutDansLeTexte(texte: string, spec: SpecBloc): number {
  const premiere = spec.type === "lignes" ? spec.debut : (spec.titre ?? spec.entete[0]);
  const motif = new RegExp(premiere.trim().split(/\s+/).map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "g");
  let dernier = -1;
  for (const m of texte.matchAll(motif)) dernier = m.index ?? -1;
  return dernier;
}

type Blocs = { description?: { segments?: { text?: string }[] } } & Record<string, unknown>;

async function main() {
  const ecrire = process.argv.includes("--write");
  const lignes = readFileSync(SOURCE, "utf-8").split(/\r\n|\n|\r/);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  const supabase = createClient(url, cle, { auth: { persistSession: false } });

  const changements = new Map<string, { avant: string; apres: string }>();
  const erreurs: string[] = [];

  // 1. Les tableaux.
  for (const c of CORRECTIONS) {
    const ancre = lignes.findIndex((l) => l.trim() === c.ancre);
    if (ancre < 0) {
      erreurs.push(`${c.cles[0]} : ancre « ${c.ancre} » introuvable`);
      continue;
    }
    let depuis = ancre;
    const textes: string[] = [];
    let echec = false;
    for (const spec of c.blocs) {
      const r = lireBloc(lignes, depuis, spec);
      if (!r.ok) {
        erreurs.push(`${c.cles[0]} : ${r.erreur}`);
        echec = true;
        break;
      }
      textes.push(blocEnTexte(spec, r.rangees));
      depuis = r.fin;
    }
    if (echec) continue;
    const tableau = textes.join("\n");
    for (const entryKey of c.cles) changements.set(entryKey, { avant: "", apres: tableau });
    console.log(`\n── ${c.cles.join(", ")}\n${tableau}`);
  }

  // 2. Appliquer : couper le texte au début du premier tableau, et y mettre la reconstruction.
  const { data: entrees, error } = await supabase.from("ruleset_entries").select("id, entry_key").eq("ruleset_id", RULESET_ID).order("id");
  if (error) throw new Error(error.message);
  const tous: { id: string; entry_key: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await supabase.from("ruleset_entries").select("id, entry_key").eq("ruleset_id", RULESET_ID).order("id").range(from, from + 999);
    if (e) throw new Error(e.message);
    if (!data || data.length === 0) break;
    tous.push(...data);
  }
  void entrees;
  let ecrites = 0;
  const parCle = new Map(CORRECTIONS.flatMap((c) => c.cles.map((k) => [k, c] as const)));
  for (let i = 0; i < tous.length; i += 200) {
    const lot = tous.slice(i, i + 200);
    const { data: trads, error: e2 } = await supabase.from("ruleset_entry_translations").select("entry_id, blocks").eq("locale", "fr").in("entry_id", lot.map((x) => x.id));
    if (e2) throw new Error(e2.message);
    for (const t of trads ?? []) {
      const entryKey = lot.find((x) => x.id === t.entry_id)!.entry_key;
      const blocs = (t.blocks ?? {}) as Blocs;
      const segs = blocs.description?.segments ?? [];
      if (segs.length === 0) continue;
      const dernier = segs[segs.length - 1];
      const avant = dernier.text ?? "";
      let apres = avant;
      const c = parCle.get(entryKey);
      const voulu = changements.get(entryKey);
      if (c && voulu && !avant.includes(voulu.apres)) {
        const debut = debutDansLeTexte(avant, c.blocs[0]);
        if (debut < 0) {
          erreurs.push(`${entryKey} : début du tableau introuvable dans le texte`);
          continue;
        }
        apres = `${avant.slice(0, debut).trimEnd()}\n${voulu.apres}`;
      }
      // 3. Les puces sur une ligne, partout.
      const avecPuces = segs.map((s, k) => (k === segs.length - 1 ? apres : (s.text ?? ""))).map(puceParLigne);
      if (avecPuces.every((x, k) => x === (segs[k].text ?? ""))) continue;
      const puces = avecPuces.some((x, k) => (k === segs.length - 1 ? x !== apres : x !== segs[k].text));
      console.log(`${entryKey} : ${apres !== avant ? "tableau remis" : ""}${apres !== avant && puces ? " + " : ""}${puces ? "puces" : ""}`);
      ecrites++;
      if (ecrire) {
        const nouveaux: Blocs = { ...blocs, description: { ...blocs.description, segments: segs.map((s, k) => ({ ...s, text: avecPuces[k] })) } };
        const { error: e3 } = await supabase.from("ruleset_entry_translations").update({ blocks: nouveaux }).eq("entry_id", t.entry_id).eq("locale", "fr");
        if (e3) throw new Error(`${entryKey} : ${e3.message}`);
      }
    }
  }
  console.log(`\n${ecrites} fiche(s) ${ecrire ? "corrigée(s)" : "à corriger"}.`);
  if (erreurs.length) {
    console.log(`\n${erreurs.length} refus :`);
    for (const e of erreurs) console.log(`  ${e}`);
  }
  if (!ecrire && ecrites > 0) console.log("À blanc : rien n'est écrit. Relancer avec --write.");
  if (erreurs.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
