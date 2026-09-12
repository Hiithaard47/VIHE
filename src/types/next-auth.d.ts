import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      permissions: string[];
    } & DefaultSession["user"];
  }

  interface User {
    roles?: string[];
    permissions?: string[];
  }
}

// next-auth/jwt re-exports its JWT type from @auth/core/jwt, and TS module
// augmentation only merges into the module that declares the interface —
// augmenting the re-exporting module is silently a no-op, so this targets
// @auth/core/jwt directly.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    roles: string[];
    permissions: string[];
  }
}
