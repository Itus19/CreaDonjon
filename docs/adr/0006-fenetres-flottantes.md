# 0006 — Fenêtres flottantes avec URL, en remplacement du panneau unique

**Date :** 2026-07-31
**Statut :** acceptée

## Contexte

`specs/coquille-et-design.md` §4.2 avait tranché pour un panneau unique en V0 (une fiche, une page, une URL), reportant le multi-panneau façon « bureau » de l'ancienne application (`master`, avant la refonte) à la V1. Après avoir vu le résultat en conditions réelles, l'écart avec l'ancienne application s'est révélé trop grand : ce n'est pas un détail de finition (couleurs, ombres) mais le modèle d'interaction lui-même qui manque — plusieurs fiches ouvertes simultanément, en fenêtres déplaçables sur un bureau.

Vérification du code de `master` (`WorldDesktop.tsx`) : les fenêtres de l'ancienne application n'avaient **aucune URL propre** — un simple état React côté client. Conséquence concrète, déjà documentée comme le défaut à éviter (§4.1) : aucun lien partageable vers une fiche précise, aucun bouton retour fonctionnel, un rechargement qui perd tout.

## Options envisagées

- **A. Rester sur le panneau unique routé** — le plus simple, mais l'écart avec l'attente reste entier.
- **B. Fenêtres flottantes fidèles à l'ancienne app, sans URL** — visuellement le plus proche le plus vite, mais réintroduit sciemment la régression que le choix initial évitait.
- **C. Hybride : fenêtres flottantes, mais chaque fiche ouverte reste une URL** — la première fiche dans `/m/[monde]/f/[fiche]` (rendue serveur), les suivantes via un paramètre `?avec=slug1,slug2` (repris du multi-panneau déjà prévu pour la V1 dans le spec), récupérées côté client. Complexité réelle (position/z-index à synchroniser avec l'URL), mais concilie les deux exigences.

## Décision

**C.** Le multi-panneau prévu pour la V1 est avancé en V0, et son exécution visuelle devient des fenêtres déplaçables/redimensionnables plutôt que des panneaux fixes côte à côte — mais sans jamais renoncer à l'URL par fiche.

## Conséquences

- `specs/coquille-et-design.md` §4.2 est mis à jour : le multi-panneau n'est plus « V1 », son mécanisme d'URL (`?avec=`) est celui décrit ici.
- `<Panel>` cesse d'être le conteneur plein-page unique ; une nouvelle couche de gestion de fenêtres (position, taille, pile de z-index) devient nécessaire, avec un état à synchroniser avec l'URL sans boucle infinie.
- Une fiche ouverte via `?avec=` n'a pas de rendu serveur propre : une route API dédiée doit exposer les mêmes données que la page (entité, blocs, relations, autres entités) pour un rendu client.
- Sur petit écran, la mécanique de fenêtres déplaçables ne s'applique pas : repli sur l'affichage plein écran déjà existant (aucune régression sur le critère 375px de V0-03b).
