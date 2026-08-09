"use client";

import { useActionState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { requestExportAction, requestDeletionAction } from "./actions";
import type { ExportState, DeletionState } from "./actions";

const initialExportState: ExportState = {};
const initialDeletionState: DeletionState = {};

export function ExportDataButton() {
  const [state, formAction, isPending] = useActionState(requestExportAction, initialExportState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.downloadUrl) {
      toast.success("Your export is ready.", {
        action: {
          label: "Download",
          onClick: () => window.open(state.downloadUrl, "_blank", "noopener,noreferrer"),
        },
      });
    }
    // Only fire when the action state actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction}>
      <Button className="mt-3" size="sm" variant="outline" type="submit" disabled={isPending}>
        <Download className="h-4 w-4" />
        {isPending ? "Preparing export…" : "Request Export"}
      </Button>
    </form>
  );
}

export function DeleteAccountButton() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    requestDeletionAction,
    initialDeletionState
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.deleted) {
      toast.success("Your account has been deleted.");
      router.push("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "This permanently deletes your account and all associated data (conversations, messages, API keys). This cannot be undone. Continue?"
    );
    if (!confirmed) e.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <Button className="mt-3" size="sm" variant="destructive" type="submit" disabled={isPending}>
        <Trash2 className="h-4 w-4" />
        {isPending ? "Deleting…" : "Request Deletion"}
      </Button>
    </form>
  );
}
