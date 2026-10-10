// Supprime les ANCIENS comptes jetables des tests (docs/TESTS.md §5) : les
// adresses `…@creadonjon.local` creees par les tests d'integration d'avant le
// groupe fixe de comptes, restees quand un test plantait avant son nettoyage.
//
// Lancement : npm run supprimer:comptes-jetables            (liste seulement)
//             npm run supprimer:comptes-jetables -- --confirmer   (supprime)
//
// Deux options, chacune a ajouter explicitement :
// --avec-mondes  supprime AUSSI les mondes (et tout leur contenu, en cascade)
//                des comptes jetables qui en possedent : des mondes de test
//                laisses par un test qui a plante avant son nettoyage.
// --ids a,b,c    supprime en plus ces comptes precis, designes par l'auteur.
//                Seulement des comptes « tag » ou d'invitation (email
//                synthetique), jamais un superadmin, jamais un proprietaire
//                de monde : le script refuse sinon.
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
const AVEC_MONDES = process.argv.includes("--avec-mondes");
const idsArgIndex = process.argv.indexOf("--ids");
const EXTRA_IDS = idsArgIndex >= 0 ? (process.argv[idsArgIndex + 1] ?? "").split(",").map((x) => x.trim()).filter(Boolean) : [];

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

function isSynthetic(email: string): boolean {
  return /@creadonjon\.(tag|invite)$/i.test(email);
}

async function main() {
  const allUsers = await listAllUsers();
  const candidates = allUsers.filter((u) => isDisposable(u.email ?? ""));
  const extras = EXTRA_IDS.map((id) => ({ id, user: allUsers.find((u) => u.id === id) }));
  const ids = [...candidates.map((u) => u.id), ...extras.filter((e) => e.user).map((e) => e.id)];
  const [{ data: profiles, error: pErr }, { data: worlds, error: wErr }] = await Promise.all([
    admin.from("profiles").select("id, account_role, display_name, handle_name, handle_tag").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("worlds").select("owner_id, name").in("owner_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  if (pErr || wErr) throw new Error(`lecture : ${(pErr ?? wErr)?.message}`);

  const superadmins = new Set((profiles ?? []).filter((p) => p.account_role === "superadmin").map((p) => p.id));
  const owners = new Map<string, string[]>();
  for (const w of worlds ?? []) owners.set(w.owner_id, [...(owners.get(w.owner_id) ?? []), w.name]);

  const nameOf = (id: string): string => {
    const p = (profiles ?? []).find((row) => row.id === id);
    return p?.handle_name ? `${p.handle_name}#${p.handle_tag ?? "?"}` : p?.display_name || "(sans nom)";
  };
  // Jetables proprietaires d'un monde : supprimes avec leurs mondes seulement si --avec-mondes.
  const toDelete = candidates.filter((u) => !superadmins.has(u.id) && (!owners.has(u.id) || AVEC_MONDES));
  const kept = candidates.filter((u) => superadmins.has(u.id) || (owners.has(u.id) && !AVEC_MONDES));

  // Comptes designes par l'auteur : refus explicite de tout ce qui sort du perimetre.
  const refused: string[] = [];
  for (const e of extras) {
    if (!e.user) refused.push(`${e.id} : introuvable`);
    else if (!isSynthetic(e.user.email ?? "")) refused.push(`${e.id} (${nameOf(e.id)}) : email reel, jamais par ce script`);
    else if (superadmins.has(e.id)) refused.push(`${e.id} (${nameOf(e.id)}) : superadmin`);
    else if (owners.has(e.id)) refused.push(`${e.id} (${nameOf(e.id)}) : possede ${owners.get(e.id)!.join(", ")}`);
    else toDelete.push(e.user);
  }

  console.log(`Comptes jetables trouves : ${candidates.length}`);
  console.log(`A supprimer : ${toDelete.length}`);
  for (const u of toDelete) {
    const worldsOwned = owners.get(u.id);
    console.log(`  - ${nameOf(u.id)} · ${u.email} · cree le ${u.created_at.slice(0, 10)} · id ${u.id}${worldsOwned ? ` · AVEC ses mondes : ${worldsOwned.join(", ")}` : ""}`);
  }
  if (refused.length) {
    console.log(`Refuses (ids designes hors perimetre) : ${refused.length}`);
    for (const r of refused) console.log(`  - ${r}`);
  }
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
    if (owners.has(u.id)) {
      // Seulement les jetables (`@creadonjon.local`) et seulement avec --avec-mondes :
      // les ids designes proprietaires d'un monde ont ete refuses plus haut.
      const { error: worldError } = await admin.from("worlds").delete().eq("owner_id", u.id);
      if (worldError) {
        failures.push(`${u.email} : mondes non supprimes (${worldError.message}), compte garde`);
        continue;
      }
    }
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
