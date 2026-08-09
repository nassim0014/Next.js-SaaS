import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EditAgentForm } from "../edit-form";

export const dynamic = "force-dynamic";

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const { id } = await params;

  const [agent, models] = await Promise.all([
    prisma.agent.findFirst({
      where: { id, organizationId: orgId },
      include: { modelConfig: true },
    }),
    prisma.modelConfig.findMany({
      orderBy: [{ provider: "asc" }, { displayName: "asc" }],
    }),
  ]);

  if (!agent || !agent.modelConfig) notFound();
  if (models.length === 0) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/agents/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to agent
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Agent</h1>
          <p className="text-muted-foreground">Update {agent.name}&apos;s configuration</p>
        </div>
      </div>

      <EditAgentForm agent={agent} modelConfigs={models} />
    </div>
  );
}
