"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { inviteMemberAction } from "./actions";
import { toast } from "sonner";

export function InviteForm() {
  const [state, formAction] = useActionState(inviteMemberAction, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (!state.error) toast.success("Invitation sent!");
  }, [state]);

  return (
    <form action={formAction} className="flex gap-2 items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" name="email" type="email" placeholder="colleague@company.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="MEMBER"
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </div>
      <Button type="submit">
        <Plus className="h-4 w-4" />
        Invite
      </Button>
    </form>
  );
}
