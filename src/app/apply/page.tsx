import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { submitApplication } from "./actions";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;

  return (
    <div className="min-h-screen">
      <AppHeader subtitle="Vrindavan Institute for Higher Education" />

      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        {submitted ? (
          <div className="rounded-xl border border-hairline bg-card p-7 text-center">
            <h1 className="font-heading text-2xl font-semibold text-ink">Thank you</h1>
            <p className="mt-3 text-sm text-muted">
              Your application has been received. Someone from VIHE will reach out about next steps.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm text-accent-dark underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <ApplicationForm />
        )}
      </main>
    </div>
  );
}

async function ApplicationForm() {
  const courses = await prisma.course.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  return (
    <div className="rounded-xl border border-hairline bg-card p-7">
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-semibold text-ink">Apply as a student</h1>
        <p className="mt-1 text-sm text-muted">Tell us a little about yourself and we&apos;ll be in touch.</p>
      </div>

      <form action={submitApplication} className="flex flex-col gap-6">
        {/* Honeypot — kept out of the tab order and hidden from sighted users; bots that fill every field trip it. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] top-0 h-0 w-0 opacity-0"
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Contact</h2>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Full name
            <input
              name="name"
              required
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Email
            <input
              name="email"
              type="email"
              required
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Phone (optional)
            <input
              name="phone"
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Study preferences</h2>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Course you&apos;re interested in
            <select
              name="desiredCourseId"
              defaultValue=""
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            >
              <option value="">Not sure yet</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Mode
              <select
                name="preferredMode"
                defaultValue=""
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
              >
                <option value="">No preference</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ON_SITE">On-site</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Language
              <select
                name="preferredLanguage"
                defaultValue=""
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
              >
                <option value="">No preference</option>
                <option value="ENGLISH">English</option>
                <option value="HINDI">Hindi</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">About you (optional)</h2>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Date of birth
            <input
              name="dateOfBirth"
              type="date"
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Country
              <input
                name="country"
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              City
              <input
                name="city"
                className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Prior spiritual education or experience
            <textarea
              name="priorExperience"
              rows={2}
              className="resize-none rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Anything else you&apos;d like to share
            <textarea
              name="message"
              rows={2}
              className="resize-none rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
          </label>
        </div>

        <button type="submit" className="rounded-md bg-ink px-3 py-2.5 text-sm font-semibold text-accent">
          Submit application
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        Already have an account? <Link href="/login" className="text-accent-dark underline">Sign in</Link>
      </p>
    </div>
  );
}
