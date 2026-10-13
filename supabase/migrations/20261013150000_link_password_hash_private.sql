-- V3.1-142 — le hash du mot de passe d'un lien ne sort plus jamais de la base
-- vers un visiteur.
--
-- Constat : `public.resolve_share_link` et `public.resolve_campaign_invite`
-- sont exécutables par `anon` et renvoient `password_hash`. Quiconque a le
-- lien pouvait appeler l'API avec la clé publique, lire le hash, et :
-- - essayer des mots de passe hors ligne, sans compteur de tentatives ;
-- - (depuis V3.1-142) fabriquer la preuve signée du cookie, dont ce hash est
--   la clé.
-- Désormais seul le serveur lit le hash, par la clé service, depuis les seuls
-- fichiers qui y ont droit (`publicShare.ts`, `accountProvisioning.ts`).

-- 1. Lien de partage : la fonction n'est plus appelée que par le serveur
--    (`publicShare.ts`, clé service). Les visiteurs n'y ont plus accès.
revoke execute on function public.resolve_share_link(text) from anon, authenticated;
grant usage on schema app to service_role;
grant execute on function public.resolve_share_link(text) to service_role;
grant execute on function app.resolve_share_link(text) to service_role;

-- 2. Lien d'invitation : la page `/rejoindre` le résout avec le client du
--    visiteur (pas encore de compte), elle garde donc sa fonction, mais SANS
--    le hash : `has_password` dit seulement s'il y en a un. Changer les
--    colonnes d'une fonction exige de la supprimer d'abord.
drop function if exists public.resolve_campaign_invite(text);

create function public.resolve_campaign_invite(p_token text)
returns table (
  id uuid,
  campaign_id uuid,
  world_id uuid,
  intended_role text,
  claimed_by_user_id uuid,
  claimed_name text,
  has_password boolean,
  password_attempts int
)
language sql
stable
security definer
set search_path = public, app
as $$
  select r.id, r.campaign_id, r.world_id, r.intended_role, r.claimed_by_user_id, r.claimed_name,
         r.password_hash is not null, r.password_attempts
    from app.resolve_campaign_invite(p_token) r;
$$;

revoke execute on function public.resolve_campaign_invite(text) from public;
grant execute on function public.resolve_campaign_invite(text) to anon, authenticated;

-- La fonction interne, qui porte le hash, n'est plus exécutable que par le
-- propriétaire des fonctions (l'enveloppe ci-dessus, `security definer`) et
-- par la clé service.
revoke execute on function app.resolve_campaign_invite(text) from anon, authenticated;
grant execute on function app.resolve_campaign_invite(text) to service_role;

-- 3. Le hash d'une invitation, pour le serveur SEUL (vérifier un mot de
--    passe, signer ou contrôler la preuve du cookie).
create function public.campaign_invite_password_hash(p_token text)
returns text
language sql
stable
security definer
set search_path = public, app
as $$
  select r.password_hash from app.resolve_campaign_invite(p_token) r limit 1;
$$;

revoke execute on function public.campaign_invite_password_hash(text) from public, anon, authenticated;
grant execute on function public.campaign_invite_password_hash(text) to service_role;
