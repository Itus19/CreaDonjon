-- V1-E3 (refonte) — generateur de rencontres, outil d'ecran MJ autonome
-- (specs/outils-mj.md §4, redirection explicite de l'utilisateur : ne
-- s'attache a aucune fiche, contrairement au bloc `encounter` prevu par
-- docs/SCHEMA.md §7 pour la V2 et abandonne). Table dediee, meme motif
-- que sessions/dice_rolls (20260730120001_sessions.sql) : outil de
-- campagne, pas donnee de wiki.
--
-- `participants` fige un instantane des monstres choisis (cle, nom
-- affiche, FP, PX) au moment de la sauvegarde : une rencontre enregistree
-- ne doit pas changer de composition si une traduction ou une entree de
-- ruleset est modifiee plus tard.
create table campaign_encounters (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  name         text not null default 'Rencontre',
  party_size   int not null check (party_size > 0),
  party_level  int not null check (party_level between 1 and 20),
  band         text check (band in ('low','moderate','high')),
  participants jsonb not null default '[]'::jsonb,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index campaign_encounters_campaign_idx on campaign_encounters (campaign_id, created_at desc);

create trigger touch_campaign_encounters_updated_at
  before update on campaign_encounters
  for each row execute function app.touch_updated_at();

alter table campaign_encounters enable row level security;

-- Perimetre Phase 0 (voir 20260730150001_rls.sql) : filtre par
-- appartenance au monde, pas encore de distinction MJ/joueur.
create policy campaign_encounters_select on campaign_encounters for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy campaign_encounters_write on campaign_encounters for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));
