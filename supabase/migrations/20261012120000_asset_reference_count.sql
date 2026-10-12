-- V3.1-128 (docs/QUOTAS.md Q5, ADR 0057) — combien de lignes designent
-- encore une image, dans TOUT son monde.
--
-- Le serveur efface l'image d'une carte remplacee ou supprimee, mais
-- seulement si plus rien ne la designe : une fiche ou un bloc duplique
-- recopie `assetId` et partage donc les images de l'original. Ce compte ne
-- peut pas se faire avec les droits de l'appelant : la RLS de `blocks`
-- (`visibility_permits`) cache certains blocs meme au MJ (`private`,
-- `user`), et une reference invisible ferait effacer une image encore
-- utilisee. D'ou `security definer` et `row_security = off`, meme motif que
-- 20260902150002.
--
-- Sans danger : la fonction ne renvoie qu'un nombre, jamais une ligne, et
-- seulement a un membre du monde de l'image. Hors de ce cas, ou si l'image
-- n'existe pas, elle renvoie `null` : « inconnu », donc on n'efface rien.
--
-- Ce qui compte comme reference :
-- - un bloc du monde dont les donnees contiennent l'identifiant, quel que
--   soit son type (une carte, ou tout futur bloc qui designerait une image)
--   et meme si sa fiche est a la corbeille (elle peut en revenir) ;
-- - `block_images`, `entity_assets` (portraits), `background_images`.
-- L'historique des fiches (`entity_revisions`) ne compte pas : il est
-- immuable et garde tout, l'image ne serait donc jamais liberee (ADR 0057).
create or replace function app.asset_reference_count(p_asset_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, app
set row_security = off
as $$
declare
  v_world_id uuid;
begin
  select world_id into v_world_id from assets where id = p_asset_id;
  if v_world_id is null or not app.is_world_member(v_world_id) then
    return null;
  end if;

  return
      (select count(*) from blocks b
         join entities e on e.id = b.entity_id
        where e.world_id = v_world_id
          and strpos(b.data::text, p_asset_id::text) > 0)
    + (select count(*) from block_images where asset_id = p_asset_id)
    + (select count(*) from entity_assets where asset_id = p_asset_id)
    + (select count(*) from background_images where asset_id = p_asset_id);
end;
$$;

revoke execute on function app.asset_reference_count(uuid) from public;
grant execute on function app.asset_reference_count(uuid) to authenticated;

-- Enveloppe mince exposee par PostgREST (le schema `app` ne l'est jamais),
-- meme patron que public.find_user_id_by_email.
create or replace function public.asset_reference_count(p_asset_id uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select app.asset_reference_count(p_asset_id);
$$;

revoke execute on function public.asset_reference_count(uuid) from public;
grant execute on function public.asset_reference_count(uuid) to authenticated;
