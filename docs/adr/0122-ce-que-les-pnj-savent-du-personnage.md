# 0122 — Ce que les PNJ savent du personnage

**Date :** 2026-11-28
**Statut :** acceptée le 28 novembre 2026 (accord de l'auteur sur la migration, fil « Fiche allégée des PNJ »). Suit les ADR 0117 (en solo, l'IA sait ce que sait le MJ) et 0118 (fiche allégée et indices).

## Contexte

Demande de l'auteur, 27 novembre : les PNJ ne connaissent ni l'équipement ni les caractéristiques du personnage. Ils les découvrent par des jets. Le moteur retient, sans le montrer, ce que chacun sait. Un PNJ peut le répéter à un autre, ou faire courir une rumeur fausse. Second retour, le même jour : le personnage peut cacher quelque chose (un bandage sur un tatouage, une arme sous la cape). Seule une approche précise le trouve, et un échec se dit comme une absence.

Le miroir existe déjà dans l'autre sens : `entity_facet_discoveries` (ce que la personne qui joue sait d'un PNJ), `facetsRevealedByCheck` (quelles facettes un jet révèle), `conceal_dc` sur les objets d'inventaire. Les jets des PNJ existent aussi (`npc_check`, V3.2-52).

## Options

**Où le retenir.** (a) Étendre `entity_facet_discoveries` avec une colonne « qui sait » ; (b) **une table à part, `npc_knowledge`**. La première est lisible par les membres de la partie (lignes de toute la table) ; y glisser un secret du MJ demanderait de compliquer sa RLS, et une rumeur fausse n'est pas une facette. **Retenu : (b).**

**Rumeurs.** (1) Le moteur les tire seul ; (2) **l'IA les propose dans le récit, le moteur les enregistre** comme fausses, avec leur source. (1) demanderait une table de rumeurs par lieu, sans besoin concret aujourd'hui. **Retenu : (2).**

## Décision

1. **La table** `npc_knowledge` : partie, PNJ qui sait (`knower_entity_id`), sujet (`subject_entity_id`, le personnage joué), et soit une **facette** (même grammaire que `facets.ts` : `ability:str`, `ac`, `item:<id>`…), soit une **affirmation** en mots (300 caractères au plus). Elle porte aussi `is_true`, la **source** (`observation`, `told`, `rumour`), qui l'a dit (`told_by_entity_id`) et l'événement d'origine. **RLS : MJ du monde ou MJ de la partie seulement**, en lecture comme en écriture, et aucune mise à jour. La personne qui joue à une table ne la lit jamais.
2. **Observer.** Un PNJ à fiche qui partage la pièce du personnage connaît ce qui se voit : les objets portés et non cachés, comme dans l'autre sens. Pour le reste, la narration propose `npc_check` avec la cible `pc` (repérer, fouiller, jauger). Le moteur lance le dé (V3.2-52), puis `facetsRevealedByCheck` dit ce que le PNJ apprend, avec la fiche du personnage comme sujet.
3. **Cacher.** Un objet du personnage marqué `concealed` porte un `conceal_dc`. Quand la personne qui joue le cache, le moteur le tire d'un jet d'Escamotage ou de Discrétion (le total du jet, au moins 10). Seuls fouiller ou repérer, avec un total qui l'atteint, le trouvent. Un détail du corps (un tatouage) devient une facette `mark:<id>` d'un bloc caché, plus tard, sur la même règle.
4. **Dire.** La narration reçoit, dans la partie réservée au MJ (ADR 0117), ce que chaque PNJ présent sait du personnage : vrai ou faux, et de qui il le tient. Elle le fait agir en conséquence, sans jamais le dire à la personne qui joue.
5. **Transmettre.** La narration propose `npc_share` (de qui, à qui) : le moteur copie ce que le premier sait chez le second, source `told`, en gardant la véracité. `npc_rumour` (qui, quoi) enregistre une affirmation fausse, source `rumour`. Le moteur refuse un PNJ absent et une affirmation vide ou trop longue. Le texte est fencé quand il revient dans un prompt (règle 10).

## Conséquences

- Une migration : la table, ses index et sa RLS. Coût (docs/QUOTAS.md) : une lecture de plus par tour narré (ce que savent les présents), une écriture par jet réussi ou par partage.
- Le récit gagne des PNJ qui réagissent à ce qu'ils savent vraiment, sans que la personne qui joue puisse le lire.
- Ordre de livraison : la table et l'observation, puis le partage et les rumeurs, puis le geste de cacher.
