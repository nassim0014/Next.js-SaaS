"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { createWebhookAction } from "./actions";
import { toast } from "sonner";

export function WebhookForm() {
  const [state, formAction] = useActionState(createWebhookAction, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (!state.error) toast.success("Webhook endpoint created!");
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input id="url" name="url" type="url" placeholder="https://your-app.com/webhook" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="events">Events (comma-separated)</Label>
        <Input id="events" name="events" placeholder="conversation.created, billing.invoice_paid" required />
        <p className="text-xs text-muted-foreground">Comma-separated list of event types to subscribe to</p>
      </div>
      <Button type="submit">
        <Plus className="h-4 w-4" />
        Add Endpoint
      </Button>
    </form>
  );
}
