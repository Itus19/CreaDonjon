// Supprime les ANCIENS comptes jetables des tests (docs/TESTS.md §5) : les
// adresses `…@creadonjon.local` creees par les tests d'integration d'avant le
// groupe fixe de comptes, restees quand un test plantait avant son nettoyage.
//
// Lancement : npm run supprimer:comptes-jetables            (liste seulement)
//             npm run supprimer:comptes-jetables -- --confirmer   (supprime)
//
// Perimetre ferme, verifie compte par compte :
// - seulement `@creadonjon.local` ;
// - jamais le groupe des tests automatiques (`test-pool-…`) ni les comptes de
//   demonstration (`mj-demo`, `joueur-demo`) ;
// - jamais un superadmin, jamais un compte proprietaire d'un monde (ses
//   donnees partiraient avec lui ou bloqueraient : il est signale, pas touche).
// Aucun compte « tag » ni compte a email reel n'entre jamais dans la liste.

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const admin: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CONFIRMER = process.argv.includes("--confirmer");

function isDisposable(email: string): boolean {
  return /@creadonjon\.local$/i.test(email) && !/^test-pool-/i.test(email) && !/^(mj|joueur)-demo@/i.test(email);
}

async function listAllUsers(): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers : ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 1000) return all;
  }
}

async function main() {
  const candidates = (await listAllUsers()).filter((u) => isDisposable(u.email ?? ""));
  const ids = candidates.map((u) => u.id);
  const [{ data: profiles, error: pErr }, { data: worlds, error: wErr }] = await Promise.all([
    admin.from("profiles").select("id, account_role").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("worlds").select("owner_id, name").in("owner_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  if (pErr || wErr) throw new Error(`lecture : ${(pErr ?? wErr)?.message}`);

  const superadmins = new Set((profiles ?? []).filter((p) => p.account_role === "superadmin").map((p) => p.id));
  const owners = new Map<string, string[]>();
  for (const w of worlds ?? []) owners.set(w.owner_id, [...(owners.get(w.owner_id) ?? []), w.name]);

  const toDelete = candidates.filter((u) => !superadmins.has(u.id) && !owners.has(u.id));
  const kept = candidates.filter((u) => superadmins.has(u.id) || owners.has(u.id));

  console.log(`Comptes jetables trouves : ${candidates.length}`);
  console.log(`A supprimer : ${toDelete.length}`);
  for (const u of toDelete) console.log(`  - ${u.email} · cree le ${u.created_at.slice(0, 10)} · id ${u.id}`);
  if (kept.length) {
    console.log(`Gardes (a examiner a la main) : ${kept.length}`);
    for (const u of kept) {
      const why = superadmins.has(u.id) ? "superadmin" : `possede : ${owners.get(u.id)!.join(", ")}`;
      console.log(`  - ${u.email} · ${why} · id ${u.id}`);
    }
  }

  if (!CONFIRMER) {
    console.log("\nRien n'a ete supprime. Relancer avec --confirmer pour supprimer la liste ci-dessus.");
    return;
  }

  let ok = 0;
  const failures: string[] = [];
  for (const u of toDelete) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    // Un refus de la base (donnees creees par ce compte) est rapporte, jamais avale.
    if (error) failures.push(`${u.email} : ${error.message}`);
    else ok++;
  }
  console.log(`\nSupprimes : ${ok} / ${toDelete.length}`);
  if (failures.length) {
    console.log(`Echecs : ${failures.length}`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
