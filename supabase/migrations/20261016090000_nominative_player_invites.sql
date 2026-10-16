-- V3.1-100 (ADR 0049) — rejoindre sans choisir de PJ ; le lien qui vise un PJ.
--
-- 1. `campaign_invites.entity_id` : un lien joueur NOMINATIF (« ce lien est
--    pour Naivara »). Il sert une seule fois : la personne qui l'utilise est
--    retenue dans `claimed_by_user_id` (posé par `accountProvisioning.ts`).
--    Un lien joueur sans PJ reste réutilisable, comme avant (ADR 0031).
alter table campaign_invites
  add column entity_id uuid references entities(id) on delete set null;

alter table campaign_invites
  add constraint campaign_invites_entity_player_ck check (entity_id is null or intended_role = 'player');

comment on column campaign_invites.entity_id is 'Lien nominatif (V3.1-100) : le PJ réservé à la personne qui utilise ce lien, tant que le lien n''est pas révoqué.';

-- 2. Réclamer un PJ ne passe plus par une écriture directe. Constat en
--    écrivant ce ticket : `campaign_characters_write` (migration
--    20260830130001) laissait TOUT compte connecté, même hors du monde,
--    s'attribuer une ligne libre (`using user_id is null`) ou en insérer une
--    à son nom sur n'importe quelle fiche. `app.can_edit_entity` lit cette
--    table : on devenait éditeur de la fiche. Et la réservation d'un lien
--    nominatif aurait pu être contournée.
--    Désormais : écriture directe réservée au MJ ; un joueur réclame par
--    `claim_campaign_character`, qui vérifie tout.
drop policy if exists campaign_characters_write on campaign_characters;
create policy campaign_characters_write on campaign_characters for all
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));

-- Un PJ est RÉSERVÉ quand un lien nominatif actif (non révoqué) de la
-- campagne le vise. Seule la personne qui a utilisé ce lien peut alors le
-- réclamer ; un lien pas encore utilisé le réserve pour tout le monde.

-- 3. Les PJ que l'appelant peut réclamer, et ceux qui lui sont réservés.
create function public.list_claimable_characters(p_campaign_id uuid)
returns table (entity_id uuid, reserved_for_me boolean)
language sql
stable
security definer
set search_path = public, app
as $$
  with links as (
    select ci.entity_id, ci.claimed_by_user_id
      from campaign_invites ci
     where ci.campaign_id = p_campaign_id
       and ci.revoked_at is null
       and ci.entity_id is not null
  )
  select cc.entity_id, false
    from campaign_characters cc
   where app.is_world_member(app.campaign_world_id(p_campaign_id))
     and cc.campaign_id = p_campaign_id
     and cc.is_pc
     and cc.user_id is null
     and not exists (select 1 from links l where l.entity_id = cc.entity_id)
  union
  select l.entity_id, true
    from links l
    join entities e on e.id = l.entity_id
   where app.is_world_member(app.campaign_world_id(p_campaign_id))
     and l.claimed_by_user_id = auth.uid()
     and e.world_id = app.campaign_world_id(p_campaign_id)
     and e.deleted_at is null
     and not exists (
           select 1 from campaign_characters cc
            where cc.campaign_id = p_campaign_id and cc.entity_id = l.entity_id and cc.user_id is not null
         );
$$;

revoke execute on function public.list_claimable_characters(uuid) from public, anon;
grant execute on function public.list_claimable_characters(uuid) to authenticated;

-- 4. Réclamer un PJ pour soi. Trois cas, et seulement eux :
--    a. un PJ ouvert (`is_pc`, sans joueur) qu'aucun lien actif ne réserve ;
--    b. le PJ que réserve un lien nominatif que l'appelant a utilisé, même
--       s'il n'est pas encore ouvert dans la campagne ;
--    c. une fiche que l'appelant vient de créer lui-même (« Nouveau
--       personnage ») et qui n'est encore liée à personne dans la campagne.
--    Course-safe : chaque écriture exige `user_id is null` ; `false` si
--    quelqu'un est passé avant.
create function public.claim_campaign_character(p_campaign_id uuid, p_entity_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_world uuid := app.campaign_world_id(p_campaign_id);
  v_created_by uuid;
  v_reserved boolean;
  v_mine boolean;
  v_count int := 0;
begin
  if v_uid is null or v_world is null or not app.is_world_member(v_world) then
    return false;
  end if;

  select e.created_by into v_created_by
    from entities e
   where e.id = p_entity_id and e.world_id = v_world and e.deleted_at is null;
  if not found then
    return false;
  end if;

  select exists (
           select 1 from campaign_invites ci
            where ci.campaign_id = p_campaign_id and ci.entity_id = p_entity_id and ci.revoked_at is null
         ),
         exists (
           select 1 from campaign_invites ci
            where ci.campaign_id = p_campaign_id and ci.entity_id = p_entity_id and ci.revoked_at is null
              and ci.claimed_by_user_id = v_uid
         )
    into v_reserved, v_mine;

  if v_reserved and not v_mine then
    return false;
  end if;

  if v_mine then
    insert into campaign_characters (campaign_id, entity_id, user_id, is_pc)
    values (p_campaign_id, p_entity_id, v_uid, true)
    on conflict (campaign_id, entity_id) do update
      set user_id = excluded.user_id, is_pc = true
      where campaign_characters.user_id is null;
    get diagnostics v_count = row_count;
    return v_count > 0;
  end if;

  update campaign_characters
     set user_id = v_uid
   where campaign_id = p_campaign_id and entity_id = p_entity_id and is_pc and user_id is null;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    return true;
  end if;

  if v_created_by = v_uid then
    insert into campaign_characters (campaign_id, entity_id, user_id, is_pc)
    values (p_campaign_id, p_entity_id, v_uid, true)
    on conflict (campaign_id, entity_id) do nothing;
    get diagnostics v_count = row_count;
  end if;
  return v_count > 0;
end;
$$;

revoke execute on function public.claim_campaign_character(uuid, uuid) from public, anon;
grant execute on function public.claim_campaign_character(uuid, uuid) to authenticated;

-- 5. La page `/rejoindre` doit savoir si un lien est nominatif (et déjà
--    utilisé par quelqu'un d'autre) avant de créer un compte. Même
--    enveloppe que la migration 20261013150000, une colonne de plus.
drop function if exists public.resolve_campaign_invite(text);

create function public.resolve_campaign_invite(p_token text)
returns table (
  id uuid,
  campaign_id uuid,
  world_id uuid,
  intended_role text,
  claimed_by_user_id uuid,
  claimed_name text,
  has_password boolean,
  password_attempts int,
  entity_id uuid
)
language sql
stable
security definer
set search_path = public, app
as $$
  select r.id, r.campaign_id, r.world_id, r.intended_role, r.claimed_by_user_id, r.claimed_name,
         r.password_hash is not null, r.password_attempts, ci.entity_id
    from app.resolve_campaign_invite(p_token) r
    join campaign_invites ci on ci.id = r.id;
$$;

revoke execute on function public.resolve_campaign_invite(text) from public;
grant execute on function public.resolve_campaign_invite(text) to anon, authenticated;

-- 6. Rejoindre ne liste plus les PJ (on choisit après, sur l'écran de
--    choix). La liste anonyme par jeton n'a plus d'appelant : elle aurait
--    en plus montré à tout porteur d'un lien ouvert le nom d'un PJ réservé.
drop function if exists public.list_unclaimed_campaign_characters(text);
drop function if exists app.list_unclaimed_campaign_characters(text);
