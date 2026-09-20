/** Open a native `<dialog>` and focus the first field (not Cancel / submit). */
export function openDialog(dialog: HTMLDialogElement | null | undefined) {
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  queueMicrotask(() => {
    const field = dialog.querySelector<HTMLElement>(
      [
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([disabled])',
        "textarea:not([disabled])",
        "select:not([disabled])",
      ].join(", "),
    );
    field?.focus();
  });
}
