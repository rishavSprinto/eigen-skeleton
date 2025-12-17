// src/core/edges.ts

import { StateGraph } from "@langchain/langgraph";

export type EdgeOptions<State> = {
    when?: (state: State) => boolean;
    label?: string;
    description?: string;
};

export type ConditionalEdge<State> = {
    from: string;
    to: string;
    when: (state: State) => boolean;
    label?: string;
    description?: string;
};

/**
 * - If `when` is undefined → wire an unconditional edge immediately.
 * - If `when` is defined → record as conditional for later.
 *
 * Note: LangGraph's type system tracks node names at compile time, but our workflow
 * system creates nodes dynamically at runtime.
 *
 * StateGraph type parameters:
 * - State: The state definition
 * - State: The state type (S = SD for simple cases)
 * - Partial<State>: The update type (U = Partial<S> for simple cases)
 * - N: The node names (string union)
 */
export function addEdgeToGraph<State, N extends string = string>(
    graph: StateGraph<State, State, Partial<State>, N>,
    fromId: N,
    toId: N,
    options: EdgeOptions<State> | undefined,
    conditionalEdges: ConditionalEdge<State>[]
): void {
    if (!options?.when) {
        graph.addEdge(fromId, toId);
    } else {
        conditionalEdges.push({
            from: fromId,
            to: toId,
            when: options.when,
            label: options.label,
            description: options.description,
        });
    }
}
