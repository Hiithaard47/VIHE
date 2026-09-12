import { ChangePasswordForm } from "@/components/change-password-form";
import { FlashBanner } from "@/components/flash-banner";
import { changeOwnPassword } from "./actions";

export default function AdminAccountPage() {
  return (
    <div className="flex flex-col gap-4">
      <FlashBanner />
      <h1 className="font-heading text-lg font-semibold text-ink">Account</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Change password</h2>
        <ChangePasswordForm action={changeOwnPassword} />
      </section>
    </div>
  );
}
