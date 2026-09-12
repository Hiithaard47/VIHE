export { auth as proxy } from "@/auth";

// The proxy (formerly "middleware") only enforces authentication (is there
// a session?). Fine-grained permission checks happen in each section's
// layout.tsx, since that's where we have a clean server-side redirect/story
// per role.
export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*"],
};
