# Backlog V3.1 — Dette technique (V3.1-120…)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Ce qui ne se voit pas à l'écran mais rend le code fragile à modifier. Relevé par des audits ponctuels (ADR 0054), pas en jouant.

---

### ☐ V3.1-126 — Les `catch` muets restants · `M` · sans modèle IA — **prêt (Sonnet ; Haiku pour le recensement)**

**Modèle conseillé : Sonnet.** Sous-tâches Haiku : recenser les occurrences et les classer par fichier (`grep -rn "catch {\|\.catch(() => {})" app components lib src`, tests exclus).

`CLAUDE.md` interdit le `catch` silencieux. Le 12 octobre, il en reste **55, dans 44 fichiers**. Ceux touchés par V3.1-62 ont été corrigés en passant (chargeurs de la fiche, pastille du chat, radio, dés, liste des règles, découverte d'une fiche joueuse). Les autres datent d'avant la règle.

**Méthode**, fichier par fichier, sans changer le comportement visible :
- un échec qui doit rester sans effet pour l'utilisateur (geste « au mieux ») garde son repli, mais **journalise** l'erreur (`console.error` avec ce qui a échoué) ;
- un échec qui laisse un écran sur un état faux reçoit l'état d'erreur de la charte (`docs/CHARTE-UI.md`, états d'écran) ;
- un `fetch` qui ne teste pas `res.ok` le teste (charte : « un `fetch` dont on ne teste pas `res.ok` est un bug »).

**Garde-fou.** Ajouter le motif au cliquet `lib/cablage.test.ts`, plafond au compte du jour, abaissé à chaque lot.

**Critères d'acceptation**
- [ ] Plus aucun `catch` sans traitement de l'erreur hors des tests.
- [ ] Le cliquet compte les `catch` muets et échoue s'ils augmentent.
- [ ] `npm run typecheck && npm run lint && npm run test` passent.
