-- Phase F2 (Lot I) — migre le portrait d'une fiche de `entity_portraits`
-- (bytea, jamais branche a un vrai stockage) vers `entity_assets`
-- (entity_id, asset_id, role) + `assets`/Storage, deja construits pour les
-- cartes (ADR 0017 decision 3). `entity_assets.role` acceptait deja
-- 'portrait' depuis sa creation (migration 011, jamais cablee) : c'est
-- precisement la ligne prevue pour cet usage.
--
-- Colonnes de mise en page (V2-G11, `display_size_pct`/`align`) migrees
-- depuis `entity_portraits` telles quelles -- elles decrivent l'affichage
-- du LIEN entite/portrait, pas l'image elle-meme, donc suivent le
-- pointeur plutot que `assets` (un meme asset pourrait un jour, en theorie,
-- etre reutilise avec une mise en page differente ailleurs).
alter table entity_assets
  add column display_size_pct int not null default 100 check (display_size_pct between 50 and 200),
  add column align text not null default 'right' check (align in ('left', 'right'));

-- Un seul portrait par fiche (meme garantie que l'ancienne cle primaire
-- `entity_portraits.entity_id`) -- un remplacement passe par supprimer puis
-- reinserer la ligne (l'`asset_id` change a chaque televersement, jamais un
-- UPDATE en place), jamais par un upsert sur cet index.
create unique index entity_assets_one_portrait on entity_assets(entity_id) where role = 'portrait';

-- Portrait toujours public, y compris pour un visiteur anonyme du wiki
-- partage (meme garantie que l'ancienne `entity_portraits_select using
-- (true)`) : la route qui sert `/api/entities/[id]/portrait` doit pouvoir
-- resoudre l'`asset_id` de CETTE ligne sans etre membre du monde. Politique
-- additive (PostgreSQL agrege les politiques SELECT permissives d'une
-- meme table par OR) : la politique `entity_assets_select` existante
-- (membre du monde) reste inchangee pour tout le reste (banner/gallery/map,
-- pas encore utilises).
create policy entity_assets_select_portrait on entity_assets for select
  using (role = 'portrait');
