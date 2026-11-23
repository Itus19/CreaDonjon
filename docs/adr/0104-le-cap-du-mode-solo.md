# 0104 — Le cap du mode solo

**Date :** 2026-11-23
**Statut :** acceptée (décisions de l'auteur, novembre 2026)

## Contexte

L'audit du moteur solo et des prompts d'IA (novembre 2026) a posé à l'auteur une série de questions de direction. Ses réponses vivaient seulement dans le « Backlog du mode solo », hors du dépôt : une session qui ne l'a pas sous les yeux ne peut pas les respecter. Cet ADR les inscrit dans le dépôt pour que chaque session les suive.

## Options envisagées

- **A.** Laisser les décisions dans le document externe — chaque session doit savoir qu'il existe, ce qui n'arrive pas.
- **B.** Les recopier en entier dans `CLAUDE.md` — le fichier grossit, et il doit rester court.
- **C.** Un ADR qui les fixe, et quelques lignes de `CLAUDE.md` qui y renvoient. Retenu.

## Décision

1. **L'IA propose, le moteur décide et mémorise.** L'IA peut inventer (un lieu, un PNJ, un objet), mais seulement sous forme de proposition structurée. Le code la valide contre le wiki et les règles, puis l'ancre. Une invention chiffrée (arme, monstre) prend ses statistiques dans les règles, jamais chez l'IA. Prolonge les règles absolues 8 et 9.
2. **Le wiki est gravé dans la pierre.** Ce qui y est écrit l'emporte toujours. Une invention qui le contredit est refusée, avec au plus un nouvel essai court, puis la narration se fait sans elle. Une invention validée devient une page du wiki et entre dans le contexte des tours suivants.
3. **Les PNJ et les détails émergent d'agrégats.** Une ville est un ensemble de chiffres (population, richesse, peuples, métiers, factions, biome), pas une simulation habitant par habitant. Le moteur matérialise les personnes quand on entre quelque part, par un tirage à graine fixe (même lieu, même rôle, même résultat, sans rien stocker). On n'écrit un PNJ dans le wiki qu'au moment où l'on interagit avec lui. Chaque biome a ses listes (flore, faune, matériaux, climat) où l'IA puise.
4. **Le moteur choisit la compétence et le DD.** Une action libre incertaine se règle par un jet : le moteur choisit la compétence et fixe le DD selon la difficulté. Réussite automatique quand l'action est triviale pour ce personnage.
5. **Des espaces abstraits avant toute grille.** Un lieu se découpe en zones (la salle commune, le comptoir, l'étage). Le moteur sait ce que contient chaque zone et décide si l'on voit, tire ou se déplace de l'une à l'autre. Un objet est posé dans une zone.
6. **La carte du monde vient d'Azgaar's Fantasy Map Generator** (MIT) : export JSON ou code réutilisé, avec sa notice de licence.
7. **L'histoire du monde reprend la méthode de Dwarf Fortress, pas son code ni son contenu** : faire passer des siècles sur la carte, puis figer le résultat comme toile de fond. Les détails se figent au fil des découvertes.
8. **Le catalogue vient de trois sources** : Wikidata (données structurées CC0 seulement, jamais les textes de Wikipédia, sous CC-BY-SA), le SRD, et le contenu maison. Chaque élément garde sa source.

## Conséquences

- Le rang 3 de la hiérarchie des sources du lot C (`docs/backlog-v3/03-monde-qui-s-ecrit.md` : « le modèle, jamais pour un fait ») est amendé : le modèle peut proposer un fait, à condition qu'il soit déclaré, structuré et validé par le moteur. Les rangs 1 (le wiki) et 2 (les générateurs) gardent la priorité.
- Le choix du contexte quand le wiki devient grand reste une question ouverte (D4 du backlog solo).
- Tout ticket du solo qui s'écarte d'un de ces points s'arrête et demande à l'auteur.
