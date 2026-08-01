-- V1 D-01 — trouve par le test d'integration de publicShare, pas suppose :
-- `anon` n'avait jamais recu `usage on schema app`, seulement
-- `authenticated` (grant manquant depuis la Phase 0, meme categorie
-- d'oubli que celui deja documente dans docs/BACKLOG.md pour
-- `authenticated`). Consequence reelle : un visiteur veritablement
-- anonyme (aucune session, jamais le cas d'un navigateur de developpement
-- encore connecte au compte MJ) recevait "permission denied for schema
-- app" au lieu d'une page de partage — la route publique n'a jamais
-- fonctionne pour un vrai visiteur anonyme avant ce correctif.
grant usage on schema app to anon;
