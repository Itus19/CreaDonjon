-- V1-E4 : ajoute 'combat' aux natures d'evenement possibles dans le
-- journal de session (specs/outils-mj.md §5.3 : "chaque modification de
-- combat ecrit un session_event", annuler = appliquer l'evenement
-- inverse). Distinct de 'world_update' (mutation de fiche via
-- entity_runtime_state) : un evenement de combat porte en plus l'etat
-- avant/apres du participant ou du combat, pour une annulation generique
-- sans logique d'inverse par type d'action.
--
-- Le nom exact de la contrainte inline (auto-genere par Postgres) n'est
-- pas suppose : retrouve dynamiquement via pg_constraint plutot qu'un nom
-- fige qui casserait la migration s'il differait.
do $$
declare
  c_name text;
begin
  select conname into c_name
  from pg_constraint
  where conrelid = 'session_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%kind%';

  execute format('alter table session_events drop constraint %I', c_name);
  execute 'alter table session_events add constraint session_events_kind_check
    check (kind in (''player_action'',''narration'',''roll'',''rule_application'',''world_update'',''note'',''system'',''combat''))';
end $$;
