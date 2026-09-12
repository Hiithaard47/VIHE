"use client";

import { useId, useMemo, useRef, useState } from "react";

export type PersonOption = { id: string; title: string; subtitle: string; keywords?: string };

export function AddPersonDialog({
  people,
  fieldName,
  buttonLabel,
  placeholder,
  emptyLabel,
  action,
}: {
  people: PersonOption[];
  fieldName: string;
  buttonLabel: string;
  placeholder: string;
  emptyLabel: string;
  action: (formData: FormData) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people.slice(0, 8);
    return people
      .filter((person) =>
        [person.title, person.subtitle, person.keywords ?? ""].some((value) => value.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [query, people]);

  const selected = people.find((person) => person.id === personId);

  function close() {
    dialog.current?.close();
    setQuery("");
    setPersonId("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent"
      >
        {buttonLabel}
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={action} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">{buttonLabel}</h2>
            <button type="button" onClick={close} className="text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
          <input type="hidden" name={fieldName} value={personId} />
          <label className="flex flex-col gap-1 text-sm text-ink">
            Search
            <input
              value={selected && query === selected.title ? selected.title : query}
              onChange={(event) => {
                setPersonId("");
                setQuery(event.target.value);
              }}
              placeholder={placeholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={Boolean(query.trim())}
              aria-controls={listId}
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
          </label>
          {query.trim() && (
            <ul
              id={listId}
              role="listbox"
              className="max-h-56 overflow-y-auto rounded-md border border-hairline bg-canvas"
            >
              {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted">{emptyLabel}</li>}
              {matches.map((person) => (
                <li key={person.id} role="option" aria-selected={person.id === personId}>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonId(person.id);
                      setQuery(person.title);
                    }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm text-ink hover:bg-card"
                  >
                    <span>{person.title}</span>
                    <span className="text-xs text-muted">{person.subtitle}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            disabled={!personId}
            className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </form>
      </dialog>
    </>
  );
}
