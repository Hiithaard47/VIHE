import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/rbac";
import { isStudentLoginExpired } from "@/lib/student-login";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (user?.passwordHash && user.isActive) {
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;
          return { id: user.id, name: user.name, email: user.email, image: user.image, kind: "staff" as const };
        }

        const student = await prisma.student.findUnique({ where: { email } });
        if (!student?.passwordHash || !student.isActive || isStudentLoginExpired(student.loginExpiresAt)) return null;
        const validStudent = await bcrypt.compare(password, student.passwordHash);
        if (!validStudent) return null;
        return { id: student.id, name: student.name, email: student.email, kind: "student" as const };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // No self sign-up: a Google account only works if an admin already
    // created a matching, active User record for that email.
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const existing = await prisma.user.findUnique({ where: { email: user.email } });
        if (!existing || !existing.isActive) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.kind === "student") {
        if (!user.id) return token;
        token.id = user.id;
        token.kind = "student";
        token.roles = [];
        token.permissions = [];
        if (user.name) token.name = user.name;
        if (user.email) token.email = user.email;
        return token;
      }
      if (token.kind === "student") {
        if (token.id) {
          const student = await prisma.student.findUnique({
            where: { id: token.id },
            select: { name: true, email: true },
          });
          if (student?.name) token.name = student.name;
          if (student?.email) token.email = student.email;
        }
        return token;
      }
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          token.id = dbUser.id;
          token.kind = "staff";
          token.name = dbUser.name;
          if (dbUser.email) token.email = dbUser.email;
          const { roles, permissions } = await getUserPermissions(dbUser.id);
          token.roles = roles;
          token.permissions = permissions;
        }
        return token;
      }
      if (token.kind === "staff" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { name: true, email: true },
        });
        if (dbUser?.name) token.name = dbUser.name;
        if (dbUser?.email) token.email = dbUser.email;
        const { roles, permissions } = await getUserPermissions(token.id);
        token.roles = roles;
        token.permissions = permissions;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.kind = token.kind ?? "staff";
      session.user.roles = token.roles ?? [];
      session.user.permissions = token.permissions ?? [];
      if (token.name) session.user.name = token.name;
      if (token.email) session.user.email = token.email;
      return session;
    },
  },
});
