"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setSubmitting(false);
      setError("Invalid email or password.");
      return;
    }
    // Keep the pending state until the hard navigation completes.
    window.location.assign(result?.url ?? callbackUrl);
  }

  return (
    <div className="min-h-screen">
      <AppHeader title={null} />

      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        <div className="rounded-xl border border-hairline bg-card p-7">
          <div className="mb-5">
            <h1 className="font-heading text-2xl font-semibold text-ink">Sign in</h1>
            <p className="mt-1 text-sm text-muted">Vrindavan Institute for Higher Education</p>
          </div>

          <form
            onSubmit={handleCredentialsSubmit}
            aria-busy={submitting}
            className="relative flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1 text-sm text-ink">
              Email
              <input
                type="email"
                required
                disabled={submitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Password
              <input
                type="password"
                required
                disabled={submitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted disabled:opacity-60"
              />
            </label>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="mt-2 rounded-md bg-ink px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
            {submitting ? (
              <p className="text-xs text-muted" role="status" aria-live="polite">
                Checking your account — this can take a moment.
              </p>
            ) : null}
          </form>

          <p className="mt-5 text-center text-xs text-muted">
            Teachers and students sign in here. Ask an admin for an account.
          </p>
          <p className="mt-2 text-center text-xs text-muted">
            Prospective student?{" "}
            <Link href="/apply" className="text-accent-dark underline">
              Apply here
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
