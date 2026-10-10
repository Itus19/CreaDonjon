-- V3.1-101 (ADR 0040) — l'initiative se ferme aux joueurs.
--
-- Jusqu'ici (20260818120001_combats.sql, perimetre « Phase 0 »), tout membre
-- du monde lisait ET ecrivait `combats` et `combat_participants` : un joueur
-- pouvait, par l'API, lire les PV et la CA des adversaires et modifier le
-- combat. Desormais :
-- - `combats` reste LISIBLE des membres (statut, round, tour : rien de
--   secret, et c'est le signal temps reel des futurs ecrans joueurs), mais ne
--   s'ecrit que par un administrateur du monde (proprietaire, editeur ou MJ
--   de campagne : app.is_world_admin) ;
-- - `combat_participants` se lit et s'ecrit par l'administrateur seulement.
--   Les joueurs auront leur vue filtree par une fonction dediee (V3.1-102).
-- Le solo n'est pas touche : le joueur y est proprietaire du monde, donc
-- administrateur.

drop policy if exists combats_select on combats;
drop policy if exists combats_write on combats;
drop policy if exists combat_participants_select on combat_participants;
drop policy if exists combat_participants_write on combat_participants;

create policy combats_select on combats for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy combats_insert on combats for insert
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));
create policy combats_update on combats for update
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));
create policy combats_delete on combats for delete
  using (app.is_world_admin(app.campaign_world_id(campaign_id)));

create policy combat_participants_admin on combat_participants for all
  using (app.is_world_admin(app.combat_world_id(combat_id)))
  with check (app.is_world_admin(app.combat_world_id(combat_id)));
