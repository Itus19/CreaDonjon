-- V2 (retour utilisateur, point 5) : bascule "afficher ou non au wiki" par
-- ligne de souvenir (personnalite/convictions ET relation). Un simple
-- booleen, pas les 6 niveaux de `visibility_level` (SCHEMA.md §4) : le
-- retour utilisateur demande "afficher ou non", jamais un choix de portee
-- campagne/utilisateur pour une ligne de journal — meme geste binaire que
-- `entities.is_public` (20260829180001) et l'oeil des bulles de relation.
--
-- Defaut `false` ("par defaut cela est masque", instruction explicite) :
-- contrairement a `entities.is_public`, ce defaut s'applique aussi bien
-- aux lignes deja existantes qu'aux nouvelles — aucun souvenir n'a jamais
-- ete visible au wiki jusqu'ici (le tableau de souvenirs n'existait meme
-- pas cote public avant ce ticket), donc rien n'est masque retroactivement
-- qui aurait ete visible avant.
alter table personality_events add column is_public boolean not null default false;
alter table attitude_events    add column is_public boolean not null default false;
