// src/core/llmNode.ts

import { ChatOpenAI } from "@langchain/openai";
import type { StateGraph } from "@langchain/langgraph"
import type { Model } from "../modelProvider/openai";


export type LlmOutputFormat = "string" | "json";

export type LlmNodeConfig<State> = {
    model: Model;
    outputFormat: LlmOutputFormat;
    targetKey: keyof State;
    buildInput: (state: State) => {
        prompt: string;
        systemPrompt?: string;
    };
    description?: string;
};

/**
 * Register a simple LLM node on the given StateGraph.
 * Node:
 *   - reads full State
 *   - calls the model with `prompt`
 *   - writes the result to `targetKey` in State
 */
export function registerLlmNode<State>(
    graph: StateGraph<any>,
    id: string,
    config: LlmNodeConfig<State>
): void {
    const { model, outputFormat, targetKey, buildInput, } = config;

    graph.addNode(id, async (state: State) => {
        const { prompt, systemPrompt } = buildInput(state);

        if (model.provider !== "openai") {
            throw new Error(`Unsupported provider: ${model.provider}`);
        }

        const llm = new ChatOpenAI({
            model: model.name,
            temperature: model.temperature ?? 0.2,
            maxTokens: model.maxTokens,
            apiKey: process.env.OPENAI_API_KEY,
        });


        // Invoke with Langfuse tracking
        const res = await llm.invoke(
            systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,

        );


        // ChatOpenAI returns an AIMessage; grab the content
        const text =
            typeof res.content === "string"
                ? res.content
                : Array.isArray(res.content)
                    ? res.content.map((c: any) => c?.text ?? "").join("\n")
                    : String(res.content ?? "");

        let value: any = text;
        if (outputFormat === "json") {
            value = JSON.parse(text);
        }

        // Return a partial state update (LangGraph merges it)
        return {
            [targetKey]: value,
        } as Partial<State>;
    });
}
