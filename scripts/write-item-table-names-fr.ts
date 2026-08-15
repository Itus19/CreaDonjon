// V1-D3b (suite) : familles d'Objets 5.1 documentees comme "plafond structurel"
// dans BACKLOG_V1.md (point 6 -- Ceinturon de force de geant, Pierre de Ioun,
// Anneau de resistance/commandement, Potion de force/resistance de geant,
// Manuel de golem, Armure d'ecailles de dragon, Parchemin de sort, Barde).
// translate-entries.ts rejette ces candidats a raison (chaque ligne de table
// ne contient qu'un mot commun, une recherche de sous-chaine donnerait un
// faux positif garanti) -- mais le mot est connu avec certitude en lisant la
// table directement, jamais devine. Meme principe que
// write-draconic-color-names-fr.ts : nom compose a partir de deux fragments
// verifies separement (en-tete de l'objet + valeur de cellule de table),
// chaque fragment relu dans data/srd/fr-source/srd-5.1-fr.txt avant d'etre
// inscrit ci-dessous.
//
// Lancement : npx tsx --env-file=.env.local scripts/write-item-table-names-fr.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESET_5_1 = "41ebff94-aabc-4f5c-b437-28f2f7a195ee";
const WRITE = process.argv.includes("--write");

interface Target {
  entryKey: string;
  name: string;
  /** ligne(s) du texte source relue(s) pour verifier ce fragment */
  source: string;
}

const targets: Target[] = [];

// --- Ceinturon de force de geant (ligne 22422-22440) ---
// Base "Ceinturon de force de geant" + suffixe deja present tel quel dans la
// colonne "Type" de la table (ex. "des collines"), jamais de preposition
// inventee.
const GIANT_SUFFIX: { slug: string; suffix: string }[] = [
  { slug: "hill", suffix: "des collines" },
  { slug: "stone", suffix: "des pierres" },
  { slug: "frost", suffix: "du givre" },
  { slug: "fire", suffix: "du feu" },
  { slug: "cloud", suffix: "des nuages" },
  { slug: "storm", suffix: "des tempêtes" },
];
for (const g of GIANT_SUFFIX) {
  targets.push({ entryKey: `belt-of-giant-strength-${g.slug}`, name: `Ceinturon de force de géant ${g.suffix}`, source: "22422-22440" });
  targets.push({ entryKey: `potion-of-giant-strength-${g.slug}`, name: `Potion de force de géant ${g.suffix}`, source: "24345-24361" });
}

// --- Anneau/Potion de resistance (lignes 21097-21113, 24394-24405) ---
// Table donne le type de degats au pluriel (colonne de liste) ; normalise au
// singulier pour un nom d'objet individuel (meme lemme, pas un mot invente).
const DAMAGE_TYPES_SINGULAR: { slug: string; fr: string }[] = [
  { slug: "acid", fr: "Acide" },
  { slug: "fire", fr: "Feu" },
  { slug: "force", fr: "Force" },
  { slug: "lightning", fr: "Foudre" },
  { slug: "cold", fr: "Froid" },
  { slug: "necrotic", fr: "Nécrotique" },
  { slug: "poison", fr: "Poison" },
  { slug: "psychic", fr: "Psychique" },
  { slug: "radiant", fr: "Radiant" },
  { slug: "thunder", fr: "Tonnerre" },
];
for (const d of DAMAGE_TYPES_SINGULAR) {
  targets.push({ entryKey: `ring-of-resistance-${d.slug}`, name: `Anneau de résistance (${d.fr})`, source: "21097-21113" });
  targets.push({ entryKey: `potion-of-resistance-${d.slug}`, name: `Potion de résistance (${d.fr})`, source: "24394-24405" });
}

// --- Anneau de maitrise elementaire (lignes 20956-21041, sous-en-tetes
// complets deja au fil du texte, aucune preposition inventee) ---
targets.push({ entryKey: "ring-of-elemental-command-air", name: "Anneau de maîtrise élémentaire de l’air", source: "20970" });
targets.push({ entryKey: "ring-of-elemental-command-water", name: "Anneau de maîtrise élémentaire de l’eau", source: "20988" });
targets.push({ entryKey: "ring-of-elemental-command-fire", name: "Anneau de maîtrise élémentaire du feu", source: "21006" });
targets.push({ entryKey: "ring-of-elemental-command-earth", name: "Anneau de maîtrise élémentaire de la terre", source: "21021" });

// --- Manuel des golems (lignes 23737-23751) ---
const GOLEM_MATERIALS: { slug: string; fr: string }[] = [
  { slug: "clay", fr: "Argile" },
  { slug: "flesh", fr: "Chair" },
  { slug: "iron", fr: "Fer" },
  { slug: "stone", fr: "Pierre" },
];
for (const g of GOLEM_MATERIALS) {
  targets.push({ entryKey: `manual-of-golems-${g.slug}`, name: `Manuel des golems (${g.fr})`, source: "23747-23751" });
}

// --- Armure d'ecailles de dragon (lignes 21218-21251), meme table
// couleur -> type de degats que Ascendance draconique. ---
const DRAGON_COLORS: { slug: string; fr: string }[] = [
  { slug: "black", fr: "Noir" },
  { slug: "blue", fr: "Bleu" },
  { slug: "brass", fr: "Airain" },
  { slug: "bronze", fr: "Bronze" },
  { slug: "copper", fr: "Cuivre" },
  { slug: "gold", fr: "Or" },
  { slug: "green", fr: "Vert" },
  { slug: "red", fr: "Rouge" },
  { slug: "silver", fr: "Argent" },
  { slug: "white", fr: "Blanc" },
];
for (const c of DRAGON_COLORS) {
  targets.push({ entryKey: `dragon-scale-mail-${c.slug}`, name: `Armure d’écailles de dragon (${c.fr})`, source: "21218, 21246-21251" });
}

// --- Parchemin de sort (lignes 23946-23990) ---
const SPELL_LEVELS: { slug: string; fr: string }[] = [
  { slug: "cantrip", fr: "sort mineur" },
  { slug: "1st", fr: "1er niveau" },
  { slug: "2nd", fr: "2e niveau" },
  { slug: "3rd", fr: "3e niveau" },
  { slug: "4th", fr: "4e niveau" },
  { slug: "5th", fr: "5e niveau" },
  { slug: "6th", fr: "6e niveau" },
  { slug: "7th", fr: "7e niveau" },
  { slug: "8th", fr: "8e niveau" },
  { slug: "9th", fr: "9e niveau" },
];
for (const s of SPELL_LEVELS) {
  targets.push({ entryKey: `spell-scroll-${s.slug}`, name: `Parchemin de sort (${s.fr})`, source: "23974-23990" });
}

// --- Pierre de Ioun (lignes 24057-24160) : deja traduite dans une passe
// anterieure (style "Absorption" nu plutot que bracket), confirme par
// dry-run -- rien a ecrire ici, laisse en commentaire pour memoire.

// --- Barde (harnachement de monture, ligne 6495 : "Barde 4 x2" -- prix
// double de l'armure equivalente, pas de nom distinct par piece dans le
// texte) : reutilise les noms d'Armure deja traduits (categorie complete),
// jamais devine. ---
const BARDING_ARMOR: { slug: string; armorFr: string }[] = [
  { slug: "breastplate", armorFr: "Cuirasse" },
  { slug: "chain-mail", armorFr: "Cotte de mailles" },
  { slug: "splint", armorFr: "Clibanion" },
  { slug: "plate", armorFr: "Harnois" },
  { slug: "scale-mail", armorFr: "Armure d’écailles" },
  { slug: "padded", armorFr: "Matelassée" },
  { slug: "leather", armorFr: "Armure de cuir" },
  { slug: "studded-leather", armorFr: "Cuir clouté" },
  { slug: "hide", armorFr: "Armure de peaux" },
  { slug: "chain-shirt", armorFr: "Chemise de mailles" },
  { slug: "half-plate", armorFr: "Demi-plate" },
  { slug: "ring-mail", armorFr: "Broigne" },
];
for (const b of BARDING_ARMOR) {
  targets.push({ entryKey: `barding-${b.slug}`, name: `Barde (${b.armorFr})`, source: "6495 + noms Armure deja traduits" });
}

async function main() {
  console.log(`${targets.length} cibles construites.\n`);

  let written = 0;
  let skippedIdentical = 0;
  const missing: string[] = [];
  const conflicts: string[] = [];

  for (const t of targets) {
    const { data: entry } = await supabase
      .from("ruleset_entries")
      .select("id")
      .eq("ruleset_id", RULESET_5_1)
      .eq("entry_key", t.entryKey)
      .maybeSingle();
    if (!entry) {
      missing.push(t.entryKey);
      continue;
    }

    const { data: existing } = await supabase
      .from("ruleset_entry_translations")
      .select("name, blocks")
      .eq("entry_id", entry.id)
      .eq("locale", "fr")
      .maybeSingle();

    if (existing?.name && existing.name !== t.name) {
      conflicts.push(`${t.entryKey} : deja "${existing.name}", candidat "${t.name}"`);
      continue;
    }
    if (existing?.name === t.name) {
      skippedIdentical++;
      continue;
    }

    console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} ${t.entryKey} -> ${t.name}`);
    written++;
    if (WRITE) {
      const { error } = await supabase
        .from("ruleset_entry_translations")
        .upsert(
          { entry_id: entry.id, locale: "fr", name: t.name, blocks: existing?.blocks ?? {}, source: "official_srd" },
          { onConflict: "entry_id,locale" }
        );
      if (error) throw new Error(`${t.entryKey} : ${error.message}`);
    }
  }

  console.log(`\n${written} ${WRITE ? "ecrites" : "a ecrire (dry-run)"}, ${skippedIdentical} deja identiques, ${missing.length} entry_key introuvables, ${conflicts.length} conflits.`);
  if (missing.length > 0) {
    console.log("\nEntry_key introuvables :");
    for (const m of missing) console.log(`  - ${m}`);
  }
  if (conflicts.length > 0) {
    console.log("\nConflits (nom deja different, non ecrase) :");
    for (const c of conflicts) console.log(`  - ${c}`);
  }
  if (!WRITE) console.log("\n(mode dry-run, relancer avec --write pour ecrire en base)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
