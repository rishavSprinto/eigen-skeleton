// src/core/callableRegistry.ts
// Registry for all callable types - nodes and workflows
// All registered items are FUNCTIONS that know how to register themselves

import type { StateGraph } from "@langchain/langgraph";

/**
 * Callable registration function type
 * This is a FUNCTION that registers a node/workflow on a graph
 */
export type CallableRegistrationFunction = (
    graph: StateGraph<any>,
    config: any
) => void;

/**
 * Private callable registry storage
 * All stored items are registration FUNCTIONS
 */
const callables = new Map<string, CallableRegistrationFunction>();

/**
 * Register a callable type with its registration function
 */
function register(
    callableType: string,
    registerFn: CallableRegistrationFunction
): void {
    if (callables.has(callableType)) {
        throw new Error(`Callable '${callableType}' is already registered`);
    }
    callables.set(callableType, registerFn);
    console.log(`✅ Registered callable: ${callableType}`);
}

/**
 * Get registration function for a callable type
 */
function get(callableType: string): CallableRegistrationFunction | undefined {
    return callables.get(callableType);
}

/**
 * Check if a callable type is registered
 */
function has(callableType: string): boolean {
    return callables.has(callableType);
}

/**
 * Get all registered callable types
 */
function listCallables(): string[] {
    return Array.from(callables.keys());
}

/**
 * Global callable registry - functional API
 * Handles all callable types (nodes and workflows)
 */
export const callableRegistry = {
    register,
    get,
    has,
    listCallables,
};
