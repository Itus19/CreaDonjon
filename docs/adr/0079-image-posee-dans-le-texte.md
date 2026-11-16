# 0079 — Une image se pose dans le texte, à n'importe quel endroit d'une phrase

**Date :** 2026-11-09
**Statut :** acceptée (V3.1-189 ; option B choisie par l'auteur, esquisses validées)

## Contexte

Le bloc image se plaçait par un curseur à crans « avant tel paragraphe » (V2.1-11), réglé depuis le bloc image lui-même, avec un aperçu. L'auteur veut un placement à la souris dans le texte, comme dans un traitement de texte, et une bulle d'habillage du même style que celle du gras et du spoiler.

## Options envisagées

- **A** : entre deux paragraphes seulement. Aucun changement de format : le champ `anchor` existant suffit.
- **B** : n'importe où, au milieu d'une phrase. Un élément nouveau dans le contenu des segments.

## Décision

**B**, choisi par l'auteur.

- Le contenu d'un segment accepte `{ t: "image", blockId }` (`zSegmentContentNode`). Le nœud ne porte que la position. Adresse, légende, habillage (`anchorFlow`), alignement et taille restent sur le bloc image ; la bulle de l'éditeur de texte les y écrit.
- **Aucun champ « dans le texte » n'est stocké** : une image est dans le texte dès qu'un paragraphe de la fiche la cite (valeur dérivée, règle 16). Le texte prime sur l'ancien ancrage par paragraphe, qui reste lu pour les blocs non retouchés.
- **Visibilité** (règle de l'auteur) : une image cachée à un lecteur l'est partout, texte compris ; le texte se comporte comme si elle n'était pas là. `applyInlineImageVisibility` retire le nœud côté serveur, avant l'envoi (règle 5), et supprime un paragraphe qui ne contenait qu'elle. Une image visible posée dans un paragraphe caché disparaît avec lui, sans retomber dans le fil ; si elle sert de fond de page, elle le reste (« fond seul » pour ce lecteur).
- Les valeurs d'infobox gardent un format sans image (`zMentionNode`).
- Les duplications (fiche, monde) et l'import recalent les identifiants de blocs cités (`remapBlockIds`) ; l'export porte désormais l'id d'origine de chaque bloc (`ref`, facultatif).

## Conséquences

- L'éditeur charge toujours l'extension `inlineImage`, y compris dans le cahier de notes : sans elle, Tiptap jetterait le nœud et la sauvegarde suivante effacerait l'image.
- Dans l'**éditeur**, les segments d'un bloc texte arrivent entiers, comme avant ce ticket : un compte qui édite le texte reçoit l'identifiant d'une image qu'il ne voit pas (rien ne se dessine). Pas de donnée d'image, seulement l'identifiant ; le retirer effacerait la place de l'image à la sauvegarde.
- Le curseur à crans, l'aperçu et la barre d'alignement quittent le bloc image.
- Un fichier exporté avant ce ticket s'importe toujours, mais ses images posées dans le texte n'y sont pas recalées.
