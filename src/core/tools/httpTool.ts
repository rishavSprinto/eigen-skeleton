// src/tools/httpTool.ts
// HTTP tool that can make HTTP requests - functional implementation

import { tool } from 'langchain';
import {z, ZodObject, ZodRawShape} from "zod";
import type { StateGraph } from "@langchain/langgraph";
import type { ToolCallable } from "../callable";
import { callableRegistry } from "../callableRegistry";

export type HttpToolConfig = {
    id: string;
    name: string;
    description: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    baseUrl?: string;
    headers?: Record<string, string>;
    inputSchema?: ZodObject<ZodRawShape>; // Optional schema for input validation
    metadata?: Record<string, unknown>;
};

export type HttpToolNodeConfig<StateType> = HttpToolConfig & {
    targetKey: string;
    buildInput: (state: StateType) => any; // Can return string or object
};

/**
 * Create an HTTP tool using functional approach
 * Can be used as an agent tool or as a standalone node
 */
export function createHttpTool(config: HttpToolConfig): ToolCallable {
    const method = config.method || "GET";
    const baseUrl = config.baseUrl;
    const defaultHeaders = config.headers || {};

    const run = async (input: any): Promise<any> => {
        // Extract url, body, headers from input
        const { url, body, headers } = input as {
            url: string;
            body?: any;
            headers?: Record<string, string>;
        };

        const fullUrl = baseUrl ? `${baseUrl}${url}` : url;
        const finalHeaders = { ...defaultHeaders, ...headers };

        const response = await fetch(fullUrl, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                ...finalHeaders,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            throw new Error(
                `HTTP ${method} failed: ${response.status} ${response.statusText}`
            );
        }

        return await response.json();
    };

    const toLangChainTool = () => {
        // Define schema for LangChain tool
        const toolSchema = z.object({
            url: z.string().describe("The URL to make the request to"),
            body: z.any().optional().describe("Request body for POST/PUT requests"),
            headers: z.record(z.string(), z.string()).optional().describe("Additional headers"),
        });

        return tool(
            async (input) => {
                const result = await run(input);
                return JSON.stringify(result);
            },{
            name: config.name,
            description: config.description,
            schema: toolSchema,
        })

    };

    return {
        id: config.id,
        name: config.name,
        description: config.description,
        metadata: config.metadata,
        run,
        toLangChainTool,
    };
}

/**
 * Register an HTTP tool node on a StateGraph
 * Use this when you want to use HTTP tool directly in LangGraph without wrapping it as a tool
 */
export function registerHttpToolNode<StateType>(
    graph: StateGraph<any>,
    config: HttpToolNodeConfig<StateType>
): void {
    // Create the HTTP tool to reuse its run method
    const httpTool = createHttpTool(config);

    graph.addNode(
        config.id,
        async (state: StateType) => {
            // Build input from state
            const input = config.buildInput(state);

            // Validate input if schema provided
            const validatedInput = config.inputSchema ? config.inputSchema.parse(input) : input;

            // Run the HTTP tool
            const result = await httpTool.run(validatedInput);

            // Return state update
            return {
                [config.targetKey]: result,
            };
        },
        {
            metadata: {
                name: config.name,
                description: config.description,
                type: "http-tool",
                method: config.method || "GET",
            },
        }
    );
}

// Register HTTP tool node type in the callable registry

callableRegistry.register("http-tool", registerHttpToolNode);

