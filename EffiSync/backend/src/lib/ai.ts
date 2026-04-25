import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "../config/env.js";
import type { LanguageModel } from "ai";

/**
 * Google Generative AI provider — configured with the validated API key.
 * Uses Gemini 1.5 Flash for fast, cost-effective agentic reasoning.
 */
const google = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const geminiModel: LanguageModel = google("gemini-2.5-flash");
