import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <form className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          CreaDonjon
        </h1>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {message && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {message}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Mot de passe
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/10 dark:text-zinc-50"
          />
        </label>

        <div className="flex gap-3 pt-2">
          <button
            formAction={login}
            className="flex-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Se connecter
          </button>
          <button
            formAction={signup}
            className="flex-1 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black/5 dark:border-white/10 dark:text-zinc-50 dark:hover:bg-white/5"
          >
            Creer un compte
          </button>
        </div>
      </form>
    </div>
  );
}
