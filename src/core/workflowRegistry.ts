// src/core/workflowRegistry.ts
// Registry for all defined workflows - functional singleton pattern

import type { CompiledWorkflow } from "./workflow";

/**
 * Private workflow storage.
 * Using closure to ensure single instance and prevent external access.
 */
const workflows = new Map<string, CompiledWorkflow>();

/**
 * Register a workflow with a unique identifier.
 */
function register(id: string, workflow: CompiledWorkflow): void {
    if (workflows.has(id)) {
        throw new Error(`Workflow '${id}' is already registered`);
    }
    workflows.set(id, workflow);
    console.log(`✅ Registered workflow: ${id}`);
}

/**
 * Get a workflow by ID.
 */
function get(id: string): CompiledWorkflow | undefined {
    return workflows.get(id);
}

/**
 * Check if a workflow is registered.
 */
function has(id: string): boolean {
    return workflows.has(id);
}

/**
 * Get all registered workflow IDs.
 */
function listWorkflows(): string[] {
    return Array.from(workflows.keys());
}

/**
 * Get all workflows as a map (returns a copy for immutability).
 */
function getAll(): Map<string, CompiledWorkflow> {
    return new Map(workflows);
}

/**
 * Global workflow registry - functional API.
 * All functions share the same workflow storage via closure.
 */
export const workflowRegistry = {
    register,
    get,
    has,
    listWorkflows,
    getAll,
};

