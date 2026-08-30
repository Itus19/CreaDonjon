-- V2-M4 (Lot M) — liens d'invitation nominatifs (sans email/mot de passe
-- pour l'invite) + resserrement prealable de `campaign_characters_write`.

-- Prealable note en ecrivant V2-M3 : n'importe quel membre du monde peut
-- aujourd'hui reassigner ou liberer N'IMPORTE QUELLE ligne
-- `campaign_characters`, pas seulement la sienne. Sans consequence tant
-- qu'aucun ami n'a de compte ; devient exploitable des ce ticket (un ami
-- pourrait voler la fiche PJ d'un autre en forgeant une requete). Un MJ
-- (`is_world_admin`) garde tout ; un joueur ne peut plus toucher qu'une
-- ligne libre (`user_id is null`, pour la reclamer) ou SA PROPRE ligne
-- (`user_id = auth.uid()`), jamais celle d'un autre.
drop policy campaign_characters_write on campaign_characters;

create policy campaign_characters_write on campaign_characters for all
  using (
    app.is_world_admin(app.campaign_world_id(campaign_id))
    or user_id = auth.uid()
    or user_id is null
  )
  with check (
    app.is_world_admin(app.campaign_world_id(campaign_id))
    or user_id = auth.uid()
  );

create table campaign_invites (
  id                 uuid primary key default gen_random_uuid(),
  -- L'un des deux au moins : `campaign_id` pour rejoindre une campagne (PJ
  -- ou MJ humain de cette campagne precise), `world_id` pour rejoindre un
  -- monde comme editeur (V2-M8, amis MJ testeurs) sans etre membre d'une
  -- campagne particuliere.
  campaign_id        uuid references campaigns(id) on delete cascade,
  world_id           uuid references worlds(id) on delete cascade,
  token_hash         text not null unique,
  intended_role      text check (intended_role in ('gm', 'player')),
  -- Rempli au premier passage (src/server/services/accountProvisioning.ts) :
  -- le jeton reste ensuite la porte d'entree PERMANENTE de cette personne,
  -- jamais un usage unique — rouvrir le meme lien plus tard, depuis
  -- n'importe quel appareil, reconnecte ce meme compte.
  claimed_by_user_id uuid references auth.users(id),
  claimed_name       text,
  revoked_at         timestamptz,
  created_by         uuid not null references auth.users(id),
  created_at         timestamptz not null default now(),
  constraint campaign_invites_target_ck check (campaign_id is not null or world_id is not null)
);

alter table campaign_invites enable row level security;

-- Gerer ses propres invitations (les lister, en creer, les revoquer) est
-- un geste de MJ/superadmin — jamais quelque chose qu'un simple joueur
-- consulte ou modifie directement sur cette table (il passe par le lien
-- lui-meme, resolu par la fonction ci-dessous, jamais par une lecture SQL
-- directe).
create policy campaign_invites_select on campaign_invites for select
  using (
    (campaign_id is not null and app.is_world_admin(app.campaign_world_id(campaign_id)))
    or (world_id is not null and app.is_world_admin(world_id))
  );

create policy campaign_invites_write on campaign_invites for all
  using (
    (campaign_id is not null and app.is_world_admin(app.campaign_world_id(campaign_id)))
    or (world_id is not null and app.is_world_admin(world_id))
  )
  with check (
    (campaign_id is not null and app.is_world_admin(app.campaign_world_id(campaign_id)))
    or (world_id is not null and app.is_world_admin(world_id))
  );

-- Resolution d'un jeton par une personne SANS SESSION (meme necessite que
-- `app.resolve_share_link`, migration 20260801140001) : la RLS ci-dessus
-- refuserait systematiquement l'acces, meme pour verifier un jeton valide.
-- Un jeton revoque ne resout a rien (meme choix que le partage public :
-- ne jamais reveler si un jeton a existe, seulement s'il fonctionne).
-- Hachage identique cote ecriture (src/core/campaignInvites/token.ts) et
-- cote resolution : une seule implementation du "jeton en clair -> hache".
create or replace function app.resolve_campaign_invite(p_token text)
returns table (
  id uuid,
  campaign_id uuid,
  world_id uuid,
  intended_role text,
  claimed_by_user_id uuid,
  claimed_name text
)
language plpgsql
stable
security definer
set search_path = public, app
as $$
begin
  return query
    select ci.id, ci.campaign_id, ci.world_id, ci.intended_role, ci.claimed_by_user_id, ci.claimed_name
    from campaign_invites ci
    where ci.token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and ci.revoked_at is null;
end;
$$;

revoke execute on function app.resolve_campaign_invite(text) from public;
grant execute on function app.resolve_campaign_invite(text) to anon, authenticated;

-- Wrapper mince expose via PostgREST (le schema `app` n'est jamais expose
-- directement — meme patron que public.resolve_share_link).
create or replace function public.resolve_campaign_invite(p_token text)
returns table (
  id uuid,
  campaign_id uuid,
  world_id uuid,
  intended_role text,
  claimed_by_user_id uuid,
  claimed_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  select * from app.resolve_campaign_invite(p_token);
$$;

revoke execute on function public.resolve_campaign_invite(text) from public;
grant execute on function public.resolve_campaign_invite(text) to anon, authenticated;
