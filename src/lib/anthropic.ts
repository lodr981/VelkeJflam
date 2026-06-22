import Anthropic from "@anthropic-ai/sdk";

// API klíč i base URL bere SDK automaticky z prostředí
// (ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL).
export const anthropic = new Anthropic();

// Model lze přepsat přes env; výchozí je Sonnet (dobrý poměr cena/kvalita).
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
