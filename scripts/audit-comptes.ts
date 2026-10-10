// Inventaire des comptes du projet Supabase, en LECTURE SEULE (docs/TESTS.md).
// Le projet sert a la fois a la vraie table et aux tests : ce script range les
// comptes par origine pour que l'auteur decide quoi supprimer. Il ne supprime
// rien, et n'affiche jamais l'email d'un compte ordinaire (email reel).
//
// Lancement : npm run audit:comptes

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const admin: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Category =
  | "pool"
  | "banc"
  | "demo"
  | "jetable"
  | "synthetique_isole"
  | "actif";

const TITLES: Record<Category, string> = {
  pool: "Groupe des tests automatiques — GARDER (src/server/testUtils/reusableTestAccounts.ts)",
  banc: "Banc d'essai, tests a la main — GARDER (scripts/comptes-test-manuels.ts)",
  demo: "Comptes de demonstration (npm run seed:dev) — verifier avant de supprimer : ils possedent les mondes de demo",
  jetable: "Anciens comptes jetables de test (@creadonjon.local) — SUPPRIMABLES",
  synthetique_isole: "Comptes « tag » ou d'invitation sans campagne ni monde — A EXAMINER (un vrai compte de joueuse a la meme forme)",
  actif: "Comptes actifs (membres d'une campagne ou proprietaires d'un monde) — ne pas toucher",
};

async function listAllUsers(): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers : ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 1000) return all;
  }
}

function isSynthetic(email: string): boolean {
  return /@creadonjon\.(tag|invite)$/i.test(email);
}

function day(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "jamais";
}

async function main() {
  const users = await listAllUsers();
  const [{ data: profiles, error: pErr }, { data: members, error: mErr }, { data: worlds, error: wErr }] = await Promise.all([
    admin.from("profiles").select("id, display_name, handle_name, handle_tag, account_role"),
    admin.from("campaign_members").select("user_id, role"),
    admin.from("worlds").select("owner_id, name"),
  ]);
  if (pErr || mErr || wErr) throw new Error(`lecture : ${(pErr ?? mErr ?? wErr)?.message}`);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const memberships = new Map<string, number>();
  for (const m of members ?? []) memberships.set(m.user_id, (memberships.get(m.user_id) ?? 0) + 1);
  const ownedWorlds = new Map<string, string[]>();
  for (const w of worlds ?? []) ownedWorlds.set(w.owner_id, [...(ownedWorlds.get(w.owner_id) ?? []), w.name]);

  const byCategory = new Map<Category, string[]>();
  for (const u of users) {
    const email = u.email ?? "";
    const p = profileById.get(u.id);
    const name = p?.handle_name ? `${p.handle_name}#${p.handle_tag ?? "?"}` : p?.display_name || "(sans nom)";
    const nMemb = memberships.get(u.id) ?? 0;
    const owned = ownedWorlds.get(u.id) ?? [];
    let cat: Category;
    if (/^test-pool-.*@creadonjon\.local$/i.test(email)) cat = "pool";
    else if (/^tag-banc-essai-.*@creadonjon\.tag$/i.test(email)) cat = "banc";
    else if (/^(mj|joueur)-demo@creadonjon\.local$/i.test(email)) cat = "demo";
    else if (/@creadonjon\.local$/i.test(email)) cat = "jetable";
    else if (isSynthetic(email) && nMemb === 0 && owned.length === 0) cat = "synthetique_isole";
    else cat = "actif";

    // Jamais l'email d'un compte ordinaire : seulement des comptes de test ou synthetiques.
    const shownEmail = cat === "actif" && !isSynthetic(email) ? "(email reel masque)" : email;
    const role = p?.account_role === "superadmin" ? " · superadmin" : "";
    const line = `- ${name}${role} · ${shownEmail} · cree le ${day(u.created_at)} · derniere connexion ${day(u.last_sign_in_at)} · ${nMemb} campagne(s)${owned.length ? ` · possede : ${owned.join(", ")}` : ""} · id ${u.id}`;
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), line]);
  }

  console.log(`# Inventaire des comptes — ${users.length} au total\n`);
  for (const cat of Object.keys(TITLES) as Category[]) {
    const lines = byCategory.get(cat) ?? [];
    console.log(`## ${TITLES[cat]} — ${lines.length}\n`);
    console.log(lines.length ? lines.sort().join("\n") : "(aucun)");
    console.log("");
  }
  console.log("Rien n'a ete supprime. Suppression : Administration › Comptes, ou sur une liste d'ids validee par l'auteur.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
