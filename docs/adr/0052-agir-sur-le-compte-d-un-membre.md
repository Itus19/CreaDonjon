# 0052 — Agir sur le compte d'un autre : membre de la campagne, et compte « tag » seulement

**Date :** 2026-10-09
**Statut :** acceptée (faille trouvée en préparant V3.1-12)

## Contexte

« Forcer une réinitialisation » depuis Gestion de campagne (`forceMemberPasswordReset`) vérifiait que l'appelant administrait le monde de la campagne, puis émettait un lien de réinitialisation pour l'identifiant reçu. Il ne vérifiait **ni que la cible était membre de cette campagne, ni le type de compte**.

Créer un monde est libre, et un compte se crée en libre-service depuis `/login`. N'importe qui pouvait donc obtenir un lien de réinitialisation pour n'importe quel compte, superadmin compris, et le prendre. V3.1-12 (« voir comme » pour un MJ) demande exactement la même règle d'accès.

## Décision

Une fonction pure, `canActOnMemberAccount` (`src/core/accounts/memberAccountActions.ts`), décide pour les deux gestes, `view_as` et `reset_password` :

- **superadmin** : partout, sauf « voir comme » sur un compte ordinaire ;
- **MJ** (administrateur du monde de la campagne d'où il agit) : seulement sur un **membre de cette campagne**, et seulement sur un **compte « tag »** ;
- **tout autre appelant** : refusé.

Un compte « tag » se reconnaît à son email synthétique, `@creadonjon.tag` ou `@creadonjon.invite` pour les comptes d'avant V3.1-10 (`isSyntheticAccountEmail`). Le module confiné `accountAuth.ts` ne rend qu'un booléen (`isSyntheticAccount`), jamais l'email. `decideMemberAccountAction` (`campaigns.ts`) rassemble les faits.

## Conséquences

Un MJ ne peut plus rien sur un compte qui n'est pas à sa table, ni sur un compte qui a un vrai email : celui-ci se réinitialise par son email. Le panneau Administration (`adminForcePasswordReset`) garde sa portée superadmin, inchangée.
