// Traduction du SRD vers le francais a partir du texte officiel (V1-A1b,
// suite a la decision de privilegier le PDF officiel plutot que l'API
// Claude — voir la conversation). Contrairement a translate-srd.ts (traduction
// automatique, source='machine'), ce script n'ECRIT QUE des correspondances
// deja verifiees presentes mot pour mot dans le texte extrait des PDF
// officiels CC-BY-4.0 (data/srd/fr-source/*.txt, generes depuis les PDF
// telecharges aupres de Wizards/D&D Beyond). Source='official_srd'.
//
// Le nom francais de chaque entree est propose a partir de la connaissance
// du jeu (termes stables depuis longtemps en francais), puis verifie
// litteralement dans le texte officiel avant d'etre accepte — jamais ecrit
// sans cette verification. Une entree dont le terme propose n'est pas
// trouve est ignoree et listee en fin d'execution, plutot que d'ecrire une
// traduction non confirmee.
//
// Portee actuelle : classes, especes (dont variantes), historiques et
// conditions, pour les deux rulesets officiels. Les sorts et monstres
// (~700 entrees a eux deux) restent a traiter dans une passe suivante —
// le meme mecanisme (candidats + verification) s'y applique, juste plus
// d'entrees a proposer.
//
// Lancement : npm run translate:srd-official

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local)."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESETS = {
  "5.1": { id: "41ebff94-aabc-4f5c-b437-28f2f7a195ee", textFile: "data/srd/fr-source/srd-5.1-fr.txt" },
  "5.2.1": { id: "110d20e9-dd80-4752-a57e-a957601b4eae", textFile: "data/srd/fr-source/srd-5.2.1-fr.txt" },
} as const;

/**
 * Candidats par ruleset : seuls les entry_type couverts par cette passe
 * (class, species, background, condition). Un nom absent d'un ruleset
 * (ex. une sous-race qui n'existe que dans un des deux) n'a simplement pas
 * d'entree ici.
 */
const CANDIDATES: Record<keyof typeof RULESETS, Record<string, string>> = {
  "5.1": {
    Barbarian: "Barbare",
    Bard: "Barde",
    Cleric: "Clerc",
    Druid: "Druide",
    Fighter: "Guerrier",
    Monk: "Moine",
    Paladin: "Paladin",
    Ranger: "Rôdeur",
    Rogue: "Roublard",
    Sorcerer: "Ensorceleur",
    Warlock: "Occultiste",
    Wizard: "Magicien",
    Dwarf: "Nain",
    Elf: "Elfe",
    Gnome: "Gnome",
    Halfling: "Halfelin",
    Human: "Humain",
    Dragonborn: "Drakéide",
    "Half-Elf": "Demi-elfe",
    "Half-Orc": "Demi-orc",
    Tiefling: "Tieffelin",
    "Hill Dwarf": "Nain des collines",
    "Rock Gnome": "Gnome des roches",
    "Lightfoot Halfling": "Halfelin pied-léger",
    "High Elf": "Haut-elfe",
    Acolyte: "Acolyte",
    Blinded: "Aveuglé",
    Charmed: "Charmé",
    Deafened: "Assourdi",
    Exhaustion: "Épuisement",
    Frightened: "Effrayé",
    Grappled: "Agrippé",
    Incapacitated: "Neutralisé",
    Invisible: "Invisible",
    Paralyzed: "Paralysé",
    Petrified: "Pétrifié",
    Poisoned: "Empoisonné",
    Prone: "À terre",
    Restrained: "Entravé",
    Stunned: "Étourdi",
    Unconscious: "Inconscient",
  },
  "5.2.1": {
    Barbarian: "Barbare",
    Bard: "Barde",
    Cleric: "Clerc",
    Druid: "Druide",
    Fighter: "Guerrier",
    Monk: "Moine",
    Paladin: "Paladin",
    Ranger: "Rôdeur",
    Rogue: "Roublard",
    Sorcerer: "Ensorceleur",
    Warlock: "Occultiste",
    Wizard: "Magicien",
    Dwarf: "Nain",
    Elf: "Elfe",
    Gnome: "Gnome",
    Halfling: "Halfelin",
    Human: "Humain",
    Dragonborn: "Drakéide",
    Orc: "Orc",
    Goliath: "Goliath",
    Tiefling: "Tieffelin",
    "Rock Gnome": "Gnome des roches",
    "High Elf": "Haut-elfe",
    Acolyte: "Acolyte",
    Sage: "Sage",
    Soldier: "Soldat",
    Criminal: "Criminel",
    Blinded: "Aveuglé",
    Charmed: "Charmé",
    Deafened: "Assourdi",
    Exhaustion: "Épuisement",
    Frightened: "Effrayé",
    Grappled: "Agrippé",
    Incapacitated: "Neutralisé",
    Invisible: "Invisible",
    Paralyzed: "Paralysé",
    Petrified: "Pétrifié",
    Poisoned: "Empoisonné",
    Prone: "À terre",
    Restrained: "Entravé",
    Stunned: "Étourdi",
    Unconscious: "Inconscient",
  },
};

async function main() {
  let totalWritten = 0;
  const allSkipped: string[] = [];

  for (const [label, { id: rulesetId, textFile }] of Object.entries(RULESETS)) {
    console.log(`\n--- ${label} ---`);
    const text = readFileSync(textFile, "utf-8");
    const candidates = CANDIDATES[label as keyof typeof RULESETS];

    const verified: Record<string, string> = {};
    const skipped: string[] = [];
    for (const [en, fr] of Object.entries(candidates)) {
      if (text.includes(fr)) {
        verified[en] = fr;
      } else {
        skipped.push(`${en} -> "${fr}" (non trouve dans ${textFile})`);
      }
    }
    console.log(`${Object.keys(verified).length}/${Object.keys(candidates).length} verifies dans le texte officiel.`);
    allSkipped.push(...skipped);

    const { data: entries, error } = await supabase
      .from("ruleset_entries")
      .select("id, source_raw")
      .eq("ruleset_id", rulesetId)
      .in("entry_type", ["class", "species", "background", "condition"]);
    if (error) throw new Error(error.message);

    const rows: { entry_id: string; locale: string; name: string; source: string }[] = [];
    for (const entry of entries) {
      const name = (entry.source_raw as { name?: unknown } | null)?.name;
      if (typeof name === "string" && verified[name]) {
        rows.push({ entry_id: entry.id, locale: "fr", name: verified[name], source: "official_srd" });
      }
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("ruleset_entry_translations")
        .upsert(rows, { onConflict: "entry_id,locale" });
      if (upsertError) throw new Error(upsertError.message);
    }
    console.log(`${rows.length} traductions ecrites (source='official_srd').`);
    totalWritten += rows.length;
  }

  console.log(`\nTermine : ${totalWritten} traductions ecrites au total.`);
  if (allSkipped.length > 0) {
    console.log(`\nIgnores (terme non verifie, a corriger dans une prochaine passe) :`);
    for (const s of allSkipped) console.log(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
