import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, MessageSquare } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const agents = await prisma.agent.findMany({
    where: { organizationId: orgId },
    include: {
      modelConfig: true,
      _count: { select: { conversations: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground">Create and manage your AI agents</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/agents/new">
            <Plus className="h-4 w-4" />
            New agent
          </Link>
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              No agents yet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first AI agent to start chatting. Pick a model, write a system prompt,
              and you&apos;re ready to go.
            </p>
            <Button asChild>
              <Link href="/dashboard/agents/new">Create your first agent</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{agent.modelConfig?.displayName ?? "No model"}</p>
                    </div>
                  </div>
                  <Badge variant={agent.status === "ACTIVE" ? "default" : "secondary"}>
                    {agent.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {agent.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{agent.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {agent._count.conversations} conversations
                  </span>
                  <span>Created {formatRelativeTime(agent.createdAt)}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="default">
                    <Link href={`/dashboard/chat?agent=${agent.id}`}>Chat</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/agents/${agent.id}`}>Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
