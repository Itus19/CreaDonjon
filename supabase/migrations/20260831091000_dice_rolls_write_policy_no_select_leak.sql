-- V2-M11 (Lot M) : corrige une fuite de visibilite decouverte par
-- checkRolls.integration.test.ts. `dice_rolls_write` (migration precedente)
-- est une policy `for all`, dont le `using` s'applique aussi au SELECT — sans
-- restriction sur `visibility_level`, elle s'ajoute par OR (policies
-- permissives Postgres) a `dice_rolls_select` et laisse n'importe quel membre
-- lire un jet marque `gm`. `dice_rolls` n'est jamais mis a jour ni supprime
-- (journal immuable) : la policy d'ecriture n'a besoin de couvrir que
-- l'INSERT, jamais le SELECT.

drop policy dice_rolls_write on dice_rolls;
create policy dice_rolls_insert on dice_rolls for insert
  with check (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and (visibility_level = 'public' or app.is_world_admin(app.campaign_world_id(campaign_id)))
  );
