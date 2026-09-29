-- V3.1-10 (etape 2/8, ADR 0031) — comptes "tag" a mot de passe natif,
-- liens joueurs reutilisables, reinitialisation mediee par jeton.

-- =====================================================================
-- 1. profiles : identite "tag" (nom + 4 chiffres), reinitialisation
-- =====================================================================

alter table profiles
  add column handle_name text,
  add column handle_tag text,
  add column must_change_password boolean not null default false,
  add column password_reset_requested_at timestamptz;

comment on column profiles.handle_name is 'Nom affiche (V3.1-10) : pas unique seul, jamais utilise pour se connecter sans le mot de passe correspondant.';
comment on column profiles.handle_tag is '4 chiffres genere automatiquement (#0000-#9999), unique avec handle_name. Attribution interne uniquement : jamais affiche ailleurs que dans les reglages du compte concerne (ticket critere).';
comment on column profiles.must_change_password is 'Pose par une reinitialisation forcee (MJ/superadmin, V3.1-10) : force le choix d''un nouveau mot de passe a la prochaine connexion, jamais de connexion automatique sur le mot de passe temporaire.';
comment on column profiles.password_reset_requested_at is 'Horodatage d''une demande "mot de passe oublie" deposee depuis /login (V3.1-10) — jamais un jeton utilisable, seulement un signal lu par le panneau MJ/superadmin competent. NULL = aucune demande en attente.';

-- Genere un tag a 4 chiffres unique pour ce handle_name, reessaie en cas de
-- collision (critere du ticket) — reutilise a la fois par le trigger de
-- creation de compte ci-dessous et par le backfill des comptes existants,
-- une seule implementation de la boucle de collision.
create or replace function app.generate_unique_handle_tag(p_handle_name text)
returns text
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_tag text;
  v_attempts int := 0;
begin
  loop
    v_tag := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (
      select 1 from profiles where handle_name = p_handle_name and handle_tag = v_tag
    );
    v_attempts := v_attempts + 1;
    if v_attempts > 50 then
      raise exception 'app.generate_unique_handle_tag: pas de tag libre pour %', p_handle_name;
    end if;
  end loop;
  return v_tag;
end;
$$;

-- Chaque compte en a un des sa creation, ordinaire ou "tag" (ticket : "y
-- compris celui de l'auteur") — etend le trigger existant plutot que d'en
-- ajouter un second, meme insertion.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_handle_name text;
begin
  v_handle_name := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Compte');
  insert into public.profiles (id, display_name, handle_name, handle_tag)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    v_handle_name,
    app.generate_unique_handle_tag(v_handle_name)
  );
  return new;
end;
$$;

-- Backfill des comptes deja crees (base de test = production, ADR "migrations
-- appliquees a la main") : un nom issu de ce qui existe deja, jamais invente.
do $$
declare
  r record;
begin
  for r in select id, display_name from profiles where handle_name is null order by created_at loop
    update profiles
      set handle_name = coalesce(nullif(trim(r.display_name), ''), 'Compte'),
          handle_tag = app.generate_unique_handle_tag(coalesce(nullif(trim(r.display_name), ''), 'Compte'))
      where id = r.id;
  end loop;
end $$;

-- L'auteur (ticket : "Gabriel#0000", tag fixe choisi a la main) — apres le
-- backfill generique, pour ne jamais etre ecrase par lui.
update profiles set handle_name = 'Gabriel', handle_tag = '0000'
where id = (select id from auth.users where email = 'gabs19mass@gmail.com');

alter table profiles
  alter column handle_name set not null,
  alter column handle_tag set not null,
  add constraint profiles_handle_unique unique (handle_name, handle_tag);

-- Resolution de connexion (ecran unique, ni session ni email connu au
-- moment de l'appel) : les emails (toujours synthetiques pour un compte
-- "tag") de chaque compte portant ce nom, dans l'ordre de creation — le
-- serveur de connexion essaie `signInWithPassword` sur chacun avant de
-- retomber sur le texte tape comme un email classique. Ne revele jamais
-- l'existence d'un nom : une liste vide et un mot de passe faux se
-- comportent a l'identique cote appelant.
create or replace function app.resolve_login_emails(p_handle_name text)
returns table (email text)
language sql
stable
security definer
set search_path = public, app
as $$
  select u.email
  from profiles p
  join auth.users u on u.id = p.id
  where p.handle_name = p_handle_name
  order by p.created_at;
$$;

revoke execute on function app.resolve_login_emails(text) from public;
grant execute on function app.resolve_login_emails(text) to anon, authenticated;

create or replace function public.resolve_login_emails(p_handle_name text)
returns table (email text)
language sql
stable
security invoker
set search_path = public
as $$
  select * from app.resolve_login_emails(p_handle_name);
$$;

revoke execute on function public.resolve_login_emails(text) from public;
grant execute on function public.resolve_login_emails(text) to anon, authenticated;

-- Depot d'une demande "mot de passe oublie" par nom (ecran de connexion,
-- SANS session) : reponse neutre que le nom corresponde ou non a un
-- compte (meme discipline que app/auth/forgot-password/actions.ts pour
-- les comptes ordinaires) — pose le drapeau sur CHAQUE compte "tag"
-- portant ce nom plutot que d'exiger de lever l'ambiguite ici ; le MJ/
-- superadmin qui la voit reconnait sa propre joueuse dans son panneau.
create or replace function app.request_password_reset_by_name(p_handle_name text)
returns void
language sql
security definer
set search_path = public, app
as $$
  update profiles set password_reset_requested_at = now() where handle_name = p_handle_name;
$$;

revoke execute on function app.request_password_reset_by_name(text) from public;
grant execute on function app.request_password_reset_by_name(text) to anon, authenticated;

create or replace function public.request_password_reset_by_name(p_handle_name text)
returns void
language sql
security invoker
set search_path = public
as $$
  select app.request_password_reset_by_name(p_handle_name);
$$;

revoke execute on function public.request_password_reset_by_name(text) from public;
grant execute on function public.request_password_reset_by_name(text) to anon, authenticated;

-- =====================================================================
-- 2. campaign_invites : le role "player" perd sa semantique "reclame une
--    seule fois" (ADR 0031, renverse V2-M4) — pas de colonne a changer,
--    seule l'application cesse d'ecrire/lire claimed_by_user_id pour ce
--    role. "Qui a rejoint via ce lien" redevient une lecture de
--    campaign_members, deja la source de verite.
-- =====================================================================

comment on column campaign_invites.claimed_by_user_id is 'Pour un lien de role gm : le seul compte qui a reclame ce lien (usage unique, inchange). Pour un lien de role player (V3.1-10, reutilisable) : NON MAINTENU, campaign_members fait foi de qui a rejoint.';
comment on column campaign_invites.claimed_name is 'Idem claimed_by_user_id : pertinent seulement pour un lien de role gm depuis V3.1-10.';

-- Revoquer UNE joueuse = l'expulser du monde, jamais toucher au lien
-- (V3.1-10, ADR 0031) : liberer son personnage + retirer son adherence,
-- rien de plus. Distinct de app.revoke_campaign_invite_access (qui barre
-- le JETON, toujours correct pour un lien MJ nominatif, plus pour un lien
-- joueur reutilisable ou d'autres personnes doivent continuer a l'utiliser).
-- Meme discipline que app.revoke_campaign_invite_access : une fonction,
-- une transaction, le droit verifie a l'interieur.
create or replace function app.revoke_campaign_member(p_campaign_id uuid, p_user_id uuid)
returns table (allowed boolean, released_character boolean, removed_member boolean)
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_world uuid;
  v_released int := 0;
  v_removed int := 0;
begin
  v_world := app.campaign_world_id(p_campaign_id);

  if v_world is null or not (app.is_superadmin() or app.is_world_admin(v_world)) then
    return query select false, false, false;
    return;
  end if;

  update campaign_characters
    set user_id = null
    where campaign_id = p_campaign_id and user_id = p_user_id;
  get diagnostics v_released = row_count;

  delete from campaign_members
    where campaign_id = p_campaign_id and user_id = p_user_id;
  get diagnostics v_removed = row_count;

  return query select true, v_released > 0, v_removed > 0;
end;
$$;

revoke execute on function app.revoke_campaign_member(uuid, uuid) from public;
grant execute on function app.revoke_campaign_member(uuid, uuid) to authenticated;

create or replace function public.revoke_campaign_member(p_campaign_id uuid, p_user_id uuid)
returns table (allowed boolean, released_character boolean, removed_member boolean)
language sql
security invoker
set search_path = public
as $$
  select * from app.revoke_campaign_member(p_campaign_id, p_user_id);
$$;

revoke execute on function public.revoke_campaign_member(uuid, uuid) from public;
grant execute on function public.revoke_campaign_member(uuid, uuid) to authenticated;

-- =====================================================================
-- 3. Jetons de reinitialisation a usage unique (ADR 0031 §5) — meme
--    primitive que campaign_invites (src/core/campaignInvites/token.ts),
--    jamais le jeton en clair conserve (contrairement a campaign_invites :
--    un secret de reinitialisation, pas un lien permanent a recopier).
--    RLS activee SANS AUCUNE politique : seul le client service-role
--    confine (lib/supabase/serviceAccountAuth.ts, ADR 0031 §6) y touche,
--    meme discipline que accountProvisioning.ts pour campaign_invites.
-- =====================================================================

create table account_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token_hash  text not null unique,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);

comment on table account_reset_tokens is 'Jetons "Forcer une reinitialisation" (V3.1-10, ADR 0031) — usage unique, jamais lu ni ecrit hors du client service-role confine (src/server/services/accountAuth.ts).';

alter table account_reset_tokens enable row level security;
