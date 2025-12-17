// core/model.ts
export type Model = {
    provider: "openai"; // extend later: "anthropic" | "groq" | ...
    name: string;
    temperature?: number;
    maxTokens?: number;
};
