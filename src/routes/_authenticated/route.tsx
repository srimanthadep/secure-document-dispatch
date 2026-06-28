import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    return {
      user: {
        id: "guest-user",
        email: "guest@example.com",
        created_at: new Date().toISOString(),
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
      },
    };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
