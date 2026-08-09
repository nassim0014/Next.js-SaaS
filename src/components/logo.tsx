import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

/**
 * Brand mark — a simple abstract spark/bolt in a rounded square, deliberately
 * generic (not tied to a specific product name) since this is a boilerplate
 * meant to be rebranded. Swap this out once a real brand name/logo exists.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground",
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[60%] w-[60%]">
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
      </svg>
    </div>
  );
}

/**
 * Full logo lockup — mark + wordmark. Used in the marketing header, dashboard
 * sidebar, and auth pages.
 */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark className="h-8 w-8" />
      {showText && <span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span>}
    </div>
  );
}
