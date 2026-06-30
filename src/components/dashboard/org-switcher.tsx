"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Org = {
  organizationId: string;
  organization: { name: string };
};

export function OrgSwitcher({ orgs, activeOrgId }: { orgs: Org[]; activeOrgId: string }) {
  const router = useRouter();
  const [isPending] = useTransition();

  function handleChange(value: string) {
    router.push(`/api/org/switch?orgId=${value}&redirect=${window.location.pathname}`);
  }

  return (
    <select
      value={activeOrgId}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {orgs.map((m) => (
        <option key={m.organizationId} value={m.organizationId}>
          {m.organization.name}
        </option>
      ))}
    </select>
  );
}
