// src/tools/registry.ts
// Tool registry that holds references to all available tools - functional singleton pattern

import type { StateGraph } from "@langchain/langgraph";

/**
 * Tool function that can be registered.
 * Each tool takes a StateGraph instance and additional parameters.
 */
export type ToolFunction<Args extends any[] = any[]> = (
    graph: StateGraph<any>,
    ...args: Args
) => void;

/**
 * Private tool storage.
 * Using closure to ensure single instance and prevent external access.
 */
const tools = new Map<string, ToolFunction>();

/**
 * Register a tool with a unique name.
 */
function register<Args extends any[]>(name: string, tool: ToolFunction<Args>): void {
    if (tools.has(name)) {
        throw new Error(`Tool '${name}' is already registered`);
    }
    tools.set(name, tool);
}

/**
 * Get a tool by name.
 */
function get<Args extends any[]>(name: string): ToolFunction<Args> | undefined {
    return tools.get(name) as ToolFunction<Args> | undefined;
}

/**
 * Check if a tool is registered.
 */
function has(name: string): boolean {
    return tools.has(name);
}

/**
 * Get all registered tool names.
 */
function listTools(): string[] {
    return Array.from(tools.keys());
}

/**
 * Global tool registry - functional API.
 * All functions share the same tool storage via closure.
 */
export const toolRegistry = {
    register,
    get,
    has,
    listTools,
};

