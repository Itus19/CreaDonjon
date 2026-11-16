# 0080 — Plusieurs demandes de disponibilités ouvertes à la fois

**Date :** 2026-11-09
**Statut :** acceptée (V3.1-190 ; esquisses validées par l'auteur)

## Contexte

Le Calendrier réel (V3.1-8) n'acceptait qu'une demande ouverte par campagne (index partiel), et une réponse avait pour clé (campagne, joueuse, jour), indépendamment de la demande. L'auteur veut lancer plusieurs demandes en parallèle, et voir côté MJ comme côté joueur qui a répondu.

## Options envisagées

- **Une demande à plusieurs « séances »** : garder la limite d'une demande, et y mettre plusieurs groupes de dates. Change l'écran plus profondément, et une séance fixée ne fermerait qu'une partie de la demande.
- **Plusieurs demandes indépendantes** : retirer la limite, rattacher chaque réponse à sa demande.

## Décision

Plusieurs demandes indépendantes.

- L'index « une seule ouverte » disparaît ; les réponses prennent un `id` et l'unicité devient (demande, joueuse, jour). Les réponses antérieures à V3.1-8 (`request_id` nul) restent lisibles.
- « Aucune date ne me va » : table `availability_declines`, pour qu'une joueuse sans aucune date compte comme ayant répondu. Cocher une date l'efface.
- Fixer une date ferme **sa** demande (le client la nomme ; le serveur vérifie qu'elle est ouverte et de cette campagne). Les autres restent ouvertes.
- Pastilles : le nombre de demandes sans réponse (rail joueur), le nombre de demandes « prêtes à fixer », où tout le monde a répondu (outil MJ). Pas de « nouvelles réponses depuis ma dernière visite », qui demanderait de retenir les visites.
- Un seul point d'entrée lit tout l'écran (`requests/open`, `getSchedulingBoard`), pour le MJ comme pour la joueuse.

## Conséquences

- La migration doit être appliquée **avant** le déploiement du code : l'enregistrement d'une réponse vise la nouvelle contrainte d'unicité.
- Les pastilles coûtent quatre lectures légères par chargement de layout, quel que soit le nombre de demandes.
- La route `worlds/[worldSlug]/scheduling/open-request` disparaît, remplacée par `requests/open`.
