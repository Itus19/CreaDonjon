-- V3.1-59 (ADR 0047) — le fond par défaut du wiki d'un monde.
--
-- Une colonne sur `worlds` : `null` (aucun fond par défaut, comportement
-- d'avant), ou un objet validé par Zod côté serveur
-- (`src/core/theme/worldWikiBackground.ts`, `zWorldWikiBackground`) :
--   { source: 'builtin', key, mode, blur }
--   { source: 'world_asset', assetId, mode, blur, hue, chroma, availableModes }
-- Une image de la bibliothèque personnelle du MJ n'est jamais servie telle
-- quelle : elle est COPIÉE dans le stockage du monde, et `assetId` désigne
-- cette copie. La bibliothèque reste privée.
--
-- L'écriture suit `worlds_write` (propriétaire du monde), vérifiée aussi par
-- le service (`isWorldAdmin`). La lecture suit `worlds_select` (membres) ; le
-- wiki public la lit par `publicShare.ts`, seul porteur du service role.
alter table public.worlds add column wiki_background jsonb;

-- La copie n'est désignée QUE par cette colonne. Sans la compter ici, une
-- image de carte effacée « parce que plus rien ne la désigne » (ADR 0057)
-- ne la toucherait pas (elle ne désigne pas la copie), mais le recensement
-- des orphelines la verrait comme abandonnée. Même fonction qu'en
-- 20261012130000, avec un terme de plus.
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
    + (select count(*) from background_images where asset_id = p_asset_id)
    + (select count(*) from worlds w where w.wiki_background ->> 'assetId' = p_asset_id::text);
end;
$$;
