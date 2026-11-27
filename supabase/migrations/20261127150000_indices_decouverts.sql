-- ADR 0118 (V3.2-49) — Les indices découverts : ce que la personne qui joue
-- sait d'un PNJ, détail par détail, dans UNE partie.
--
-- `entity_discoveries` (SCHEMA §13) dit qu'une fiche est connue, en entier.
-- Celle-ci dit quelle FACETTE d'un bloc l'est : `ability:str`, `ac`, `hp`,
-- `item:<id d'objet>`, `purse`, `action:<rang>`… Le serveur construit pour un
-- lecteur joueur une vue des blocs `statblock` et `inventory` qui ne contient
-- QUE les facettes découvertes (règle absolue 5) ; cette table et sa RLS sont
-- le dernier filet, pas la seule défense.
--
-- Par partie, jamais par monde : deux parties du même monde ne partagent pas
-- ce qu'elles ont appris. Ajout seul : découvrir est un fait qui s'accumule.

create table entity_facet_discoveries (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  entity_id       uuid not null references entities(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,  -- null : toute la table le sait
  facet           text not null check (facet ~ '^[a-z_]{1,24}(:[A-Za-z0-9_-]{1,64})?$'),
  source_event_id uuid references session_events(id) on delete set null,
  discovered_at   timestamptz not null default now()
);

create unique index entity_facet_discoveries_uniq on entity_facet_discoveries
  (campaign_id, entity_id, facet, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index entity_facet_discoveries_entity_idx on entity_facet_discoveries (entity_id);
create index entity_facet_discoveries_event_idx on entity_facet_discoveries (source_event_id) where source_event_id is not null;

alter table entity_facet_discoveries enable row level security;

-- Lecture : le MJ du monde voit tout ; un membre de la partie voit ce que
-- toute la table sait et ce que LUI sait, jamais ce qu'une autre personne a
-- découvert seule.
create policy entity_facet_discoveries_select on entity_facet_discoveries for select
  using (
    app.is_world_admin(app.campaign_world_id(campaign_id))
    or (
      app.campaign_role(campaign_id) is not null
      and (user_id is null or user_id = (select auth.uid()))
    )
  );

-- Écriture : un geste du MJ ou du moteur agissant pour lui (en solo, la
-- personne qui joue est propriétaire du monde). Une joueuse d'une partie à
-- table ne s'accorde pas un indice elle-même ; le moteur signé le fera pour
-- elle (ADR 0041) quand le jeu à distance en aura besoin. Aucune mise à jour :
-- un indice se donne ou se retire, il ne se réécrit pas.
create policy entity_facet_discoveries_insert on entity_facet_discoveries for insert
  with check (
    app.is_world_admin(app.campaign_world_id(campaign_id))
    or app.campaign_role(campaign_id) = 'gm'
  );
create policy entity_facet_discoveries_delete on entity_facet_discoveries for delete
  using (
    app.is_world_admin(app.campaign_world_id(campaign_id))
    or app.campaign_role(campaign_id) = 'gm'
  );

comment on table entity_facet_discoveries is 'ADR 0118 : les facettes d''un PNJ (caractéristique, objet, bourse…) qu''une partie a découvertes.';
comment on column entity_facet_discoveries.facet is 'ability:<clé>, ac, hp, speed, item:<id>, purse, action:<rang>, trait:<rang> — voir src/core/rules/facets.ts.';
