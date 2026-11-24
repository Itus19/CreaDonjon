-- AG-12 (ADR 0105) — « Nom pour la table » : une fiche que la table connaît
-- sans connaître son vrai nom.
--
-- entities.name est lisible par tout membre du monde (RLS d'entities) : il
-- devient donc le nom pour la table, et le vrai nom (avec ses alias, eux
-- aussi cherchables) part ici, lisible et modifiable par le MJ seul. Une
-- ligne existe tant que le nom pour la table est rempli ; le vider remet
-- le vrai nom dans entities et supprime la ligne.
create table entity_true_names (
  entity_id    uuid primary key references entities(id) on delete cascade,
  world_id     uuid not null references worlds(id) on delete cascade,
  true_name    text not null check (char_length(btrim(true_name)) between 1 and 200),
  true_aliases text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table entity_true_names enable row level security;

-- Le MJ du monde seul, en lecture comme en écriture. world_id doit être
-- celui de la fiche : jamais une ligne rangée dans un autre monde.
create policy entity_true_names_gm on entity_true_names for all
  using (app.is_world_admin(world_id))
  with check (app.is_world_admin(world_id) and world_id = app.entity_world_id(entity_id));

-- Les blocs d'un monde qui citent une fiche (texte et Encadré, les seuls qui
-- portent un texte de lien), pour renommer ces liens quand le nom pour la
-- table change. security invoker : la RLS de blocks s'applique, l'appelant
-- ne reçoit que ce qu'il peut déjà lire.
create or replace function public.blocks_citing_entity(p_world_id uuid, p_entity_id uuid)
returns setof blocks
language sql
stable
security invoker
set search_path = public
as $$
  select b.*
  from blocks b
  join entities e on e.id = b.entity_id
  where e.world_id = p_world_id
    and e.deleted_at is null
    and b.entity_id <> p_entity_id
    and b.block_type in ('text', 'infobox')
    and b.data::text like '%' || p_entity_id::text || '%';
$$;

revoke execute on function public.blocks_citing_entity(uuid, uuid) from public;
grant execute on function public.blocks_citing_entity(uuid, uuid) to authenticated;
