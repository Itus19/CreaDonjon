-- V2.1-3 — Livre de sessions (retour utilisateur : le MJ assigne le devoir
-- de rediger le recit d'une seance a une joueuse ; date ingame ET date IRL
-- de redaction ; la fiche rendue doit avoir exactement la meme presentation
-- que n'importe quelle autre fiche du wiki).
--
-- Chaque entree est une vraie fiche (`entities.entity_kind = 'session_journal'`,
-- blocs texte/image existants) — c'est ce qui donne gratuitement la meme
-- presentation en lecture ET en edition que toute autre fiche, sans nouveau
-- type de bloc. Cette table ne porte QUE ce qu'une fiche generique ne sait
-- pas deja exprimer : le devoir (qui doit ecrire, a-t-il ecrit) et la date
-- INGAME couverte (une fiche n'a aucune notion de date de jeu propre).
--
-- L'entite n'existe qu'a partir du moment ou la joueuse commence a ecrire
-- (`entity_id` reste null tant que `status = 'pending'`) : `created_by` de
-- l'entite est alors reellement l'autrice, jamais le MJ qui a assigne le
-- devoir — evite un champ "auteur" redondant avec `entities.created_by`.
-- `written_at` (distinct de `entities.created_at`, qui daterait la creation
-- de la fiche au meme instant de toute facon) sert de cle de tri IRL
-- explicite et stable si la fiche est renommee/deplacee plus tard.
create table session_journal_entries (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  ingame_date  jsonb not null,
  assigned_to  uuid not null references auth.users(id),
  status       text not null default 'pending' check (status in ('pending', 'written')),
  entity_id    uuid references entities(id) on delete set null,
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  written_at   timestamptz
);

create index session_journal_entries_campaign_idx on session_journal_entries (campaign_id);

alter table session_journal_entries enable row level security;

-- Lecture ouverte a tout membre du monde (meme motif que `real_sessions`) :
-- savoir qui doit ecrire quoi n'a rien de sensible entre coequipieres.
create policy session_journal_entries_select on session_journal_entries for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));

-- Assigner un devoir reste un geste MJ, comme confirmer une seance reelle.
create policy session_journal_entries_insert on session_journal_entries for insert
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));
create policy session_journal_entries_delete on session_journal_entries for delete
  using (app.is_world_admin(app.campaign_world_id(campaign_id)));

-- Marquer "redige" (poser entity_id/status/written_at) est un geste de
-- l'autrice assignee elle-meme ; le MJ garde la main pour reassigner/annuler.
create policy session_journal_entries_update on session_journal_entries for update
  using (assigned_to = auth.uid() or app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (assigned_to = auth.uid() or app.is_world_admin(app.campaign_world_id(campaign_id)));

-- 6e cas de app.can_edit_entity (miroir canEditEntity.ts) : l'autrice d'une
-- entree du Livre de sessions garde le droit de la corriger ensuite — sans
-- ce cas, seul le MJ (cas 1, deja vrai pour tout MJ de campagne) pourrait la
-- retoucher une fois creee. Meme motif exact que le 5e cas (notes,
-- migration 20260830210001, restaure le 13 septembre par
-- 20260913150000) : "je l'ai creee moi-meme" ne decoule d'aucun des cas
-- precedents pour un entity_kind qui n'est ni un PJ ni un octroi.
create or replace function app.can_edit_entity(p_entity_id uuid)
returns boolean
language sql stable security definer set search_path = public, app set row_security = off as $$
  select
    app.is_world_admin(app.entity_world_id(p_entity_id))
    or exists (
         select 1 from campaign_characters cc
         join campaigns c on c.id = cc.campaign_id
         where c.world_id = app.entity_world_id(p_entity_id)
           and cc.entity_id = p_entity_id
           and cc.user_id = auth.uid()
       )
    or exists (select 1 from entity_grants g where g.entity_id = p_entity_id and g.user_id = auth.uid())
    or exists (
         select 1 from entities e
         where e.id = p_entity_id and e.entity_kind = 'notes' and e.created_by = auth.uid()
       )
    or exists (
         select 1 from entities e
         where e.id = p_entity_id and e.entity_kind = 'session_journal' and e.created_by = auth.uid()
       );
$$;
