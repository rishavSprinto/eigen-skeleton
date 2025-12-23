// src/core/workflowRegistry.ts
// Separate registry for workflow instances (for API access)
// callableRegistry handles registration functions
// This handles the actual workflow objects for execution

import type { WorkflowCallable } from "./callable";

/**
 * Private workflow storage
 */
const workflows = new Map<string, WorkflowCallable>();

/**
 * Register a workflow instance
 */
function register(id: string, workflow: WorkflowCallable): void {
    if (workflows.has(id)) {
        throw new Error(`Workflow '${id}' is already registered`);
    }
    workflows.set(id, workflow);
    console.log(`📊 Registered workflow instance: ${id}`);
}

/**
 * Get a workflow by ID
 */
function get(id: string): WorkflowCallable | undefined {
    return workflows.get(id);
}

/**
 * Check if a workflow is registered
 */
function has(id: string): boolean {
    return workflows.has(id);
}

/**
 * Get all registered workflow IDs
 */
function listWorkflows(): string[] {
    return Array.from(workflows.keys());
}

/**
 * Workflow registry - stores workflow instances for API execution
 */
export const workflowRegistry = {
    register,
    get,
    has,
    listWorkflows,
};

