# Backlog V3.1 — Conception du 9 octobre : les tickets Opus découpés

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Les neuf tickets « à concevoir » ont été conçus le 9 octobre ; chaque
décision a son ADR (0040 à 0049). Ce qui suit les découpe en tickets prêts.
V3.1-104 n'est plus bloqué : option B de l'ADR 0041, choisie le 10 octobre.

| Conçu | ADR | Découpé en |
|---|---|---|
| V3.1-37 initiative côté joueurs | 0040 | 101, 102, 103 (puis 38) |
| — écritures du moteur au nom d'un joueur | 0041 (option B) | 104 |
| V3.1-21 cibler et résoudre | 0042 | 105, 106, 107 |
| V3.1-23 droits des joueurs | 0043 | 108, 109 (puis 57) |
| V3.1-39 sauvegardes demandées | 0044 | 110, 111, 112 |
| V3.1-40 ressources de classe | 0045 | 113, 114 |
| V3.1-47 (+ 3, 6, 7) règles de personnage, choix | 0046 | 115, 116, 117, 118, 119 |
| V3.1-59 fond par défaut du wiki | 0047 | 59 lui-même, désormais prêt |
| V3.1-96 données de la chronologie | 0048 | 96 lui-même, désormais prêt |
| V3.1-100 rejoindre sans PJ, lien nominatif | 0049 | 100 lui-même, désormais prêt |

### ☐ V3.1-104 — Écritures du moteur au nom d'un joueur : changements signés · `M` · sans modèle IA — **prêt (Opus) — ADR 0041, option B**

**Modèle conseillé : Opus** — sécurité, base, cryptographie. **Dépend de** : 105.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**À faire**
1. **Migration.**
   - Schéma `app_private` (s'il n'existe pas), tables `engine_signing_keys (id text primary key, secret bytea not null, active boolean not null default true)` et `engine_change_nonces (nonce uuid primary key, seen_at timestamptz not null default now())`, sans droit pour `anon` ni `authenticated`.
   - Fonction `app.apply_engine_change(payload jsonb, signature text)`, `security definer`, `search_path` fixé. Elle refuse :
     - une clé inconnue ou inactive ;
     - une signature fausse : HMAC-SHA256 par `pgcrypto`, sur le texte canonique reçu dans `payload` ;
     - un `issued_at` de plus de 60 s ;
     - un `nonce` déjà vu ;
     - une ligne hors de `campaign_id` ;
     - un champ hors de la liste (`hp`, `temp_hp`, `conditions`).

     Elle écrit dans une transaction, puis purge les `nonce` de plus d'une heure.
   - `SCHEMA.md` mis à jour dans le même ticket.
2. **Serveur.** `src/server/services/engineSigning.ts` signe en HMAC-SHA256 (`node:crypto`), avec `ENGINE_SIGNING_KEY` et `ENGINE_SIGNING_KEY_ID`, sur la forme canonique (clés triées, une fonction pure testée dans `src/core`). Son appel au repo passe par `src/server/repos/`. Clé absente : erreur explicite au démarrage du service, jamais un repli silencieux.
3. **Branchement.** `resolveTargetedRoll` (105) passe par ce chemin quand l'acteur est un joueur et que la cible n'est pas à lui. Le MJ garde l'écriture directe.
4. **Documentation.** Poser et faire tourner la clé, en hébergé et en cible locale : une section de `docs/` et `.env.example`.

**Critères d'acceptation**
- [ ] Un changement signé s'applique ; le même, rejoué, est refusé (test d'intégration).
- [ ] Une signature fausse, une clé inactive, un `issued_at` trop vieux, un champ hors liste : chacun refusé, sans rien écrire.
- [ ] Un joueur qui appelle la fonction avec un objet de sa main est refusé.
- [ ] Deux clés actives : un changement signé par l'une ou l'autre passe (rotation).
- [ ] Aucun import du service role hors `publicShare.ts` (la règle ESLint reste verte).

---

### ☐ V3.1-107 — Cibler côté joueur · `M` · sans modèle IA — **dépend de V3.1-104**

**Modèle conseillé : Sonnet.** Comme V3.1-106, pour le joueur avec son PJ,
une fois l'écriture au nom du joueur tranchée et faite (V3.1-104). D'ici là,
le joueur voit le verdict, sans application sur une cible qu'il ne contrôle
pas.

### ☑ V3.1-118 — Les choix dans l'assistant de création et de montée de niveau · `L` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 116, 117, 49, 50, 51.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Chaque `RemainingChoice` s'affiche à l'étape de sa source (Origines,
  Historique, Classe, montée de niveau), avec le sélecteur de son genre :
  compétences, langues, outils, maîtrises d'armes, dons (filtrés), sorts
  (le sélecteur unique de V3.1-50), types de dégâts, caractéristiques, et
  **options nommées** (cartes, chacune avec ses effets).
- La caractéristique d'incantation d'un lignage se choisit une fois, dans
  l'option.

**Reçu de V3.1-116** (13 octobre) :
- proposer les choix imbriqués que rend `resolveChoices` (`open`), au-delà des compétences et langues de premier niveau ;
- afficher les sorts accordés (`sheet.grantedSpells`) dans l'onglet Magie ;
- faire passer les améliorations de caractéristiques et les dons de progression en choix `ability` / `feat`.

**Critères d'acceptation**
- [x] Les critères de V3.1-3 et de V3.1-6 passent dans l'assistant (reste : l'Ascendance gigante comme ressource rechargeable, avec V3.1-119).

---

### ☑ V3.1-119 — Les choix rouverts au repos · `M` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 116, 117, 24 (repos), V3.1-5.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Un repos qui rouvre un choix (`refresh`) émet son événement ; la fiche
  propose « Choisir à nouveau : Résilience fiélonne » (feuille du bas au
  téléphone) ; sans réponse, le choix d'avant reste.

**Critères d'acceptation**
- [x] Cercle de la Terre : après un repos long, le terrain se rechoisit et
  la liste de sorts suit (test de service + écran).

---

### ☐ V3.1-148 — Les bottes d'armes maîtrisées, appliquées en jeu · `M` · sans modèle IA — **à concevoir (Opus)**

**Modèle conseillé : Opus** (moteur de jeu), puis Sonnet pour l'affichage. **Dépend de** : 118.

Sorti de V3.1-118 (31 octobre). Ce qui EXISTE déjà : le choix des armes
maîtrisées (`RemainingChoice` de genre `weapon_mastery`, lu dans la
progression de classe), l'onglet Maîtrises de la fiche, le changement au
repos long (V2-G1), et depuis V3.1-118 la botte de chaque arme sur les
cartes de l'assistant. Ce qui MANQUE : le moteur ne fait rien de la botte
d'une arme maîtrisée (`WeaponData.masteryKey` est seulement affiché).

- L'action d'attaque d'une arme maîtrisée porte sa botte (Sape, Ouverture,
  Poussée, Ralentissement, Vexation, Coup double, Écorchure, Renversement).
- Son effet passe par le moteur (déclencheurs, conditions), jamais par
  l'IA (règle 8) ; une arme non maîtrisée ne l'a pas.

**Critères d'acceptation**
- [ ] Un Guerrier qui maîtrise l'Épée longue voit « Sape » sur son attaque ;
  touché, la cible a le désavantage à son prochain jet d'attaque.
- [ ] Une arme non maîtrisée n'applique aucune botte.
