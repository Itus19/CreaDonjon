# 0062 — Le mot de passe d'un lien : une preuve signée, un hash qui ne sort pas

**Date :** 2026-10-13
**Statut :** acceptée (V3.1-142, choix de l'auteur)

## Contexte

Un lien de partage et un lien d'invitation peuvent porter un mot de passe. Deux failles s'additionnaient :
- **La preuve se forgeait.** Après un bon mot de passe, le serveur posait un cookie valant « 1 ». Son nom se calcule à partir du jeton, que le visiteur a forcément. Il pouvait donc le poser lui-même : ouvrir un wiki protégé, ou **rejoindre une campagne** sans connaître le mot de passe.
- **Le hash se lisait.** `public.resolve_share_link` et `public.resolve_campaign_invite`, exécutables par `anon`, renvoyaient `password_hash`. Quiconque avait le lien pouvait le lire, puis essayer des mots de passe hors ligne, sans compteur.

## Options envisagées

- **A.** Fermer la fuite du hash : seul le serveur le lit. Le hash, redevenu secret et propre à chaque lien, signe la preuve.
- **B.** Un secret serveur nouveau (variable d'environnement) signe la preuve. La fuite du hash reste à traiter à part, et l'auteur doit ajouter la variable partout.

## Décision

**A** (auteur, 13 octobre).
- **La preuve** : `<échéance>.<HMAC-SHA-256(hash du mot de passe, jeton.échéance)>` (`src/core/shareLinks/access.ts`), vérifiée en temps constant, valable six heures. Changer le mot de passe change la clé, donc invalide toutes les preuves posées.
- **Le cookie** se lit et se pose dans des modules serveur ordinaires : `lib/shareLinks/passwordCookie.ts` et `lib/campaignInvites/passwordCookie.ts`. Jamais dans un fichier `"use server"`, dont toute fonction exportée devient une action appelable par n'importe quel navigateur.
- **Le hash** (migration `20261013150000`) :
  - `resolve_share_link` est retirée à `anon` et `authenticated`. `publicShare.ts` résout par la clé service.
  - `resolve_campaign_invite` ne renvoie plus le hash, seulement `has_password`.
  - Une fonction `campaign_invite_password_hash`, réservée à la clé service, le lit pour `accountProvisioning.ts` (`readInvitePasswordHash`).

## Conséquences

- Aucune variable d'environnement nouvelle.
- Les preuves posées avant ce changement (« 1 ») ne valent plus : un visiteur déjà déverrouillé redonne le mot de passe une fois.
- Preuves : `src/core/shareLinks/access.test.ts` (7 tests) et `linkPasswordPrivacy.integration.test.ts`.
