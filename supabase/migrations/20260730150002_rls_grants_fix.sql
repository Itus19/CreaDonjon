-- Correctif a la migration 012 : le schema app n'accordait USAGE a
-- personne d'autre que le role qui l'a cree. Sans cela, authenticated ne
-- peut meme pas resoudre app.is_world_member(...) dans une politique RLS —
-- EXECUTE sur la fonction ne suffit pas sans USAGE sur son schema.
--
-- CLAUDE.md, regle absolue 10 : une migration appliquee n'est jamais
-- modifiee, on en ecrit une nouvelle, meme pour reparer un oubli decouvert
-- pendant la verification du meme ticket (P0-07).

grant usage on schema app to authenticated;
