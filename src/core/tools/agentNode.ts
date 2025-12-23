// src/tools/agentNode.ts
// Agent node that can use tools and serve as a LangGraph node - functional implementation

import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import type { StateGraph } from "@langchain/langgraph";
import type { AgentCallable, ToolCallable } from "../callable";
import type { Model } from "../../modelProvider/openai";
import { callableRegistry } from "../callableRegistry";
import { z } from "zod";

export type AgentNodeConfig = {
    id: string;
    name: string;
    description: string;
    model: Model;
    tools: ToolCallable[];
    inputSchema?: z.ZodObject<z.ZodRawShape>; // Optional schema for input validation
    systemPrompt?: string;
    targetKey: string;
    buildInput: (state: Record<string, unknown>) => any; // Can return string or object
    metadata?: Record<string, unknown>;
};

/**
 * Create an agent node using functional approach
 * Uses LangChain agent with tools to accomplish tasks
 */
function createAgentNode(config: AgentNodeConfig): AgentCallable {
    const run = async (input: any): Promise<any> => {
        // Validate input if schema was provided during initialization
        const validatedInput = config.inputSchema ? config.inputSchema.parse(input) : input;

        // Create model instance based on provider
        let model;
        if (config.model.provider === "openai") {
            model = new ChatOpenAI({
                model: config.model.name,
                temperature: config.model.temperature ?? 0.2,
                maxTokens: config.model.maxTokens,
                apiKey: process.env.OPENAI_API_KEY,
            });
        } else {
            throw new Error(`Unsupported model provider: ${config.model.provider}`);
        }

        // Convert ToolCallable to LangChain tools
        // Each tool has its own toLangChainTool() method
        const langChainTools = config.tools.map((tool) => tool.toLangChainTool());

        // Create agent using createAgent with tools
        const agent = createAgent({
            model: model,
            tools: langChainTools,
        });

        // Prepare input message
        const inputMessage = typeof validatedInput === "string"
            ? validatedInput
            : JSON.stringify(validatedInput);

        // Build messages with system prompt if provided
        const messages = config.systemPrompt
            ? [
                { role: "system", content: config.systemPrompt },
                { role: "user", content: inputMessage },
            ]
            : [{ role: "user", content: inputMessage }];

        // Execute agent
        const result = await agent.invoke({
            messages,
        });

        // Extract final response from messages
        const finalMessage = result.messages[result.messages.length - 1];
        return finalMessage.content;
    };

    return {
        id: config.id,
        name: config.name,
        description: config.description,
        inputSchema: config.inputSchema, // Store schema from initialization
        tools: config.tools,
        modelConfig: config.model,
        metadata: config.metadata,
        run,
    };
}

/**
 * Register an agent node on a StateGraph
 */
function registerAgentNode<StateType>(
    graph: StateGraph<any>,
    config: AgentNodeConfig
): void {
    const agent = createAgentNode(config);

    graph.addNode(
        config.id,
        async (state: StateType) => {
            console.log("running agent node");
            // Build input from state
            const input = config.buildInput(state as Record<string, unknown>);

            // Invoke agent
            const output = await agent.run(input);

            // Return state update
            return {
                [config.targetKey]: output,
            };
        },
        {
            metadata: {
                name: config.name,
                description: config.description,
                type: "agent",
                tools: config.tools.map((t) => t.name),
            },
        }
    );
}

// Register agent node type in the callable registry

callableRegistry.register("agent", registerAgentNode);
console.log("registered agent")

