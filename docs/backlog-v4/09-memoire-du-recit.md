# Lot I — La mémoire du récit

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). Spec : [`specs/memoire-du-recit.md`](../../specs/memoire-du-recit.md). ADR : [`0091`](../adr/0091-la-memoire-du-recit.md).*

**Le moteur assemble, le modèle raconte.** La vérité est en base ; à chaque tour, un contexte court et borné est assemblé par couches ; ce que la narration invente est capté ; les fils ouverts sont tenus ; chaque récit est vérifié avant d'être affiché. Conçu le 30 octobre 2026. Ce lot reprend V3-E1, V3-E3 et V3-F1.

---

### ☐ V4-I1 — Le contexte assemblé · `L` · sans modèle IA — **prêt après B9, C5, E12**

**Modèle conseillé : Opus** — contexte du modèle, audience (règle 11). **Spec :** §1.

**Sous-tâches Haiku** : lancer les tests et résumer les échecs.

- `src/core/ai/assembleContext.ts` (pur) : les dix couches, leur ordre, leur budget, la sélection déterministe, la coupe à l'intérieur d'une couche ; il remplace l'assemblage de `buildSoloTurnContext` (V3-B3) en gardant ses garanties (encadrement, audience, `known_as`).
- Un compteur de jetons approché dans le noyau (sans dépendance), et le plafond du modèle configuré.

**Critères d'acceptation**
- [ ] Même état, même contexte (test).
- [ ] Le plafond n'est jamais dépassé sur un journal factice de cent heures de jeu (test).
- [ ] Aucune donnée hors audience n'y entre (test repris de V3-B3).
- [ ] Les couches 1 à 3 ne sont jamais coupées.

---

### ☐ V4-I2 — Capter ce que la narration invente · `M` · **avec modèle IA** — **prêt après I1**

**Modèle conseillé : Opus** — propositions (règle 9), contradiction avec la base. **Spec :** §2.

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- La sortie structurée du récit liste les affirmations nouvelles (personne, lieu, objet, lien, fait passé) ; chacune devient une proposition validée par Zod et par le métier ; une affirmation qui contredit la base est refusée d'office ; un détail de décor n'est pas capté.
- En solo, une proposition sans contradiction ni conséquence mécanique peut s'appliquer seule ; les autres vont au tiroir de conséquences.

**Critères d'acceptation**
- [ ] « Son frère Dorn » sur un PNJ fils unique d'après sa généalogie est refusé (test).
- [ ] Un personnage de passage capté devient une figure après acceptation (test).
- [ ] `ai_usage_log` est écrit à chaque appel (règle 13).

---

### ☐ V4-I3 — Les fils ouverts · `M` · sans modèle IA — **prêt après A9, C12, E12**

**Modèle conseillé : Opus** — noyau. **Spec :** §3.

**Sous-tâches Haiku** : libellés ; lancer les tests.

- `openThreads(campaign)` (pur) : serments non tenus, chantages, menaces, rêves qui visent un PJ, quêtes actives, croyances à acteur inconnu, propositions en attente ; échéances ; une promesse échue devient `oath_broken`.
- La couche 7 du contexte prend les fils que la scène touche ; le journal de personnage (I5) les montre au joueur.

**Critères d'acceptation**
- [ ] Une promesse faite à Hesta ressort quand le PJ revoit Hesta, pas ailleurs (test).
- [ ] Une promesse échue devient un fait et un souvenir (test).

---

### ☐ V4-I4 — Le contrôle après coup · `M` · **avec modèle IA** — **prêt après I1**

**Modèle conseillé : Opus** — garde-fou du récit. **Spec :** §4.

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- `checkNarration(text, turnFacts, knownNames)` (pur) : noms, issues (liste fermée de verbes d'issue par genre de fait), thèmes voilés, fuites de `known_as`.
- Échec : une régénération avec la faute signalée ; second échec : un récit sobre composé par le serveur depuis les faits. Chaque échec journalisé.

**Critères d'acceptation**
- [ ] Un récit qui dit « tu le tues » sur un jet raté n'est jamais affiché (test avec un récit factice).
- [ ] Le tour continue toujours, même si le modèle échoue deux fois.
- [ ] Vérifié en direct : le taux d'échec du modèle local est mesuré sur une séance.

---

### ☐ V4-I5 — Résumé de scène et journal de personnage · `M` · **avec modèle IA** — **prêt après I1, I3** — *reprend V3-E1 et V3-E3*

**Modèle conseillé : Opus** — mémoire du modèle. **Spec :** §5.1, §5.2.

**Sous-tâches Haiku** : planche du catalogue ; vérifications.

- Le résumé de scène : composé depuis les faits de la scène, mis en prose, relu par le joueur en solo ; il remplace les tours détaillés dans la couche 10.
- Le journal de personnage : croyances du PJ et fils ouverts, mis en page ; il entre dans la couche 5.

**Critères d'acceptation**
- [ ] Un résumé se recompose toujours depuis les faits (test).
- [ ] Le nombre de tours gardés en clair est fixé après mesure sur une vraie partie.

---

### ☐ V4-I6 — Reprendre une partie · `M` · **avec modèle IA** — **prêt après I5** — *reprend V3-F1*

**Modèle conseillé : Opus.** **Spec :** §5.3.

**Sous-tâches Haiku** : planche du catalogue.

- « Précédemment… » : les derniers résumés de scène, les fils ouverts, l'état du PJ, ce qui a changé dans le monde pendant l'absence ; composé depuis les faits, mis en prose.

**Critères d'acceptation**
- [ ] Une reprise après une semaine sans jouer ne s'appuie sur aucune mémoire du modèle (test : le contexte de reprise est une fonction des faits).
