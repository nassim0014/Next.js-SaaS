import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { ChatInterface } from "@/components/chat/chat-interface";

export const dynamic = "force-dynamic";

type ChatParams = Promise<{
  conversation?: string;
  agent?: string;
}>;

export default async function ChatPage({ searchParams }: { searchParams: ChatParams }) {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const { conversation: conversationParam, agent: agentParam } = await searchParams;

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

  // Resolve an initial conversation + its messages when the user deep-links to
  // /dashboard/chat?conversation=<id> or clicks a past conversation in the
  // sidebar. The conversation must belong to (orgId, userId) to be loaded.
  let initialConversationId: string | undefined;
  let initialAgentId: string | undefined;
  let initialMessages: { id: string; role: "user" | "assistant"; content: string; createdAt: string }[] = [];

  // Preselect the agent when deep-linked from the agent detail page, but only
  // if it belongs to this org and is active.
  if (agentParam) {
    const agentMatch = agents.find((a) => a.id === agentParam);
    if (agentMatch) initialAgentId = agentMatch.id;
  }

  if (conversationParam) {
    const conversation = conversations.find((c) => c.id === conversationParam)
      ?? await prisma.conversation.findFirst({
        where: { id: conversationParam, organizationId: orgId, userId: session.user.id, status: "ACTIVE" },
      });

    if (conversation) {
      initialConversationId = conversation.id;
      // If no agent was explicitly selected, carry over the conversation's agent.
      if (!initialAgentId && conversation.agentId) {
        const agentMatch = agents.find((a) => a.id === conversation.agentId);
        if (agentMatch) initialAgentId = agentMatch.id;
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversation.id,
          role: { in: ["USER", "ASSISTANT"] },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
      initialMessages = messages.map((m) => ({
        id: m.id,
        // MessageRole enum is uppercase in the DB; map to the AI SDK's lowercase roles.
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }));
    }
  }

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
        initialAgentId={initialAgentId}
        initialConversationId={initialConversationId}
        initialMessages={initialMessages}
      />
    </div>
  );
}
