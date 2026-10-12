# Lot F — La partie qui dure

*Partie du backlog V3. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.md`](../BACKLOG_V3.md). Le cadre commun (ce que S1 a changé, critères transverses) : [`00-cadre.md`](00-cadre.md).*

---

### ☐ V3-F1 — Reprendre une partie · `M` · **avec modèle IA**

**Modèle conseillé : Sonnet** — relire ce qui est déjà persisté ; le rappel réutilise E1.

Sous-tâches Haiku : aucune avant E1 ; ensuite, vérifications et résumé des échecs.

- [ ] Rouvrir une séance trois semaines plus tard restitue la scène, la fiche et le fil à l'identique.
- [ ] Un rappel d'ouverture : « la dernière fois… », engendré depuis les résumés.

---

### ☐ V3-F2 — Annuler un tour · `M` · sans modèle IA

**Modèle conseillé : Opus** — défaire des mutations sans jamais effacer le journal.

Sous-tâches Haiku : aucune avant sa conception ; ensuite, recenser les écritures `auto_applied` par `session_event_id`.

- [ ] Défaire le dernier tour : les mutations `auto_applied` se retirent par leur `session_event_id`.
- [ ] Le journal reste en ajout seul — annuler écrit un événement d'annulation, n'efface jamais.

**À coordonner avec la V3.1 (12 octobre).** Le bouton « annuler » laissé en attente par V3-C5 vit dans le tiroir de conséquences, que **V3.1-36** redessine (la feuille ✦ sur téléphone). Poser le bouton dans le dessin de V3.1-36, pas dans l'ancien tiroir. Aucun ticket V3.1 ne fait l'annulation elle-même : pas de doublon.

---

### ☐ V3-F3 — Copier le wiki d'un monde, sans jamais convertir une partie solo · `L` · sans modèle IA — **réécrit le 12 octobre (ADR 0058)**

**Modèle conseillé : Opus** — stockage, droits, copie d'images, retrait d'une route.

Sous-tâches Haiku : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Ce que le ticket demandait, et pourquoi il a changé.** Il demandait qu'une campagne `solo` devienne une campagne ordinaire. L'auteur a tranché autrement (12 octobre, ADR 0058) : **une table solo ne devient jamais une vraie table**. Le seul passage est de copier le wiki d'un monde dans un monde neuf, joué en mode MJ / joueurs.

**Constaté en le préparant.**
- Une bascule existait (`PATCH /api/campaigns/[id]`, menu de l'écran Campagne), incomplète : elle ne créait aucun membre `gm`, l'onglet Solo restait donc visible.
- « Dupliquer » gardait le mode d'origine (une copie de monde solo restait solo) et **ne copiait aucune image** : portraits et blocs Image perdus, cartes pointant vers l'image du monde d'origine, invisible des joueurs de la copie.
- Et un défaut introduit le même jour par V3.1-128 : le compte des références d'une image ne cherchait que dans son monde. Remplacer une carte dans l'original aurait effacé l'image encore utilisée par une copie.

**À faire**
1. Migration `20261012130000` : `app.asset_reference_count` compte dans tous les mondes.
2. Retirer la bascule de mode : route `PATCH`, `setCampaignMode`, `updateCampaignMode`, son schéma, le menu de `CampaignsPanel`.
3. « Dupliquer » ouvre une fenêtre : mode de la copie (solo réservé au superadmin, vérifié côté serveur), et « Les règles suivent » (oui / non). Route validée par Zod.
4. La copie emporte ses images : chaque image désignée (cartes, portrait du bloc personnage, `entity_assets`, `block_images`) est recopiée dans le monde neuf, et ses identifiants remplacés dans les blocs et les révisions.

**Critères d'acceptation**
- [ ] Aucune route ni aucun écran ne change le mode d'une campagne existante.
- [ ] Dupliquer un monde solo en « campagne » donne un monde dont le propriétaire est MJ, sans découverte, scène, journal ni membre copiés.
- [ ] « Les règles suivent : non » donne le ruleset officiel ; « oui » recopie une variante et reprend un ruleset personnel.
- [ ] Les images de la copie vivent dans le monde neuf ; supprimer l'original ne les casse pas (test d'intégration).
- [ ] Une image de carte partagée par une ancienne copie n'est pas effacée quand on la remplace dans l'original (test d'intégration).
- [ ] `npm run typecheck && npm run lint && npm run test` passent.
