import { describe, it, expect, vi } from "vitest";

// rag.ts imports `prisma` at module scope (retrieveRelevantChunks uses it),
// but none of these tests call that function — only the pure chunkDocument /
// formatContextForPrompt. Mocked anyway, matching this repo's convention
// (see rate-limit.test.ts, audit/logger.test.ts), so the import can't
// accidentally reach a real database.
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRawUnsafe: vi.fn() },
}));

const { chunkDocument, formatContextForPrompt } = await import("@/lib/ai/rag");

describe("chunkDocument", () => {
  it("returns a single chunk when the text is shorter than chunkSize", () => {
    const chunks = chunkDocument("short text", 2000, 200);
    expect(chunks).toEqual(["short text"]);
  });

  it("returns an empty array for empty text", () => {
    expect(chunkDocument("", 2000, 200)).toEqual([]);
  });

  it("splits long text into overlapping chunks covering the whole document", () => {
    const text = "a".repeat(4500);
    const chunks = chunkDocument(text, 2000, 200);

    // Step is chunkSize - overlap = 1800; ceil(4500 / 1800) = 3 chunks.
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(2000);
    expect(chunks[1]).toHaveLength(2000);
    // Last chunk is whatever's left, not padded.
    expect(chunks[2]).toHaveLength(4500 - 2 * 1800);

    // Re-joining without the overlap must reconstruct the original text.
    const rejoined = chunks[0]!.slice(0, 1800) + chunks[1]!.slice(0, 1800) + chunks[2];
    expect(rejoined).toHaveLength(text.length);
    expect(rejoined).toBe(text);
  });

  it("actually overlaps consecutive chunks by `overlap` characters", () => {
    const text = "0123456789".repeat(50); // 500 chars, distinct enough to check positions
    const chunks = chunkDocument(text, 100, 20);

    for (let i = 0; i < chunks.length - 1; i++) {
      const tailOfCurrent = chunks[i]!.slice(-20);
      const headOfNext = chunks[i + 1]!.slice(0, 20);
      expect(tailOfCurrent).toBe(headOfNext);
    }
  });

  it("throws when overlap equals chunkSize, instead of looping forever", () => {
    expect(() => chunkDocument("x".repeat(10_000), 500, 500)).toThrow(RangeError);
  });

  it("throws when overlap exceeds chunkSize", () => {
    expect(() => chunkDocument("x".repeat(10_000), 500, 900)).toThrow(RangeError);
  });

  it("throws on the swapped-positional-args mistake (chunkSize and overlap flipped)", () => {
    // The exact real-world trigger named in the backlog item: a caller
    // swapping the two positional args (chunkDocument(text, overlap, chunkSize)).
    expect(() => chunkDocument("x".repeat(10_000), 200, 2000)).toThrow(RangeError);
  });

  it("throws for a non-positive chunkSize", () => {
    expect(() => chunkDocument("hello", 0, 0)).toThrow(RangeError);
    expect(() => chunkDocument("hello", -5, 0)).toThrow(RangeError);
  });

  it("throws for a negative overlap", () => {
    expect(() => chunkDocument("hello", 100, -1)).toThrow(RangeError);
  });

  it("allows overlap of 0 (no overlap, adjacent chunks)", () => {
    const chunks = chunkDocument("a".repeat(300), 100, 0);
    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toBe("a".repeat(300));
  });
});

describe("formatContextForPrompt", () => {
  it("returns a fallback message for zero chunks", () => {
    expect(formatContextForPrompt([])).toBe("No relevant context found.");
  });

  it("formats N chunks with their index and similarity score", () => {
    const chunks = [
      { id: "1", documentId: "d1", content: "first", chunkIndex: 0, similarity: 0.912, metadata: null },
      { id: "2", documentId: "d1", content: "second", chunkIndex: 1, similarity: 0.834, metadata: null },
    ];
    const result = formatContextForPrompt(chunks);

    expect(result).toContain("--- Source 1 (similarity: 0.91) ---\nfirst");
    expect(result).toContain("--- Source 2 (similarity: 0.83) ---\nsecond");
    // Chunks are joined, not concatenated, so they stay visually distinct.
    expect(result).toContain("\n\n");
  });
});
