# Eigen Skeleton - Workflow Framework

A lightweight, type-safe framework for building and executing AI-powered workflows using Zod schemas, LangGraph orchestration, and LangChain models.

## Quick Start

### Installation

```bash
npm install
```

### Run the Server

```bash
npm run dev
# Server starts on http://localhost:3000
```

### Run a Workflow (CLI)

```bash
npm run cli
# Executes workflow from registry
```

## Architecture

```
src/
├── app.ts              # Express app configuration (exported for testing)
├── index.ts            # Server entry point (starts HTTP server)
├── run.ts              # CLI runner for workflows
├── core/               # Core framework
│   ├── workflow.ts     # Workflow DSL and auto-registration
│   ├── workflowRegistry.ts  # Global workflow registry
│   └── helpers.ts      # Edge and routing helpers
├── workflows/          # Workflow definitions
│   ├── index.ts        # Exports all workflows (single import point)
│   └── weatherWorkflow.ts  # Example workflow
└── tools/              # Tools (LLM nodes, etc.)
    ├── registry.ts     # Tool registry
    └── llmNode.ts      # LLM node tool
```

## Key Concepts

### 1. Define a Workflow

```typescript
// src/workflows/myWorkflow.ts
import { z } from "zod";
import { defineWorkflow } from "../core/workflow";

const InputSchema = z.object({
    location: z.string(),
});

const StateSchema = z.object({
    input: z.object({ location: z.string() }),
    result: z.string().optional(),
});

export const myWorkflow = defineWorkflow<z.infer<typeof StateSchema>>({
    id: "my-workflow",
    inputSchema: InputSchema,
    stateSchema: StateSchema,
    metadata: { version: "1.0" },
}, (wf) => {
    const node1 = wf.addLlmNode("analyze", {
        model: { provider: "openai", name: "gpt-4o-mini" },
        outputFormat: "string",
        targetKey: "result",
        buildInput: (state) => ({
            prompt: `Analyze: ${state.input.location}`,
        }),
    });

    wf.addEdge(wf.start, node1);
    wf.addEdge(node1, wf.end);
});
```

### 2. Register Workflow

```typescript
// src/workflows/index.ts
export { weatherUmbrellaWorkflow } from "./weatherWorkflow";
export { myWorkflow } from "./myWorkflow";  // ← Add this line
```

### 3. It's Automatically Available!

```bash
# Via API
curl http://localhost:3000/api/workflows
# Returns: ["weather-umbrella", "my-workflow"]

curl -X POST http://localhost:3000/api/workflows/my-workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"location":"Paris"}'
```

## API Endpoints

### List Workflows
```http
GET /api/workflows
```

### Execute Workflow
```http
POST /api/workflows/:id/execute
Content-Type: application/json

{
  "location": "San Francisco"
}
```

### Execute Workflow with Field Selection
```http
POST /api/workflows/:id/execute
Content-Type: application/json

{
  "location": "San Francisco",
  "fields": ["weatherText", "shopsRaw"]
}
```

The `fields` parameter is optional and allows you to specify which fields from the result should be returned. If omitted, all fields are returned.

### Health Check
```http
GET /health
```

## Features

✅ **Auto-Registration** - Workflows register themselves when defined
✅ **Type-Safe** - Zod schemas provide runtime validation
✅ **Conditional Routing** - Support for conditional and parallel edges
✅ **LLM Integration** - Built-in support for OpenAI models
✅ **Observability** - Integrated Langfuse tracing
✅ **HTTP API** - RESTful API for workflow execution
✅ **Testable** - App/server separation for easy testing

## Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-***
LANGFUSE_PUBLIC_KEY=pk-lf-***
LANGFUSE_SECRET_KEY=sk-lf-***
LANGFUSE_HOST=https://cloud.langfuse.com
PORT=3000
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with hot reload |
| `npm run cli` | Run workflow via CLI |
| `npm run build` | Build for production |
| `npm start` | Start production server |

## Documentation

- [Workflow Registration](./docs/WORKFLOW_REGISTRATION.md) - How workflows are registered
- [Server Architecture](./docs/SERVER_ARCHITECTURE.md) - App/server separation
- [Architecture One-Pager](./docs/ARCHITECTURE_ONE_PAGER.md) - Complete architecture overview
- [Workflow Registry](./docs/WORKFLOW_REGISTRY.md) - Registry API and patterns

## Example Workflow

The framework includes a weather/umbrella workflow example:

```typescript
// Check if it's raining, suggest umbrella shops if yes
const result = await weatherUmbrellaWorkflow.run({
    location: "San Francisco"
});

// Returns:
// {
//   input: { location: "San Francisco" },
//   weatherText: "yes",
//   shopsRaw: "Shop A\nShop B"
// }
```

## Adding New Workflows

1. **Create** workflow file in `src/workflows/`
2. **Export** from `src/workflows/index.ts`
3. **Done!** Available via API and registry

See [Workflow Registration docs](./docs/WORKFLOW_REGISTRATION.md) for details.

## Testing (Future)

```typescript
import { app } from "./app";
import request from "supertest";

test("Execute workflow", async () => {
    const res = await request(app)
        .post("/api/workflows/weather-umbrella/execute")
        .send({ location: "NYC" });
    expect(res.status).toBe(200);
});
```

## License

MIT

