// src/app.ts
// Express app configuration with middleware and routes

import "dotenv/config";
import express from "express";
import cors from "cors";

// Import all workflows to register them automatically
import "./workflows";
import { workflowRegistry } from "./core/workflowRegistry";

// Create and configure Express app
export const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

// List all registered workflows
app.get("/api/workflows", (_req, res) => {
    const workflows = workflowRegistry.listWorkflows();
    res.json({ workflows });
});

// Execute a workflow by ID from the registry
app.post("/api/workflows/:id/execute", async (req, res) => {
    const workflowId = req.params.id;
    const { fields, ...input } = req.body; // Extract 'fields' from request body

    const workflow = workflowRegistry.get(workflowId);

    if (!workflow) {
        return res.status(404).json({
            error: `Workflow '${workflowId}' not found`,
            availableWorkflows: workflowRegistry.listWorkflows()
        });
    }

    try {
        const result = await workflow.run(input);

        // Filter result fields if 'fields' array is provided
        let filteredResult = result;
        if (fields && Array.isArray(fields) && fields.length > 0) {
            filteredResult = {} as Record<string, unknown>;
            for (const field of fields) {
                if (field in result) {
                    filteredResult[field] = result[field];
                }
            }
        }

        return res.status(200).json({
            id: workflowId,
            input,
            result: filteredResult
        });
    } catch (err: any) {
        const message = err?.message ?? "Workflow execution failed";
        return res.status(400).json({ error: message });
    }
});

