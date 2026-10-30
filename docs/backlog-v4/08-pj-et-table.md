# Lot H — Les PJ et les réglages de table

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). Spec : [`specs/simulation-monde.md`](../../specs/simulation-monde.md) §11, §14.*

**L'esprit d'un PJ appartient à son joueur.** Chaque table choisit ce qu'elle voit de ses PJ : tout, rien, ou le MJ seul, couche par couche. Décidé avec l'auteur le 22 octobre 2026 ; conçu le même jour (ADR 0080, 0083, 0084).

---

### ☐ V4-H1 — Les réglages et la projection du joueur · `L` · sans modèle IA — **prêt après A3, B1**

**Modèle conseillé : Opus** — visibilité côté serveur (règle 5), RLS. **ADR :** 0080. **Spec :** §11.1, §14.

**Sous-tâches Haiku** : remplir la liste de contrôle de `docs/SECURITE.md` ; lancer les tests et résumer les échecs.

**À faire**
- `src/core/sim/settings.ts` : `zSimTableSettings` (la forme de la spec §11.1 : mode, couches des PJ dont l'intimité, évolution des traits, conséquences du corps, mémoire longue de 30 à 365 jours, âge adulte, romance et sexualité séparées, normes sur l'identité, PJ concernés, thèmes de table avec leurs plafonds, détail de la violence, ton) et ses défauts par mode de campagne ; lu depuis `campaigns.table_settings.sim`. Les plafonds des thèmes (`sexual_violence`, `violence_to_children` : `veiled_generated` au plus) sont imposés par le schéma.
- Migration `sim_pc_views` (lecture : admin du monde et joueur du PJ ; écriture : admin).
- `buildPcView(figure, beliefs, settings, pendingShifts): PcView` (pur) : couches `player` en bandes, traits, valeurs et rêves, propositions en attente, croyances (version crue, source et certitude en mots), réputation. Jamais `is_accurate`, jamais un nombre.
- `refreshPcViews(campaignId)` : appelé en fin de lot et à chaque changement de réglage.

**Critères d'acceptation**
- [ ] Couche `gm` : absente de la projection et de toute réponse envoyée au joueur, y compris par requête directe à la base (test d'intégration RLS).
- [ ] Couche `off` : non simulée pour les PJ, aucune conséquence (test).
- [ ] Un joueur ne lit que la projection de **son** PJ.

---

### ☐ V4-H2 — L'écran des réglages · `S` · sans modèle IA — **prêt après H1 (Sonnet)**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Dans les réglages de table (V3.1-108) : une section « Simulation et psyché » : mode, une ligne par couche (joueur, MJ seul, désactivée), évolution des traits des PJ, conséquences du corps, simulation romantique et simulation sexuelle, récit intime, délai de la mémoire longue (**curseur de 30 à 365 jours**, repères à 30, 90 et 365), âge adulte, normes sur l'identité, PJ concernés.
- Une section « Les jets » : 20 naturel (réussite automatique, avec ses deux limites dites en clair), 1 naturel, succès à un prix, changement de caractéristique.
- Une section « Thèmes et récit » : les quatre thèmes et leurs positions (une position au-delà du plafond n'est pas proposée), le détail de la violence, le ton. Chaque option dit son effet en une phrase.

**Critères d'acceptation**
- [ ] Tient à 375 px ; seul le MJ voit et modifie ; en solo, tout est ouvert au joueur.

---

### ☐ V4-H3 — La psyché du PJ vue par son joueur · `M` · sans modèle IA — **prêt après H1, B8 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : planche du catalogue.

- Dans la fiche jouable (V3-D5) : la projection, en bandes nommées (« affamé », « épuisé », « en colère »). Les souvenirs visibles rejoignent le journal de personnage (V3-E3). La réputation par lieu.
- Une couche absente ne laisse **aucune** trace, pas même un emplacement vide.

**Critères d'acceptation**
- [ ] Esquisse validée ; tient à 375 px.

---

### ☐ V4-H4 — Les besoins du corps et les déclencheurs · `M` · sans modèle IA — **prêt après E3, H1**

**Modèle conseillé : Opus** — vocabulaire fermé des déclencheurs. **ADR :** 0083.

**Sous-tâches Haiku** : lancer les tests.

- `need_threshold_crossed` ajouté à `TRIGGER_EVENTS`, avec `event.need` et `event.band` ; émis par le pas de simulation quand un besoin du corps d'un PJ change de bande.
- `body_consequences: "auto"` applique les effets des déclencheurs ; `"gm"` les met dans le tiroir du MJ.
- Un exemple de déclencheur (faim → épuisement) dans la documentation des déclencheurs ; **pas** dans un fichier suivi par Git qui contiendrait la règle d'un livre.

**Critères d'acceptation**
- [ ] Un PJ qui ne mange pas déclenche l'événement à chaque changement de bande, une seule fois (test).
- [ ] Couche du corps `off` : aucun événement émis.

---

### ☐ V4-H5 — Proposer une transformation au joueur · `S` · sans modèle IA — **prêt après C2, H3 (Sonnet)**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Quand le réglage est « le moteur propose » : la proposition (cause, changement en bandes) dans la fiche du PJ ; accepter applique le déplacement (`personality_events` `core_memory`) ; refuser ne change rien et garde le souvenir.

**Critères d'acceptation**
- [ ] Refuser ne change aucune valeur et n'efface aucun souvenir (test).

---

### ☐ V4-H6 — Le motif déclaré et l'Inspiration · `M` · sans modèle IA — **prêt après E2, H1**

**Modèle conseillé : Opus** — moteur de tour, règle 8. **ADR :** 0084.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- La barre d'intention (V3-B1) gagne une puce facultative « par… » : une liste fermée tirée de l'état du PJ (émotion forte, valeurs prioritaires, rêve actif).
- `motiveGrantsInspiration(motive, pcState, intent)` (pur) : vrai si le motif existe dans l'état, si l'action demande un jet, et si l'Inspiration n'a pas été accordée par ce moyen dans la scène. Effet `grant_inspiration` (ADR 0050).
- Avec un MJ humain : une suggestion dans ses outils, jamais automatique. L'élan (E2) propose aussi l'Inspiration.

**Critères d'acceptation**
- [ ] Un motif absent de l'état ne rapporte rien (test).
- [ ] Au plus une fois par scène (test).

---

### ☐ V4-H7 — Ce que le MJ voit pour raconter · `S` · sans modèle IA — **prêt après H1 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : planche du catalogue.

- Un panneau dans les outils de table : l'état de chaque PJ en une ligne (« Max : affamé, inquiet ; se souvient de la trahison d'Aude »), pour les couches « MJ seul » comme pour les autres.

**Critères d'acceptation**
- [ ] Un seul chargement (`docs/CABLAGE.md`) ; tient à 375 px.
