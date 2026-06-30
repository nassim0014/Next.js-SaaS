"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Copy, Check } from "lucide-react";
import { createApiKeyAction } from "./actions";
import { toast } from "sonner";

export function ApiKeyForm() {
  const [state, formAction] = useActionState(createApiKeyAction, {});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.key) toast.success("API key created! Copy it now — you won't see it again.");
  }, [state]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex gap-2 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="name">Key Name</Label>
          <Input id="name" name="name" placeholder="e.g. Production API" required maxLength={100} />
        </div>
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </form>

      {state.key && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
            ⚠️ Copy your API key now. You won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{state.key}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(state.key!);
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
