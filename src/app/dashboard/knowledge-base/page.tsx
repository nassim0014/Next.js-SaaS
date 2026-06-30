import { requireUser } from "@/lib/auth/session";
import { getActiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import { BookOpen, FileText } from "lucide-react";
import { KnowledgeBaseForm } from "./kb-form";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const session = await requireUser();
  const orgId = await getActiveOrgId();
  if (!orgId) return null;

  const knowledgeBases = await prisma.knowledgeBase.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground">Upload documents for RAG-powered AI responses</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Knowledge Base</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeBaseForm />
        </CardContent>
      </Card>

      {knowledgeBases.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              No knowledge bases yet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create a knowledge base above, then upload documents (PDF, TXT, MD). Your AI agents
              will be able to search them for grounded answers using pgvector similarity search.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {knowledgeBases.map((kb) => (
            <Card key={kb.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{kb.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {kb.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{kb.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {kb._count.documents} documents
                  </span>
                  <span>Created {formatRelativeTime(kb.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
