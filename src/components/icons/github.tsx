import type { SVGProps } from "react";

/**
 * GitHub mark.
 *
 * lucide-react removed all brand icons in v1, so `Github` is no longer
 * exported. The generic git icons it kept (GitBranch, GitFork, ...) mean
 * "version control", not "sign in with GitHub", so none of them are a
 * substitute on an OAuth button.
 *
 * Inlined here rather than adding a brand-icon dependency: it is one path,
 * and a whole package for a single mark is not worth the supply-chain
 * surface or the future dependabot traffic.
 *
 * Takes the same props as a lucide icon, so `className="h-4 w-4"` and
 * `currentColor` behave exactly as before.
 */
export function Github(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}
