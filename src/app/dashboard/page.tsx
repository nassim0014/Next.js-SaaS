import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { getCurrentPeriodUsage } from "@/lib/ai/cost";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCost, formatTokenCount } from "@/lib/utils";
import { Bot, MessageSquare, Activity, DollarSign } from "lucide-react";

export default async function DashboardHome() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const [agentCount, conversationCount, usage] = await Promise.all([
    prisma.agent.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    prisma.conversation.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    getCurrentPeriodUsage(orgId),
  ]);

  const stats = [
    { label: "Active Agents", value: agentCount, icon: Bot },
    {
      label: "Active Conversations",
      value: conversationCount,
      icon: MessageSquare,
    },
    {
      label: "Tokens Used (this period)",
      value: formatTokenCount(usage.totalTokens),
      icon: Activity,
    },
    {
      label: "Estimated Cost (this period)",
      value: formatCost(usage.totalCostUsd),
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {session.user.name?.split(" ")[0] ?? "there"}</h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening with your AI workspace.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>Get your first agent running in 3 steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="font-bold text-primary">1.</span>
              <span>
                Create an agent — define its name, system prompt, and the LLM model it should use.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary">2.</span>
              <span>(Optional) Upload documents to a Knowledge Base for RAG-powered answers.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary">3.</span>
              <span>Start chatting with your agent. Token usage and cost are tracked automatically.</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
