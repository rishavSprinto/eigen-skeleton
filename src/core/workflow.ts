// src/core/workflow.ts
//import "../tracing/instrumentation"
import type { ZodObject, ZodRawShape } from "zod";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";

import { toolRegistry } from "../tools";
import type { LlmNodeConfig } from "../tools";
import { addEdgeToGraph, finalizeConditionalEdges } from "./helpers";
import type { EdgeOptions, ConditionalEdge } from "./helpers";
import { CallbackHandler } from "@langfuse/langchain";
import { workflowRegistry } from "./workflowRegistry";

export type NodeHandle = { id: string };

export interface WorkflowBuilder<StateType> {
    start: NodeHandle;
    end: NodeHandle;

    addLlmNode(
        id: string,
        config: LlmNodeConfig<StateType>
    ): NodeHandle;

    addEdge(
        from: NodeHandle,
        to: NodeHandle,
        options?: EdgeOptions<StateType>
    ): void;
}

export type CompiledWorkflow = {
    id: string;
    run(input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

/**
 * Main entrypoint: define a workflow with your DSL.
 *
 * Users must provide Zod schemas (z.object()) for both input and state.
 *
 * Example:
 * ```typescript
 * import { z } from "zod";
 *
 * const InputSchema = z.object({
 *   location: z.string()
 * });
 *
 * const StateSchema = z.object({
 *   input: z.object({ location: z.string() }),
 *   result: z.string().optional()
 * });
 *
 * const workflow = defineWorkflow({
 *   id: "my-workflow",
 *   inputSchema: InputSchema,
 *   stateSchema: StateSchema,
 * }, (wf) => {
 *   // Build workflow...
 * });
 * ```
 */
export function defineWorkflow<StateType>(
    meta: {
        id: string;
        inputSchema: ZodObject<ZodRawShape>; // Must be z.object() schema for input validation
        stateSchema: ZodObject<ZodRawShape>; // Must be z.object() schema for state definition
        metadata?: Record<string, string | number | boolean>; // Workflow-level metadata for Langfuse
    },
    build: (wf: WorkflowBuilder<StateType>) => void
): CompiledWorkflow {
    // Use Zod schema to configure StateGraph
    // Let TypeScript infer the exact type from the constructor
    const builder = new StateGraph(meta.stateSchema);
    // Store workflow metadata for use during invocation
    const workflowMetadata = meta.metadata || {};

    const startHandle: NodeHandle = { id: START };
    const endHandle: NodeHandle = { id: END };

    const conditionalEdges: ConditionalEdge<StateType>[] = [];

    const workflowBuilder: WorkflowBuilder<StateType> = {
        start: startHandle,
        end: endHandle,

        addLlmNode(id, config) {
            const registerLlmNode = toolRegistry.get('llmNode');
            if (!registerLlmNode) {
                throw new Error("LLM node tool not found in registry");
            }
            registerLlmNode(builder, id, config);
            return { id };
        },

        addEdge(from, to, options) {
            addEdgeToGraph(
                builder,
                from.id,
                to.id,
                options,
                conditionalEdges
            );
        },
    };

    // Let user build graph using our DSL
    build(workflowBuilder);

    // Turn conditionalEdges into LangGraph conditional edges
    finalizeConditionalEdges(builder, conditionalEdges);

    // Compile into a runnable
    const app = builder.compile( {checkpointer: new MemorySaver()},);

    const compiledWorkflow: CompiledWorkflow = {
        id: meta.id,
        async run(input: Record<string, unknown>): Promise<Record<string, unknown>> {
            // Validate input using the provided Zod schema
            const parsed = meta.inputSchema.parse(input);

            // Build tags from workflow metadata
            const tags = [
                `workflow:${meta.id}`,
                ...Object.entries(workflowMetadata).map(([k, v]) => `${k}:${String(v)}`)
            ];

            const langfuseHandler = new CallbackHandler({
                sessionId: `workflow-${meta.id}-${Date.now()}`,
                tags,
            });

            // Invoke with parsed input and callback handler
            const finalState = await app.invoke(parsed,  {
                configurable: {
                    thread_id: "trip-planning-session-1",
                },
                callbacks: [langfuseHandler],
            });

            // Return final state (validated by Zod schema at runtime)
            return finalState as Record<string, unknown>;
        },
    };

    // Auto-register the workflow in the global registry
    workflowRegistry.register(meta.id, compiledWorkflow);

    return compiledWorkflow;
}

