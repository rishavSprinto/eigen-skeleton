// src/core/workflow.ts
//import "../tracing/instrumentation"
import type { ZodObject, ZodRawShape } from "zod";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";

import {
    registerLlmNode,
    type LlmNodeConfig,
} from "../tools/llmNode";
import {
    addEdgeToGraph,
    type EdgeOptions,
    type ConditionalEdge,
} from "../tools/edges";
import { CallbackHandler } from "@langfuse/langchain";

export type NodeHandle = { id: string };

export interface WorkflowBuilder<State> {
    start: NodeHandle;
    end: NodeHandle;

    addLlmNode(
        id: string,
        config: LlmNodeConfig<State>
    ): NodeHandle;

    addEdge(
        from: NodeHandle,
        to: NodeHandle,
        options?: EdgeOptions<State>
    ): void;
}

export type CompiledWorkflow<Input, State> = {
    id: string;
    run(input: Input): Promise<State>;
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
export function defineWorkflow<Input, State>(
    meta: {
        id: string;
        inputSchema: ZodObject<ZodRawShape>; // Must be z.object() schema for input validation
        stateSchema: ZodObject<ZodRawShape>; // Must be z.object() schema for state definition
        metadata?: Record<string, string | number | boolean>; // Workflow-level metadata for Langfuse
    },
    build: (wf: WorkflowBuilder<State>) => void
): CompiledWorkflow<Input, State> {
    // Use Zod schema to configure StateGraph
    // Let TypeScript infer the exact type from the constructor
    const builder = new StateGraph(meta.stateSchema);
    // Store workflow metadata for use during invocation
    const workflowMetadata = meta.metadata || {};

    const startHandle: NodeHandle = { id: START };
    const endHandle: NodeHandle = { id: END };

    const conditionalEdges: ConditionalEdge<State>[] = [];

    const workflowBuilder: WorkflowBuilder<State> = {
        start: startHandle,
        end: endHandle,

        addLlmNode(id, config) {
            registerLlmNode<State>(builder, id, config);
            return { id };
        },

        addEdge(from, to, options) {
            addEdgeToGraph<State>(
                builder as StateGraph<State, State, Partial<State>, string>,
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
    finalizeConditionalEdges(builder as StateGraph<State, State, Partial<State>, string>, conditionalEdges);

    // Compile into a runnable
    const app = builder.compile( {checkpointer: new MemorySaver()},);

    return {
        id: meta.id,
        async run(input: Input): Promise<State> {
            // Validate input
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

            // CallbackHandler flushes automatically
            return finalState as State;
        },
    };
}



/**
 * Convert our collected ConditionalEdge<State>[] into graph.addConditionalEdges calls.
 */
function finalizeConditionalEdges<State>(
    graph: StateGraph<State, State, Partial<State>, string>, // StateGraph<any>
    conditionalEdges: ConditionalEdge<State>[]
): void {
    if (conditionalEdges.length === 0) return;

    const grouped = new Map<string, ConditionalEdge<State>[]>();

    for (const edge of conditionalEdges) {
        const list = grouped.get(edge.from) ?? [];
        list.push(edge);
        grouped.set(edge.from, list);
    }

    for (const [fromId, edges] of grouped.entries()) {
        const possibleTargets = Array.from(
            new Set(edges.map((e) => e.to))
        );

        const routingFn = (state: State): string | string[] => {
            const matches: string[] = [];

            for (const e of edges) {
                if (e.when(state)) {
                    matches.push(e.to);
                }
            }

            if (matches.length === 0) {
                // no branch taken: stop here
                return [];
            }

            // If multiple branches match, run them in parallel
            return matches.length === 1 ? matches[0] : matches;
        };

        // Third param (possibleTargets) helps Studio render conditionals
        graph.addConditionalEdges(fromId, routingFn, possibleTargets);
    }
}
