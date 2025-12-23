// src/core/callable.ts
// Common interface for all executable components (tools, agents, workflows)

import type { ZodObject, ZodRawShape } from "zod";

/**
 * Callable - common contract for all executable components.
 * This allows tools, agents, and workflows to be used interchangeably.
 */
export type Callable = {
    /**
     * Unique identifier for this callable
     */
    id: string;

    /**
     * Human-readable name
     */
    name: string;

    /**
     * Description of what this callable does
     */
    description: string;

    /**
     * Execute the callable with given input
     * @param input - The input data (can be string, object, or any type)
     */
    run(input: any): Promise<any>;

    /**
     * Optional metadata
     */
    metadata?: Record<string, unknown>;
};

/**
 * Tool-specific callable that can be used by agents or as a node
 */
export type ToolCallable = Callable & {

    /**
     * Convert to LangChain tool format
     */
    toLangChainTool(): any;
};

/**
 * Agent callable that uses tools to accomplish tasks
 */
export type AgentCallable = Callable & {
    /**
     * Zod schema for input validation (defined at initialization)
     */
    inputSchema?: ZodObject<ZodRawShape>;

    /**
     * Tools available to this agent
     */
    tools: ToolCallable[];

    /**
     * Model configuration for the agent
     */
    modelConfig: {
        provider: string;
        name: string;
        temperature?: number;
    };
};

/**
 * Workflow callable that orchestrates multiple steps
 */
export type WorkflowCallable = Callable & {
    /**
     * Zod schema for input validation
     */
    inputSchema: ZodObject<ZodRawShape>;

    /**
     * Zod schema for state definition (workflow-specific)
     */
    stateSchema: ZodObject<ZodRawShape>;
};

