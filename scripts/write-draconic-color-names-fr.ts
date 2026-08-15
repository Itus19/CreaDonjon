// V1-D3b (suite, sur question explicite « pour les objets/aptitudes en table,
// une carte par ligne ? ») — les entrées "Ascendance/Ancêtre draconique" par
// couleur de dragon étaient documentées comme bloquées pour translate-entries.ts
// (un seul mot commun par ligne de table, ex. "Rouge" ou "Absorption" : une
// recherche de sous-chaîne donnerait un faux positif garanti). Mais le mot est
// connu avec certitude — c'est la donnée même de la table, lue directement,
// pas devinée — donc écrit ici à la main, sur le même principe que
// write-spellcasting-2024.ts : nom composé à partir de deux fragments
// vérifiés séparément (en-tête de trait + valeur de cellule de table).
//
// Vérifié mot pour mot dans les deux textes source avant d'écrire quoi que
// ce soit :
//  - Table "Ascendance draconique" (5.1, ligne 403-424) et "Ancêtres
//    draconiques" (5.2.1, ligne 8221-8231) : même correspondance
//    couleur -> type de dégâts dans les deux éditions.
//  - "Ancêtre draconique" (Ensorceleur, 5.1 ligne 2176) : même table reprise
//    (ligne 2180-2191), feature réelle du sous-classe Ensorceleur 2014.
//  - Le sous-classe Ensorceleur 2024 ("Sorcellerie draconique") N'A PLUS de
//    variante par couleur (remplacée par "Résistance draconique"/"Affinité
//    élémentaire" génériques, déjà confirmé ailleurs dans BACKLOG_V1.md,
//    V1-D3b point 10) : dragon-ancestor-* volontairement PAS écrit pour la
//    5.2.1, contenu structurellement absent plutôt qu'un nom inventé pour un
//    choix qui n'existe plus.
//
// Lancement : npx tsx --env-file=.env.local scripts/write-draconic-color-names-fr.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESET_5_1 = "41ebff94-aabc-4f5c-b437-28f2f7a195ee";
const RULESET_5_2_1 = "110d20e9-dd80-4752-a57e-a957601b4eae";
const WRITE = process.argv.includes("--write");

// Couleur -> [slug anglais tel qu'utilise dans entry_key, nom francais officiel SRD, type de degats anglais]
const COLORS: { slug: string; fr: string; damage: string }[] = [
  { slug: "black", fr: "Noir", damage: "acid" },
  { slug: "blue", fr: "Bleu", damage: "lightning" },
  { slug: "brass", fr: "Airain", damage: "fire" },
  { slug: "bronze", fr: "Bronze", damage: "lightning" },
  { slug: "copper", fr: "Cuivre", damage: "acid" },
  { slug: "gold", fr: "Or", damage: "fire" },
  { slug: "green", fr: "Vert", damage: "poison" },
  { slug: "red", fr: "Rouge", damage: "fire" },
  { slug: "silver", fr: "Argent", damage: "cold" },
  { slug: "white", fr: "Blanc", damage: "cold" },
];

const DAMAGE_FR: Record<string, string> = {
  acid: "Acide",
  lightning: "Foudre",
  fire: "Feu",
  poison: "Poison",
  cold: "Froid",
};

interface Target {
  rulesetId: string;
  entryKey: string;
  name: string;
}

const targets: Target[] = [];

// draconic-ancestry-{couleur} : trait Drakéide, les deux rulesets.
for (const rulesetId of [RULESET_5_1, RULESET_5_2_1]) {
  for (const c of COLORS) {
    targets.push({ rulesetId, entryKey: `draconic-ancestry-${c.slug}`, name: `Ascendance draconique (${c.fr})` });
  }
}

// draconic-ancestor-{couleur} : choix d'espece (entry_type species), 5.2.1 seulement.
for (const c of COLORS) {
  targets.push({ rulesetId: RULESET_5_2_1, entryKey: `draconic-ancestor-${c.slug}`, name: `Ascendance draconique (${c.fr})` });
}

// dragon-ancestor-{couleur}---{degats}-damage : feature Ensorceleur, 5.1 seulement
// (confirmee reelle, ligne 2176). PAS ecrit pour la 5.2.1 (contenu absent, voir en-tete).
function withDeElision(damageFr: string): string {
  const lower = damageFr.toLowerCase();
  return /^[aeiouéèêàâ]/.test(lower) ? `d'${lower}` : `de ${lower}`;
}

for (const c of COLORS) {
  targets.push({
    rulesetId: RULESET_5_1,
    entryKey: `dragon-ancestor-${c.slug}---${c.damage}-damage`,
    name: `Ancêtre draconique : ${c.fr} - dégâts ${withDeElision(DAMAGE_FR[c.damage])}`,
  });
}

// draconic-breath-weapon-{degats} / draconic-damage-resistance-{degats} :
// features generiques par type de degats, 5.2.1 seulement (structure propre
// a 2024, verifiee via l'entete "Souffle."/"Resistance aux degats." ligne
// 8232-8241 -- le texte re-decoupe par type de degats plutot que par couleur
// individuelle, chaque type couvrant plusieurs couleurs).
const DAMAGE_TYPES = ["acid", "lightning", "fire", "poison", "cold"];
for (const d of DAMAGE_TYPES) {
  targets.push({ rulesetId: RULESET_5_2_1, entryKey: `draconic-breath-weapon-${d}`, name: `Souffle : ${DAMAGE_FR[d]}` });
  targets.push({ rulesetId: RULESET_5_2_1, entryKey: `draconic-damage-resistance-${d}`, name: `Résistance aux dégâts : ${DAMAGE_FR[d]}` });
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
      .eq("ruleset_id", t.rulesetId)
      .eq("entry_key", t.entryKey)
      .maybeSingle();
    if (!entry) {
      missing.push(`${t.rulesetId === RULESET_5_1 ? "5.1" : "5.2.1"} / ${t.entryKey}`);
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
