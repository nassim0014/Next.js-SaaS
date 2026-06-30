"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { createKnowledgeBaseAction } from "./actions";
import { toast } from "sonner";

export function KnowledgeBaseForm() {
  const [state, formAction] = useActionState(createKnowledgeBaseAction, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (!state.error) toast.success("Knowledge base created!");
  }, [state]);

  return (
    <form action={formAction} className="flex gap-2 items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="e.g. Product Docs" required maxLength={100} />
      </div>
      <div className="flex-1 space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" name="description" placeholder="What's in this KB?" maxLength={500} />
      </div>
      <Button type="submit">
        <Plus className="h-4 w-4" />
        Create
      </Button>
    </form>
  );
}
