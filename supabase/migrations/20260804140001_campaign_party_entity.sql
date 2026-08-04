-- V1-C1 : lien entre une campagne et l'entite `faction` qui represente son
-- groupe de joueurs (docs/adr/0008-campagne-entite-faction.md). Nullable :
-- une campagne peut exister brievement sans sa faction le temps de sa
-- creation transactionnelle, jamais par choix delibere du modele de donnees.

alter table campaigns
  add column party_entity_id uuid references entities(id) on delete set null;

-- Invitation d'un joueur (V1-C1) : `campaign_members.user_id` exige un
-- compte deja existant (FK vers auth.users), et `profiles` ne peut pas
-- servir de repertoire — sa politique RLS ne laisse lire que sa propre
-- ligne (`profiles_select`, migration 20260730150001). La seule facon de
-- verifier qu'un email correspond a un compte, sans jamais lire
-- `auth.users` depuis l'application (CLAUDE.md, SCHEMA.md §3) ni elargir la
-- portee du client service_role (CLAUDE.md regle 4 ter, confine a
-- publicShare.ts), est cette fonction etroite : elle ne renvoie qu'un id,
-- rien d'autre — meme patron que app.resolve_share_link (migration
-- 20260801140001).
create or replace function app.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, app
as $$
  select id from auth.users where email = p_email limit 1;
$$;

revoke execute on function app.find_user_id_by_email(text) from public;
grant execute on function app.find_user_id_by_email(text) to authenticated;

-- Wrapper mince expose via PostgREST (le schema `app` n'est jamais expose
-- directement — meme raison que public.resolve_share_link).
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select app.find_user_id_by_email(p_email);
$$;

revoke execute on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to authenticated;
