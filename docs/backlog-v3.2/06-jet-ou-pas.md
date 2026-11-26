# V3.2 — Faut-il un jet ? Le détecteur de sens

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md).*

**Constaté le 25 novembre.** Un jet d'Histoire sur le seul mot « histoire », un jet de Persuasion sans DD dont le récit devine l'issue. V3.2-21 a resserré le lexique ; ces trois tickets remplacent son jugement par un classement de l'IA, chiffré par le moteur. Décision : [ADR 0113](../adr/0113-le-detecteur-de-sens.md). Spécification relue par l'auteur le 26 novembre (« Détecteur de sens : quand faut-il un jet ? »), options A aux trois questions.

---

### ☐ V3.2-22 — Du palier au DD, et la réussite automatique · `S` · sans modèle IA · Modèle conseillé : Opus

Le noyau pur, tests d'abord.

- `src/core/rules/checkDifficulty.ts` : le type `CheckTier` (`tres_facile` à `quasi_impossible`), `dcForTier` (5, 10, 15, 20, 25, 30), `autoSuccess({ tier, modifier, trivial })` : vrai si `trivial`, ou si 1 + modificateur ≥ DD.
- Le type de classement (`none` | `trivial` | `check` + action + palier) et son schéma Zod, partagés par le serveur.

**Critères d'acceptation**
- [ ] Chaque palier donne son DD ; un palier inconnu est refusé par le schéma.
- [ ] Modificateur +5 contre « très facile » (DD 5) : réussite automatique ; +3 contre « facile » : non.
- [ ] `trivial` donne toujours la réussite automatique.

---

### ☐ V3.2-23 — Le classifieur, son prompt et son corpus · `M` · **avec modèle IA** · Modèle conseillé : Opus

- `src/server/ai/soloClassify.ts` : un appel court, sortie structurée (outil forcé), validée par le schéma de V3.2-22. La liste des actions autorisées vient de la fiche ; une action hors liste est refusée.
- Contexte : la phrase du joueur, le lieu, les présents, les noms des actions de la fiche, encadrés comme données (règle 10), bornés au joueur (règle 11).
- `ai_usage_log` à chaque appel, usage `solo_classify` (règle 13) ; ajouter la valeur à `AiUsagePurpose`.
- Repli sur `interpretIntent` (V3.2-21) quand le fournisseur manque ou que la réponse échoue à Zod.
- Corpus d'évaluation hors ligne : 40 à 60 phrases françaises et leur classement attendu (dont « je me raconte une histoire », « je négocie trois pièces », « j'ouvre la porte », « je cherche des traces dans la boue »), et un script qui rejoue le corpus contre le fournisseur local et donne le taux d'accord.

**Ce que ça consomme** : un appel de modèle par tour libre, aucune requête de base de plus.

**Critères d'acceptation**
- [ ] Tests du noyau et du service avec un faux fournisseur : `none`, `trivial`, `check`, réponse invalide (repli), fournisseur absent (repli, journal écrit).
- [ ] Corpus rejoué avec le fournisseur local : taux d'accord noté dans ce ticket.

---

### ☐ V3.2-24 — Le classement joue le tour, la pastille propose · `M` · sans modèle IA pour le cœur · Modèle conseillé : Opus

- Le tour libre passe d'abord par le classifieur : `none` joue le tour directement ; `trivial` ou réussite automatique joue un tour réussi sans dé, avec un fait « réussite automatique » ; `check` pose la demande de jet avec le DD du moteur.
- La pastille (V3.2-20) gagne « Sans jet » et « Changer » (autre action de la fiche, même palier). Le DD reste caché sauf `solo_show_outcome`.
- Le narrateur reçoit DD et verdict dans le fait du jet ; l'affichage masqué reste de la mise en forme (`factSansIssue`).
- Un indicateur d'attente pendant le classement ; planche `pastille-jet` du catalogue mise à jour.

**Critères d'acceptation**
- [ ] « je négocie : trois pièces, pas plus » : pastille Persuasion, DD fixé par le moteur, verdict transmis au récit.
- [ ] « j'ouvre la porte » (non verrouillée) : pas de pastille, le récit suit.
- [ ] « Sans jet » joue le tour comme une action libre ; « Changer » relance la proposition avec l'action choisie.
- [ ] Sans fournisseur : comportement de V3.2-21, inchangé.
