-- V3.1-111 (ADR 0044) — les sauvegardes demandées à la cible.
--
-- Un effet à sauvegarde n'est pas lancé par son auteur : la cible résiste.
-- Le moteur fige l'effet à la demande (dégâts déjà lancés, états imposés) ;
-- le joueur de la cible — ou le MJ pour un PNJ — répond ; le serveur
-- applique l'issue au nom de celui qui répond.

-- 1. La demande.
create table save_requests (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  combat_id        uuid references combats(id) on delete set null,
  origin_roll_id   uuid references session_events(id) on delete set null,  -- le jet de l'auteur
  author_user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_kind      text not null check (target_kind in ('entity', 'participant')),
  target_id        uuid not null,                                           -- une entité ou un participant
  target_entity_id uuid references entities(id) on delete set null,         -- la fiche de la cible, s'il y en a une
  target_user_id   uuid references auth.users(id) on delete set null,       -- le joueur qui répond ; null : le MJ
  label            text not null,                                           -- « Flamme sacrée — Sauvegarde DEX DD 13 »
  ability          text not null check (ability in ('str', 'dex', 'con', 'int', 'wis', 'cha')),
  dc               int not null check (dc between 1 and 40),
  effect           jsonb not null,                                          -- zSaveRequestEffect, validé par le serveur
  status           text not null default 'pending' check (status in ('pending', 'answered', 'cancelled')),
  natural_roll     int check (natural_roll between 1 and 20),       -- le d20 de la réponse (« natural » est un mot réservé)
  total            int check (total between -10 and 60),
  answered_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  answered_at      timestamptz
);

create index save_requests_campaign_status_idx on save_requests (campaign_id, status, created_at desc);
create index save_requests_target_user_idx on save_requests (target_user_id) where status = 'pending';

alter table save_requests enable row level security;

-- Lecture : l'auteur, le joueur de la cible, le MJ. Personne d'autre : une
-- sauvegarde imposée à un PJ n'est pas l'affaire de la table entière.
create policy save_requests_select on save_requests for select
  using (
    author_user_id = auth.uid()
    or target_user_id = auth.uid()
    or app.is_world_admin(app.campaign_world_id(campaign_id))
  );

-- Création : par le MJ seulement, à son propre nom. Un joueur ne cible pas
-- encore (ADR 0041, V3.1-104) ; l'ouvrir aux joueurs maintenant laisserait
-- fabriquer une demande « 100 dégâts » contre le PJ d'un autre.
create policy save_requests_insert on save_requests for insert
  with check (
    author_user_id = auth.uid()
    and app.is_world_admin(app.campaign_world_id(campaign_id))
  );

-- Le MJ peut annuler ou corriger ; la RÉPONSE passe par la fonction ci-dessous.
create policy save_requests_admin_update on save_requests for update
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));
create policy save_requests_admin_delete on save_requests for delete
  using (app.is_world_admin(app.campaign_world_id(campaign_id)));

-- 2. Répondre : le joueur de la cible ou le MJ, une seule fois. N'écrit que
--    le résultat ; le serveur applique ensuite l'issue au nom de celui qui
--    répond. Renvoie la ligne, ou null si refusé (pas le bon compte, déjà
--    répondue, annulée).
create function public.answer_save_request(p_request uuid, p_natural int, p_total int)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_row save_requests;
begin
  if v_uid is null or p_total is null or p_total < -10 or p_total > 60 or (p_natural is not null and (p_natural < 1 or p_natural > 20)) then
    return null;
  end if;

  select * into v_row from save_requests where id = p_request for update;
  if not found or v_row.status <> 'pending' then
    return null;
  end if;
  if v_row.target_user_id is distinct from v_uid and not app.is_world_admin(app.campaign_world_id(v_row.campaign_id)) then
    return null;
  end if;

  update save_requests
     set natural_roll = p_natural, total = p_total, status = 'answered', answered_by = v_uid, answered_at = now()
   where id = p_request
   returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.answer_save_request(uuid, int, int) from public, anon;
grant execute on function public.answer_save_request(uuid, int, int) to authenticated;

-- 3. Le joueur applique l'issue sur SON PJ (ADR 0044) ; sa ligne de combat
--    est fermée aux joueurs depuis V3.1-101. Cette fonction recopie sur la
--    ligne de son PJ ce qu'il a déjà le droit de changer sur sa fiche (PV,
--    PV temporaires, états) — même patron que `set_own_initiative`. Renvoie
--    la ligne avant et après (journal du combat, annulable par le MJ), ou
--    null si refusé.
create function public.set_own_participant_vitals(p_participant uuid, p_hp_current int, p_temp_hp int, p_conditions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_before combat_participants;
  v_after combat_participants;
  v_campaign uuid;
begin
  if v_uid is null or p_hp_current is null or p_temp_hp is null or p_hp_current < 0 or p_temp_hp < 0
     or p_conditions is null or jsonb_typeof(p_conditions) <> 'array' then
    return null;
  end if;

  select cp.* into v_before from combat_participants cp where cp.id = p_participant for update;
  if not found or v_before.entity_id is null then
    return null;
  end if;
  select c.campaign_id into v_campaign from combats c where c.id = v_before.combat_id;

  if not exists (
    select 1 from campaign_characters cc
     where cc.campaign_id = v_campaign and cc.entity_id = v_before.entity_id and cc.user_id = v_uid and cc.is_pc
  ) then
    return null;
  end if;

  update combat_participants
     set hp_current = least(p_hp_current, coalesce(v_before.hp_max, p_hp_current)), temp_hp = p_temp_hp, conditions = p_conditions
   where id = p_participant
   returning * into v_after;
  return jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after));
end;
$$;

revoke execute on function public.set_own_participant_vitals(uuid, int, int, jsonb) from public, anon;
grant execute on function public.set_own_participant_vitals(uuid, int, int, jsonb) to authenticated;
