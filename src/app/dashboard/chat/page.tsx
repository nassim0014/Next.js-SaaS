import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { ChatInterface } from "@/components/chat/chat-interface";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const [agents, conversations] = await Promise.all([
    prisma.agent.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      include: { modelConfig: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.conversation.findMany({
      where: { organizationId: orgId, userId: session.user.id, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-muted-foreground">Conversation with your AI agents</p>
      </div>
      <ChatInterface
        agents={agents.map((a) => ({
          id: a.id,
          name: a.name,
          systemPrompt: a.systemPrompt,
          modelConfig: {
            displayName: a.modelConfig?.displayName ?? "Unknown",
            provider: a.modelConfig?.provider ?? "unknown",
          },
        }))}
        conversations={conversations.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt.toISOString(),
        }))}
        orgId={orgId}
      />
    </div>
  );
}
