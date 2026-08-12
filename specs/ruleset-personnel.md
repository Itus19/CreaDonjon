# Spécification — Rulesets de référence personnelle

**Version :** 0.1 — 12 août 2026
**Cible :** lot D (V1-D5), après l'éditeur manuel de règles
**Amende :** `SCHEMA.md` §9 · `CLAUDE.md` · `specs/arbitrage-modifications.md` §1.2

---

## 0. Le besoin

Vous possédez les manuels des joueurs 2014 et 2024, les guides des monstres et les guides du maître. Vous voulez y accéder depuis l'application, pour vos propres parties.

L'architecture le permet sans rien ajouter de structurel : c'est un ruleset de plus, avec `parent_ruleset_id` pointant vers la base SRD correspondante et des surcharges pour ce qui s'y ajoute.

Ce qui doit être ajouté, ce sont les **garde-fous**. Sans eux, ce contenu finira un jour dans un lien public ou dans un dépôt Git, et ce sera irréversible.

> Ce document décrit une position de prudence, pas un avis juridique. Pour un usage commercial, la question mérite un conseil professionnel.

---

## 1. La distinction qui commande tout

Un livre acheté ne donne pas le droit d'en reproduire le texte. Mais tout ce qu'un livre de règles contient n'est pas du texte protégé.

| Nature | Statut habituel | Exemple |
|---|---|---|
| **Mécanique** — nombres, formules, propriétés, structure de résolution | non protégeable en tant que telle | « épée longue : 1d8 tranchant, polyvalente (1d10) » |
| **Expression** — description, ambiance, tournures, mise en forme | protégée | le paragraphe qui raconte ce qu'on ressent face à un dragon |
| **Sélection et agencement** — le choix et l'ordre d'un ensemble | protégés comme compilation | recopier le sommaire et l'organisation d'un chapitre |
| **Identité de produit** — noms propres, créatures signatures, illustrations, décors | protégée, hors SRD | beholder, illithid, Faerûn, toute illustration |

La règle pratique qui en découle :

> **Saisissez la mécanique. Ne recopiez pas la prose.**

Et une conséquence heureuse : **vous possédez les livres.** Vous n'avez donc aucun besoin d'en recopier les descriptions — il vous suffit de savoir où regarder.

D'où le champ `page_ref` :

```json
{
  "entry_key": "mind_flayer_custom",
  "blocks": [
    { "block_type": "statblock", "data": { /* CA, PV, actions, jets — la mécanique */ } },
    { "block_type": "description", "data": {
        "segments": [{ "content": [{ "t": "text", "v": "Voir MM 2024, p. 232." }] }] } }
  ]
}
```

Moins de saisie, aucun texte recopié, et à la table vous ouvrez le livre. C'est plus rapide que de tout retranscrire, et c'est la position la plus nette.

---

## 2. Trois origines de contenu

```sql
alter table rulesets add column content_origin text not null default 'user_created'
  check (content_origin in ('official_srd', 'user_created', 'personal_reference'));
```

| Origine | Ce que c'est | Partageable | Commercial |
|---|---|---|---|
| `official_srd` | SRD 5.1 et 5.2, CC-BY-4.0 | oui | oui, avec attribution |
| `user_created` | vos règles maison, écrites par vous | oui | oui, elles vous appartiennent |
| `personal_reference` | saisi depuis un ouvrage que vous possédez | **non** | **non** |

Les deux premières continuent exactement comme aujourd'hui. Seule la troisième est nouvelle, et elle est **verrouillée**.

---

## 3. Les garde-fous

Ce ne sont pas des avertissements dans l'interface. Ce sont des refus.

### 3.1 En base

```sql
-- Un monde dont le ruleset par défaut est personnel ne peut pas être partagé.
create or replace function app.forbid_share_personal_ruleset()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from worlds w
    join rulesets r on r.id = w.default_ruleset_id
    where w.id = new.world_id and r.content_origin = 'personal_reference'
  ) then
    raise exception 'Un monde utilisant un ruleset de référence personnelle ne peut pas être partagé';
  end if;
  return new;
end;
$$;

create trigger share_links_no_personal
  before insert on share_links
  for each row execute function app.forbid_share_personal_ruleset();
```

Le même verrou s'applique à `campaign_invites` et à `campaign_members` : **aucun tiers** n'accède à une partie fondée sur un ruleset personnel.

### 3.2 À l'export

Un export de monde omet le contenu d'un ruleset `personal_reference` et n'en garde que la référence : *« ce monde utilise un ruleset personnel non inclus »*. Réimporter sur une autre machine demande de le saisir à nouveau — c'est le comportement voulu.

### 3.3 Dans le produit

- Jamais indexé dans une bibliothèque partagée, ni dans des données d'entraînement, ni dans un catalogue public.
- Jamais de conversion `personal_reference` → `user_created`. La bascule est interdite, pas déconseillée.
- L'interface l'énonce **au moment de la création**, en une phrase, pas dans des conditions d'utilisation.

### 3.4 Hors de l'application — la règle la plus importante

**Ce contenu ne doit jamais entrer dans le dépôt Git.**

Pas dans une migration, pas dans un fichier de données de démonstration, pas dans un test, pas dans un commentaire, pas dans un exemple de documentation.

Votre dépôt `Itus19/CreaDonjon` est **public** : j'ai pu le lire sans authentification. Un stat-block du guide des monstres recopié dans un fichier de seed devient une publication mondiale, conservée dans l'historique Git même après suppression du fichier.

C'est de loin le risque le plus concret de tout ce sujet, et il ne vient pas de l'application : il vient de l'agent de codage à qui on demanderait « ajoute les monstres du MM ».

---

## 4. Comment saisir

### 4.1 À la main — disponible dès V1-D4

L'éditeur manuel de règles couvre le cas. Long pour un bestiaire complet, mais parfaitement praticable pour ce dont on se sert : quelques dizaines de sous-classes, de dons, d'objets magiques.

**Commencez par ce que vous utilisez réellement.** Un guide des monstres complet représente des centaines d'entrées dont vous emploierez une fraction. Saisir à l'usage, séance après séance, est plus efficace que de tout entrer d'avance — et vous saurez alors quels champs comptent.

### 4.2 Assisté — V1-F2, et l'argument pour le modèle local

Le collage assisté : vous collez le texte d'une règle, l'assistant en propose la structure, vous validez dans le bac à sable.

**Avec un modèle distant, ce texte quitte votre machine** et transite chez un tiers, avec ses propres conditions d'utilisation. Avec un modèle local via Ollama ou LM Studio, il ne sort jamais.

C'est le meilleur argument que je connaisse en faveur de votre orientation locale, et je ne l'avais pas identifié : **la saisie de contenu sous droits est un cas d'usage qui exige un modèle local.** À inscrire dans `specs/cible-locale-et-ia.md`.

Conséquence de séquencement : le collage assisté sur du contenu d'ouvrage ne doit être proposé **que** lorsqu'un fournisseur local est actif. Avec un fournisseur distant, la fonction reste disponible pour vos propres règles maison, mais l'avertissement est explicite.

### 4.3 Pas d'analyse automatique de PDF

Position inchangée. Un analyseur qui se trompe sur un tableau de progression produit des règles fausses que personne ne remarque — et il encourage à ingérer un ouvrage entier plutôt que les règles dont on se sert.

---

## 5. Le ticket

## V1-D5 — Rulesets de référence personnelle · `M`

Après V1-D4 (l'éditeur manuel), dont il dépend.

**Livrables**
- Colonne `content_origin` et migration.
- Les trois verrous : partage, invitation, membres de campagne.
- Export omettant le contenu personnel.
- Création d'un ruleset personnel dérivant d'une base SRD, avec la phrase d'avertissement.
- Champ `page_ref` sur le bloc `description`, affiché comme référence et non comme contenu.

**Critères d'acceptation**
- [ ] Créer un lien de partage sur un monde en ruleset personnel lève une exception en base, pas seulement un message d'interface.
- [ ] Inviter un membre dans une campagne fondée sur un ruleset personnel est refusé.
- [ ] L'export d'un tel monde ne contient aucune entrée de règle du ruleset personnel.
- [ ] Aucune bascule possible de `personal_reference` vers `user_created`.
- [ ] Le badge « référence personnelle » est visible sur toute fiche de règle qui en provient.
- [ ] Une recherche dans le dépôt sur cinq noms de créatures hors SRD ne remonte rien.

---

## 6. Ce que ça ne change pas

Les bases SRD restent exactement ce qu'elles sont : `official_srd`, CC-BY-4.0, avec l'attribution prescrite, partageables, exploitables commercialement. C'est **elles** que voit un utilisateur de votre application.

Le ruleset personnel est une couche par-dessus, dans votre base, pour vos parties. La séparation est propre parce qu'elle était déjà dans le modèle : `parent_ruleset_id`, surcharges, `is_official_base` inviolable.

Vous n'aviez pas prévu ce cas, et l'architecture y répond sans être tordue. C'est plutôt bon signe.
