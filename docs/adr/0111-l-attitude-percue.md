# ADR 0111 — L'attitude perçue : ce qu'un PNJ laisse voir

**Statut :** accepté, 25 novembre 2026 (V3.2-13). L'auteur a choisi l'option 1.

## Contexte

L'écran solo va montrer, pour chaque personne présente, comment elle semble percevoir le personnage (V3.2-14 : un anneau d'amitié, un cercle rose d'attirance). L'auteur a posé la règle le 25 novembre : **l'écran montre la perception du joueur, pas la vérité**. Un PNJ peut ne pas ressentir ce qu'il montre, et tromper.

Aujourd'hui, `entity_attitudes.axes` (sept axes de −100 à +100, `specs/psyche-pnj.md` §3) porte ce que le PNJ **ressent**. Rien ne porte ce qu'il **montre**.

Deuxième décision de l'auteur, le même jour : les romances sont **activées par défaut dans tous les mondes**, et le cercle rose n'apparaît que quand le PNJ a montré de l'attirance. Cela corrige `specs/psyche-pnj.md` §3, qui recommandait l'axe d'attirance en visibilité `gm` par défaut.

## Options pour la façade

1. **Une seconde série d'axes par paire.** `entity_attitudes.shown_axes jsonb` (nul = le PNJ montre ce qu'il ressent) et `attitude_events.shown_deltas jsonb` (journal de la façade, rejoué comme les vrais deltas). Une tromperie qui évolue (un traître qui devient de plus en plus aimable) se représente avec la même mécanique que le reste, amortissement compris.
2. **Un masque figé sur le bloc `relationship`** : « affiche : cordial » par axe. Pas de migration, mais le bloc vit au niveau du monde, alors que l'attitude est propre à une campagne (ADR 0013) : le masque serait le même dans toutes les parties, et il ne bouge pas avec le jeu.
3. **Une dérivation sans stockage** : perçu = ressenti, sauf pour un PNJ marqué dissimulateur, dont l'écran montre « neutre ». Rien à stocker, mais impossible de jouer un mensonge précis (« il te sourit alors qu'il te hait »).

## Décision

**Option 1**, choisie par l'auteur. C'est la seule qui laisse une tromperie vivre et évoluer avec la partie, et elle réutilise le journal en ajout seul, le rejeu et l'amortissement existants (`src/core/psyche/apply.ts`).

Dans toutes les options, **sans façade, le perçu est le ressenti**. La couche d'affichage de V3.2-14 peut donc être construite dès maintenant sur une fonction pure (`src/core/psyche/perception.ts`) qui prend les deux séries d'axes ; une paire sans façade lui passe `null`.

## Règles, quelle que soit l'option

- **Ce qui part au client** : la bande perçue d'amitié, et celle d'attirance seulement si elle est positive (intrigué·e, attiré·e, épris·e). En mots ou en cran, jamais le nombre (`specs/psyche-pnj.md` §1.5). La valeur ressentie, quand elle diffère, ne quitte jamais le serveur (règle absolue 5).
- **Une personne sans attitude enregistrée envers le personnage** n'a pas d'anneau : on ne sait rien d'elle, on n'affiche pas « indifférent ».
- **Ce que reçoit le modèle** (règle 11) : la vérité ET la façade, sous une consigne explicite (« ce qu'il ressent ; ce qu'il laisse voir : narre seulement ce qu'il laisse voir »). Sans la vérité, le narrateur ne peut pas laisser filtrer un indice ; c'est la même discipline que `known_as`.
- **Qui écrit la façade** : le MJ, et l'IA par proposition validée (règle 9), avec les mêmes seuils de signalement que les vraies attitudes (deux crans ou plus : signalé).

## Conséquences

- Migration `20261125150000_attitude_percue.sql` : deux colonnes jsonb, aucune table, RLS inchangée puisque les politiques portent sur la ligne. `docs/SCHEMA.md` et `specs/psyche-pnj.md` mis à jour.
- L'écran lit la façade dès maintenant (`loadSceneView`, `perceivedBy`). L'écrire (MJ, proposition de l'IA, rejeu qui reconstruit `shown_axes`) et la donner au narrateur sous consigne est le ticket V3.2-15.
- **Limite connue, antérieure à cet ADR** : la politique `entity_attitudes_select` laisse tout membre du monde lire la ligne entière. En solo, la personne qui joue est propriétaire du monde : rien ne fuit qu'elle ne puisse déjà voir. En campagne à plusieurs, une joueuse qui interrogerait la base directement lirait le ressenti d'un PNJ. Le resserrer (lecture réservée au MJ, la couche service lisant pour les autres) est une décision de RLS à part, à prendre avant qu'une table jouée à plusieurs n'utilise les façades.
- L'écran du solo lit une requête de plus par chargement de scène (les attitudes des présents envers le personnage, une seule requête groupée) : à compter dans `docs/QUOTAS.md`.
- La désactivation des romances par monde reste prévue par la spécification mais n'est pas construite : aucun monde n'en a besoin aujourd'hui.
