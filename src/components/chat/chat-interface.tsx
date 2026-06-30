"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Bot, User, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Agent = {
  id: string;
  name: string;
  systemPrompt: string | null;
  modelConfig: {
    displayName: string;
    provider: string;
  };
};

type Conversation = {
  id: string;
  title: string | null;
  createdAt: string;
};

export function ChatInterface({
  agents,
  conversations,
  orgId,
}: {
  agents: Agent[];
  conversations: Conversation[];
  orgId: string;
}) {
  const router = useRouter();
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, reload } = useChat({
    api: "/api/chat",
    // Use experimental_prepareRequestBody to explicitly build the request body.
    // The static `body` option in AI SDK v4 can get stale (captured at hook
    // init time) and doesn't always merge correctly with the messages array.
    experimental_prepareRequestBody: ({ messages: chatMessages }) => ({
      messages: chatMessages,
      agentId: selectedAgentId,
      conversationId: selectedConversationId,
    }),
    streamProtocol: "data",
    onError: (err) => {
      console.error("[useChat error]", err);
      // The error message from the data stream can be generic ("An error occurred.")
      // Show a more helpful message that tells the user to check server logs.
      const msg = err.message || "Chat error";
      if (msg === "An error occurred.") {
        toast.error("The AI provider returned an error. Check the server terminal for details — look for [CHAT STREAM ERROR] in the logs.");
      } else {
        toast.error(msg);
      }
    },
    onFinish: () => {
      router.refresh();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleAgentChange(agentId: string) {
    setSelectedAgentId(agentId);
    setSelectedConversationId(undefined);
    setMessages([]);
  }

  function handleNewChat() {
    setSelectedConversationId(undefined);
    setMessages([]);
  }

  function handleSelectConversation(convId: string, convTitle: string | null) {
    setSelectedConversationId(convId);
    setMessages([]);
    // In a full implementation, we'd fetch the conversation's messages here.
    // For now, the API reconstructs history from the DB on the next message.
    toast.info(`Loaded conversation: ${convTitle ?? "Untitled"}`);
  }

  if (agents.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Bot className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No agents yet</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Create an agent first to start chatting.
        </p>
        <Button asChild>
          <a href="/dashboard/agents/new">Create Agent</a>
        </Button>
      </Card>
    );
  }

  const currentAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar: agent + conversation list */}
      <div className="hidden md:flex w-64 flex-col gap-3 border-r pr-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent</label>
          <select
            value={selectedAgentId}
            onChange={(e) => handleAgentChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {currentAgent && (
            <p className="text-xs text-muted-foreground mt-1 px-1">
              {currentAgent.modelConfig.displayName}
            </p>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={handleNewChat}>
          + New Chat
        </Button>

        <div className="flex-1 overflow-y-auto space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-1 mb-1">Recent</p>
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectConversation(c.id, c.title)}
                className={`w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors ${
                  selectedConversationId === c.id ? "bg-accent" : ""
                }`}
              >
                <p className="truncate">{c.title ?? "Untitled"}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-3" />
              <p>Send a message to start chatting with {currentAgent?.name}</p>
              <p className="text-xs mt-1">Powered by {currentAgent?.modelConfig.displayName ?? "AI"}</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role !== "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-lg px-4 py-2 bg-muted">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error.message}
              <Button size="sm" variant="ghost" onClick={() => reload()} className="ml-2">
                Retry
              </Button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e);
          }}
          className="flex gap-2 pt-4 border-t"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
