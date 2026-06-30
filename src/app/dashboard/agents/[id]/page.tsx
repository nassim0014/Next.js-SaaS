import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bot, MessageSquare, Thermometer, Hash, Settings2 } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id, organizationId: orgId },
    include: {
      modelConfig: true,
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
      _count: { select: { conversations: true } },
    },
  });

  if (!agent) notFound();
  if (!agent.modelConfig) notFound();

  const mc = agent.modelConfig;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/agents">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <Badge variant={agent.status === "ACTIVE" ? "default" : "secondary"}>{agent.status}</Badge>
          </div>
          {agent.description && (
            <p className="text-muted-foreground mt-1">{agent.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Created {formatRelativeTime(agent.createdAt)}
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/chat?agent=${agent.id}`}>
            <MessageSquare className="h-4 w-4" />
            Chat
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Model Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{mc.provider}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model</span>
              <span className="font-medium">{mc.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Context window</span>
              <span className="font-medium">{mc.contextWindow.toLocaleString()} tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input cost</span>
              <span className="font-medium">${mc.inputCostPer1K}/1K tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output cost</span>
              <span className="font-medium">${mc.outputCostPer1K}/1K tokens</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Generation Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                Temperature
              </span>
              <span className="font-medium">{agent.temperature}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Max tokens
              </span>
              <span className="font-medium">{agent.maxTokens.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {agent.systemPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">System Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono bg-muted/50 rounded-lg p-4">
              {agent.systemPrompt}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Conversations ({agent._count.conversations} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {agent.conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations yet. Start chatting!</p>
          ) : (
            <div className="space-y-2">
              {agent.conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/chat?conversation=${c.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{c.title ?? "Untitled conversation"}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(c.updatedAt)}</p>
                  </div>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
