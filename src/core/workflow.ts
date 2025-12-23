// src/core/workflow.ts
//import "../tracing/instrumentation"
import type { ZodObject, ZodRawShape } from "zod";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";

import { callableRegistry} from "./index";
import {type CallableRegistrationFunction } from './callableRegistry';
import { workflowRegistry } from "./workflowRegistry";
import { addEdgeToGraph, finalizeConditionalEdges } from "./helpers";
import type { EdgeOptions, ConditionalEdge } from "./helpers";
import { CallbackHandler } from "@langfuse/langchain";
import type { WorkflowCallable } from "./callable";

export type NodeHandle = { id: string };



export interface WorkflowBuilder<StateType> {
    start: NodeHandle;
    end: NodeHandle;

    /**
     * Generic method to add any type of node
     */
    addNode(
        id: string,
        nodeType: string,
        config: any
    ): NodeHandle;

    addEdge(
        from: NodeHandle,
        to: NodeHandle,
        options?: EdgeOptions<StateType>
    ): void;
}

export type CompiledWorkflow = WorkflowCallable & {
    run(input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

/**
 * Generic workflow registration function
 * Creates a registration function that wraps a workflow for use as a node
 */
function createWorkflowRegistration(workflow: CompiledWorkflow): CallableRegistrationFunction {
    return (graph: StateGraph<any>, config: any) => {
        graph.addNode(
            config.id,
            async (state: any) => {
                // If buildInput is provided, use it to map state to workflow input
                // Otherwise, pass the state directly (parent state matches child input)
                const input = config.buildInput ? config.buildInput(state) : state;
                const result = await workflow.run(input);

                // If targetKey is provided, wrap result in that key
                // Otherwise, merge result directly into state
                if (config.targetKey) {
                    return {
                        [config.targetKey]: result,
                    };
                } else {
                    return result;
                }
            },
            {
                metadata: {
                    name: config.id,
                    description: `Workflow: ${workflow.id}`,
                    type: "workflow",
                    workflowId: workflow.id,
                },
            }
        );
    };
}

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

        addNode(id, nodeType, config) {
            // Get the registration function for this callable type
            const registerFn = callableRegistry.get(nodeType);
            if (!registerFn) {
                throw new Error(
                    `Callable type '${nodeType}' not found. Available: ${callableRegistry.listCallables().join(", ")}`
                );
            }

            // Call the registration function with the graph and config
            registerFn(builder, { ...config, id });
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
        name: meta.id,
        description: meta.metadata?.description as string || `Workflow: ${meta.id}`,
        metadata: meta.metadata,
        inputSchema: meta.inputSchema,
        stateSchema: meta.stateSchema,

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

    // Register workflow instance in workflow registry (for API execution)
    workflowRegistry.register(meta.id, compiledWorkflow);

    // Register in callable registry using generic registration function
    callableRegistry.register(meta.id, createWorkflowRegistration(compiledWorkflow));

    return compiledWorkflow;
}

