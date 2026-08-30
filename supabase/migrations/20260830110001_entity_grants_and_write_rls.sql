-- V2-M3 (Lot M) — `entity_grants` et resserrement de la RLS d'ecriture.
--
-- Constat (docs/BACKLOG_V2.md, ticket V2-M3) : `entities_write`,
-- `blocks_write`, `campaigns_write` et `campaign_members_write`
-- autorisaient jusqu'ici l'ecriture a N'IMPORTE QUEL membre du monde
-- (`app.is_world_member`), jamais restreint a "c'est sa fiche" ou "c'est
-- son propre role". Sans risque tant que seuls des comptes crees a la main
-- y accedaient ; devient une vraie faille des qu'un ami obtient un compte
-- en un clic (V2-M4).

-- Point d'entree unique pour "cette personne administre-t-elle ce monde,
-- au sens large" (proprietaire/editeur du monde, ou MJ humain d'une
-- campagne de ce monde) — utilise par `campaigns_write`/
-- `campaign_members_write`/`entity_grants_write` ci-dessous. Ne connait
-- rien des fiches individuelles (`entity_grants`, personnage revendique) :
-- voir `app.can_edit_entity` plus bas pour cette logique plus fine.
create or replace function app.is_world_admin(p_world_id uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select
    exists (select 1 from worlds w where w.id = p_world_id and w.owner_id = auth.uid())
    or exists (select 1 from world_members m where m.world_id = p_world_id and m.user_id = auth.uid() and m.role in ('owner', 'editor'))
    or exists (
         select 1 from campaign_members cm
         join campaigns c on c.id = cm.campaign_id
         where c.world_id = p_world_id and cm.user_id = auth.uid() and cm.role = 'gm'
       );
$$;

revoke execute on function app.is_world_admin(uuid) from public;
grant execute on function app.is_world_admin(uuid) to authenticated;

create table entity_grants (
  entity_id  uuid not null references entities(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (entity_id, user_id)
);

alter table entity_grants enable row level security;

create policy entity_grants_select on entity_grants for select
  using (app.is_world_member(app.entity_world_id(entity_id)));

-- Ecrire un octroi est un geste de MJ (accorder l'edition d'une fiche a un
-- joueur, V2-M6) — jamais quelque chose que le beneficiaire s'accorde
-- lui-meme.
create policy entity_grants_write on entity_grants for all
  using (app.is_world_admin(app.entity_world_id(entity_id)))
  with check (app.is_world_admin(app.entity_world_id(entity_id)));

-- Miroir SQL de `canEditEntity` (src/core/permissions/canEditEntity.ts) —
-- memes quatre cas, dans le meme ordre, avec le meme commentaire sur le
-- cas 2 (MJ de campagne sans role de monde separe, flux d'invitation par
-- email deja existant). Les deux ne peuvent pas s'appeler l'une l'autre
-- (RLS ne peut pas executer du TypeScript) : deux implementations
-- deliberees de la meme regle, chacune avec un seul point d'appel dans sa
-- couche (voir docs/adr/0014-role-superadmin.md pour la meme discipline
-- appliquee a `is_superadmin`). Definie apres `entity_grants` (table) et
-- `is_world_admin` (fonction), qu'elle utilise toutes les deux — une
-- fonction `language sql` est validee contre le catalogue a la creation,
-- l'ordre des instructions dans cette migration compte.
create or replace function app.can_edit_entity(p_entity_id uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select
    exists (select 1 from entities e where e.id = p_entity_id)
    and (
      app.is_world_admin(app.entity_world_id(p_entity_id))
      or exists (
           select 1 from campaign_characters cc
           join campaigns c on c.id = cc.campaign_id
           where c.world_id = app.entity_world_id(p_entity_id)
             and cc.entity_id = p_entity_id
             and cc.user_id = auth.uid()
         )
      or exists (select 1 from entity_grants g where g.entity_id = p_entity_id and g.user_id = auth.uid())
    );
$$;

revoke execute on function app.can_edit_entity(uuid) from public;
grant execute on function app.can_edit_entity(uuid) to authenticated;

-- entities : la CREATION d'une nouvelle fiche reste ouverte a tout membre
-- du monde (hors perimetre de ce ticket, qui porte sur l'edition d'une
-- fiche EXISTANTE) — `entities_insert` ne peut de toute facon pas
-- interroger `can_edit_entity` sur un id qui n'existe pas encore au moment
-- du controle (`with check` sur un INSERT voit la ligne proposee, jamais
-- une ligne deja committee que `can_edit_entity` pourrait relire).
drop policy entities_write on entities;

create policy entities_insert on entities for insert
  with check (app.is_world_member(world_id));

create policy entities_update on entities for update
  using (app.can_edit_entity(id))
  with check (app.can_edit_entity(id));

create policy entities_delete on entities for delete
  using (app.can_edit_entity(id));

-- blocks : deja scindee insert/update/delete par la migration
-- 20260804150003 (motif sans rapport : une politique "for all" s'appliquait
-- aussi a select et court-circuitait `blocks_select`). Ajouter un bloc a
-- une fiche EXISTANTE est deja une edition de cette fiche (contrairement a
-- `entities_insert` ci-dessus) — pas de probleme d'auto-reference,
-- `can_edit_entity` interroge `entities`, jamais `blocks` elle-meme.
drop policy blocks_insert on blocks;
drop policy blocks_update on blocks;
drop policy blocks_delete on blocks;

create policy blocks_insert on blocks for insert
  with check (app.can_edit_entity(entity_id));
create policy blocks_update on blocks for update
  using (app.can_edit_entity(entity_id))
  with check (app.can_edit_entity(entity_id));
create policy blocks_delete on blocks for delete
  using (app.can_edit_entity(entity_id));

-- campaigns / campaign_members : administration de la campagne elle-meme,
-- pas edition d'une fiche precise — `is_world_admin`, jamais
-- `can_edit_entity` (qui n'aurait pas de sens ici, il n'y a pas d'entite).
drop policy campaigns_write on campaigns;

create policy campaigns_write on campaigns for all
  using (app.is_world_admin(world_id))
  with check (app.is_world_admin(world_id));

drop policy campaign_members_write on campaign_members;

create policy campaign_members_write on campaign_members for all
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));
