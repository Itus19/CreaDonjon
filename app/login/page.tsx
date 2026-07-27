import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <form className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-8 shadow-xl shadow-black/20">
        <h1 className="text-xl font-semibold tracking-wide text-accent">
          CreaDonjon
        </h1>

        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-accent">{message}</p>}

        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-border bg-black/20 px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Mot de passe
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-md border border-border bg-black/20 px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>

        <div className="flex gap-3 pt-2">
          <button
            formAction={login}
            className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            Se connecter
          </button>
          <button
            formAction={signup}
            className="flex-1 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Créer un compte
          </button>
        </div>
      </form>
    </div>
  );
}
