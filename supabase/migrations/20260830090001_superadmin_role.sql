-- V2-M2 (Lot M) — role superadmin, socle du ticket hors serie "comptes et
-- acces multi-joueurs" (docs/BACKLOG_V2.md). Un seul compte, pose a la
-- main ici, jamais via une interface de self-service : promouvoir un
-- second superadmin exige une nouvelle migration.

alter table profiles add column account_role text not null default 'member'
  check (account_role in ('member', 'superadmin'));

-- Aucune ligne mise a jour si ce compte n'existe pas encore dans cet
-- environnement (base fraiche d'un autre developpeur, par exemple) :
-- l'UPDATE est alors un no-op silencieux, jamais une erreur de migration.
update profiles set account_role = 'superadmin'
where id = (select id from auth.users where email = 'gabs19mass@gmail.com');

-- Meme patron que `app.is_world_member` (20260730150001) : point d'entree
-- unique pour toute politique RLS qui doit un jour laisser le superadmin
-- traverser la logique habituelle d'appartenance (V2-M4/M5, pas encore
-- ecrites). Jamais appele depuis le code applicatif (TypeScript) : les
-- verifications cote service lisent directement `profiles.account_role`
-- via `getOwnProfile`/`isSuperadmin` (src/server/services/account.ts),
-- une lecture de table ordinaire n'ayant pas besoin d'un aller-retour RPC
-- ni d'une enveloppe `public.*` (contrairement a `delete_own_account`, qui
-- doit contourner la RLS elle-meme).
create or replace function app.is_superadmin()
returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.account_role = 'superadmin');
$$;
