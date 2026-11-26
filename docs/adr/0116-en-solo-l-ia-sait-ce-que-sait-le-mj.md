# 0116 — En solo, l'IA sait ce que sait le MJ, à part de ce que sait le personnage

**Date :** 2026-11-26
**Statut :** acceptée le 26 novembre 2026 (choix de l'auteur dans le fil « Faire avancer l'intrigue en narration solo », option « Oui, en deux parts séparées ») ; amende la règle absolue 11 pour la seule narration du tour solo.

## Contexte

La règle 11 bornait le contexte d'un modèle à l'audience de sa sortie : la narration solo part à la personne qui joue, donc l'IA ne recevait que ce qu'elle peut lire. Résultat en jeu : des PNJ sans intériorité, qui ne peuvent ni mentir ni cacher quoi que ce soit, puisque l'IA ignore ce qu'ils cachent. Pour l'auteur, en solo, le moteur et l'IA sont les deux hémisphères du cerveau du MJ : les deux savent tout, l'un décide et compte, l'autre raconte. Seul le personnage voit le monde à travers un brouillard, et le wiki qu'il peut lire est sa base de connaissance.

Constat associé : la personne qui joue en solo est propriétaire du monde, donc son lecteur voyait déjà tout. La « description » envoyée à l'IA pouvait donc contenir un secret, sans que rien ne le distingue de ce que le personnage sait.

## Options

- **A — Deux parts séparées** : ce que le personnage sait, puis à part ce que seul le MJ sait, avec la consigne de le faire agir sans jamais le dire. Retenue.
- **B — Seulement la personnalité et les buts des PNJ.** Écartée : trop étroit, les secrets de lieu (un passage, un objet caché) manquent.
- **C — Garder la règle 11.** Écartée par l'auteur.

## Décision

1. La narration du tour solo lit chaque page deux fois (`lecteursDuTour`, `src/server/services/turnContext.ts`). Le lecteur « joueur » est celui d'un joueur de la campagne (`genericPlayerViewer`) quand la personne qui joue est MJ ou propriétaire ; sinon c'est son propre lecteur, et il n'y a aucun secret. Le lecteur « MJ » est le lecteur réel.
2. Ce que le personnage sait (description du lieu, première ligne de chaque PNJ présent) vient du lecteur « joueur ». Les paragraphes que le MJ lit et que le joueur ne lit pas (`secretsEntre`, 500 caractères par entité) vont dans une balise `secrets-du-mj`, pour le lieu et les PNJ présents seulement.
3. Une consigne (`SECRETS_INSTRUCTION`) interdit d'en écrire le contenu dans la narration, une réplique ou une `world_note`, sauf ce que les faits établis du tour font découvrir. Un PNJ peut mentir ou se taire pour le cacher.
4. La question au MJ hors du temps de jeu (`buildSoloGmQuestionContext`) ne reçoit pas les secrets : la règle 11 s'y applique telle quelle, comme à tout autre appel.

## Conséquences

- Risque accepté : un petit modèle local peut laisser fuir un secret. La séparation en deux parts et la consigne le limitent ; un secret qui fuit reste un texte du récit, il n'écrit rien en base.
- Les notes du monde (ADR 0114) sont écrites en paragraphes publics : la consigne leur interdit de reprendre un secret.
- Le brouillard de guerre (des capacités passives qui dévoilent des paragraphes au fil de la perception) n'est pas encore construit : ce qui passe d'une part à l'autre dépend aujourd'hui de la visibilité des paragraphes. C'est un chantier à part.
- Les quêtes et les lieux voisins sont encore lus avec le lecteur réel : à revoir avec le brouillard.
