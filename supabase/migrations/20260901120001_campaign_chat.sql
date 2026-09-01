-- V2-M12 (retour utilisateur, 1 sept. : "ajoute un outil de chat avec le mj
-- dans la liste des outils de joueur et de MJ") — un seul salon partage par
-- campagne (MJ + tous les joueurs), jamais de messagerie privee entre
-- joueurs : le retour utilisateur nomme le MJ comme interlocuteur, et "un
-- monde = une campagne" (V2-G1) rend ce salon unique et sans ambiguite pour
-- toute la table de jeu.

create table campaign_chat_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index campaign_chat_messages_campaign_created_idx
  on campaign_chat_messages (campaign_id, created_at);

alter table campaign_chat_messages enable row level security;

create policy campaign_chat_messages_select on campaign_chat_messages for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy campaign_chat_messages_insert on campaign_chat_messages for insert
  with check (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and sender_id = auth.uid()
  );

-- Temps reel (meme motif que dice_rolls, migration 20260831090001) : la RLS
-- ci-dessus s'applique deja aux changements diffuses par Postgres Changes.
alter publication supabase_realtime add table campaign_chat_messages;

-- Pastille de notification ("avec notif -> pastille avec nombre de
-- message") : une ligne par (campagne, utilisateur) portant la date de
-- derniere lecture, jamais un etat lu/non-lu par message individuel —
-- suffisant pour un compteur "depuis ma derniere visite".
create table campaign_chat_reads (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

alter table campaign_chat_reads enable row level security;

create policy campaign_chat_reads_select on campaign_chat_reads for select
  using (user_id = auth.uid());

create policy campaign_chat_reads_insert on campaign_chat_reads for insert
  with check (user_id = auth.uid() and app.is_world_member(app.campaign_world_id(campaign_id)));

create policy campaign_chat_reads_update on campaign_chat_reads for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
