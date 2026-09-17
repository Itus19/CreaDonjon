-- V2.1-25 (lot 1) — « Revoquer » retire vraiment l'acces.
--
-- Constat : `revokeCampaignInvite` posait `revoked_at` et RIEN d'autre. Le
-- jeton cessait d'ouvrir une session (`app.resolve_campaign_invite` filtre
-- `revoked_at is null`), mais tout ce que la reclamation avait ecrit
-- survivait — `campaign_members`, `campaign_characters.user_id`, et pour un
-- lien MJ de niveau monde `world_members`. Or `app.is_world_member` compte
-- les membres de campagne (migration 20260804150002) : le monde restait donc
-- ouvert a la personne "revoquee", dont la session continuait de fonctionner.
--
-- Decision de l'auteur (17 septembre), prise sur quatre options : revoquer
-- retire l'acces. Le COMPTE survit — c'est ce qui distingue ce geste de
-- « Supprimer le compte », qui reste superadmin.
--
-- Pourquoi une fonction et non trois requetes a la file : ce sont trois
-- ecritures sur trois tables pour une operation de securite, et un etat a
-- moitie applique laisserait quelqu'un avec un acces qu'il ne devrait plus
-- avoir. Une fonction, une transaction.
--
-- `security definer` oblige a verifier le droit ICI, jamais a s'en remettre
-- a la RLS de l'appelant — meme discipline que
-- `app.set_campaign_invite_password` (migration 20260830160001). Les
-- politiques existantes autoriseraient d'ailleurs ces ecritures au MJ
-- (`campaign_members_write`, `campaign_characters_write`, toutes deux sur
-- `app.is_world_admin`) : rien a elargir, et ce controle reproduit exactement
-- la meme borne.
--
-- `claimed_by_user_id` est volontairement CONSERVE : il dit qui s'est servi
-- de ce lien, et l'effacer rendrait le jeton reclamable a nouveau — ce qui
-- est une autre operation, non demandee (voir « Ce que ce ticket ne fait
-- pas », V2.1-25).

create function app.revoke_campaign_invite_access(p_invite_id uuid)
returns table (
  allowed boolean,
  revoked boolean,
  released_character boolean,
  removed_member boolean,
  removed_world_member boolean
)
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_campaign uuid;
  v_invite_world uuid;
  v_world uuid;
  v_user uuid;
  v_released int := 0;
  v_removed int := 0;
  v_removed_world int := 0;
  v_revoked int := 0;
begin
  select ci.campaign_id, ci.world_id, ci.claimed_by_user_id
    into v_campaign, v_invite_world, v_user
  from campaign_invites ci
  where ci.id = p_invite_id;

  -- Introuvable et interdit renvoient la meme chose : un appelant sans droit
  -- n'apprend pas si l'identifiant existe.
  if not found then
    return query select false, false, false, false, false;
    return;
  end if;

  v_world := coalesce(app.campaign_world_id(v_campaign), v_invite_world);

  if v_world is null or not app.is_world_admin(v_world) then
    return query select false, false, false, false, false;
    return;
  end if;

  -- L'acces part AVANT le drapeau : si la transaction echouait malgre tout,
  -- mieux vaut un lien encore visible dans la liste (donc que le MJ peut
  -- reessayer) qu'un lien barre dont la personne garde l'acces.
  if v_user is not null then
    if v_campaign is not null then
      update campaign_characters
        set user_id = null
        where campaign_id = v_campaign and user_id = v_user;
      get diagnostics v_released = row_count;

      delete from campaign_members
        where campaign_id = v_campaign and user_id = v_user;
      get diagnostics v_removed = row_count;
    end if;

    -- Un lien MJ de niveau monde (V2-M8) ecrit `world_members` a la
    -- reclamation : le laisser en place rendrait cette revocation-la
    -- purement cosmetique, exactement le defaut que ce ticket corrige.
    if v_invite_world is not null then
      delete from world_members
        where world_id = v_invite_world and user_id = v_user;
      get diagnostics v_removed_world = row_count;
    end if;
  end if;

  update campaign_invites
    set revoked_at = now()
    where id = p_invite_id and revoked_at is null;
  get diagnostics v_revoked = row_count;

  return query select true, v_revoked > 0, v_released > 0, v_removed > 0, v_removed_world > 0;
end;
$$;

revoke execute on function app.revoke_campaign_invite_access(uuid) from public;
grant execute on function app.revoke_campaign_invite_access(uuid) to authenticated;

create function public.revoke_campaign_invite_access(p_invite_id uuid)
returns table (
  allowed boolean,
  revoked boolean,
  released_character boolean,
  removed_member boolean,
  removed_world_member boolean
)
language sql
security invoker
set search_path = public
as $$
  select * from app.revoke_campaign_invite_access(p_invite_id);
$$;

revoke execute on function public.revoke_campaign_invite_access(uuid) from public;
grant execute on function public.revoke_campaign_invite_access(uuid) to authenticated;
