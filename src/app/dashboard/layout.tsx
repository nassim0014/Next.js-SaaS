import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId, getUserOrganizations, setActiveOrgId } from "@/lib/auth/org-context";
import { dashboardNav } from "@/config/nav";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/rbac";
import { Bot, Github, LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect("/login");
  }

  const orgs = await getUserOrganizations(session.user.id);

  if (orgs.length === 0) {
    // New user — show onboarding
    redirect("/onboarding");
  }

  // Get or set the active org cookie
  let activeOrgId = await getActiveOrgId();

  if (!activeOrgId) {
    // No active org cookie — set it to the first org and use it for this render.
    // Previously this redirected to /api/org/switch, which caused a redirect loop
    // because cookies().set() in route handlers doesn't persist across redirects.
    // Setting it directly in the Server Component works reliably.
    activeOrgId = orgs[0]!.organization.id;
    await setActiveOrgId(activeOrgId);
  }

  // Verify the active org is one the user belongs to
  const activeMembership = orgs.find((m) => m.organizationId === activeOrgId);

  if (!activeMembership) {
    // The cookie has a stale org ID — reset to the first org
    activeOrgId = orgs[0]!.organization.id;
    await setActiveOrgId(activeOrgId);
  }

  const userRole = activeMembership?.role ?? "VIEWER";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30">
        <div className="flex h-16 items-center gap-2 border-b px-6 font-bold">
          <Bot className="h-5 w-5" />
          {siteConfig.name}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {dashboardNav.map((item) => {
            if (item.permission && !can(userRole, item.permission)) return null;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </Button>
          <form action="/api/auth/signout" method="post">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <div>
            <p className="text-xs text-muted-foreground">Organization</p>
            <p className="font-medium">
              {activeMembership?.organization.name ?? "Select an org"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
