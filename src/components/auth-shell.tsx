import Link from "next/link";
import { Logo, LogoMark } from "@/components/logo";
import { Check, ShieldCheck, Activity, Layers } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Layers, text: "Multi-tenant from the first migration — organizationId everywhere" },
  { icon: ShieldCheck, text: "RBAC + immutable audit trail on every mutation" },
  { icon: Activity, text: "AI cost observability — no more surprise token bills" },
];

/**
 * Shared split-screen shell for /login and /signup: form on the left, a
 * branded panel on the right (hidden below lg — the form stays centered on
 * mobile instead of squeezing a second column in). No fabricated
 * testimonials/customer logos — the right panel highlights real,
 * already-shipped capabilities instead.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <Link href="/" className="lg:hidden">
          <Logo />
        </Link>
        {children}
      </div>

      <div className="relative hidden w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-brand-gradient p-12 text-primary-foreground lg:flex">
        <div
          className="absolute inset-0 bg-dot-grid opacity-20 [background-size:20px_20px]"
          aria-hidden="true"
        />
        <Link href="/" className="relative">
          <div className="flex items-center gap-2">
            <LogoMark className="h-9 w-9" />
          </div>
        </Link>
        <div className="relative space-y-8">
          <blockquote className="text-2xl font-semibold leading-snug">
            Six systems every AI SaaS founder has to build eventually — pre-integrated, so you skip
            straight to your actual product.
          </blockquote>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.text}
                className="flex items-start gap-3 text-sm text-primary-foreground/90"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                  <Check className="h-3 w-3" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          MIT / Commercial dual license · your Supabase, your data
        </p>
      </div>
    </div>
  );
}
