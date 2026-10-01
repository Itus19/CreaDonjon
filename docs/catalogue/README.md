# Catalogue d'interface — mode d'emploi

Le catalogue montre chaque élément d'interface **tel qu'il est codé**, avec ses états et ses animations. La règle écrite vit dans `docs/CHARTE-UI.md` (son §9 indexe les planches) ; ce dossier est la source du visuel. Décision : ADR 0033.

- **Canevas publié** : https://claude.ai/artifact/LcTPxvcvSbg1TdMqyrJD3G (privé, celui de l'auteur).
- **Sources** : un fichier `.dc.html` par planche, et `canvas.json` (position et taille de chaque planche sur le canevas).
- **Style** : jamais recopié. Chaque planche charge le CSS compilé de l'application, produit par `scripts/catalogue/build-css.mjs`.

## Quand toucher au catalogue

- Un **élément nouveau** (un composant, ou un motif qu'un écran introduit) → une section dans la planche de sa famille.
- Un **élément modifié** (classes, états, transition) → sa section reflète le nouveau code.
- Un élément **supprimé** → sa section part avec lui.

Seuls les **états qui existent dans le code** sont montrés. Un état qu'on aimerait ajouter (un « appuyé », par exemple) se décide d'abord, se code ensuite, et entre au catalogue en dernier.

## Anatomie d'une section

Chaque section `<section id="…">` suit le même ordre ; copier une section voisine est la façon la plus sûre d'en écrire une :

1. **Titre** et **composant** à utiliser (chemin du fichier).
2. **La règle**, en une à trois phrases.
3. **Mouvement** : la transition réelle (`transition-colors` = couleurs, 150 ms, `cubic-bezier(0.4, 0, 0.2, 1)`), ou « aucun ».
4. **Les états figés**, côte à côte, chacun dans une case libellée. Les classes sont **exactement** celles du composant, plus :
   - `st-hover` pour montrer le survol, `st-focus` pour le focus clavier, `st-active` pour l'appui (dérivées des vraies règles `:hover`, `:focus-visible`, `:active` par `build-css.mjs`) ;
   - l'attribut `disabled=""` pour l'état désactivé (c'est la vraie règle `disabled:` qui s'applique).
5. **« À essayer »** (facultatif) : un exemplaire vivant, branché sur l'état du script en bas du fichier. « Rejouer » relance une animation.

Le script de chaque planche est le même partout (état des exemplaires vivants, sélecteur de mode). Un nouvel exemplaire vivant ajoute sa clé d'état et ses valeurs dans `renderVals()` — de préférence dans les neuf fichiers, pour qu'ils restent identiques.

Format des fichiers : celui du canevas « Design » (`{{trou}}` = une valeur de `renderVals()`, jamais une expression ; `<sc-for>`, `<sc-if>` pour répéter et conditionner ; balises toujours fermées, attributs toujours entre guillemets).

## Reconstruire et publier

Dans une session Claude (l'outil Artifact est nécessaire pour publier) :

1. `node scripts/catalogue/build-css.mjs /tmp/catalogue.css` — compile `app/globals.css` avec les planches comme source et ajoute les variantes d'état.
2. Téléverser ce CSS comme ressource du canevas ; remplacer l'adresse `/_blob/…` du `<link rel="stylesheet">` en tête de **chaque** planche par la nouvelle.
3. **Hauteur** : une planche ne doit pas dépasser **8 000 px** (limite du canevas : au-delà, la fin est coupée). Mesurer la hauteur rendue (navigateur sans tête, largeur 1 280 px), puis reporter dans `canvas.json` (`h`) et dans `data-props` (`$preview.height`) une valeur un peu plus grande. Une planche qui approche la limite se coupe en deux.
4. Publier les planches modifiées (et `canvas.json` si une planche est ajoutée, déplacée ou redimensionnée).
5. Committer ici les mêmes fichiers : le dépôt et le canevas doivent rester identiques.

## Pourquoi `@source not "../docs"` dans `app/globals.css`

Tailwind lit tout le projet pour savoir quelles classes générer. Sans cette exclusion, les classes propres au catalogue (mise en page des planches) entreraient dans la feuille de l'application. `build-css.mjs` retire cette ligne et ajoute `docs/catalogue` explicitement.
