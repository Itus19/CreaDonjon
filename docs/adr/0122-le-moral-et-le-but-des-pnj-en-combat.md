# 0122 — Le moral et le but des PNJ en combat

**Date :** 2026-11-28
**Statut :** acceptée le 28 novembre 2026 (choix de l'auteur, option B : « moral et but dans le combat »). Précise les points 5 et 7 de l'ADR 0121.

## Contexte

Depuis l'ADR 0121, le moteur décide qui entre en combat (liens, garde, peur, archétype), et les PNJ jouent une tactique fixe : viser le personnage, frapper. Une fois entrés, ils se battent jusqu'à 0 PV, tous de la même façon. L'auteur veut une bataille cohérente avec la psyché : on fuit avant de mourir, on a peur, on poursuit un but.

Dwarf Fortress (la méthode, pas le contenu, ADR 0104) : des traits de personnalité, dont la bravoure, des valeurs et des rêves ; la douleur, les blessures et la peur font fuir ou céder, par seuils calculés ; en mode aventure, un adversaire blessé peut se rendre.

## Options

(A) Un test de moral seul ; (B) **le moral, plus un but dans le combat tiré de la psyché, qui oriente la cible et les gestes** ; (C) B, plus le choix de l'action par l'IA dans une liste fermée. **Retenu par l'auteur : B.** C pourra s'y ajouter sans rien défaire (V3.2-73).

## Décision

1. **Le but**, fixé à l'entrée dans le combat par une fonction pure (`butDeCombat`, `src/core/rules/combatMinds.ts`) :
   - `arreter` : la garde. Elle vise l'agresseur.
   - `piller` : le malfrat, ou un tempérament égoïste qui préfère la richesse à l'honneur. Il vise l'ennemi le plus faible et lâche vite.
   - `defendre` : celui qui entre pour un ami (camp de la cible ou de l'agresseur). Il vise celui qui menace son protégé.
   - `survivre` : la cible qui craint son agresseur, ou qui tient à la paix. Elle ne s'approche pas : elle frappe si on est au contact, sinon elle esquive.
   - `vaincre` : tous les autres. Ils visent le personnage d'abord.
2. **Le modificateur de moral**, calculé une fois à l'entrée : la peur envers l'adversaire (fear_assurance), l'impulsivité, les aspirations de toute une vie (on a quelque chose à perdre), l'archétype (la garde tient, le malfrat moins) et le but. Borné à ± 6.
3. **Le test de moral**, au début du tour du PNJ, une fois par déclencheur : passé à la moitié de ses PV (DD 10), un allié tombé ou en fuite (DD 10), seul contre plusieurs (DD 12). Le moteur lance d20 + modificateur (dés du serveur, règle 8). Raté : il **fuit** ; s'il est au contact et à un quart de ses PV ou moins, il **se rend**. Un 20 tient toujours, un 1 lâche toujours.
4. **Fuir** le sort du combat et de la pièce. **Se rendre** le laisse là, sans agir ; personne ne frappe plus un ennemi rendu. Un PNJ ne vise jamais quelqu'un qui a fui ou s'est rendu.
5. **Fin du combat** : quand plus aucun ennemi du personnage ne veut ou ne peut se battre (0 PV, fui, rendu), `endCombat` le clôt et l'heure avance.
6. **Où ça vit.** Les esprits du combat (but, protégé, modificateur, état, déclencheurs déjà testés) vont dans l'état de scène (`combatMinds`), lu sans requête à chaque tour. « Annuler ce tour » restaure la scène, donc aussi le moral. Aucune migration.
7. L'IA ne décide rien ici : elle reçoit l'issue de chaque test (« tient bon », « s'enfuit », « se rend ») comme un fait, et la raconte. Le but ne s'écrit pas dans la ligne du tour, qui est publique : il se voit aux gestes (la garde vise l'agresseur, le malfrat le plus faible).

## Conséquences

- Coût (QUOTAS) : à l'ouverture, une lecture groupée de plus (les visions du monde) ; à chaque tour, rien de plus que l'ADR 0121, et une écriture de scène quand un esprit change.
- Le but se lit aussi pour un PNJ qui entre plus tard (V3.2-74, renforts), quand le recalcul des camps sera codé.
- **Hors périmètre** : la reddition du personnage, épargner ou achever un PNJ rendu, la poursuite d'un fuyard, le coup qui assomme plutôt que tue, l'attitude qui change après le combat (V3.2-15).
