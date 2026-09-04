// V2-J12/V2-J13 (docs/BACKLOG_V2.md §7) : recentre la fiche officielle
// "Pièces de monnaie" (`standard-exchange-rates`, SRD 5.2.1) sur le seul
// taux de conversion — mis en forme dans un vrai tableau plutôt qu'une
// phrase de prose — et deplace ce qui n'y a pas sa place (« Écuries et
// fourrage ») vers une nouvelle fiche "Commerce".
//
// Le paragraphe de revente du SRD 2024 ("Vente d'équipement", page 95,
// lignes 8738-8743 de data/srd/fr-source/srd-5.2.1-fr.txt) condense en
// 3 phrases ce que le SRD 2014 detaillait en 4 sous-parties ("Revente du
// tresor", srd-5.1-fr.txt lignes 5398-5436 : Armes/armures, Objets
// magiques, Gemmes/bijoux/objets d'art, Troc) — la mecanique est identique
// (revente a moitie prix, gemmes/objets d'art gardent leur pleine valeur),
// le 2024 est juste plus laconique et omet meme le troc. Retour utilisateur
// (4 septembre) : preferer la clarte du decoupage 2014 plutot que le
// paragraphe compresse, tout en restant sur les REGLES 2024 (aucune regle
// mecanique differente entre les deux versions ici, seulement la prose) —
// texte ci-dessous reformule, pas recopie du 2014.
//
// Utilise `app.import_srd_entries` (meme fonction que scripts/ingest-srd.ts,
// seul endroit autorise a contourner le verrou d'immutabilite officielle,
// supabase/migrations/20260730180001_srd_import_functions.sql) : upsert par
// entry_key, les blocs sont remplaces en bloc (jamais fusionnes), donc
// chaque appel ci-dessous liste la totalite des blocs voulus pour l'entree,
// y compris ceux qui ne changent pas. Idempotent (on conflict do update),
// relancer ce script ne duplique rien.
//
// PIEGE TROUVE EN VERIFIANT EN DIRECT : `ruleset_entry_translations.blocks`
// (surcharge de libelles PAR LOCALE, SCHEMA.md §9.2) portait deja une copie
// complete de l'ancienne description francaise pour standard-exchange-rates
// — elle masque le bloc de base a l'affichage tant qu'elle existe, meme
// apres avoir corrige le bloc de base lui-meme. Ce script la vide donc
// aussi pour cette entree, sans quoi la correction reste invisible.
//
// Lancement : npx tsx --env-file=.env.local scripts/write-commerce-2024.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RULESET_5_2_1 = "110d20e9-dd80-4752-a57e-a957601b4eae";
const WRITE = process.argv.includes("--write");

// Table de conversion complete du SRD (deja presente, en anglais, dans le
// bloc "Donnees brutes" existant de l'entree — traduite ici en noms de
// pieces francais plutot que reinventee).
const EXCHANGE_TABLE = {
  columns: ["Pièce", "pc", "pa", "pe", "po", "pp"],
  rows: [
    { "Pièce": "Cuivre (pc)", pc: "1", pa: "1/10", pe: "1/50", po: "1/100", pp: "1/1 000" },
    { "Pièce": "Argent (pa)", pc: "10", pa: "1", pe: "1/5", po: "1/10", pp: "1/100" },
    { "Pièce": "Électrum (pe)", pc: "50", pa: "5", pe: "1", po: "1/2", pp: "1/20" },
    { "Pièce": "Or (po)", pc: "100", pa: "10", pe: "2", po: "1", pp: "1/10" },
    { "Pièce": "Platine (pp)", pc: "1 000", pa: "100", pe: "20", po: "10", pp: "1" },
  ],
};

// Bloc "Donnees brutes (SRD)" existant de standard-exchange-rates, reproduit
// tel quel : import_srd_entries remplace TOUS les blocs d'une entree, ne
// jamais omettre ce qu'on veut garder.
const RAW_DATA_BLOCK = {
  block_type: "custom_table",
  display: { label: "Donnees brutes (SRD)", layout: "table", collapsed: true },
  data: {
    columns: ["field", "value"],
    rows: [
      { field: "name", value: "Standard Exchange Rates" },
      { field: "index", value: "standard-exchange-rates" },
      {
        field: "desc",
        value:
          "## Standard Exchange Rates\n| Coin          | CP    | SP   | EP   | GP    | PP      |\n|---------------|-------|------|------|-------|---------|\n| Copper (cp)   | 1     | 1/10 | 1/50 | 1/100 | 1/1,000 |\n| Silver (sp)   | 10    | 1    | 1/5  | 1/10  | 1/100   |\n| Electrum (ep) | 50    | 5    | 1    | 1/2   | 1/20    |\n| Gold (gp)     | 100   | 10   | 2    | 1     | 1/10    |\n| Platinum (pp) | 1,000 | 100  | 20   | 10    | 1       |",
      },
    ],
  },
  display_order: 900,
};

async function main() {
  const { data: existingRates, error: ratesError } = await supabase
    .from("ruleset_entries")
    .select("id, ai_digest")
    .eq("ruleset_id", RULESET_5_2_1)
    .eq("entry_key", "standard-exchange-rates")
    .maybeSingle();
  if (ratesError) throw new Error(ratesError.message);
  if (!existingRates) throw new Error('entry_key "standard-exchange-rates" introuvable — rien a recentrer.');

  const entries = [
    {
      entry_key: "standard-exchange-rates",
      entry_type: "rule",
      ai_digest: existingRates.ai_digest,
      source_attribution: "SRD 5.2.1",
      blocks: [
        {
          block_type: "description",
          display: { label: "Description", layout: "prose" },
          data: {
            segments: [
              {
                text: "Les personnages accumulent de la monnaie au fil de leurs aventures, qu’ils pourront dépenser dans les boutiques, auberges et autres commerces. Ces pièces portent des noms différents, selon la valeur relative des métaux qui les composent : pièce de cuivre (pc) = 1/100 po ; pièce d’argent (pa) = 1/10 po ; pièce d’électrum (pe) = 1/2 po ; pièce d’or (po) = 1 ; pièce de platine (pp) = 10 po. Cent pièces de cuivre, par exemple, valent 1 pièce d’or. Une pièce pèse environ 10 grammes, si bien que cent pièces font un kilogramme.",
              },
            ],
          },
          display_order: 100,
        },
        {
          block_type: "custom_table",
          display: { label: "Taux de conversion", layout: "table" },
          data: EXCHANGE_TABLE,
          display_order: 200,
        },
        RAW_DATA_BLOCK,
      ],
    },
    {
      entry_key: "commerce",
      entry_type: "rule",
      ai_digest: null,
      source_attribution: "SRD 5.2.1",
      blocks: [
        {
          block_type: "description",
          display: { label: "Description", layout: "prose" },
          data: {
            segments: [
              {
                text: "**Revente.** Les occasions ne manquent pas de trouver des trésors, de l’équipement, des armes, des armures et plus encore lors de vos aventures. Vous pouvez généralement les revendre en retournant dans un village ou une ville, à condition d’y trouver des acheteurs ou des marchands intéressés.\n**Armes, armures et autre équipement.** En règle générale, les armes, armures et autres pièces d’équipement en bon état se revendent à la moitié de leur prix d’achat. Les armes et armures utilisées par des monstres sont rarement en assez bon état pour être vendues.\n**Objets magiques.** Vendre des objets magiques est problématique. Trouver un acheteur pour une potion ou un parchemin reste assez facile, mais les autres objets ne sont accessibles qu’aux nobles les plus riches — en dehors de quelques objets magiques courants, vous ne trouverez normalement personne pour acheter un objet magique ou un sort. La magie a une valeur bien supérieure à l’or et doit être traitée comme telle.\n**Gemmes, bijoux et objets d’art.** Ces objets conservent leur pleine valeur sur le marché : vous pouvez les échanger contre des pièces ou les utiliser directement comme monnaie dans une transaction. Pour un trésor d’une valeur exceptionnelle, le MJ peut exiger que vous trouviez un acheteur dans une grande ville.\n**Troc.** Dans les régions reculées, le troc est souvent la base du commerce. Comme pour les gemmes et les objets d’art, les biens échangés (barres de fer, sacs de sel, bétail, etc.) conservent leur pleine valeur sur le marché et peuvent servir de monnaie.\n**Écuries et fourrage.** Une place d’écurie coûte 5 pa par jour ; 5 kg de fourrage coûtent 5 pc par jour.",
              },
            ],
          },
          display_order: 100,
        },
      ],
    },
  ];

  console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} standard-exchange-rates : description recentree + tableau "Taux de conversion" ajoute.`);
  console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} standard-exchange-rates : surcharge de traduction "description" videe (sinon elle masque la correction).`);
  console.log(`${WRITE ? "[ecrit]" : "[a ecrire]"} commerce (entree upsertee) : Revente (4 sous-parties) + "Écuries et fourrage".`);

  if (!WRITE) {
    console.log("\n(mode dry-run, relancer avec --write pour ecrire en base)");
    return;
  }

  const { data: count, error } = await supabase.rpc("import_srd_entries", {
    p_ruleset_id: RULESET_5_2_1,
    p_entries: entries,
  });
  if (error) throw new Error(error.message);

  const { error: clearOverrideError } = await supabase
    .from("ruleset_entry_translations")
    .update({ blocks: {} })
    .eq("entry_id", existingRates.id)
    .eq("locale", "fr");
  if (clearOverrideError) throw new Error(clearOverrideError.message);

  const { data: commerceEntry, error: commerceError } = await supabase
    .from("ruleset_entries")
    .select("id")
    .eq("ruleset_id", RULESET_5_2_1)
    .eq("entry_key", "commerce")
    .single();
  if (commerceError || !commerceEntry) throw new Error(commerceError?.message ?? "entree commerce introuvable apres import");

  const { error: translationError } = await supabase
    .from("ruleset_entry_translations")
    .upsert({ entry_id: commerceEntry.id, locale: "fr", name: "Commerce", source: "official_srd" }, { onConflict: "entry_id,locale" });
  if (translationError) throw new Error(translationError.message);

  console.log(`\n[ecrit] ${count} entree(s) mises a jour/creees.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
