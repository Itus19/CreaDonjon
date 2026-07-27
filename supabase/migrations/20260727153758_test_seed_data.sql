-- Manual validation data for Phase 0, step 4: one world, two entities linked
-- by a relation, one hidden block and one visible block. Owned by the test
-- account created in Supabase Auth for this purpose.
--
-- This is throwaway dev data, not a reusable seed script.

with test_user as (
  select 'cb6bebcc-ece6-43b6-8ef8-f27c77fab9b7'::uuid as id
),
new_world as (
  insert into worlds (name, owner_id)
  select 'Monde de test', id from test_user
  returning id
),
tavernier as (
  insert into entities (world_id, name, summary, entity_kind, created_by)
  select new_world.id, 'Gornak le tavernier',
    'Tient la taverne du Sanglier Ivre.', 'personnage', test_user.id
  from new_world, test_user
  returning id
),
taverne as (
  insert into entities (world_id, name, summary, entity_kind, created_by)
  select new_world.id, 'Le Sanglier Ivre',
    'Une taverne animee au centre du village.', 'lieu', test_user.id
  from new_world, test_user
  returning id
),
new_relation as (
  insert into relations (source_entity_id, target_entity_id, relation_type, visibility)
  select tavernier.id, taverne.id, 'habite', 'public'
  from tavernier, taverne
  returning id
),
visible_block as (
  insert into blocks (entity_id, block_type, data, visibility, display_order)
  select tavernier.id, 'personnage',
    '{"description": "Jovial et accueillant avec tous les clients."}'::jsonb,
    'public', 0
  from tavernier
  returning id
)
insert into blocks (entity_id, block_type, data, visibility, display_order)
select tavernier.id, 'personnage',
  '{"secret": "Travaille en realite pour la guilde des voleurs."}'::jsonb,
  'mj', 1
from tavernier;
