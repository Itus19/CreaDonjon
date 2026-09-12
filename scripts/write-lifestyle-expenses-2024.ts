// V2-J14 (docs/BACKLOG_V2.md §7) : nouvelle fiche officielle "Train de vie"
// (SRD 5.2.1) — jamais importee jusqu'ici (absente du JSON source
// structure, seulement dans le texte PDF extrait). Contenu verifie mot
// pour mot dans data/srd/fr-source/srd-5.2.1-fr.txt, lignes 9881-9995
// (pages 107-108) : les 7 paliers de train de vie, la table "Repas,
// boisson et hebergement", la table "Employes", la table "Services
// d'incantation".
//
// Sert de reference de prix pour le futur axe "richesse" du generateur
// Taverne/Echoppe (V2-J8/V2-J9) — cf. la note de dependance sur ces
// tickets dans le backlog.
//
// Meme mecanisme que scripts/write-commerce-2024.ts : RPC
// `app.import_srd_entries` (seul chemin autorise a ecrire une entree
// officielle, supabase/migrations/20260730180001_srd_import_functions.sql),
// idempotent (on conflict do update).
//
// Lancement : npx tsx --env-file=.env.local scripts/write-lifestyle-expenses-2024.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESET_5_2_1 = "110d20e9-dd80-4752-a57e-a957601b4eae";
const WRITE = process.argv.includes("--write");

const MEALS_TABLE = {
  columns: ["Service/produit", "Prix"],
  rows: [
    { "Service/produit": "Bière (pichet)", Prix: "4 pc" },
    { "Service/produit": "Fromage (tranche)", Prix: "1 pa" },
    { "Service/produit": "Pain (miche)", Prix: "2 pc" },
    { "Service/produit": "Repas — misérable", Prix: "1 pc" },
    { "Service/produit": "Repas — pauvre", Prix: "2 pc" },
    { "Service/produit": "Repas — modeste", Prix: "1 pa" },
    { "Service/produit": "Repas — confortable", Prix: "2 pa" },
    { "Service/produit": "Repas — riche", Prix: "3 pa" },
    { "Service/produit": "Repas — aristocratique", Prix: "6 pa" },
    { "Service/produit": "Séjour à l’auberge (par jour) — misérable", Prix: "7 pc" },
    { "Service/produit": "Séjour à l’auberge (par jour) — pauvre", Prix: "1 pa" },
    { "Service/produit": "Séjour à l’auberge (par jour) — modeste", Prix: "5 pa" },
    { "Service/produit": "Séjour à l’auberge (par jour) — confortable", Prix: "8 pa" },
    { "Service/produit": "Séjour à l’auberge (par jour) — riche", Prix: "2 po" },
    { "Service/produit": "Séjour à l’auberge (par jour) — aristocratique", Prix: "4 po" },
    { "Service/produit": "Vin (bouteille) — ordinaire", Prix: "2 pa" },
    { "Service/produit": "Vin (bouteille) — fin", Prix: "10 po" },
  ],
};

const EMPLOYEES_TABLE = {
  columns: ["Service", "Prix"],
  rows: [
    { Service: "Employé qualifié", Prix: "2 po par jour" },
    { Service: "Employé sans formation", Prix: "2 pa par jour" },
    { Service: "Messager", Prix: "2 pc par 1,5 km" },
  ],
};

const SPELLCASTING_SERVICES_TABLE = {
  columns: ["Niveau du sort", "Disponibilité", "Prix"],
  rows: [
    { "Niveau du sort": "Sort mineur", "Disponibilité": "Village, bourgade ou ville", Prix: "30 po" },
    { "Niveau du sort": "1", "Disponibilité": "Village, bourgade ou ville", Prix: "50 po" },
    { "Niveau du sort": "2", "Disponibilité": "Village, bourgade ou ville", Prix: "200 po" },
    { "Niveau du sort": "3", "Disponibilité": "Bourgade ou ville uniquement", Prix: "300 po" },
    { "Niveau du sort": "4–5", "Disponibilité": "Bourgade ou ville uniquement", Prix: "2 000 po" },
    { "Niveau du sort": "6–8", "Disponibilité": "Ville uniquement", Prix: "20 000 po" },
    { "Niveau du sort": "9", "Disponibilité": "Ville uniquement", Prix: "100 000 po" },
  ],
};

const DESCRIPTION_TEXT = [
  "Les dépenses de train de vie résument le coût de la vie quotidienne dans un monde fantastique. Elles couvrent l’hébergement, la nourriture, l’entretien de l’équipement et autres commodités.",
  "Au début de chaque semaine ou de chaque mois (au choix du MJ), choisissez l’un des trains de vie suivants : mendiant, misérable, pauvre, modeste, confortable, riche ou aristocratique, et acquittez le prix correspondant au train de vie associé. Si le train de vie n’a pas de répercussions automatiques en soi, le MJ peut le prendre en compte pour déterminer les risques ou la façon dont votre personnage est perçu.",
  "**Mendiant (gratuit).** Vous comptez sur votre bonne étoile et sur la charité pour survivre. Dormir à l’extérieur vous expose souvent à des dangers naturels.",
  "**Misérable (1 pa par jour).** Vous dépensez le strict minimum pour vos besoins. Vous êtes parfois exposé à des conditions insalubres et aux exactions des petits criminels.",
  "**Pauvre (2 pa par jour).** Vous dépensez avec parcimonie pour vos besoins essentiels.",
  "**Modeste (1 po par jour).** Vous subvenez à vos besoins à un niveau moyen.",
  "**Confortable (2 po par jour).** Vous subvenez aux besoins élémentaires et profitez de temps à autre du superflu.",
  "**Riche (4 po par jour).** Habitué à vivre dans le luxe, vous pourriez même avoir des domestiques.",
  "**Aristocratique (10 po par jour).** Vous payez pour ce qu’il y a de mieux et régnez sur une petite armée de serviteurs. Les personnes qui remarquent tout ce faste risquent de vous « inviter » à partager, par des moyens légaux ou non.",
].join("\n");

async function main() {
  const entries = [
    {
      entry_key: "lifestyle-expenses",
      entry_type: "rule",
      ai_digest: null,
      source_attribution: "SRD 5.2.1",
      blocks: [
        { block_type: "description", display: { label: "Description", layout: "prose" }, data: { segments: [{ text: DESCRIPTION_TEXT }] }, display_order: 100 },
        { block_type: "custom_table", display: { label: "Repas, boisson et hébergement", layout: "table" }, data: MEALS_TABLE, display_order: 200 },
        { block_type: "custom_table", display: { label: "Employés", layout: "table" }, data: EMPLOYEES_TABLE, display_order: 300 },
        { block_type: "custom_table", display: { label: "Services d’incantation", layout: "table" }, data: SPELLCASTING_SERVICES_TABLE, display_order: 400 },
      ],
    },
  ];

  console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} lifestyle-expenses (nouvelle entree) : 7 paliers + 3 tableaux de prix.`);

  if (!WRITE) {
    console.log("\n(mode dry-run, relancer avec --write pour ecrire en base)");
    return;
  }

  const { data: count, error } = await supabase.rpc("import_srd_entries", { p_ruleset_id: RULESET_5_2_1, p_entries: entries });
  if (error) throw new Error(error.message);

  const { data: entry, error: entryError } = await supabase
    .from("ruleset_entries")
    .select("id")
    .eq("ruleset_id", RULESET_5_2_1)
    .eq("entry_key", "lifestyle-expenses")
    .single();
  if (entryError || !entry) throw new Error(entryError?.message ?? "entree lifestyle-expenses introuvable apres import");

  const { error: translationError } = await supabase
    .from("ruleset_entry_translations")
    .upsert({ entry_id: entry.id, locale: "fr", name: "Train de vie", source: "official_srd" }, { onConflict: "entry_id,locale" });
  if (translationError) throw new Error(translationError.message);

  console.log(`\n[ecrit] ${count} entree(s) mises a jour/creees.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
