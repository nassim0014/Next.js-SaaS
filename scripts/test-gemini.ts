// Test script — run with: npx tsx scripts/test-gemini.ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

async function main() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!key) {
    console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY is not set in your environment");
    console.error("   Run: set -a; source .env.local; set +a");
    process.exit(1);
  }

  console.log("✅ API key found:", key.slice(0, 15) + "...");

  // Check if the key looks valid (Google AI Studio keys start with AIza)
  if (!key.startsWith("AIza")) {
    console.error("⚠️  WARNING: This doesn't look like a Google AI Studio API key.");
    console.error("   Google API keys start with 'AIzaSy...'");
    console.error("   Your key starts with: '" + key.slice(0, 10) + "...'");
    console.error("   Get a valid key from: https://aistudio.google.com/apikey");
    console.error("");
    console.error("   Continuing anyway to see the actual error...");
  }

  console.log("\nTesting Gemini API with model 'gemini-2.0-flash'...\n");

  try {
    const google = createGoogleGenerativeAI({ apiKey: key });
    const model = google("gemini-2.0-flash");

    const result = await streamText({
      model,
      messages: [{ role: "user", content: "Say hello in one word" }],
    });

    const text = await result.text;
    console.log("✅ SUCCESS! Response:", text);
    console.log("\nThe API key and model work correctly.");
  } catch (err) {
    console.error("❌ FAILED with error:\n");
    console.error("  Error type:", err.constructor.name);
    console.error("  Error message:", err.message);
    if (err.cause) {
      console.error("  Cause:", err.cause);
    }
    if (err.responseBody) {
      console.error("  Response body:", err.responseBody);
    }
    console.error("\nFull error object:");
    console.error(JSON.stringify(err, null, 2));
  }
}

main();
