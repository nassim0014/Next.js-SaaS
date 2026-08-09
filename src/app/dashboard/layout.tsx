import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId, getUserOrganizations } from "@/lib/auth/org-context";
import { dashboardNav } from "@/config/nav";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { can } from "@/lib/auth/rbac";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Github, LogOut } from "lucide-react";

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

  // Get the active org cookie.
  // If missing or stale, redirect to /api/org/switch (a Route Handler, which
  // CAN set cookies) instead of calling setActiveOrgId() here — Next.js 16
  // forbids cookies().set() in Server Components during render.
  const activeOrgId = await getActiveOrgId();
  const activeMembership = orgs.find((m) => m.organizationId === activeOrgId);

  if (!activeMembership) {
    // No cookie, or cookie points to an org the user no longer belongs to.
    // Redirect to the Route Handler which sets the cookie, then back here.
    const firstOrgId = orgs[0]!.organization.id;
    redirect(`/api/org/switch?orgId=${firstOrgId}&redirect=/dashboard`);
  }

  const userRole = activeMembership?.role ?? "VIEWER";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-muted/30 md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <Logo />
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
          <div className="flex items-center gap-3">
            {/* Org switcher */}
            {orgs.length > 1 ? (
              <OrgSwitcher
                orgs={orgs.map((m) => ({
                  organizationId: m.organizationId,
                  organization: { name: m.organization.name },
                }))}
                activeOrgId={activeMembership!.organizationId}
              />
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">Organization</p>
                <p className="text-sm font-medium">
                  {activeMembership?.organization.name ?? "Select an org"}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
            <Avatar className="h-8 w-8 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                {session.user.email[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
