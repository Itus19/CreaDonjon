// Distribution fixe pour tester l'app a la main (docs/TESTS.md) : trois
// comptes « tag » permanents et leur monde « Banc d'essai ». Remplace la
// creation d'un compte neuf a chaque verification, qui a laisse des dizaines
// de comptes inutilises dans le projet Supabase (partage avec la vraie table).
//
// Lancement : npm run test:comptes-manuels
// Idempotent : relance sans risque, ne recree jamais ce qui existe. Le mot de
// passe vient de MANUAL_TEST_PASSWORD (jamais dans Git) ; le changer puis
// relancer le script met les trois comptes au nouveau mot de passe.
//
// Le monde est cree par les services de l'app (`createWorldWithCampaign`,
// `createEntity`...), pas par des insertions a la main : il est exactement
// ce que l'interface aurait produit. D'ou `--conditions=react-server` dans la
// commande npm, qui laisse ces modules `server-only` se charger hors de Next.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { createWorldWithCampaign } from "../src/server/services/worlds";
import { createEntity } from "../src/server/services/entities";
import { insertCampaignMember, listCampaignsForWorld, upsertCampaignCharacter } from "../src/server/repos/campaigns";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.MANUAL_TEST_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
if (!PASSWORD || PASSWORD.length < 12) {
  throw new Error("MANUAL_TEST_PASSWORD doit etre defini (12 caracteres au moins) : c'est le mot de passe des trois comptes de test.");
}

const admin: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WORLD_NAME = "Banc d'essai";

/** Emails synthetiques FIXES (domaine des comptes « tag ») : c'est par eux que le script retrouve les comptes d'une fois sur l'autre. */
const ACCOUNTS = [
  { key: "mj", email: "tag-banc-essai-mj@creadonjon.tag", name: "Testeur MJ" },
  { key: "a", email: "tag-banc-essai-a@creadonjon.tag", name: "Testeuse A" },
  { key: "b", email: "tag-banc-essai-b@creadonjon.tag", name: "Testeur B" },
] as const;

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers : ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
}

async function ensureAccount(account: (typeof ACCOUNTS)[number]): Promise<string> {
  const existing = await findUserIdByEmail(account.email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing, { password: PASSWORD });
    if (error) throw new Error(`updateUserById(${account.name}) : ${error.message}`);
    console.log(`  ${account.name} : existait, mot de passe remis a jour.`);
    return existing;
  }
  // `display_name` devient `handle_name` par le declencheur app.handle_new_user,
  // qui tire aussi le numero (#1234) — meme chemin qu'un compte cree depuis /login.
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: account.name },
  });
  if (error || !data.user) throw new Error(`createUser(${account.name}) : ${error?.message}`);
  console.log(`  ${account.name} : cree.`);
  return data.user.id;
}

async function officialRuleset2024Id(): Promise<string> {
  const { data, error } = await admin
    .from("rulesets")
    .select("id, version")
    .eq("is_official_base", true)
    .eq("base_system", "dnd_srd_52")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`ruleset officiel : ${error.message}`);
  if (!data) throw new Error("Ruleset officiel SRD 5.2.1 introuvable : lancer d'abord npm run ingest:srd.");
  return data.id;
}

async function ensureCharacter(params: { worldId: string; mjId: string; name: string }): Promise<string> {
  const { data, error } = await admin
    .from("entities")
    .select("id")
    .eq("world_id", params.worldId)
    .eq("name", params.name)
    .maybeSingle();
  if (error) throw new Error(`entities : ${error.message}`);
  if (data) return data.id;
  const created = await createEntity(admin, { worldId: params.worldId, createdBy: params.mjId, name: params.name, entityKind: "character", aliases: [] });
  return created.id;
}

async function main() {
  console.log("Comptes de test manuels — monde « Banc d'essai »\n");
  const ids: Record<string, string> = {};
  for (const account of ACCOUNTS) ids[account.key] = await ensureAccount(account);

  const { data: existingWorld, error: worldError } = await admin
    .from("worlds")
    .select("id, slug")
    .eq("owner_id", ids.mj)
    .eq("name", WORLD_NAME)
    .maybeSingle();
  if (worldError) throw new Error(`worlds : ${worldError.message}`);

  let worldId: string;
  let worldSlug: string;
  if (existingWorld) {
    worldId = existingWorld.id;
    worldSlug = existingWorld.slug;
    console.log(`  Monde : existait (/m/${worldSlug}).`);
  } else {
    const { world } = await createWorldWithCampaign(admin, { ownerId: ids.mj, name: WORLD_NAME, rulesetId: await officialRuleset2024Id(), mode: "campaign" });
    worldId = world.id;
    worldSlug = world.slug;
    console.log(`  Monde : cree (/m/${worldSlug}).`);
  }

  const [campaign] = await listCampaignsForWorld(admin, worldId);
  if (!campaign) throw new Error("Le monde « Banc d'essai » n'a pas de campagne : incoherence, a examiner a la main.");

  for (const key of ["a", "b"] as const) {
    const account = ACCOUNTS.find((a) => a.key === key)!;
    await insertCampaignMember(admin, { campaignId: campaign.id, userId: ids[key], role: "player" });
    // Le PJ existe mais sans fiche : la premiere verification de l'assistant
    // de creation la remplit, puis elle reste d'une fois sur l'autre.
    const entityId = await ensureCharacter({ worldId, mjId: ids.mj, name: `PJ de ${account.name}` });
    await upsertCampaignCharacter(admin, { campaignId: campaign.id, entityId, userId: ids[key], isPc: true });
  }
  console.log("  Campagne : Testeuse A et Testeur B joueurs, chacun avec son PJ.\n");

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, handle_name, handle_tag")
    .in("id", Object.values(ids));
  if (profilesError) throw new Error(`profiles : ${profilesError.message}`);
  console.log("Pour se connecter (nom + mot de passe de MANUAL_TEST_PASSWORD) :");
  for (const account of ACCOUNTS) {
    const p = profiles?.find((row) => row.id === ids[account.key]);
    console.log(`  ${account.name} — ${p?.handle_name ?? account.name}#${p?.handle_tag ?? "?"}`);
  }
  console.log(`\nMonde : /m/${worldSlug}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
