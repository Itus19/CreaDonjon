-- Corrige un bug decouvert en direct (retour utilisateur : "L'Ancre
-- Rouillee" refusait de se supprimer, comme d'autres fiches) : la
-- suppression douce (`entities.deleted_at`) echouait TOUJOURS avec "new
-- row violates row-level security policy for table entities", quel que
-- soit le compte ou la fiche — reproduit sur une fiche neuve et vide.
--
-- `app.can_edit_entity` (utilisee par `entities_update.with check`)
-- commence par `exists (select 1 from entities e where e.id =
-- p_entity_id)` avant de verifier les droits reels. Cette sous-requete
-- retombe sous la politique `entities_select` (`deleted_at is null AND
-- is_world_member(...)`) — au moment ou `WITH CHECK` evalue la ligne
-- PROPOSEE (deja `deleted_at = now()`), cette sous-requete ne trouve plus
-- la ligne (son propre `deleted_at is null` la rejette) : le premier
-- membre du AND devient faux, `can_edit_entity` renvoie faux, la mise a
-- jour qui pose justement `deleted_at` est refusee par la politique
-- censee l'autoriser. Une fiche qui ne pose jamais `deleted_at` (renommer,
-- changer le type...) ne declenche jamais ce cas, d'ou le bug invisible
-- jusqu'a une vraie suppression testee en direct.
--
-- Corrige en retirant ce garde-fou : il est de toute facon redondant.
-- `app.entity_world_id(p_entity_id)` renvoie deja `null` si la fiche
-- n'existe pas, ce qui rend `is_world_admin(null)` et les verifications
-- `entity_grants`/`campaign_characters` (toutes deux `on delete cascade`
-- vers `entities`, ne peuvent donc pas referencer un id inexistant) faux
-- de toute facon — jamais un droit accorde a tort en retirant ce test.
create or replace function app.can_edit_entity(p_entity_id uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select
    app.is_world_admin(app.entity_world_id(p_entity_id))
    or exists (
         select 1 from campaign_characters cc
         join campaigns c on c.id = cc.campaign_id
         where c.world_id = app.entity_world_id(p_entity_id)
           and cc.entity_id = p_entity_id
           and cc.user_id = auth.uid()
       )
    or exists (select 1 from entity_grants g where g.entity_id = p_entity_id and g.user_id = auth.uid());
$$;
