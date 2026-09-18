"use client";

import { useRef, useState, type ChangeEvent, type ComponentProps, type DragEvent } from "react";
import { useFormStatus } from "react-dom";

const buttonClassName =
  "w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/*";

function fileMatchesAccept(file: File, accept?: string) {
  if (!accept) return true;
  return accept
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .some((token) => {
      if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1));
      if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token.toLowerCase());
      return file.type === token;
    });
}

function fileNames(files: FileList | null) {
  return files && files.length > 0 ? Array.from(files).map((file) => file.name) : [];
}

function acceptsImages(accept?: string) {
  if (!accept) return true;
  return accept.split(",").some((token) => {
    const value = token.trim().toLowerCase();
    return value === "image/*" || value.startsWith("image/") || value === ".jpg" || value === ".jpeg" || value === ".png" || value === ".webp" || value === ".gif";
  });
}

export function UploadFileInput({
  disabled,
  multiple,
  accept,
  onChange,
  name,
  ...props
}: ComponentProps<"input">) {
  const { pending } = useFormStatus();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [rejectHint, setRejectHint] = useState<string | null>(null);
  const isDisabled = Boolean(pending || disabled);
  const acceptValue = typeof accept === "string" ? accept : undefined;
  const showCamera = acceptsImages(acceptValue);

  function applyFiles(list: File[], { append = false }: { append?: boolean } = {}) {
    const input = inputRef.current;
    if (!input || isDisabled) return;

    const allowed = list.filter((file) => fileMatchesAccept(file, acceptValue));
    if (list.length > 0 && allowed.length === 0) {
      setRejectHint("Only PDF or image files can be uploaded.");
      return;
    }

    const data = new DataTransfer();
    if (append && multiple && input.files) {
      for (const file of Array.from(input.files)) data.items.add(file);
    }
    for (const file of allowed) data.items.add(file);
    const next = multiple ? Array.from(data.files) : Array.from(data.files).slice(0, 1);
    const trimmed = new DataTransfer();
    for (const file of next) trimmed.items.add(file);
    input.files = trimmed.files;
    setNames(fileNames(input.files));
    setRejectHint(null);
    onChange?.({ target: input } as ChangeEvent<HTMLInputElement>);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setNames(fileNames(event.target.files));
    setRejectHint(null);
    onChange?.(event);
  }

  function handleCameraChange(event: ChangeEvent<HTMLInputElement>) {
    applyFiles(Array.from(event.target.files ?? []), { append: Boolean(multiple) });
    event.target.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isDisabled) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isDisabled) event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (isDisabled) return;
    applyFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        onClick={() => {
          if (!isDisabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (isDisabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-disabled={isDisabled}
        className={[
          "rounded-md border border-dashed px-3 py-4 text-sm transition-colors",
          dragging ? "border-accent-dark bg-accent/15 text-ink" : "border-hairline bg-input text-muted",
          isDisabled ? "cursor-wait opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <input
          {...props}
          ref={inputRef}
          type="file"
          name={name}
          multiple={multiple}
          accept={accept}
          disabled={isDisabled}
          onChange={handleChange}
          onClick={(event) => event.stopPropagation()}
          className="sr-only"
        />
        {showCamera ? (
          <input
            ref={cameraRef}
            type="file"
            accept={IMAGE_ACCEPT}
            capture="environment"
            disabled={isDisabled}
            onChange={handleCameraChange}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        ) : null}
        <p className="text-ink">
          {dragging
            ? "Drop files to attach"
            : multiple
              ? "Drop files here, or tap to browse"
              : "Drop a file here, or tap to browse"}
        </p>
        <p className="mt-1 text-xs text-muted">
          PDF or image{multiple ? " — you can select more than one" : ""}
          {showCamera ? " — on phones you can also take a photo" : ""}
        </p>
        {names.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink">
            {names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {showCamera ? (
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => cameraRef.current?.click()}
          className="w-fit text-xs font-medium text-accent-dark underline hover:text-ink disabled:cursor-wait disabled:opacity-60 sm:hidden"
        >
          Take photo
        </button>
      ) : null}
      {rejectHint ? (
        <p className="text-xs text-red-700" role="status">
          {rejectHint}
        </p>
      ) : null}
    </div>
  );
}

export function UploadSubmitButton({
  idleLabel,
  pendingLabel = "Uploading…",
}: {
  idleLabel: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2">
      <button type="submit" disabled={pending} aria-busy={pending} className={buttonClassName}>
        {pending ? pendingLabel : idleLabel}
      </button>
      {pending ? (
        <p className="text-xs text-muted" role="status" aria-live="polite">
          Upload in progress — larger files take longer. Please wait.
        </p>
      ) : null}
    </div>
  );
}
