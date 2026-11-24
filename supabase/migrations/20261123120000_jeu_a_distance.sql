-- Jeu à distance, première partie jouable (ADR 0103).
--
-- Un MJ humain et ses joueurs jouent par écrit, en direct ou en différé,
-- sur un fil commun. Ce fil EST le journal de session (`session_events`,
-- ADR 0005) : le MJ y écrit en `narration` / `gm`, un joueur en
-- `player_action` / `player`. Quatre ajouts :
--
-- 1. `session_events.visible_to` : la visibilité d'un message, filtrée par
--    la RLS (jamais par l'écran). Nul = toute la table. Une liste = ces
--    joueurs-là, plus l'administrateur du monde et l'auteur. Liste vide =
--    l'administrateur et l'auteur seuls (le « secret au MJ » d'un joueur).
--
-- 2. Correction de sécurité sur l'insertion (registre de SECURITE.md,
--    23 nov.) : tout membre du monde pouvait insérer un événement signé du
--    compte d'un AUTRE (`actor_user_id` libre) et parler en MJ humain
--    (`narration` / `gm`). Désormais :
--    - `actor_user_id` est nul ou le compte qui insère ;
--    - la voix du MJ humain (`kind = 'narration'` et `actor = 'gm'`) est
--      réservée à l'administrateur du monde. Les autres événements `gm`
--      (jet ciblé, sauvegarde refaite en fin de tour, révélation de carte)
--      restent ouverts aux membres : un joueur les déclenche légitimement,
--      le serveur les écrit à son nom ;
--    - un joueur ne restreint un message qu'au MJ (`visible_to = '{}'`),
--      jamais à une liste de joueurs (pas de messagerie entre joueurs).
--    La règle `combat` de 20261102110000 est conservée telle quelle.
--
-- 3. `roll_requests` : le MJ demande un jet à un joueur ; le joueur répond
--    par un jet du serveur ou en recopiant son dé physique. Même patron que
--    `save_requests` (ADR 0044) : création par le MJ, réponse par une
--    fonction `security definer`. Le DD caché vit dans une table à part,
--    lisible du seul MJ : la RLS filtre des lignes, pas des colonnes.
--
-- 4. `session_reads` : le dernier `seq` lu par chaque lecteur, pour
--    « depuis ta dernière visite » et le compteur de l'onglet. Une ligne
--    par (session, lecteur), jamais un état lu/non lu par message.

-- 1. La visibilité d'un message.
alter table session_events add column visible_to uuid[];

-- 2. Lecture : on ajoute la visibilité aux règles de 20261102090000.
drop policy if exists session_events_select on session_events;
create policy session_events_select on session_events for select
  using (
    app.is_superadmin()
    or app.is_world_admin(app.session_world_id(session_id))
    or (
      app.is_world_member(app.session_world_id(session_id))
      and (kind <> 'combat' or actor_user_id = auth.uid())
      and (visible_to is null or actor_user_id = auth.uid() or auth.uid() = any (visible_to))
    )
  );

-- Insertion : la règle `combat` (20261102110000) plus les trois contrôles.
drop policy if exists session_events_insert on session_events;
create policy session_events_insert on session_events for insert
  with check (
    app.is_world_member(app.session_world_id(session_id))
    and (actor_user_id is null or actor_user_id = auth.uid())
    and (kind <> 'narration' or actor <> 'gm' or app.is_world_admin(app.session_world_id(session_id)))
    and (
      visible_to is null
      or (
        actor_user_id = auth.uid()
        and (visible_to = '{}'::uuid[] or app.is_world_admin(app.session_world_id(session_id)))
      )
    )
    and (
      kind <> 'combat'
      or app.is_world_admin(app.session_world_id(session_id))
      or (
        actor_user_id = auth.uid()
        and payload ->> 'target' = 'participant'
        and case
              when (payload ->> 'targetId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                then app.is_own_combat_participant((payload ->> 'targetId')::uuid, session_id)
              else false
            end
      )
    )
  );

-- Les écrans du jeu à distance écoutent le fil au lieu de le sonder
-- (docs/QUOTAS.md Q2, Q3) : un canal par écran, filtré sur la session.
-- Realtime applique la RLS ci-dessus : un secret ne part qu'à ses lecteurs.
alter publication supabase_realtime add table session_events;

-- 3. Les demandes de jet.
create table roll_requests (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  session_id       uuid not null references sessions(id) on delete cascade,
  event_id         uuid references session_events(id) on delete set null,   -- le message du MJ qui porte la demande
  author_user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_user_id   uuid not null references auth.users(id) on delete cascade, -- le joueur qui répond
  target_entity_id uuid references entities(id) on delete set null,          -- son personnage, pour le bonus
  check_kind       text not null check (check_kind in ('skill', 'ability', 'save')),
  check_key        text not null check (char_length(check_key) between 1 and 64), -- « acrobatics », « dex »
  label            text not null check (char_length(label) between 1 and 120),    -- « Acrobaties »
  advantage        text not null default 'none' check (advantage in ('none', 'advantage', 'disadvantage')),
  dc_shown         int check (dc_shown between 1 and 40),   -- le DD annoncé ; nul quand il est caché
  status           text not null default 'pending' check (status in ('pending', 'answered', 'cancelled')),
  natural_roll     int check (natural_roll between 1 and 20),
  total            int check (total between -10 and 60),
  by_hand          boolean,                                  -- vrai : recopié d'un dé physique
  answer_event_id  uuid references session_events(id) on delete set null,
  created_at       timestamptz not null default now(),
  answered_at      timestamptz
);

create index roll_requests_session_status_idx on roll_requests (session_id, status, created_at desc);
create index roll_requests_target_pending_idx on roll_requests (target_user_id) where status = 'pending';

alter table roll_requests enable row level security;

-- Lecture : toute la table voit qui doit lancer quoi (« Lyra doit lancer »),
-- comme elle voit le message qui porte la demande. Le DD caché n'est pas ici.
create policy roll_requests_select on roll_requests for select
  using (app.is_superadmin() or app.is_world_member(app.campaign_world_id(campaign_id)));

-- Création : le MJ seul, à son nom, sur une session de SA campagne.
create policy roll_requests_insert on roll_requests for insert
  with check (
    author_user_id = auth.uid()
    and app.is_world_admin(app.campaign_world_id(campaign_id))
    and app.session_world_id(session_id) = app.campaign_world_id(campaign_id)
  );

-- Le MJ annule ou corrige ; la RÉPONSE passe par la fonction ci-dessous.
create policy roll_requests_admin_update on roll_requests for update
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));
create policy roll_requests_admin_delete on roll_requests for delete
  using (app.is_world_admin(app.campaign_world_id(campaign_id)));

alter publication supabase_realtime add table roll_requests;

-- Le DD caché : une ligne par demande au plus, pour le MJ seul.
create table roll_request_gm_details (
  request_id uuid primary key references roll_requests(id) on delete cascade,
  dc         int not null check (dc between 1 and 40)
);

create or replace function app.roll_request_world_id(p_request uuid)
returns uuid
language sql stable security definer set search_path = public, app set row_security = off as $$
  select app.campaign_world_id(campaign_id) from roll_requests where id = p_request;
$$;
revoke execute on function app.roll_request_world_id(uuid) from public;
grant execute on function app.roll_request_world_id(uuid) to authenticated;

alter table roll_request_gm_details enable row level security;

create policy roll_request_gm_details_select on roll_request_gm_details for select
  using (app.is_superadmin() or app.is_world_admin(app.roll_request_world_id(request_id)));
create policy roll_request_gm_details_write on roll_request_gm_details for all
  using (app.is_world_admin(app.roll_request_world_id(request_id)))
  with check (app.is_world_admin(app.roll_request_world_id(request_id)));

-- Répondre : le joueur visé, une seule fois. N'écrit que le résultat ; le
-- serveur a calculé le total (bonus de la fiche, ADR 0044 : un joueur peut
-- déjà déclarer son dé physique, le total recopié n'ouvre rien de plus).
-- Renvoie la ligne, ou null si refusé (pas le bon compte, déjà répondue,
-- annulée, valeurs hors bornes).
create function public.answer_roll_request(p_request uuid, p_natural int, p_total int, p_by_hand boolean, p_answer_event uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_row roll_requests;
begin
  if v_uid is null or p_natural is null or p_natural < 1 or p_natural > 20
     or p_total is null or p_total < -10 or p_total > 60 or p_by_hand is null then
    return null;
  end if;

  select * into v_row from roll_requests where id = p_request for update;
  if not found or v_row.status <> 'pending' or v_row.target_user_id <> v_uid then
    return null;
  end if;
  -- L'événement de réponse, s'il est donné, est celui du joueur dans la même session.
  if p_answer_event is not null and not exists (
    select 1 from session_events
     where id = p_answer_event and session_id = v_row.session_id and actor_user_id = v_uid
  ) then
    return null;
  end if;

  update roll_requests
     set natural_roll = p_natural, total = p_total, by_hand = p_by_hand,
         answer_event_id = p_answer_event, status = 'answered', answered_at = now()
   where id = p_request
   returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.answer_roll_request(uuid, int, int, boolean, uuid) from public, anon;
grant execute on function public.answer_roll_request(uuid, int, int, boolean, uuid) to authenticated;

-- 4. Le dernier message lu.
create table session_reads (
  session_id uuid not null references sessions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  last_seq   int not null default 0 check (last_seq >= 0),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table session_reads enable row level security;

create policy session_reads_select on session_reads for select
  using (user_id = auth.uid());
create policy session_reads_insert on session_reads for insert
  with check (user_id = auth.uid() and app.is_world_member(app.session_world_id(session_id)));
create policy session_reads_update on session_reads for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and app.is_world_member(app.session_world_id(session_id)));
