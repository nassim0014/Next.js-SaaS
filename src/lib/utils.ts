import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind class merger — used by every shadcn/ui component.
 *
 * @example
 *   <button className={cn("px-4 py-2", isActive && "bg-blue-500")} />
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number of cents as a USD currency string.
 * Money is stored as Int cents throughout the app — never floats.
 *
 * @example
 *   formatCurrency(1999) // "$19.99"
 *   formatCurrency(0)    // "$0.00"
 */
export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format a date as a relative time ("2 hours ago", "3 days ago", etc.)
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Format a number of tokens as a human-readable string.
 *
 * @example
 *   formatTokenCount(50000)      // "50K"
 *   formatTokenCount(1_500_000)  // "1.5M"
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

/**
 * Format a USD cost (float) as a currency string.
 *
 * @example
 *   formatCost(0.04) // "$0.04"
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) return `<$0.01`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(usd);
}

/**
 * Generate a random API key prefix for display.
 *
 * @example
 *   generateApiKeyPrefix() // "nk_live_abcd1234..."
 */
export function generateApiKeyPrefix(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let prefix = "";
  for (let i = 0; i < 8; i++) {
    prefix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `nks_live_${prefix}`;
}

/**
 * Sleep for a number of milliseconds. Used in tests + dev.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate a string to a max length, adding an ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}
