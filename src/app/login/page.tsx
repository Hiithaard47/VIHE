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

    setSubmitting(false);
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    window.location.href = result?.url ?? callbackUrl;
  }

  return (
    <div className="min-h-screen">
      <AppHeader subtitle="Vrindavan Institute for Higher Education" />

      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        <div className="rounded-xl border border-hairline bg-card p-7">
          <div className="mb-5">
            <h1 className="font-heading text-2xl font-semibold text-ink">Sign in</h1>
            <p className="mt-1 text-sm text-muted">Vrindavan Institute for Higher Education</p>
          </div>

          <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
              />
            </label>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-md bg-ink px-3 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-hairline" />
            or
            <div className="h-px flex-1 bg-hairline" />
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm font-medium text-ink"
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-canvas text-[10px] font-bold text-muted">
              G
            </span>
            Continue with Google
          </button>

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
