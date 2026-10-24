# 0087 — La sexualité dans la psyché

**Date :** 2026-10-24
**Statut :** proposée (V4-B1, V4-E7)

## Contexte

La sexualité est un besoin humain et un grand enjeu social que les jeux évitent souvent. L'auteur veut qu'elle existe dans la psyché et la simulation, sans confondre attirance, envie et volonté, et sans jamais franchir les limites du consentement et de l'âge.

## Options envisagées

- **A.** N'en garder que l'attirance (V2) — pas de besoin, pas d'enjeu.
- **B.** Une couche complète, avec trois notions séparées : attirance (orientation), libido (`lust_propensity`), rapport au sexe (`sex_attitude` : réfractaire, indifférent·e, favorable).

## Décision

**B.** Facettes `sexual_curiosity` et `body_modesty` ; valeurs `sexual_freedom` (pôle négatif : la chasteté) et `fidelity` ; besoins `intimacy` (selon libido et rapport au sexe) et `tenderness` (non sexuel, ouvert à tous) ; émotions `fulfillment` et `insecurity` ; rêves `be_desired`, `explore_desires`, `win_over` ; éthiques `sex_work`, `seduction_for_gain`, `sexual_violence` ; préférences `attraction` et `intimate` ; lien `fling` ; événements, actions et réputations associés. **Le consentement est une condition du moteur. Jamais de mineur.** `sexuality_simulation` se règle séparément de `romance_simulation`. Détail : `specs/psyche-v4.md` §2, §3, §4, §5, §6, §9.5 ; `specs/simulation-monde.md` §8.5.

## Conséquences

- Une personne asexuelle peut avoir une libido ; le besoin `intimacy` suit son rapport au sexe, pas son étiquette.
- Le récit reste réglé par `intimate_narration`.
