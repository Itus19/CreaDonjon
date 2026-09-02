-- Diagnostic TEMPORAIRE (isolation) : remplace entities_update par
-- using(true) with check(true) pour confirmer sans le moindre doute que
-- c'est bien CETTE politique (et non un autre mecanisme) qui bloque la
-- suppression douce. Retire par une migration suivante des que confirme.
drop policy if exists entities_update on entities;
create policy entities_update on entities for update
  using (true)
  with check (true);
