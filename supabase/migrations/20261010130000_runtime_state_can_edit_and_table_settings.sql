-- V3.1-108 (ADR 0043) — droits des joueurs : la base ferme, le serveur regle.
--
-- 1. L'etat de jeu (`entity_runtime_state`) et les effets actifs
--    (`entity_active_effects`) s'ecrivaient par TOUT membre du monde
--    (20260730150001_rls.sql) : une joueuse changeait, par l'API, les PV
--    d'une autre fiche ou d'un PNJ. Desormais seul celui qui peut editer la
--    fiche les ecrit (app.can_edit_entity : administrateur du monde, joueuse
--    qui a revendique ce PJ, octroi). La lecture ne change pas.
-- 2. Les reglages de table de la campagne (`campaigns.table_settings`,
--    ADR 0036 §5) : les six interrupteurs « ce que les joueurs modifient
--    eux-memes » et le plafond d'inspiration. Objet vide = les defauts de
--    `src/core/campaigns/tableSettings.ts`, appliques a la lecture. La
--    colonne suit la RLS existante de `campaigns` (ecriture par le MJ).

drop policy if exists entity_runtime_state_write on entity_runtime_state;
create policy entity_runtime_state_write on entity_runtime_state for all
  using (app.can_edit_entity(entity_id))
  with check (app.can_edit_entity(entity_id));

drop policy if exists entity_active_effects_write on entity_active_effects;
create policy entity_active_effects_write on entity_active_effects for all
  using (app.can_edit_entity(entity_id))
  with check (app.can_edit_entity(entity_id));

alter table campaigns add column if not exists table_settings jsonb not null default '{}'::jsonb;
alter table campaigns add constraint campaigns_table_settings_is_object
  check (jsonb_typeof(table_settings) = 'object');
