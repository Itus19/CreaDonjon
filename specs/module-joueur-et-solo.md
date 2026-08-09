# Spécification — Compagnon joueur et mode solo

**Version :** 0.1 — 12 août 2026
**Cible :** V3
**Amende :** `PDD.md` §22 · `specs/outils-mj.md` §5

---

## 0. Deux morceaux, un socle

| Morceau | Qui | Écran |
|---|---|---|
| **Compagnon joueur** | un joueur humain, souvent sur téléphone | sa fiche, ses notes, le combat en cours |
| **Interface solo** | une personne seule, l'IA en MJ | wiki, conversation, fiche |

Ils partagent la fiche jouable (`specs/fiche-personnage-interactive.md`), le moteur de règles et le journal de session. Ce qui les distingue est le **modèle de permissions** : le compagnon introduit des gens qui écrivent dans le monde de quelqu'un d'autre.

C'est la vraie nouveauté de la V3, plus que l'IA.

---

# Partie A — Le compagnon joueur

## A1. Rejoindre

Le MJ génère une invitation ; le joueur ouvre un lien ou scanne un QR code.

```sql
create table campaign_invites (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  token_hash   text not null unique,   -- SHA-256, comme share_links
  entity_id    uuid references entities(id),  -- non nul = invitation nominative
  max_uses     int not null default 1,
  used_count   int not null default 0,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
```

**Deux formes d'invitation, et il faut les deux.**

| Forme | `entity_id` | Usage |
|---|---|---|
| Nominative | renseigné | « ce lien est pour Naivara » — un seul usage, aucune ambiguïté |
| Ouverte | nul | « rejoignez la table » — le joueur choisit son personnage dans une liste, ou en crée un |

Vous évoquez « la confiance de sélectionner le bon PJ ». L'invitation nominative supprime le problème, et c'est le cas normal quand le MJ prépare sa table. L'invitation ouverte reste utile pour une soirée improvisée.

**Rejoindre exige un compte.** C'est la différence avec un lien de partage en lecture seule : ici le joueur écrit. Sans compte, aucune trace de qui a modifié quoi, et la révocation devient impossible.

## A2. Ce qu'un joueur peut faire

C'est la question de conception centrale. Ma recommandation est de commencer étroit.

### V3 — le socle

| Sur | Droit |
|---|---|
| Sa fiche de personnage | lecture, écriture complète |
| Ses notes privées | lecture, écriture ; partage au MJ en lecture seule, au choix du joueur |
| Le wiki | lecture, filtrée par la visibilité — comportement actuel |
| Le combat en cours | lancer ses jets, cibler, modifier ses propres PV |

### V4 — l'édition élargie, préparée dès la V3

Vous confirmez vouloir, à terme, que les joueurs éditent certaines autres fiches. C'est un **modèle de permissions par entité** : une table de droits, une interface d'attribution, un durcissement des politiques RLS. Trop lourd pour la V3, et trop coûteux à greffer après coup si on ne prépare rien.

**La parade tient en une fonction, à écrire dès la V3 :**

```ts
// src/core/permissions/canEdit.ts — pure, testable, un seul endroit
function canEditEntity(viewer: Viewer, entity: EntityRef, ctx: Ctx): boolean;
```

En V3, son implémentation est courte : propriétaire ou éditeur du monde, ou bien c'est le personnage du joueur dans cette campagne. En V4, on y ajoute la consultation d'une table `entity_grants` — **et rien d'autre ne bouge**, parce que tous les appelants passent déjà par elle.

C'est exactement le même motif que `canSee` pour la visibilité : la logique d'autorisation vit à un seul endroit, testée par table de vérité. La règle absolue reste la même — vérifié côté serveur, jamais seulement en masquant le bouton.

Coût aujourd'hui : une heure. Coût si on code `entity.ownerId === viewer.userId` en dur dans quinze composants : une refonte.

### Ce qui reste au MJ, toujours

- La visibilité d'un bloc **du monde**. Le joueur gère celle de sa propre fiche, jamais celle du reste.
- **Les fiches PJ sont toujours lisibles par le MJ**, y compris leurs blocs `gm`. Vous le demandez ; c'est aussi ce que la RLS fait déjà pour un `owner` de monde. Rien à ajouter — mais à écrire dans l'interface, pour que le joueur le sache.

Un joueur qui croit avoir un secret vis-à-vis du MJ et découvre le contraire, c'est un problème de confiance. Le dire au moment de la saisie coûte une phrase.

## A3. Le suivi en direct

Le MJ voit les modifications des fiches PJ pendant la partie.

**Recommandation : ne pas commencer par du temps réel.** Un rafraîchissement toutes les quelques secondes sur l'écran du MJ, plus une invalidation après chaque mutation, couvre le besoin. Le temps réel Supabase est disponible et coûte un abonnement de canal par client ; à ajouter quand la latence gêne, pas avant.

### Deux flux, pas un — précision importante

Vous dites vouloir suivre les changements « via les versions de la fiche wiki et du bloc de personnage ». Attention : **les deux ne passent pas par le même canal**, et c'est une décision qu'on a prise en V1.

| Ce que fait le joueur | Où ça s'écrit | Pourquoi |
|---|---|---|
| Réécrit son histoire, change un alias, modifie ses choix de build, monte de niveau | `entity_revisions` | édition rédactionnelle |
| Perd des PV, dépense un emplacement, ramasse de l'or, coche une armure | `session_events` | mutation de jeu |

Si chaque point de vie perdu créait une révision, l'historique d'une fiche deviendrait illisible en une séance — c'est précisément la règle posée dans `specs/wiki-blocs.md` §4.5.

**Pour le MJ, cela donne un seul écran mais deux sources.** Un fil d'activité qui fusionne les deux, trié par date :

```
23:14  Naivara — PV 11 → 4                          jeu
23:09  Naivara — emplacement niv. 1 dépensé          jeu
22:51  Naivara — histoire modifiée (révision #7)     wiki  [voir le diff]
22:40  Bram — bloc « notes » ajouté (révision #3)    wiki  [voir le diff]
```

Les lignes « wiki » ouvrent le comparateur de révisions, qui existe depuis V1-C3. Les lignes « jeu » ne sont pas comparables : ce sont des faits ponctuels, pas des états.

Ce fil est **l'écran de suivi en direct**. Il n'y a rien d'autre à construire : les deux tables existent, le composant les fusionne.

## A4. Le combat partagé

Depuis son écran, un joueur voit l'ordre des tours, cible un adversaire, lance ses jets. Les dégâts s'appliquent.

Trois précautions.

**Le MJ décide de ce qui est visible.** Vous le demandez : PV et capacités des adversaires publics ou non. Un interrupteur par combat, et deux niveaux — « caché », « barre de santé approximative » (indemne, blessé, mal en point), « valeurs exactes ». Le niveau intermédiaire est celui que la plupart des tables utilisent.

**Le papier-crayon reste possible.** Un joueur peut ne pas se connecter ; le MJ modifie alors ses valeurs à la main. Aucune fonction ne doit exiger que tous les joueurs soient en ligne.

**Un joueur n'agit que pour lui-même.** Cibler quelqu'un, oui ; modifier ses valeurs, non. La validation le vérifie côté serveur — pas seulement en masquant le bouton.

## A5. Format

Route responsive dans la même application, sous `/j/[token]` puis `/j/[campagne]`. Une seule base de code, un seul déploiement, un seul moteur.

Conception téléphone d'abord pour cet écran précis : c'est le seul du produit dont l'usage principal est mobile, dans la main, pendant une partie. La fiche jouable est déjà tenue à 375 px par ses critères d'acceptation.

Une application installable séparée est envisageable plus tard ; elle double le travail et ne se justifie que si l'usage hors ligne devient un besoin.

---

# Partie B — L'interface solo

## B1. Trois colonnes

```
┌──────────────────────────────────────────────────────────────┐
│  L'Ancre Rouillée · Quartier des Quais        Nuit · 23 h    │
├──────────────┬─────────────────────────────┬─────────────────┤
│ Wiki │ PNJ   │                             │ Stats │ Sac │ ✦ │
│ │ Notes      │   … la conversation défile   │                 │
│              │      vers le haut …          │   Naivara       │
│  Bram        │                             │   PV 11/11      │
│  L'Ancre     │                             │   CA 11         │
│  La Main…    │                             │                 │
│              │  ┌───────────────────────┐  │   Emplacements  │
│              │  │ Que faites-vous ?   🎤│  │   ●●○○          │
└──────────────┴──┴───────────────────────┴──┴─────────────────┘
```

Conforme à votre description. Trois remarques de conception.

**La colonne de gauche est filtrée par les découvertes.** Elle n'affiche que ce que le personnage a rencontré — la table `entity_discoveries` existe précisément pour ça. Un wiki solo qui montre tout dès le départ détruit le jeu.

L'onglet PNJ affiche ceux présents dans la scène courante, avec leur attitude en une ligne : « Bram — méfiant, cordial ». C'est là que la psyché devient visible.

**L'en-tête — lieu et heure — n'est pas décoratif.** C'est l'état de la scène, tenu par le moteur et non par le modèle : un LLM perd le fil du temps qui passe. L'heure avance parce que le code la fait avancer, sur repos, voyage, ou action longue.

**La saisie vocale est une reconnaissance vocale du navigateur**, pas un appel d'API. Gratuit, disponible, et sans coût de token. À traiter comme une commodité de saisie, pas comme une fonction du produit.

## B2. Ce qui défile au centre

Le flux est le **journal de session**, rendu. Pas un fil de discussion séparé.

| Type d'événement | Rendu |
|---|---|
| `narration` | prose |
| `player_action` | aligné à droite, discret |
| `roll` | encart compact avec sa trace |
| `world_update` | mention discrète : « Bram a été ajouté au wiki » |
| `rule_application` | encart, repliable |

Conséquence : reprendre une partie trois semaines plus tard reconstruit exactement le fil, parce que le journal est en ajout seul depuis la Phase 0. C'est ici que cette décision se paie.

## B3. La colonne de droite

La fiche jouable, en version étroite. Mêmes composants, même moteur, mêmes boutons. Rien de nouveau — c'est l'intérêt de l'avoir écrite en V1 avec la contrainte des 375 px.

---

## C. Critères d'acceptation

**Compagnon joueur**
- [ ] Un lien nominatif attache directement le bon personnage ; un lien ouvert propose une liste.
- [ ] Rejoindre exige un compte ; le jeton n'est stocké que haché.
- [ ] Un joueur ne modifie que sa fiche et ses notes — vérifié côté serveur par `canEditEntity`, pas seulement masqué.
- [ ] Aucun composant ne teste la propriété d'une entité en dur : tout passe par `canEditEntity`.
- [ ] Le fil d'activité du MJ fusionne `entity_revisions` et `session_events`, chaque ligne indiquant sa source.
- [ ] Une modification de build crée une révision ; une perte de PV n'en crée pas.
- [ ] Le MJ lit les fiches PJ intégralement, et le joueur en est informé au moment de la saisie.
- [ ] Les notes d'un joueur sont invisibles du MJ tant qu'il ne les partage pas ; partagées, elles restent en lecture seule.
- [ ] Un combat fonctionne avec zéro joueur connecté.
- [ ] Les PV adverses ont trois niveaux de visibilité, réglables en cours de combat.
- [ ] L'écran est utilisable sur un téléphone de 375 px, d'une main.

**Mode solo**
- [ ] La colonne wiki n'affiche que les entités découvertes, selon `entity_discoveries`.
- [ ] Lieu et heure viennent du moteur, jamais d'une sortie du modèle.
- [ ] Le flux central est le rendu de `session_events` ; recharger la page reconstruit le fil à l'identique.
- [ ] Un jet apparaît avec sa trace ; aucun nombre aléatoire ne provient du modèle.
- [ ] La fiche de droite est la même que celle de la V1, sans code dupliqué.

---

## D. Ce qui reste ouvert

| Question | Recommandation |
|---|---|
| Temps réel ou rafraîchissement ? | rafraîchissement en V3, temps réel si la latence gêne |
| ~~Application distincte ou même application ?~~ | **tranché (12/08) : route responsive dans la même application** |
| ~~Édition du wiki par les joueurs~~ | **tranché : sa propre fiche en V3, `canEditEntity` extensible, droits par entité en V4** |
| Chrono partagé sur les écrans joueurs | avec le compagnon, pas avant — il n'a personne à qui s'afficher |
| Notes de joueur : bloc ou table dédiée ? | entité `notes` privée par joueur, avec les blocs existants — pas de second système |
| Le mode solo peut-il basculer en campagne ? | oui à terme : une campagne `solo` a la même forme qu'une campagne `campaign`. Ne pas fermer cette porte |
