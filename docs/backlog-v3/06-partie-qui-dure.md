# Lot F — La partie qui dure

*Partie du backlog V3. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.md`](../BACKLOG_V3.md). Le cadre commun (ce que S1 a changé, critères transverses) : [`00-cadre.md`](00-cadre.md).*

---

### ☐ V3-F1 — Reprendre une partie · `M` · **avec modèle IA**

**Modèle conseillé : Sonnet** — relire ce qui est déjà persisté ; le rappel réutilise E1.

Sous-tâches Haiku : aucune avant E1 ; ensuite, vérifications et résumé des échecs.

- [ ] Rouvrir une séance trois semaines plus tard restitue la scène, la fiche et le fil à l'identique.
- [ ] Un rappel d'ouverture : « la dernière fois… », engendré depuis les résumés.

---

### ☑ V3-F2 — Annuler un tour · `M` · sans modèle IA

**Modèle conseillé : Opus** — défaire des mutations sans jamais effacer le journal.

Sous-tâches Haiku : aucune avant sa conception ; ensuite, recenser les écritures `auto_applied` par `session_event_id`.

- [x] Défaire le dernier tour : les mutations `auto_applied` se retirent par leur `session_event_id`.
- [x] Le journal reste en ajout seul — annuler écrit un événement d'annulation, n'efface jamais.

*Fait le 17 novembre :* le premier événement d'un tour relève l'état d'avant (`undo_before` : état de jeu brut, scène). `undoLastSoloTurn` (`src/server/services/turnUndo.ts`, route `POST /api/campaigns/[id]/solo/annuler-tour`) défait le tour entier : fiches nées automatiquement à la corbeille et propositions au statut `reverted` (migration `20261117120000`), découvertes et effets du tour retirés, état et scène restaurés (ligne d'état supprimée si elle n'existait pas). Un événement `system` (`undo_turn`) s'ajoute ; le fil et le contexte du modèle cachent le tour défait. Bouton au pied du tiroir de conséquences, confirmation en place ; ✦ visible sur téléphone dès qu'un tour s'annule. Noyau `turnUndo.test.ts` (5), intégration `turnUndo.integration.test.ts`, vérifié au navigateur (ordinateur et 390 px).

**À coordonner avec la V3.1 (12 octobre).** Le bouton « annuler » laissé en attente par V3-C5 vit dans le tiroir de conséquences, que **V3.1-36** redessine (la feuille ✦ sur téléphone). Poser le bouton dans le dessin de V3.1-36, pas dans l'ancien tiroir. Aucun ticket V3.1 ne fait l'annulation elle-même : pas de doublon.
