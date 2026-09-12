import { Prisma } from "@prisma/client";

// Server actions communicate result back to the (JS-optional) page via a
// redirect carrying `flash`/`kind` query params, read by <FlashBanner />.
export function flashUrl(path: string, kind: "success" | "error", message: string): string {
  const params = new URLSearchParams({ flash: message, kind });
  return `${path}?${params.toString()}`;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
