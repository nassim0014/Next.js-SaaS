import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground">Create and manage your AI agents</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/agents/new">New agent</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No agents yet</CardTitle>
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
    </div>
  );
}
