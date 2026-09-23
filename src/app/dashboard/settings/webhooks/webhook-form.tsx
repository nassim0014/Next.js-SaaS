"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Copy, Check } from "lucide-react";
import { createWebhookAction } from "./actions";
import { toast } from "sonner";

export function WebhookForm() {
  const [state, formAction] = useActionState(createWebhookAction, {});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.secret) toast.success("Webhook endpoint created! Copy the signing secret now — you won't see it again.");
  }, [state]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input id="url" name="url" type="url" placeholder="https://your-app.com/webhook" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="events">Events (comma-separated)</Label>
          <Input id="events" name="events" placeholder="conversation.created, billing.invoice_paid, usage.budget_threshold" required />
          <p className="text-xs text-muted-foreground">Comma-separated list of event types to subscribe to</p>
        </div>
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Add Endpoint
        </Button>
      </form>

      {state.secret && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
            ⚠️ Copy your signing secret now. You won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{state.secret}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(state.secret!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded-md border p-2 hover:bg-accent"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
