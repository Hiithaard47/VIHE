import { Prisma } from "@prisma/client";

// Server actions communicate result back to the (JS-optional) page via a
// redirect carrying `flash`/`kind` query params, read by <FlashBanner />.
export function flashUrl(path: string, kind: "success" | "error", message: string): string {
  const [pathname, existing] = path.split("?");
  const params = new URLSearchParams(existing);
  params.set("flash", message);
  params.set("kind", kind);
  return `${pathname}?${params.toString()}`;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export function isForeignKeyError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}
