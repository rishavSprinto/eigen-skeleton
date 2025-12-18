// src/index.ts
// Server entry point - starts the HTTP server

import { app } from "./app";
import { workflowRegistry } from "./core/workflowRegistry";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(port, () => {
    console.log(`🚀 API server listening on http://localhost:${port}`);
    console.log(`📋 Registered workflows: ${workflowRegistry.listWorkflows().join(", ")}`);
});

