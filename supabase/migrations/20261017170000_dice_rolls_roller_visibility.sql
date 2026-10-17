-- V3.1-33 (ADR 0038) — le jet secret d'un joueur.
--
-- L'outil de dés unique porte un interrupteur « Secret » pour tout le
-- monde. Jusqu'ici `dice_rolls.visibility_level` ne connaissait que
-- `public` et `gm` (MJ seul) : un joueur qui cachait son jet ne l'aurait
-- plus vu lui-même, et la RLS le lui refusait de toute façon à l'écriture.
--
-- Nouveau niveau `roller` : lisible du lanceur (`rolled_by_user_id`, posé
-- par la base depuis V3.1-89, jamais par le client) et du MJ. La RLS filtre
-- à la lecture comme au temps réel (les changements Realtime passent par
-- la même politique) : aucun secret n'est envoyé puis caché à l'écran.
-- `gm` ne change pas.

alter table dice_rolls drop constraint dice_rolls_visibility_level_check;
alter table dice_rolls
  add constraint dice_rolls_visibility_level_check check (visibility_level in ('public', 'gm', 'roller'));

comment on column dice_rolls.visibility_level is '''public'' : tout membre de la campagne ; ''gm'' : le MJ seul ; ''roller'' (V3.1-33, ADR 0038) : le lanceur (rolled_by_user_id) et le MJ.';

drop policy dice_rolls_select on dice_rolls;
create policy dice_rolls_select on dice_rolls for select
  using (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and (
      visibility_level = 'public'
      or (visibility_level = 'roller' and rolled_by_user_id = auth.uid())
      or app.is_world_admin(app.campaign_world_id(campaign_id))
    )
  );

-- Même politique que V3.1-89, un niveau de plus permis à tout membre :
-- `roller` ne cache le jet qu'aux AUTRES joueurs, et le lanceur est
-- forcément l'appelant (`rolled_by_user_id is not distinct from auth.uid()`).
drop policy dice_rolls_insert on dice_rolls;
create policy dice_rolls_insert on dice_rolls for insert
  with check (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and (visibility_level in ('public', 'roller') or app.is_world_admin(app.campaign_world_id(campaign_id)))
    and rolled_by_user_id is not distinct from auth.uid()
    and (
      entity_id is null
      or (app.entity_world_id(entity_id) = app.campaign_world_id(campaign_id) and app.can_edit_entity(entity_id))
    )
  );
