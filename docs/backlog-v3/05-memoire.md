# Lot E — La mémoire

*À ouvrir seulement après trois séances réellement jouées. Concevoir la mémoire longue avant, c'est deviner.*

> **30 octobre 2026.** La conception est faite dans `specs/memoire-du-recit.md` (ADR 0091) : E1 et E3 sont repris par V4-I5, F1 par V4-I6 (`docs/backlog-v4/09-memoire-du-recit.md`). Les budgets (combien de tours garder en clair) restent à mesurer sur de vraies séances.

*Partie du backlog V3. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.md`](../BACKLOG_V3.md). Le cadre commun (ce que S1 a changé, critères transverses) : [`00-cadre.md`](00-cadre.md).*

---

### ☐ V3-E1 — Résumé de scène · `M` · **avec modèle IA**

**Modèle conseillé : Opus** — mémoire longue du modèle : conception à faire après trois séances.

Sous-tâches Haiku : aucune tant que le ticket n'est pas conçu (ADR après trois séances jouées).

- [ ] À la fermeture d'une scène, un résumé court, journalisé, relu par le joueur.
- [ ] Les résumés remplacent les tours détaillés dans le contexte des scènes suivantes — c'est ce qui borne les tokens quand la partie dure.

---

### ☐ V3-E2 — RAG sur le wiki · `L` · **avec modèle IA**

**Modèle conseillé : Opus** — RAG, dimension d'embedding à figer en ADR, audience à garantir.

Sous-tâches Haiku : aucune avant l'ADR sur la dimension d'embedding ; ensuite, vérifications et résumé des échecs.

- [ ] `chunks` et `embedding_queue` existent, l'index HNSW aussi. **La dimension d'embedding doit être figée avant la première indexation** (`SCHEMA.md` §17) — décision à prendre et à consigner en ADR avant d'écrire une ligne.
- [ ] Ce que la recherche remonte entre dans le prompt **encadré par `fenceUntrustedData`**, sans exception.
- [ ] Le contexte reste borné par l'audience (règle 11) : la recherche ne remonte jamais un bloc `gm` dans une sortie lue par le joueur.

---

### ☐ V3-E3 — Le journal de personnage · `S` · **avec modèle IA**

**Modèle conseillé : Opus** — petit, mais c'est encore la mémoire du modèle : ce qui entre dans le contexte.

Sous-tâches Haiku : aucune tant que le ticket n'est pas conçu.

- [ ] Un carnet tenu automatiquement : ce que le personnage a appris, promis, refusé. Nourri par le journal, relu par le joueur.
- [ ] Entre dans le contexte du tour à la place des faits bruts — moins de tokens, plus de sens.
