import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAgentAction } from "./actions";
import Link from "next/link";

type AgentFormProps = {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  modelConfigId: string | null;
  temperature: number;
  maxTokens: number;
};

type ModelConfigFormProps = {
  id: string;
  provider: string;
  displayName: string;
  inputCostPer1K: number;
};

export function EditAgentForm({
  agent,
  modelConfigs,
}: {
  agent: AgentFormProps;
  modelConfigs: ModelConfigFormProps[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateAgentAction} className="space-y-6">
          {/* Hidden: which agent to update */}
          <input type="hidden" name="agentId" value={agent.id} />

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={agent.name}
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
              defaultValue={agent.description ?? ""}
              placeholder="What does this agent do?"
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelConfigId">Model *</Label>
            <select
              id="modelConfigId"
              name="modelConfigId"
              defaultValue={agent.modelConfigId ?? undefined}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {modelConfigs.map((m) => (
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
              defaultValue={agent.systemPrompt ?? ""}
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
                defaultValue={agent.temperature}
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
                defaultValue={agent.maxTokens}
                required
              />
              <p className="text-xs text-muted-foreground">Response length cap</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit">Save Changes</Button>
            <Button asChild variant="outline">
              <Link href={`/dashboard/agents/${agent.id}`}>Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
