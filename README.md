# Eigen Workflow Framework

A TypeScript-based workflow orchestration system for building complex AI-powered workflows with LLMs, tools, and nested sub-workflows.

## ✨ Features

- 🤖 **Agent Support** - Create autonomous agents with custom tools
- 🔧 **Extensible Tools** - HTTP, Location, and custom tool support
- 🔄 **Workflow Composition** - Nest workflows within workflows
- 📊 **Type-Safe** - Full TypeScript + Zod schema validation
- 🎯 **Generic API** - Single `addNode()` method for all node types
- 📝 **Observable** - Built-in Langfuse integration for tracing
- 🚀 **REST API** - HTTP endpoints for workflow execution

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Environment Setup

```bash
cp .env.example .env
# Add your API keys:
# - OPENAI_API_KEY
# - LANGFUSE_PUBLIC_KEY
# - LANGFUSE_SECRET_KEY
```

### Run Example Workflow

```bash
npm run dev
```

### Start API Server

```bash
npm start
```

### Execute via API

```bash
curl -X POST http://localhost:3000/api/workflows/weather-umbrella/execute \
  -H "Content-Type: application/json" \
  -d '{"location": "Paris"}'
```

## 📖 Documentation

- **[Complete Documentation](./docs/COMPLETE_DOCUMENTATION.md)** - Full framework guide
- **[Callable Registry](./docs/CALLABLE_REGISTRY.md)** - Registry system explained
- **[Workflows as Nodes](./docs/WORKFLOWS_AS_NODES.md)** - Workflow composition
- **[Generic Node API](./docs/GENERIC_NODE_API.md)** - Node system architecture
- **[Travel Workflow Example](./docs/TRAVEL_WORKFLOW_EXAMPLE.md)** - Complex example

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│     Eigen Workflow Framework        │
├─────────────────────────────────────┤
│  Callables (Tools, Agents, Workflows)
│       ↓
│  Registries (Callable, Workflow)
│       ↓
│  LangGraph StateGraph
│       ↓
│  REST API
└─────────────────────────────────────┘
```

### Core Concepts

**Callables** - Everything executable implements the `Callable` interface
- Tools (HTTP, Location, Custom)
- Agents (LLM with tools)
- Workflows (Composable state machines)

**Registries** - Two registries manage the system
- `callableRegistry` - Node type registration functions
- `workflowRegistry` - Executable workflow instances

**Workflows** - Composable, type-safe state machines
- Built with `defineWorkflow()`
- Can be nested within other workflows
- Full Zod schema validation

## 💡 Example: Simple Workflow

```typescript
import { z } from "zod";
import { defineWorkflow } from "./core/workflow";

const WeatherStateSchema = z.object({
    location: z.string(),
    weatherText: z.string().optional(),
});

export const weatherWorkflow = defineWorkflow({
    id: "weather-check",
    inputSchema: z.object({ location: z.string() }),
    stateSchema: WeatherStateSchema,
}, (wf) => {
    const weatherNode = wf.addNode("check", "agent", {
        name: "Weather Checker",
        model: GPT4MiniModel,
        tools: [],
        targetKey: "weatherText",
        buildInput: (state) => ({
            query: `Is it rainy in ${state.location}?`,
        }),
    });

    wf.addEdge(wf.start, weatherNode);
    wf.addEdge(weatherNode, wf.end);
});
```

## 💡 Example: Nested Workflows

```typescript
// Child workflow
export const weatherWorkflow = defineWorkflow({
    id: "weather-umbrella",
    inputSchema: z.object({ location: z.string() }),
    stateSchema: WeatherStateSchema,
}, (wf) => {
    // ... weather checking logic
});

// Parent workflow using child
export const travelWorkflow = defineWorkflow({
    id: "travel-planning",
    stateSchema: WeatherStateSchema.extend({
        userId: z.string(),
    }),
}, (wf) => {
    // Get location
    const location = wf.addNode("location", "location-tool", {
        targetKey: "location",
        buildInput: (state) => ({}),
    });

    // Use weather workflow as node
    const weather = wf.addNode("weather", "weather-umbrella", {
        // No buildInput needed - state already has location!
    });

    wf.addEdge(wf.start, location);
    wf.addEdge(location, weather);
    wf.addEdge(weather, wf.end);
});
```

## 🔧 Creating Custom Tools

```typescript
// 1. Create the tool
export function createMyTool(config: MyToolConfig): ToolCallable {
    const run = async (input: any): Promise<any> => {
        // Your logic here
        return { result: "..." };
    };

    const toLangChainTool = () => {
        return new DynamicStructuredTool({
            name: config.name,
            description: config.description,
            schema: z.object({ query: z.string() }),
            func: async (input) => {
                const result = await run(input);
                return JSON.stringify(result);
            },
        });
    };

    return { id, name, description, run, toLangChainTool };
}

// 2. Create node registration
export function registerMyToolNode(graph: StateGraph, config: any) {
    const tool = createMyTool(config);
    graph.addNode(config.id, async (state) => {
        const result = await tool.run(config.buildInput(state));
        return { [config.targetKey]: result };
    });
}

// 3. Register in callable registry
callableRegistry.register("my-tool", registerMyToolNode);

// 4. Import in core/index.ts
import "./tools/myTool";

// 5. Use it!
wf.addNode("node-1", "my-tool", {
    targetKey: "result",
    buildInput: (state) => state.input,
});
```

## 📦 Project Structure

```
src/
├── core/
│   ├── callable.ts           # Callable types
│   ├── callableRegistry.ts   # Node type registry
│   ├── workflowRegistry.ts   # Workflow instance registry
│   ├── workflow.ts           # Workflow builder
│   ├── helpers.ts            # Edge helpers
│   ├── index.ts              # Core exports
│   └── tools/
│       ├── agentNode.ts      # Agent node type
│       ├── httpTool.ts       # HTTP tool
│       ├── locationTool.ts   # Location tool
│       └── workflowNode.ts   # Workflow node wrapper
├── workflows/
│   ├── weatherWorkflow.ts
│   ├── locationWeatherWorkflow.ts
│   ├── travelPlanningWorkflow.ts
│   └── index.ts              # Workflow exports
├── tracing/
│   └── langfuse.ts           # Langfuse integration
├── app.ts                    # Express app
├── index.ts                  # Server entry point
└── run.ts                    # CLI runner
```

## 🔌 API Endpoints

### List Workflows
```bash
GET /api/workflows
```

### Execute Workflow
```bash
POST /api/workflows/:id/execute
Content-Type: application/json

{
    "location": "Paris",
    "fields": ["weatherText"]  # Optional: filter output
}
```

### Health Check
```bash
GET /health
```

## 🧪 Available Workflows

- `weather-umbrella` - Check weather and find umbrella shops
- `location-weather` - Get location → Check weather
- `travel-planning` - Complex travel planning with multiple sub-workflows

## 📊 Node Types

All nodes use the generic `addNode(id, type, config)` API:

| Type | Purpose | Example |
|------|---------|---------|
| `agent` | LLM with tools | Research, analysis, reasoning |
| `http-tool` | HTTP requests | API calls, data fetching |
| `location-tool` | Location data | Get user location |
| `workflow` | Sub-workflow wrapper | Generic workflow node |
| `<workflow-id>` | Specific workflow | Direct workflow usage |

## 🎯 Design Principles

1. **Everything is a Callable** - Uniform interface for tools, agents, workflows
2. **Composition > Configuration** - Build complex from simple
3. **Type Safety** - Zod schemas everywhere
4. **DRY (Don't Repeat Yourself)** - Reuse schemas and workflows
5. **State Matching** - Parent state should match child requirements

## 🔑 Key Concepts

### Callables
Base interface for all executable components (tools, agents, workflows)

### Registries
- **callableRegistry** - Maps node types to registration functions
- **workflowRegistry** - Stores executable workflow instances

### State Management
- State flows through nodes
- Each node contributes updates
- Parent state should match child input requirements

### Workflow Composition
- Workflows can be used as nodes in other workflows
- Export and reuse state schemas
- No buildInput needed when states match

## 🛠️ Development

### Run in Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Type Check
```bash
npm run type-check
```

### Run Tests
```bash
npm test
```

## 🤝 Contributing

1. Create new tool in `src/core/tools/`
2. Register in `callableRegistry`
3. Import in `src/core/index.ts`
4. Add tests and documentation
5. Submit PR

## 📝 Examples

Check the `/docs` directory for detailed examples:
- Simple workflows
- Nested workflows
- Agent with tools
- Parallel execution
- Complex composition

## 🐛 Troubleshooting

### Node type not found
Ensure the node type is imported in `src/core/index.ts`

### Workflow not found
Import workflow in `src/workflows/index.ts`

### State doesn't match
Parent state must include all child input fields

### Type errors
Check Zod schema definitions and state types

## 📚 Learn More

- [Complete Documentation](./docs/COMPLETE_DOCUMENTATION.md)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Zod Documentation](https://zod.dev/)
- [Langfuse Documentation](https://langfuse.com/docs)

## 📄 License

MIT

## 🙏 Acknowledgments

Built with:
- [LangGraph](https://github.com/langchain-ai/langgraph) - Workflow orchestration
- [LangChain](https://github.com/langchain-ai/langchainjs) - LLM framework
- [Zod](https://github.com/colinhacks/zod) - Schema validation
- [Langfuse](https://langfuse.com/) - Observability

---

**Happy Building! 🚀**

For questions or support, check the [documentation](./docs/COMPLETE_DOCUMENTATION.md) or file an issue.

