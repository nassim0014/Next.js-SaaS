import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAgentAction } from "./actions";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  const session = await requireUser();
  const orgId = await requireActiveOrgId();

  // Fetch available model configs (seeded globally)
  const models = await prisma.modelConfig.findMany({
    orderBy: [{ provider: "asc" }, { displayName: "asc" }],
  });

  if (models.length === 0) {
    redirect("/dashboard/agents?error=no-models");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/agents">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Agent</h1>
          <p className="text-muted-foreground">Configure a new AI agent</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAgentAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Customer Support Bot"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                placeholder="What does this agent do?"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelConfigId">Model *</Label>
              <select
                id="modelConfigId"
                name="modelConfigId"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.provider})
                    {m.inputCostPer1K === 0 ? " — FREE" : ` — $${m.inputCostPer1K}/1K in`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Only models with API keys configured in .env.local will work at runtime.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <textarea
                id="systemPrompt"
                name="systemPrompt"
                rows={6}
                maxLength={10_000}
                placeholder="You are a helpful assistant that..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Instructions that shape the agent&apos;s behavior. Optional but recommended.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  name="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  defaultValue="0.7"
                  required
                />
                <p className="text-xs text-muted-foreground">0 = deterministic, 2 = creative</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  name="maxTokens"
                  type="number"
                  min="1"
                  max="100000"
                  defaultValue="4096"
                  required
                />
                <p className="text-xs text-muted-foreground">Response length cap</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit">Create Agent</Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/agents">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
