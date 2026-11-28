-- ADR 0122 (V3.2-80) — Ce que les PNJ savent du personnage joué, dans UNE
-- partie : une facette découverte (`ability:str`, `item:<id>`…) ou une
-- affirmation en mots (une rumeur, vraie ou fausse), avec sa source.
--
-- Un secret du MJ : seuls le MJ du monde et le MJ de la partie la lisent.
-- La personne qui joue à une table ne voit jamais ce que les PNJ savent d'elle.
-- Ajout et retrait seulement : savoir est un fait qui s'accumule.

create table npc_knowledge (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references campaigns(id) on delete cascade,
  knower_entity_id   uuid not null references entities(id) on delete cascade,
  subject_entity_id  uuid not null references entities(id) on delete cascade,
  facet              text check (facet ~ '^[a-z_]{1,24}(:[A-Za-z0-9_-]{1,64})?$'),
  claim              text check (char_length(claim) between 1 and 300),
  is_true            boolean not null default true,
  source             text not null check (source in ('observation', 'told', 'rumour')),
  told_by_entity_id  uuid references entities(id) on delete set null,
  source_event_id    uuid references session_events(id) on delete set null,
  learned_at         timestamptz not null default now(),
  check (facet is not null or claim is not null)
);

create unique index npc_knowledge_facet_uniq on npc_knowledge (campaign_id, knower_entity_id, subject_entity_id, facet) where facet is not null;
create index npc_knowledge_subject_idx on npc_knowledge (campaign_id, subject_entity_id);
create index npc_knowledge_knower_idx on npc_knowledge (knower_entity_id);
create index npc_knowledge_event_idx on npc_knowledge (source_event_id) where source_event_id is not null;

alter table npc_knowledge enable row level security;

create policy npc_knowledge_select on npc_knowledge for select
  using (app.is_world_admin(app.campaign_world_id(campaign_id)) or app.campaign_role(campaign_id) = 'gm');
create policy npc_knowledge_insert on npc_knowledge for insert
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)) or app.campaign_role(campaign_id) = 'gm');
create policy npc_knowledge_delete on npc_knowledge for delete
  using (app.is_world_admin(app.campaign_world_id(campaign_id)) or app.campaign_role(campaign_id) = 'gm');

comment on table npc_knowledge is 'ADR 0122 : ce qu''un PNJ sait du personnage joué (facette ou affirmation), vrai ou faux, et sa source. Secret du MJ.';
