# Backlog VM — La vie du monde

**Version :** 1.0 — 26 novembre 2026
**Spécification :** [`specs/vie-du-monde.md`](../specs/vie-du-monde.md) · **Décision :** [ADR 0115](adr/0115-la-vie-du-monde-se-calcule.md)

Les gens ont une routine, des goûts et des façades ; la ville vit sans le personnage, selon sa taille et son régime. Tout se calcule à graine fixe, au moment d'une lecture que le jeu fait déjà : aucun tic de fond (`docs/QUOTAS.md`).

**Lire les titres.** ☑ : terminé. ☐ : il reste du travail. Sous chaque titre, le **modèle conseillé** et s'il faut un **modèle d'IA joignable**.

---

## Ordre recommandé (décision 19 de l'auteur)

0. **Préalable** : relire et fusionner la PR #17 (ville en agrégat, `deriveSeed`, `materializeOccupants`). Rien ici ne commence avant.
1. **Le noyau des gens** : VM-1 (archétypes et `position()`), VM-2 (gens attachés à un lieu). Calcul pur, tests en millisecondes.
2. **Ce qu'on voit en jouant** : VM-3 (la présence calculée dans le solo), puis VM-4 (l'agenda).
3. **La ville qui vit** : VM-5 (le régime), VM-6 (les événements), VM-7 (le rattrapage), VM-11 (le vol non remarqué).
4. **Les gens qui parlent des autres** : VM-10 (les absents).
5. **En parallèle, à tout moment** : VM-8 (le questionnaire), VM-12 (franchise, centres d'intérêt, façades), VM-9 (l'archétype sur la fiche).

---

## Où trouver un ticket

| Ticket | État | IA | Titre | Fichier |
|---|---|---|---|---|
| VM-1 | ☐ | sans | Archétypes de vie et `position()` | [`01-les-gens.md`](backlog-vm/01-les-gens.md) |
| VM-2 | ☐ | sans | Les gens attachés à un lieu | [`01-les-gens.md`](backlog-vm/01-les-gens.md) |
| VM-3 | ☐ | sans | La présence calculée dans le solo | [`01-les-gens.md`](backlog-vm/01-les-gens.md) |
| VM-4 | ☐ | avec | L'agenda : exceptions datées | [`01-les-gens.md`](backlog-vm/01-les-gens.md) |
| VM-9 | ☐ | sans | L'archétype de vie sur la fiche, déduit du métier | [`01-les-gens.md`](backlog-vm/01-les-gens.md) |
| VM-10 | ☐ | avec | Les absents : témoignages et personnalités publiques | [`01-les-gens.md`](backlog-vm/01-les-gens.md) |
| VM-5 | ☐ | sans | Le régime d'une ville | [`02-la-ville.md`](backlog-vm/02-la-ville.md) |
| VM-6 | ☐ | sans | Les événements à l'heure autour du personnage | [`02-la-ville.md`](backlog-vm/02-la-ville.md) |
| VM-7 | ☐ | sans | Le rattrapage et les nouvelles qui voyagent | [`02-la-ville.md`](backlog-vm/02-la-ville.md) |
| VM-11 | ☐ | sans | Un événement non remarqué se découvre plus tard | [`02-la-ville.md`](backlog-vm/02-la-ville.md) |
| VM-8 | ☐ | sans | Le questionnaire de psyché à la Ultima IV | [`03-la-psyche.md`](backlog-vm/03-la-psyche.md) |
| VM-12 | ☐ | sans | Franchise, centres d'intérêt, normes et façades | [`03-la-psyche.md`](backlog-vm/03-la-psyche.md) |
