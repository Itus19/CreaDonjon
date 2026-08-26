-- Message d'accueil personnalisable du wiki public (V2-G2, extension sur
-- retour utilisateur) : remplace le gros titre du monde/de la campagne sur
-- la page d'accueil du lien de partage. `null` tant que la personne n'a
-- rien saisi -- l'appelant retombe alors sur un message par defaut calcule
-- (nom de la campagne), jamais stocke tant qu'il n'est pas personnalise.
alter table worlds add column wiki_welcome_message text;
