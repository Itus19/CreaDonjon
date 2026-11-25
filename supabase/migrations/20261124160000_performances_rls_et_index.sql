-- AG-23 — ce que le conseiller de performances de Supabase signale (export du
-- 24 nov.). Aucun changement de droits : les politiques gardent exactement la
-- même condition, seule la façon de l'évaluer change.
--
-- 1. `auth_rls_initplan` (34 politiques) : `auth.uid()` écrit nu est
--    réévalué pour CHAQUE ligne lue. Entouré d'un `select`, Postgres le calcule
--    une fois par requête (correctif recommandé par Supabase). Les conditions
--    ci-dessous sont celles des migrations précédentes, relues dans
--    `pg_policies`, avec ce seul changement. `alter policy` garde le rôle et
--    la commande de chaque politique.
--
-- 2. `unindexed_foreign_keys` : un index pour chaque clé étrangère signalée,
--    sauf les colonnes d'auteur (`created_by`, `*_by`), qui ne servent qu'à la
--    suppression d'un compte, rare. Sans index, supprimer une campagne ou
--    filtrer par campagne parcourt toute la table enfant.
--
-- Non traité ici, volontairement :
-- - `multiple_permissive_policies` (264) : vient des politiques d'écriture
--   `for all` qui valent aussi pour la lecture, à côté d'une politique de
--   lecture. Les scinder touche à la sécurité de 41 tables pour un gain faible
--   à notre taille ; à reprendre table par table si une lecture se montre lente.
-- - `unused_index` (7) : « inutilisé » sur une petite base veut souvent dire
--   « pas encore servi » (recherche, plein texte, embeddings).
-- - `no_primary_key` sur `campaign_chat_reads` : la clé unique
--   (campagne, personne, fil) `nulls not distinct` joue déjà ce rôle ; le fil
--   peut être vide, il ne peut donc pas entrer dans une clé primaire.

alter policy profiles_write on public.profiles
  using ((id = ( SELECT auth.uid() AS uid)))
  with check ((id = ( SELECT auth.uid() AS uid)));

alter policy worlds_write on public.worlds
  using ((owner_id = ( SELECT auth.uid() AS uid)))
  with check ((owner_id = ( SELECT auth.uid() AS uid)));

alter policy entity_templates_select on public.entity_templates
  using ((((world_id IS NULL) AND (( SELECT auth.uid() AS uid) IS NOT NULL)) OR app.is_world_member(world_id)));

alter policy rulesets_select on public.rulesets
  using ((is_official_base OR (created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM campaigns c
  WHERE ((c.ruleset_id = rulesets.id) AND app.is_world_member(c.world_id)))) OR (EXISTS ( SELECT 1
   FROM worlds w
  WHERE ((w.default_ruleset_id = rulesets.id) AND app.is_world_member(w.id))))));

alter policy rulesets_write on public.rulesets
  using ((created_by = ( SELECT auth.uid() AS uid)))
  with check ((created_by = ( SELECT auth.uid() AS uid)));

alter policy ai_usage_log_select on public.ai_usage_log
  using ((user_id = ( SELECT auth.uid() AS uid)));

alter policy ai_usage_log_write on public.ai_usage_log
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));

alter policy background_images_select on public.background_images
  using ((owner_id = ( SELECT auth.uid() AS uid)));

alter policy background_images_write on public.background_images
  using ((owner_id = ( SELECT auth.uid() AS uid)))
  with check ((owner_id = ( SELECT auth.uid() AS uid)));

alter policy campaign_invites_select_own on public.campaign_invites
  using ((claimed_by_user_id = ( SELECT auth.uid() AS uid)));

alter policy profiles_select on public.profiles
  using (((id = ( SELECT auth.uid() AS uid)) OR app.is_superadmin() OR app.shares_world_with(id)));

alter policy campaign_chat_reads_select on public.campaign_chat_reads
  using ((user_id = ( SELECT auth.uid() AS uid)));

alter policy campaign_chat_reads_insert on public.campaign_chat_reads
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_member(app.campaign_world_id(campaign_id))));

alter policy campaign_chat_reads_update on public.campaign_chat_reads
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));

alter policy real_session_availabilities_write on public.real_session_availabilities
  using (((user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_member(app.campaign_world_id(campaign_id))))
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_member(app.campaign_world_id(campaign_id))));

alter policy player_title_tiers_select on public.player_title_tiers
  using ((( SELECT auth.uid() AS uid) IS NOT NULL));

alter policy save_requests_select on public.save_requests
  using (((author_user_id = ( SELECT auth.uid() AS uid)) OR (target_user_id = ( SELECT auth.uid() AS uid)) OR app.is_world_admin(app.campaign_world_id(campaign_id))));

alter policy save_requests_insert on public.save_requests
  with check (((author_user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_admin(app.campaign_world_id(campaign_id))));

alter policy dice_rolls_select on public.dice_rolls
  using ((app.is_world_member(app.campaign_world_id(campaign_id)) AND ((visibility_level = 'public'::text) OR ((visibility_level = 'roller'::text) AND (rolled_by_user_id = ( SELECT auth.uid() AS uid))) OR app.is_world_admin(app.campaign_world_id(campaign_id)))));

alter policy dice_rolls_insert on public.dice_rolls
  with check ((app.is_world_member(app.campaign_world_id(campaign_id)) AND ((visibility_level = ANY (ARRAY['public'::text, 'roller'::text])) OR app.is_world_admin(app.campaign_world_id(campaign_id))) AND (NOT (rolled_by_user_id IS DISTINCT FROM ( SELECT auth.uid() AS uid))) AND ((entity_id IS NULL) OR ((app.entity_world_id(entity_id) = app.campaign_world_id(campaign_id)) AND app.can_edit_entity(entity_id)))));

alter policy campaign_chat_messages_select on public.campaign_chat_messages
  using (
CASE
    WHEN (thread_user_id IS NULL) THEN ((app.campaign_role(campaign_id) IS NOT NULL) OR app.is_world_admin(app.campaign_world_id(campaign_id)))
    ELSE (app.is_world_member(app.campaign_world_id(campaign_id)) AND ((thread_user_id = ( SELECT auth.uid() AS uid)) OR app.is_world_admin(app.campaign_world_id(campaign_id))))
END);

alter policy campaign_chat_messages_insert on public.campaign_chat_messages
  with check (((sender_id = ( SELECT auth.uid() AS uid)) AND
CASE
    WHEN (thread_user_id IS NULL) THEN ((app.campaign_role(campaign_id) IS NOT NULL) OR app.is_world_admin(app.campaign_world_id(campaign_id)))
    ELSE (app.is_world_member(app.campaign_world_id(campaign_id)) AND ((thread_user_id = ( SELECT auth.uid() AS uid)) OR app.is_world_admin(app.campaign_world_id(campaign_id))))
END));

alter policy roll_windows_select on public.roll_windows
  using (((author_user_id = ( SELECT auth.uid() AS uid)) OR app.is_world_admin(app.campaign_world_id(campaign_id)) OR (EXISTS ( SELECT 1
   FROM jsonb_array_elements(roll_windows.choices) c(value)
  WHERE ((c.value ->> 'user_id'::text) = (( SELECT auth.uid() AS uid))::text)))));

alter policy availability_declines_write on public.availability_declines
  using (((user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_member(app.campaign_world_id(campaign_id))))
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_member(app.campaign_world_id(campaign_id))));

alter policy ai_providers_select on public.ai_providers
  using ((user_id = ( SELECT auth.uid() AS uid)));

alter policy ai_providers_insert on public.ai_providers
  with check ((user_id = ( SELECT auth.uid() AS uid)));

alter policy ai_providers_update on public.ai_providers
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));

alter policy ai_providers_delete on public.ai_providers
  using ((user_id = ( SELECT auth.uid() AS uid)));

alter policy session_events_select on public.session_events
  using ((app.is_superadmin() OR app.is_world_admin(app.session_world_id(session_id)) OR (app.is_world_member(app.session_world_id(session_id)) AND ((kind <> 'combat'::text) OR (actor_user_id = ( SELECT auth.uid() AS uid))) AND ((visible_to IS NULL) OR (actor_user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT auth.uid() AS uid) = ANY (visible_to))))));

alter policy session_events_insert on public.session_events
  with check ((app.is_world_member(app.session_world_id(session_id)) AND ((actor_user_id IS NULL) OR (actor_user_id = ( SELECT auth.uid() AS uid))) AND ((kind <> 'narration'::text) OR (actor <> 'gm'::text) OR app.is_world_admin(app.session_world_id(session_id))) AND ((visible_to IS NULL) OR ((actor_user_id = ( SELECT auth.uid() AS uid)) AND ((visible_to = '{}'::uuid[]) OR app.is_world_admin(app.session_world_id(session_id))))) AND ((kind <> 'combat'::text) OR app.is_world_admin(app.session_world_id(session_id)) OR ((actor_user_id = ( SELECT auth.uid() AS uid)) AND ((payload ->> 'target'::text) = 'participant'::text) AND
CASE
    WHEN ((payload ->> 'targetId'::text) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::text) THEN app.is_own_combat_participant(((payload ->> 'targetId'::text))::uuid, session_id)
    ELSE false
END))));

alter policy roll_requests_insert on public.roll_requests
  with check (((author_user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_admin(app.campaign_world_id(campaign_id)) AND (app.session_world_id(session_id) = app.campaign_world_id(campaign_id))));

alter policy session_reads_select on public.session_reads
  using ((user_id = ( SELECT auth.uid() AS uid)));

alter policy session_reads_insert on public.session_reads
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_member(app.session_world_id(session_id))));

alter policy session_reads_update on public.session_reads
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND app.is_world_member(app.session_world_id(session_id))));

create index if not exists account_reset_tokens_user_id_fk_idx on public.account_reset_tokens (user_id);
create index if not exists ai_proposals_campaign_id_fk_idx on public.ai_proposals (campaign_id);
create index if not exists ai_proposals_session_event_id_fk_idx on public.ai_proposals (session_event_id);
create index if not exists ai_proposals_target_entity_id_fk_idx on public.ai_proposals (target_entity_id);
create index if not exists ai_usage_log_campaign_id_fk_idx on public.ai_usage_log (campaign_id);
create index if not exists assets_world_id_fk_idx on public.assets (world_id);
create index if not exists attitude_events_session_event_id_fk_idx on public.attitude_events (session_event_id);
create index if not exists attitude_events_source_entity_id_fk_idx on public.attitude_events (source_entity_id);
create index if not exists attitude_events_target_entity_id_fk_idx on public.attitude_events (target_entity_id);
create index if not exists availability_declines_request_id_campaign_id_fk_idx on public.availability_declines (request_id, campaign_id);
create index if not exists availability_declines_user_id_fk_idx on public.availability_declines (user_id);
create index if not exists background_images_asset_id_fk_idx on public.background_images (asset_id);
create index if not exists block_images_asset_id_fk_idx on public.block_images (asset_id);
create index if not exists campaign_characters_entity_id_fk_idx on public.campaign_characters (entity_id);
create index if not exists campaign_characters_user_id_fk_idx on public.campaign_characters (user_id);
create index if not exists campaign_chat_messages_related_entity_id_fk_idx on public.campaign_chat_messages (related_entity_id);
create index if not exists campaign_chat_messages_sender_id_fk_idx on public.campaign_chat_messages (sender_id);
create index if not exists campaign_chat_messages_thread_user_id_fk_idx on public.campaign_chat_messages (thread_user_id);
create index if not exists campaign_chat_reads_thread_user_id_fk_idx on public.campaign_chat_reads (thread_user_id);
create index if not exists campaign_chat_reads_user_id_fk_idx on public.campaign_chat_reads (user_id);
create index if not exists campaign_entity_snapshots_entity_id_fk_idx on public.campaign_entity_snapshots (entity_id);
create index if not exists campaign_entity_snapshots_mechanical_revision_id_fk_idx on public.campaign_entity_snapshots (mechanical_revision_id);
create index if not exists campaign_invites_campaign_id_fk_idx on public.campaign_invites (campaign_id);
create index if not exists campaign_invites_claimed_by_user_id_fk_idx on public.campaign_invites (claimed_by_user_id);
create index if not exists campaign_invites_entity_id_fk_idx on public.campaign_invites (entity_id);
create index if not exists campaign_invites_world_id_fk_idx on public.campaign_invites (world_id);
create index if not exists campaign_members_user_id_fk_idx on public.campaign_members (user_id);
create index if not exists campaigns_gm_user_id_fk_idx on public.campaigns (gm_user_id);
create index if not exists campaigns_party_entity_id_fk_idx on public.campaigns (party_entity_id);
create index if not exists combat_participants_entity_id_fk_idx on public.combat_participants (entity_id);
create index if not exists combats_session_id_fk_idx on public.combats (session_id);
create index if not exists dice_rolls_entity_id_fk_idx on public.dice_rolls (entity_id);
create index if not exists dice_rolls_rolled_by_user_id_fk_idx on public.dice_rolls (rolled_by_user_id);
create index if not exists dice_rolls_session_id_fk_idx on public.dice_rolls (session_id);
create index if not exists embedding_queue_chunk_id_fk_idx on public.embedding_queue (chunk_id);
create index if not exists entities_current_mechanical_revision_id_fk_idx on public.entities (current_mechanical_revision_id);
create index if not exists entity_active_effects_applied_at_event_fk_idx on public.entity_active_effects (applied_at_event);
create index if not exists entity_active_effects_campaign_id_fk_idx on public.entity_active_effects (campaign_id);
create index if not exists entity_active_effects_expires_at_event_fk_idx on public.entity_active_effects (expires_at_event);
create index if not exists entity_assets_asset_id_fk_idx on public.entity_assets (asset_id);
create index if not exists entity_attitudes_source_entity_id_fk_idx on public.entity_attitudes (source_entity_id);
create index if not exists entity_attitudes_target_entity_id_fk_idx on public.entity_attitudes (target_entity_id);
create index if not exists entity_discoveries_entity_id_fk_idx on public.entity_discoveries (entity_id);
create index if not exists entity_discoveries_source_event_id_fk_idx on public.entity_discoveries (source_event_id);
create index if not exists entity_discoveries_user_id_fk_idx on public.entity_discoveries (user_id);
create index if not exists entity_grants_user_id_fk_idx on public.entity_grants (user_id);
create index if not exists entity_mechanical_revisions_based_on_ruleset_entry_id_fk_idx on public.entity_mechanical_revisions (based_on_ruleset_entry_id);
create index if not exists entity_runtime_state_campaign_id_fk_idx on public.entity_runtime_state (campaign_id);
create index if not exists entity_templates_world_id_fk_idx on public.entity_templates (world_id);
create index if not exists entity_true_names_world_id_fk_idx on public.entity_true_names (world_id);
create index if not exists map_pins_layer_id_fk_idx on public.map_pins (layer_id);
create index if not exists map_region_reveals_region_id_fk_idx on public.map_region_reveals (region_id);
create index if not exists map_regions_layer_id_fk_idx on public.map_regions (layer_id);
create index if not exists personality_events_session_event_id_fk_idx on public.personality_events (session_event_id);
create index if not exists real_session_availabilities_user_id_fk_idx on public.real_session_availabilities (user_id);
create index if not exists roll_requests_answer_event_id_fk_idx on public.roll_requests (answer_event_id);
create index if not exists roll_requests_author_user_id_fk_idx on public.roll_requests (author_user_id);
create index if not exists roll_requests_campaign_id_fk_idx on public.roll_requests (campaign_id);
create index if not exists roll_requests_event_id_fk_idx on public.roll_requests (event_id);
create index if not exists roll_requests_target_entity_id_fk_idx on public.roll_requests (target_entity_id);
create index if not exists roll_windows_author_user_id_fk_idx on public.roll_windows (author_user_id);
create index if not exists roll_windows_combat_id_fk_idx on public.roll_windows (combat_id);
create index if not exists ruleset_entry_refs_target_entry_id_fk_idx on public.ruleset_entry_refs (target_entry_id);
create index if not exists rulesets_copied_from_ruleset_id_fk_idx on public.rulesets (copied_from_ruleset_id);
create index if not exists rulesets_parent_ruleset_id_fk_idx on public.rulesets (parent_ruleset_id);
create index if not exists save_requests_author_user_id_fk_idx on public.save_requests (author_user_id);
create index if not exists save_requests_combat_id_fk_idx on public.save_requests (combat_id);
create index if not exists save_requests_origin_roll_id_fk_idx on public.save_requests (origin_roll_id);
create index if not exists save_requests_target_entity_id_fk_idx on public.save_requests (target_entity_id);
create index if not exists session_events_actor_user_id_fk_idx on public.session_events (actor_user_id);
create index if not exists session_journal_entries_assigned_to_fk_idx on public.session_journal_entries (assigned_to);
create index if not exists session_journal_entries_entity_id_fk_idx on public.session_journal_entries (entity_id);
create index if not exists session_reads_user_id_fk_idx on public.session_reads (user_id);
create index if not exists sessions_campaign_id_fk_idx on public.sessions (campaign_id);
create index if not exists share_links_campaign_id_fk_idx on public.share_links (campaign_id);
create index if not exists share_links_world_id_fk_idx on public.share_links (world_id);
create index if not exists world_members_user_id_fk_idx on public.world_members (user_id);
