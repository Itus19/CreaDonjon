# 0067 — Les mentions dans une valeur d'Encadré

**Date :** 2026-10-25
**Statut :** acceptée (V3.1-66, choix de l'auteur)

## Contexte

V3.1-66 veut que « @ » dans une valeur d'Encadré cite une fiche, « même mention que dans le texte ». Une valeur d'Encadré était une simple chaîne ; une mention du texte est un nœud structuré (`{ t: "ref", kind, id, label }`).

## Options envisagées

- **A.** Des jetons dans la chaîne (`[[fiche|libellé]]`) : aucun changement de forme, mais un second format de mention à maintenir.
- **B.** Des nœuds, comme le texte : la valeur devient chaîne **ou** liste de `zSegmentContentNode`.

## Décision

B (choix de l'auteur). `zInfoboxValue = string | SegmentContentNode[]` : les anciennes valeurs restent valides, rien à migrer. Une valeur sans mention s'enregistre toujours en chaîne (`normaliserValeur`). Le serveur résout les mentions comme pour le texte (`textRefs`), et seule une fiche visible du lecteur devient un lien (règle 5) ; le libellé, texte écrit par l'auteur, reste affiché.

## Conséquences

Lecteurs en texte brut (`infoboxValueText`) : générateur de scène, âge du mode solo. Rendu public par `renderNode`, le même que le texte. Test d'intégration : une fiche masquée citée ne part jamais comme lien (`publicShare.integration.test.ts`).
