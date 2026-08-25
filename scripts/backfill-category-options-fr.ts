// V2-G1 (retour utilisateur, choix d'equipement de categorie) : repare une
// desynchronisation decouverte apres l'ajout de `category_options` a
// `BackgroundEquipmentItem` — l'historique Soldat (SRD 5.2.1) porte un
// override `ruleset_entry_translations.blocks.background` (traduction
// verifiee du texte officiel, ex. `tool_proficiency` = "Choisissez un type
// de boite de jeux (voir « Equipement »)."), ecrit AVANT l'ajout de ce
// champ. `listRuleEntryBlocksByKeys` remplace tout le bloc par cet override
// quand il existe (`overrides[block_type] ?? row.data`), donc le nouveau
// `category_options` (deja present dans `ruleset_entry_blocks.data` frais,
// verifie apres reingestion) restait invisible malgre l'ingestion.
//
// Seule cette entree est concernee dans toute la base (verifie : requete sur
// toutes les lignes `ruleset_entry_translations` en `fr` dont `blocks`
// contient une cle `background`/`class_equipment` — un seul resultat,
// `soldier`). Ce script fusionne `category_options` depuis les donnees
// fraiches dans l'override, par position d'item (ordre stable, meme tableau
// source SRD des deux cotes) — jamais un ecrasement complet, pour ne
// perdre aucune des traductions deja verifiees dans l'override.
//
// Lancement : npx tsx --env-file=.env.local scripts/backfill-category-options-fr.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WRITE = process.argv.includes("--write");

interface EquipmentItem {
  label: string;
  quantity: number;
  ref?: { kind: string; key: string };
  category_options?: { kind: string; key: string }[];
}
interface EquipmentOption {
  label: string;
  items: EquipmentItem[];
  gold?: { value: number; unit: string };
}
interface BackgroundData {
  equipment_options: EquipmentOption[];
  [key: string]: unknown;
}

async function main() {
  const { data: entries, error: entryError } = await supabase
    .from("ruleset_entries")
    .select("id, entry_key")
    .eq("entry_key", "soldier")
    .eq("entry_type", "background")
    .eq("ruleset_id", "110d20e9-dd80-4752-a57e-a957601b4eae");
  if (entryError) throw new Error(entryError.message);
  const entry = entries?.[0];
  if (!entry) throw new Error("Entree 'soldier' (2024) introuvable.");

  const { data: freshBlock, error: blockError } = await supabase
    .from("ruleset_entry_blocks")
    .select("data")
    .eq("entry_id", entry.id)
    .eq("block_type", "background")
    .single();
  if (blockError) throw new Error(blockError.message);
  const fresh = freshBlock.data as BackgroundData;

  const { data: translation, error: transError } = await supabase
    .from("ruleset_entry_translations")
    .select("blocks")
    .eq("entry_id", entry.id)
    .eq("locale", "fr")
    .single();
  if (transError) throw new Error(transError.message);
  const blocks = translation.blocks as Record<string, unknown>;
  const overrideBg = blocks.background as BackgroundData | undefined;
  if (!overrideBg) throw new Error("Override 'background' absent pour soldier — rien a fusionner.");

  let patched = 0;
  overrideBg.equipment_options.forEach((opt, optIndex) => {
    const freshOpt = fresh.equipment_options[optIndex];
    if (!freshOpt) return;
    opt.items.forEach((item, itemIndex) => {
      const freshItem = freshOpt.items[itemIndex];
      if (!freshItem) return;
      if (item.label !== freshItem.label) {
        console.warn(`  attention : libelle different a [${optIndex}][${itemIndex}] ("${item.label}" vs "${freshItem.label}"), ignore.`);
        return;
      }
      if (freshItem.category_options && !item.category_options) {
        item.category_options = freshItem.category_options;
        patched++;
        console.log(`  fusionne : [${optIndex}][${itemIndex}] "${item.label}" -> ${freshItem.category_options.length} membre(s).`);
      }
    });
  });

  if (patched === 0) {
    console.log("Rien a fusionner (deja a jour).");
    return;
  }

  console.log(`${patched} item(s) patche(s).${WRITE ? "" : " (mode simulation, relancer avec --write pour ecrire)"}`);
  if (!WRITE) return;

  const { error: updateError } = await supabase
    .from("ruleset_entry_translations")
    .update({ blocks: { ...blocks, background: overrideBg } })
    .eq("entry_id", entry.id)
    .eq("locale", "fr");
  if (updateError) throw new Error(updateError.message);
  console.log("Ecrit.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
