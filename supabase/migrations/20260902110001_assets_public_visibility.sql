-- Corrige un acces anonyme casse sur `assets` (decouvert en preparant la
-- Phase F2, Lot I "Les cartes" : migrer entity_portraits vers assets aurait
-- reproduit le meme bug sur les portraits).
--
-- `assets_select` (20260804150001_visibility_rls_descent.sql) exige
-- `app.is_world_member(world_id) AND app.visibility_permits(...)`. Mais
-- `app.visibility_permits` retourne deja `true` sans condition pour
-- `visibility_level = 'public'` (c'est le sens meme de "public" : visible
-- par un visiteur anonyme du wiki partage, `/partage/[token]`, qui n'a par
-- definition aucune ligne dans `world_members`). Le `AND is_world_member`
-- annule ce cas precis : un asset public existe en base, mais reste 404
-- pour quiconque n'est pas deja membre du monde -- y compris un visiteur
-- anonyme via un lien de partage valide. C'etait invisible jusqu'ici car
-- tous les "Verifie en direct" du Lot I se sont faits depuis une session MJ
-- connectee (`/apercu`, pas `/partage`), ou `is_world_member` est toujours
-- vrai de toute facon.
--
-- Correction : n'exiger `is_world_member` que pour les niveaux non-publics
-- (ou `visibility_permits` re-derive de toute facon l'appartenance via
-- `worlds`/`world_members`, donc `is_world_member` n'y ajoutait deja rien).
-- Pour 'public', on s'aligne explicitement sur ce que `visibility_permits`
-- dit deja. Meme correction, meme raisonnement, sur `storage.objects` (le
-- fichier reel du bucket) -- l'ancienne politique n'y verifiait meme pas le
-- niveau de visibilite de l'asset, seulement l'appartenance au monde.
drop policy if exists assets_select on assets;
create policy assets_select on assets for select
  using (
    assets.visibility_level = 'public'
    or (
      app.is_world_member(assets.world_id)
      and app.visibility_permits(assets.world_id, assets.visibility_level, assets.visibility_scope_id, assets.uploaded_by)
    )
  );

drop policy if exists assets_bucket_select on storage.objects;
create policy assets_bucket_select on storage.objects for select
  using (
    bucket_id = 'assets'
    and exists (
      select 1 from assets a
      where a.storage_path = storage.objects.name
        and (
          a.visibility_level = 'public'
          or (
            app.is_world_member(a.world_id)
            and app.visibility_permits(a.world_id, a.visibility_level, a.visibility_scope_id, a.uploaded_by)
          )
        )
    )
  );
