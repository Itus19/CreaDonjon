-- Jeton de partage retrouvable apres coup (decision explicite de
-- l'utilisateur, revient sur le choix initial de docs/SCHEMA.md §18) : un
-- lien de partage n'ouvre jamais qu'une vue en lecture seule du contenu
-- public d'un monde -- jamais une capacite de modification -- donc pas le
-- meme profil de risque qu'une cle d'API ou un mot de passe. `token_hash`
-- reste la colonne utilisee pour la resolution (`resolve_share_link`,
-- inchangee) ; cette colonne ne sert qu'a le reafficher dans l'interface.
-- Nullable : les liens crees avant cette migration n'ont jamais eu leur
-- jeton en clair conserve nulle part, impossible de le reconstituer.
alter table share_links add column token text;
