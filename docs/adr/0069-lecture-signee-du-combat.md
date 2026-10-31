# 0069 — Le moteur lit le combat au nom d'un joueur : lecture signée

**Date :** 2026-10-31
**Statut :** acceptée (V3.1-107, choix de l'auteur)

## Contexte

Pour résoudre l'attaque d'un joueur (V3.1-107), le moteur doit lire la cible : sa CA, ses PV, son bloc de stats. Depuis l'ADR 0040, un joueur ne lit plus `combat_participants` ; le serveur, qui agit avec le client du joueur, ne le peut pas non plus. L'ADR 0041 a réglé l'écriture (changements signés, V3.1-104), pas la lecture.

## Options envisagées

- **Lecture signée** : une fonction `security definer` ne rend les participants d'un combat qu'à une demande signée par le serveur (même clé, 60 s, `nonce` non rejouable).
- **Second module privilégié** : un fichier serveur lit avec le service role. Modifie la règle absolue 2.
- **Verdict sans application** : le joueur voit son jet, le MJ applique.

## Décision

**Lecture signée**, choisie par l'auteur le 31 octobre. `public.engine_read_combat(p_payload text, p_signature text)` vérifie la signature comme `apply_engine_change` (texte reçu, HMAC-SHA256, clé active, 60 s, `nonce`), refuse toute clé hors de `{ key_id, nonce, issued_at, campaign_id, combat_id }` (une demande d'écriture ne passe pas pour une lecture, ni l'inverse), et ne rend que les participants d'un combat de la campagne nommée.

Ce que le moteur a lu ne repart jamais tel quel au joueur : le verdict dit « touché » ou « raté » sans la CA, l'effet sur un adversaire dit son état de blessure (comme la vue de V3.1-102), jamais ses PV ; le journal de session reçoit les mêmes phrases.

## Conséquences

La règle absolue 2 reste intacte. La route du joueur (`player-targeted-roll`) n'accepte qu'un acteur : son PJ. Une sauvegarde demandée à un autre PJ reste au MJ (création réservée, ADR 0044). Relevé en concevant : le journal de session est lisible de tout membre, et les jets ciblés du MJ y écrivent la CA et les PV (registre, `SECURITE.md` §3) — à fermer à part.
