# 0021 — Pas de `next/image` sur les images d'entité

**Date :** 2026-09-12
**Statut :** acceptée

## Contexte

L'audit du 6 septembre (`F‑15`) relevait 11 balises `<img>` brutes contre un seul `next/image`, et concluait : *« la justification écrite est correcte, mais `next/image` accepte parfaitement une URL dynamique — ce qui manque, c'est la déclaration du domaine dans `next.config.ts` »*. Le ticket `V3-R4b` a repris ce diagnostic tel quel.

En l'implémentant, il s'est avéré faux — pas sur le détail, sur la cause.

Les images d'entité sont servies par `GET /api/assets/[id]` et `GET /api/entities/[id]/portrait`. Ces routes créent un client Supabase **à partir des cookies de session du visiteur**, puis s'en remettent à la RLS (`assets_select`, filtrée par `visibility_permits`) pour décider si *ce visiteur-là* a le droit de voir *cette image-là*. L'autorisation est donc résolue **par visiteur**, à chaque requête.

L'optimiseur d'images de Next récupère la source **côté serveur**, depuis son propre processus, sans les cookies du visiteur.

## Options envisagées

- **A. Déclarer le domaine et activer `next/image`**, comme le proposait l'audit — l'optimiseur appellerait `/api/assets/[id]` sans session : `createClient()` ne voit aucun utilisateur, la RLS refuse, `getSignedAssetUrl` renvoie `null`, la route répond 404. **Toutes les images casseraient.** Et si on lui ouvrait un accès plus large pour contourner ça, le résultat optimisé serait mis en cache **par URL** puis servi à n'importe quel visiteur — la vérification de visibilité, faite une fois pour le premier demandeur, vaudrait pour tous les suivants. C'est exactement ce qu'interdit la règle absolue n° 5 (« la résolution de visibilité se fait côté serveur, avant l'envoi »).
- **B. `next/image` avec `unoptimized`** — le navigateur récupère l'URL lui-même, avec ses cookies : l'autorisation reste juste. Mais on ne gagne alors que `width`/`height` et le chargement différé, que `<img>` sait faire nativement, au prix d'une dépendance à un composant dont on désactive la fonction principale.
- **C. Garder `<img>`**, et obtenir autrement ce que `next/image` aurait apporté.

## Décision

**C.** Les images d'entité restent des `<img>`.

Ce que `next/image` aurait apporté est obtenu par d'autres moyens, déjà en place ou ajoutés par `V3-R4b` :

- **le redimensionnement et le format moderne** sont faits **au téléversement**, pas à l'affichage : `uploadAsset` (`src/server/services/storage.ts`) ré-encode déjà tout en WebP qualité 85 et redimensionne selon `maxDimension`. L'optimisation existe donc ; elle est simplement faite une fois, en amont, plutôt qu'à chaque requête ;
- **la réservation de l'espace** est faite en CSS. Vérifié image par image : 7 des 10 `<img>` réservaient déjà leur place (`h-full w-full` dans un parent dimensionné, `aspect-[3/4]` avec largeur explicite, ou `width`/`height` calculés depuis `/api/assets/[id]/meta`). Le constat de l'audit — « sans dimensions, la page saute quand l'image arrive » — ne s'appliquait pas à elles ;
- **le chargement différé** est ajouté par `loading="lazy"` natif, qui ne demande aucune bibliothèque.

Les `eslint-disable-next-line @next/next/no-img-element` restent donc en place, et ils sont désormais justifiés par cet ADR plutôt que par une note de ligne.

## Conséquences

**Ce que ça rend plus difficile.** Les trois `<img>` qui sautent encore à l'arrivée de l'image sont les blocs `image` (vue publique, vue joueur, aperçu d'éditeur). Leur `url` peut être une **adresse externe collée** autant qu'un asset téléversé, et `zImageBlockData` ne stocke aucune dimension : on ne peut pas réserver leur espace sans connaître le rapport de l'image. Le résoudre demande d'ajouter des dimensions au schéma du bloc — un changement de forme de donnée, donc une décision de l'auteur, pas une correction d'audit. Laissé ouvert.

**Ce que ça ferme.** La question « pourquoi ce projet n'utilise-t-il pas `next/image` ? » a maintenant une réponse écrite. Sans cet ADR, le prochain audit la reposerait — celui-ci l'a posée, et sa réponse était la mauvaise.

**Ce qui reviendrait si le modèle changeait.** Cette décision tient parce que l'autorisation est **par visiteur**. Une image devenue publique pour de bon (pas de RLS, pas de session) pourrait passer par `next/image` sans rien enfreindre — les fonds fournis avec l'application, par exemple, sont dans ce cas, et c'est pourquoi `V3-R4a` a pu les traiter tout autrement.
