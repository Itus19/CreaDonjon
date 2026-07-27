import { createEntity } from "./actions";

export default async function NewEntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const createEntityForWorld = createEntity.bind(null, id);

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <form
        action={createEntityForWorld}
        className="form-card flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-xl font-semibold text-foreground">
          Créer une entité
        </h1>

        {error && <p className="text-sm text-danger">{error}</p>}

        <label className="field-label">
          Nom
          <input name="name" type="text" required className="input-field" />
        </label>

        <label className="field-label">
          Type (personnage, lieu, faction, objet...)
          <input
            name="entity_kind"
            type="text"
            list="entity-kind-suggestions"
            className="input-field"
          />
          <datalist id="entity-kind-suggestions">
            <option value="personnage" />
            <option value="lieu" />
            <option value="faction" />
            <option value="objet" />
            <option value="evenement" />
          </datalist>
        </label>

        <label className="field-label">
          Résumé (toujours visible, pas de secret ici)
          <textarea name="summary" rows={3} className="input-field" />
        </label>

        <button type="submit" className="btn-accent mt-2">
          Créer
        </button>
      </form>
    </div>
  );
}
