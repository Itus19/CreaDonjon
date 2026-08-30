# 0016 — « Voir comme » : changement de session réel, jamais une superposition en lecture seule

**Date :** 2026-08-30
**Statut :** acceptée

## Contexte

Retour utilisateur : le superadmin veut, depuis la section Administration, voir l'interface exactement comme un ami invité la voit — et s'en servir aussi pour tester (créer un profil de test, s'y « connecter », vérifier ce qu'il voit).

Deux implémentations raisonnables, données au choix de l'utilisateur :

- **A. Superposition en lecture seule.** Le superadmin garde sa propre session ; les pages se recalculent avec les permissions du compte visé, mais toute écriture reste bloquée. Zéro risque de modifier les données de l'ami par erreur, zéro risque de perdre l'accès à son propre compte. Coût : invasif (chaque page/route doit accepter un « viewer effectif » distinct de `auth.uid()`), et ne montre pas un comportement à 100 % identique à la réalité (une action bloquée reste une action qu'on ne peut pas vérifier).
- **B. Changement de session réel.** Réutilise tel quel le mécanisme de lien magique déjà bâti pour les comptes invités (`accountProvisioning.ts`, ADR 0015) : le superadmin devient littéralement le compte visé. Coût : le superadmin peut agir comme lui (une action serait attribuée à l'ami dans le journal, jamais au superadmin) ; sans filet, on peut se retrouver bloqué hors de son propre compte — vécu concrètement pendant cette même session (un compte de test partageant les cookies du navigateur a déconnecté le compte principal).

## Décision

**Option B**, explicitement choisie par l'utilisateur après ce rappel du risque. Le filet de sécurité devient alors la partie non négociable de l'implémentation :

- Un cookie httpOnly (`view_as_admin_uid`, 1h) porte l'id du superadmin, posé au moment de démarrer « voir comme » (`/api/admin/view-as`) — c'est la seule trace de qui était connecté avant, la session courante étant déjà celle du compte visé.
- Un bandeau (`ViewAsBanner`, rendu depuis `app/layout.tsx`, donc visible sur TOUTE page) reste affiché tant que ce cookie existe, avec un bouton « Revenir à mon compte » toujours accessible.
- Le retour (`/api/admin/return-from-view-as`) relit ce cookie — jamais la session courante, qui n'est plus celle du superadmin à ce stade — et vérifie via une lecture `service_role` (`isSuperadminByIdViaServiceRole`, confinée dans `accountProvisioning.ts`) que l'id stocké est bien superadmin, avant de générer un nouveau lien magique vers ce compte.
- Restreint aux comptes réellement issus d'un lien d'invitation (`mintSessionForInvitedAccount` refuse tout autre id) — ce mécanisme sert à voir comme un ami, jamais à se connecter comme n'importe quel compte au hasard.

## Conséquences

- `accountProvisioning.ts` gagne deux usages du client `service_role` au-delà de la séquence d'origine (provisionner → réclamer → lien magique) : générer un lien pour un compte déjà existant, et lire un rôle par id sans RLS. Reste dans le même fichier unique confiné (ADR 0015) plutôt que d'ouvrir un troisième trou — même nature d'opération (auth admin GoTrue), même garde-fou (« jamais un compte non issu d'un lien »).
- Toute action effectuée pendant « voir comme » est réellement celle du compte visé — le journal fusionné (V2-M6/M7) l'attribuera à lui, jamais au superadmin. Le superadmin doit le garder à l'esprit : ce n'est pas un mode d'observation passive.
- Le bandeau de retour est la seule protection contre un blocage hors de son propre compte — le retirer ou le rendre moins visible reviendrait sur cette décision.
