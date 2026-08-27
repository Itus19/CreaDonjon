-- V2-H3 : bloc genealogie. Etend le vocabulaire ferme des relations
-- (docs/SCHEMA.md §8) avec quatre types demandes par l'utilisateur —
-- jamais de texte libre, la contrainte CHECK reste la seule porte
-- d'entree pour un nouveau type. Ajoute aussi le declencheur anti-cycle
-- sur parent_of, miroir exact de celui deja en place sur part_of
-- (20260729200943_entities.sql) : un arbre genealogique qui boucle
-- tournerait a l'infini jusqu'a sa limite de profondeur a chaque affichage.

-- Le nom du CHECK d'origine est genere par Postgres (jamais nomme
-- explicitement dans 20260729200943_entities.sql) : on le retrouve par le
-- catalogue plutot que de parier sur `relations_relation_type_check`, pour
-- ne jamais echouer silencieusement sur un nom different en production.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'relations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%relation_type%'
  loop
    execute format('alter table relations drop constraint %I', con.conname);
  end loop;
end $$;

alter table relations add constraint relations_relation_type_check check (relation_type in (
                    -- famille
                    'parent_of','sibling_of','married_to','adopted_by','ancestor_of',
                    'partner_of','ex_partner_of','half_sibling_of','step_parent_of',
                    -- social
                    'friend_of','rival_of','mentor_of','serves','member_of','leads',
                    -- spatial
                    'part_of','located_in','origin_of',
                    -- possession
                    'owns','created','carries',
                    -- narratif
                    'knows','loves','hates','participated_in','witnessed'));

create or replace function app.check_parent_of_no_cycle()
returns trigger language plpgsql as $$
begin
  if new.relation_type <> 'parent_of' then
    return new;
  end if;

  if exists (
    with recursive ancestors as (
      select new.source_entity_id as id
      union all
      select r.source_entity_id
        from relations r
        join ancestors a on r.target_entity_id = a.id
       where r.relation_type = 'parent_of'
    )
    select 1 from ancestors where id = new.target_entity_id
  ) then
    raise exception 'parent_of introduit un cycle';
  end if;

  return new;
end;
$$;

create trigger relations_parent_of_no_cycle_check
  before insert or update on relations
  for each row execute function app.check_parent_of_no_cycle();
