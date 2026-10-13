# Backlog V3.1 — Dette technique (V3.1-120…)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Ce qui ne se voit pas à l'écran mais rend le code fragile à modifier. Relevé par des audits ponctuels (ADR 0054), pas en jouant.

---

### ☐ V3.1-142 — Le mot de passe d'un lien de partage se contourne par un cookie forgé · `S` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** : sécurité.

**Constat (13 octobre, en codant V3.1-59).** `verifySharePasswordAction` (`app/partage/[token]/passwordActions.ts`) pose un cookie dont la valeur est toujours `"1"`, et dont le nom dérive du jeton (`sv_` + début de `hashShareToken(token)`). Le visiteur a forcément le jeton, puisqu'il est dans le lien : il peut calculer ce nom et poser le cookie lui-même. `hasVerifiedSharePassword` le croit, et toutes les pages du lien s'ouvrent sans mot de passe. Inscrit au registre de `docs/SECURITE.md` §3.

**À faire**
1. Une valeur que seul le serveur sait produire. Par exemple une signature HMAC du jeton et d'une échéance, par un secret serveur (variable nouvelle : `.env.example` et `scripts/verifier-secrets-build.mjs`, SECURITE §2). Ou un jeton aléatoire gardé en base avec son échéance. Choisir en disant pourquoi.
2. `hasVerifiedSharePassword` vérifie cette valeur et son échéance. Les trois appelants (layout, pages, `fond-du-wiki`) n'ont rien à changer.
3. Changer le mot de passe d'un lien invalide les cookies déjà posés.

**Critères d'acceptation**
- [ ] Test : un cookie au bon nom avec la valeur `"1"` est refusé ; un cookie posé par le serveur est accepté ; un cookie échu est refusé.
- [ ] Registre de `SECURITE.md` passé à « corrigée ».
