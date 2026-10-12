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

### ☐ V3-F3 — D'une partie solo à une vraie table · `M` · sans modèle IA

**Modèle conseillé : Opus** — passer de solo à campagne : RLS, rôles, données existantes.

Sous-tâches Haiku : recenser ce qui distingue une campagne `solo` d'une campagne ordinaire (colonnes, RLS, écrans) avant la conception.

`module-joueur-et-solo.md` §D le dit : *« une campagne solo a la même forme qu'une campagne classique. Ne pas fermer cette porte. »*

- [ ] Une campagne `solo` devient une campagne ordinaire sans migration de données.
- [ ] Le monde écrit en solo est un monde comme un autre : les fiches, découvertes et relations créées en jouant restent valables avec des amis autour de la table.

**Ce que la V3.1 en dit déjà (12 octobre), sans doublon.** **V3.1-11** (☑) n'affiche l'onglet « Solo » que si la campagne n'a aucun membre `gm` : après la bascule, l'onglet doit disparaître de lui-même, et un test le dira. Le même ticket constate que **la création de monde n'offre que le mode « Campagne »** : aujourd'hui, un monde solo ne se crée pas depuis l'interface. Les invitations (**V3.1-100**) servent à faire entrer les amis après la bascule.
