-- P0-06, critere d'acceptation : "Supprimer un monde ne laisse aucune ligne
-- orpheline dans aucune des tables."
--
-- Construit une chaine de test qui touche chaque table dependant du monde
-- (directement via world_id, ou indirectement via campaign_id/entity_id),
-- supprime le monde, puis verifie que tout a disparu — sauf ai_usage_log,
-- qui garde sa ligne par conception (on delete set null sur campaign_id,
-- SCHEMA.md §16.3 : le journal de couts survit a la campagne).
--
-- A executer manuellement en developpement (pas de Docker local dans cet
-- environnement, donc pas de `supabase test db` / pgTAP) :
--   supabase db query --linked --file supabase/tests/p0-06_world_deletion_no_orphans.sql
-- Idempotent : nettoie ses propres donnees de test avant et apres.

do $$
declare
  v_world      uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_user       uuid := 'f0000000-0000-0000-0000-00000000000f';
  v_ruleset    uuid := 'a0000000-0000-0000-0000-00000000000d';
  v_campaign   uuid := 'a0000000-0000-0000-0000-00000000000b';
  v_session    uuid := 'a0000000-0000-0000-0000-00000000000c';
  v_entity1    uuid := 'e1000000-0000-0000-0000-000000000001';
  v_entity2    uuid := 'e2000000-0000-0000-0000-000000000002';
  v_block      uuid := 'b1000000-0000-0000-0000-000000000001';
  v_relation   uuid := 'c1000000-0000-0000-0000-000000000001';
  v_template   uuid := 'd1000000-0000-0000-0000-000000000001';
  v_revision   uuid := 'ab000000-0000-0000-0000-000000000001';
  v_asset      uuid := 'ac000000-0000-0000-0000-000000000001';
  v_orphans    text := '';
begin
  -- Nettoyage prealable, au cas ou une execution precedente aurait echoue
  -- avant son propre nettoyage.
  delete from auth.users where id = v_user;
  delete from rulesets where id = v_ruleset;

  -- Chaine de test.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
    'test-p0-06@example.com', crypt('test-password', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'
  );

  insert into worlds (id, owner_id, name, slug) values (v_world, v_user, 'Test P0-06', 'test-p0-06');
  insert into rulesets (id, name, base_system) values (v_ruleset, 'Ruleset test P0-06', 'custom');
  insert into campaigns (id, world_id, ruleset_id, mode, name)
    values (v_campaign, v_world, v_ruleset, 'solo', 'Campagne test P0-06');
  insert into sessions (id, campaign_id) values (v_session, v_campaign);
  insert into world_members (world_id, user_id, role) values (v_world, v_user, 'owner');

  insert into entities (id, world_id, entity_kind, slug, name) values (v_entity1, v_world, 'character', 'test-entite-1', 'Entite test 1');
  insert into entities (id, world_id, entity_kind, slug, name) values (v_entity2, v_world, 'location', 'test-entite-2', 'Entite test 2');
  insert into blocks (id, entity_id, block_type, data, visibility_level) values (v_block, v_entity1, 'description', '{}'::jsonb, 'public');
  insert into relations (id, world_id, source_entity_id, target_entity_id, relation_type) values (v_relation, v_world, v_entity1, v_entity2, 'located_in');
  insert into entity_mentions (world_id, source_entity_id, source_path, target_kind, target_entity_id, origin)
    values (v_world, v_entity1, 'narrative.s1', 'entity', v_entity2, 'link');
  insert into entity_templates (id, world_id, name, entity_kind) values (v_template, v_world, 'Modele test', 'character');

  insert into entity_mechanical_revisions (id, entity_id, revision_number, mechanical_data) values (v_revision, v_entity1, 1, '{}'::jsonb);
  update entities set current_mechanical_revision_id = v_revision where id = v_entity1;

  insert into assets (id, world_id, storage_path, mime_type, byte_size) values (v_asset, v_world, 'test/path.png', 'image/png', 100);
  insert into entity_assets (entity_id, asset_id, role) values (v_entity1, v_asset, 'portrait');

  insert into campaign_members (campaign_id, user_id, role) values (v_campaign, v_user, 'gm');
  insert into campaign_characters (campaign_id, entity_id, user_id) values (v_campaign, v_entity1, v_user);
  insert into campaign_entity_snapshots (campaign_id, entity_id, mechanical_revision_id) values (v_campaign, v_entity1, v_revision);

  insert into entity_runtime_state (entity_id, campaign_id, state) values (v_entity1, v_campaign, '{}'::jsonb);
  insert into entity_active_effects (entity_id, campaign_id, source_kind, label) values (v_entity1, v_campaign, 'condition', 'Effet test');
  insert into entity_discoveries (campaign_id, entity_id, user_id) values (v_campaign, v_entity1, null);
  insert into dice_rolls (session_id, campaign_id, expression, ast, result, detail, rolled_by)
    values (v_session, v_campaign, '1d20', '{}'::jsonb, 10, '{}'::jsonb, 'player');
  insert into session_events (session_id, seq, kind, actor) values (v_session, 1, 'note', 'system');
  insert into entity_revisions (entity_id, revision_number, snapshot, change_source) values (v_entity1, 1, '{}'::jsonb, 'user');
  insert into ai_proposals (world_id, campaign_id, kind, payload) values (v_world, v_campaign, 'create_entity', '{}'::jsonb);
  insert into ai_usage_log (campaign_id, purpose, model) values (v_campaign, 'solo_turn', 'claude-test');

  insert into chunks (world_id, source_kind, source_id, content, content_hash, embedding)
    select v_world, 'entity_summary', v_entity1, 'contenu de test', 'hash-test-p0-06',
           ('[' || array_to_string(array_agg(0.001), ',') || ']')::vector(1024)
    from generate_series(1,1024);
  insert into embedding_queue (chunk_id) select id from chunks where world_id = v_world;
  insert into share_links (world_id, token_hash, scope) values (v_world, 'hash-test-p0-06', 'public_only');

  -- Suppression du monde : tout ce qui precede doit disparaitre en cascade,
  -- sauf ai_usage_log (campaign_id passe a null, ligne conservee).
  delete from worlds where id = v_world;

  if exists (select 1 from world_members where world_id = v_world) then v_orphans := v_orphans || 'world_members '; end if;
  if exists (select 1 from entities where world_id = v_world) then v_orphans := v_orphans || 'entities '; end if;
  if exists (select 1 from blocks where id = v_block) then v_orphans := v_orphans || 'blocks '; end if;
  if exists (select 1 from relations where world_id = v_world) then v_orphans := v_orphans || 'relations '; end if;
  if exists (select 1 from entity_mentions where world_id = v_world) then v_orphans := v_orphans || 'entity_mentions '; end if;
  if exists (select 1 from entity_templates where id = v_template) then v_orphans := v_orphans || 'entity_templates '; end if;
  if exists (select 1 from entity_mechanical_revisions where id = v_revision) then v_orphans := v_orphans || 'entity_mechanical_revisions '; end if;
  if exists (select 1 from assets where id = v_asset) then v_orphans := v_orphans || 'assets '; end if;
  if exists (select 1 from entity_assets where asset_id = v_asset) then v_orphans := v_orphans || 'entity_assets '; end if;
  if exists (select 1 from campaigns where id = v_campaign) then v_orphans := v_orphans || 'campaigns '; end if;
  if exists (select 1 from campaign_members where campaign_id = v_campaign) then v_orphans := v_orphans || 'campaign_members '; end if;
  if exists (select 1 from campaign_characters where campaign_id = v_campaign) then v_orphans := v_orphans || 'campaign_characters '; end if;
  if exists (select 1 from campaign_entity_snapshots where campaign_id = v_campaign) then v_orphans := v_orphans || 'campaign_entity_snapshots '; end if;
  if exists (select 1 from sessions where id = v_session) then v_orphans := v_orphans || 'sessions '; end if;
  if exists (select 1 from session_events where session_id = v_session) then v_orphans := v_orphans || 'session_events '; end if;
  if exists (select 1 from entity_runtime_state where campaign_id = v_campaign) then v_orphans := v_orphans || 'entity_runtime_state '; end if;
  if exists (select 1 from entity_active_effects where campaign_id = v_campaign) then v_orphans := v_orphans || 'entity_active_effects '; end if;
  if exists (select 1 from entity_discoveries where campaign_id = v_campaign) then v_orphans := v_orphans || 'entity_discoveries '; end if;
  if exists (select 1 from dice_rolls where campaign_id = v_campaign) then v_orphans := v_orphans || 'dice_rolls '; end if;
  if exists (select 1 from entity_revisions where entity_id = v_entity1) then v_orphans := v_orphans || 'entity_revisions '; end if;
  if exists (select 1 from ai_proposals where world_id = v_world) then v_orphans := v_orphans || 'ai_proposals '; end if;
  if exists (select 1 from chunks where world_id = v_world) then v_orphans := v_orphans || 'chunks '; end if;
  if exists (select 1 from embedding_queue eq join chunks c on c.id = eq.chunk_id where c.world_id = v_world) then v_orphans := v_orphans || 'embedding_queue '; end if;
  if exists (select 1 from share_links where world_id = v_world) then v_orphans := v_orphans || 'share_links '; end if;

  -- Nettoyage : ai_usage_log garde sa ligne par conception (campaign_id est
  -- deja passe a null par le cascade, on la retrouve donc par son contenu),
  -- rulesets et auth.users ne dependent pas du monde.
  delete from ai_usage_log where purpose = 'solo_turn' and model = 'claude-test' and campaign_id is null;
  delete from rulesets where id = v_ruleset;
  delete from auth.users where id = v_user;

  if v_orphans <> '' then
    raise exception 'Lignes orphelines apres suppression du monde : %', v_orphans;
  end if;

  raise notice 'OK : aucune ligne orpheline apres suppression du monde.';
end $$;
