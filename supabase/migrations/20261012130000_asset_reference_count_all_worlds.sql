-- V3-F3 (ADR 0058, corrige ADR 0057) — le compte des references d'une image
-- cherche dans TOUS les mondes, plus seulement dans celui de l'image.
--
-- « Dupliquer » recopiait les donnees des blocs telles quelles : une carte
-- d'un monde copie avant l'ADR 0058 designe encore l'image du monde
-- d'origine. Compter dans le seul monde de l'image aurait fait effacer cette
-- image quand on remplace la carte dans l'original, alors que la copie
-- l'affiche encore. Les copies faites desormais recoivent leurs propres
-- images, mais les anciennes restent : on compte partout.
--
-- Rien d'autre ne change : appelant membre du monde de l'image, sinon `null`
-- (« inconnu », on n'efface rien) ; la fonction ne renvoie qu'un nombre,
-- jamais une ligne, meme si elle lit des blocs d'autres mondes.
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
        where strpos(b.data::text, p_asset_id::text) > 0)
    + (select count(*) from block_images where asset_id = p_asset_id)
    + (select count(*) from entity_assets where asset_id = p_asset_id)
    + (select count(*) from background_images where asset_id = p_asset_id);
end;
$$;
