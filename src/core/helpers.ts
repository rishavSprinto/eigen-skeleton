// src/core/helpers.ts
// Helper functions for workflow construction

import type { StateGraph } from "@langchain/langgraph";

export type EdgeOptions<StateType> = {
    when?: (state: StateType) => boolean;
    label?: string;
    description?: string;
};

export type ConditionalEdge<StateType> = {
    from: string;
    to: string;
    when: (state: StateType) => boolean;
    label?: string;
    description?: string;
};

/**
 * Add an edge to the workflow graph.
 * - If `when` is undefined → wire an unconditional edge immediately.
 * - If `when` is defined → record as conditional for later finalization.
 *
 * Note: LangGraph's type system tracks node names at compile time, but our workflow
 * system creates nodes dynamically at runtime, so we cast the IDs appropriately.
 */
export function addEdgeToGraph<StateType>(
    graph: StateGraph<any>,
    fromId: string,
    toId: string,
    options: EdgeOptions<StateType> | undefined,
    conditionalEdges: ConditionalEdge<StateType>[]
): void {
    if (!options?.when) {
        // Unconditional edge - add immediately
        // LangGraph expects specific node name types, but we use dynamic strings
        (graph.addEdge as (from: string, to: string) => void)(fromId, toId);
    } else {
        // Conditional edge - record for later finalization
        conditionalEdges.push({
            from: fromId,
            to: toId,
            when: options.when,
            label: options.label,
            description: options.description,
        });
    }
}

/**
 * Finalize all conditional edges by converting them into graph.addConditionalEdges calls.
 * Groups edges by source node and creates routing functions that support parallel branching.
 */
export function finalizeConditionalEdges<StateType>(
    graph: StateGraph<any>,
    conditionalEdges: ConditionalEdge<StateType>[]
): void {
    if (conditionalEdges.length === 0) return;

    const grouped = new Map<string, ConditionalEdge<StateType>[]>();

    for (const edge of conditionalEdges) {
        const list = grouped.get(edge.from) ?? [];
        list.push(edge);
        grouped.set(edge.from, list);
    }

    for (const [fromId, edges] of grouped.entries()) {
        const possibleTargets = Array.from(
            new Set(edges.map((e) => e.to))
        );

        const routingFn = (state: StateType): string | string[] => {
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
        (graph.addConditionalEdges as (from: string, route: (state: StateType) => string | string[], targets: string[]) => void)(
            fromId,
            routingFn,
            possibleTargets
        );
    }
}

