# Eigen Skeleton — Collapsed Architecture (One Pager)

This is a compact, copy-paste friendly overview of how the system fits together—definitions, edges/routing, LLM model provider, tracing, and the HTTP API—without duplication.

## 1) Core Concepts (DSL + Types)

- Define workflows with Zod-validated input/state and build a LangGraph under the hood.
- Add LLM nodes (reads state → prompt → writes to state).
- Add edges (unconditional/conditional/parallel) and compile.

```ts
// src/core/workflow.ts (key types)
export type NodeHandle = { id: string };

export interface WorkflowBuilder<State> {
  start: NodeHandle; // START sentinel
  end: NodeHandle;   // END sentinel
  addLlmNode(id: string, config: LlmNodeConfig<State>): NodeHandle;
  addEdge(from: NodeHandle, to: NodeHandle, options?: EdgeOptions<State>): void;
}

export type CompiledWorkflow<Input, State> = {
  id: string;
  run(input: Input): Promise<State>; // validates input, executes graph, returns final state
};

export function defineWorkflow<Input, State>(
  meta: {
    id: string;
    inputSchema: ZodObject<ZodRawShape>;
    stateSchema: ZodObject<ZodRawShape>;
    metadata?: Record<string, string | number | boolean>; // optional tracing tags
  },
  build: (wf: WorkflowBuilder<State>) => void
): CompiledWorkflow<Input, State>;
```

## 2) Minimal Workflow Example

```ts
// src/workflows/weatherWorkflow.ts
import { z } from "zod";
import { defineWorkflow } from "../core/workflow";
import type { Model } from "../modelProvider/openai";

const InputSchema = z.object({ location: z.string() });
const StateSchema = z.object({
  input: z.object({ location: z.string() }),
  weatherText: z.string().optional(),
  shopsRaw: z.string().optional(),
});

const GPT4Mini: Model = { provider: "openai", name: "gpt-4.1-mini", temperature: 0.2 };

export const weatherUmbrellaWorkflow = defineWorkflow<
  z.infer<typeof InputSchema>,
  z.infer<typeof StateSchema>
>({
  id: "weather-umbrella",
  inputSchema: InputSchema,
  stateSchema: StateSchema,
  metadata: { workflow: "weather-umbrella", version: "1.0" },
}, (wf) => {
  const weather = wf.addLlmNode("weatherCheck", {
    model: GPT4Mini,
    outputFormat: "string",
    targetKey: "weatherText",
    buildInput: (s) => ({ prompt: `Is it rainy today in ${s.input.location}? Answer yes or no.` }),
  });

  const shops = wf.addLlmNode("umbrellaShops", {
    model: GPT4Mini,
    outputFormat: "string",
    targetKey: "shopsRaw",
    buildInput: (s) => ({
      prompt: `It is raining in ${s.input.location}. List two umbrella shops nearby, one per line.`,
    }),
  });

  wf.addEdge(wf.start, weather);
  wf.addEdge(weather, shops, { when: (s) => (s.weatherText ?? "").toLowerCase().includes("yes") });
  wf.addEdge(weather, wf.end, { when: (s) => !(s.weatherText ?? "").toLowerCase().includes("yes") });
  wf.addEdge(shops, wf.end);
});
```

## 3) LLM Node + Provider-Aware Model

```ts
// src/tools/llmNode.ts (essentials)
import type { StateGraph } from "@langchain/langgraph";
import type { Model } from "../modelProvider/openai";
import { createChatModel } from "../modelProvider"; // provider-aware factory

export type LlmNodeConfig<State> = {
  model: Model;
  outputFormat: "string" | "json";
  targetKey: keyof State;
  buildInput: (state: State) => { prompt: string; systemPrompt?: string };
};

export function registerLlmNode<State>(graph: StateGraph<any>, id: string, cfg: LlmNodeConfig<State>) {
  graph.addNode(id, async (state: State) => {
    const { prompt, systemPrompt } = cfg.buildInput(state);
    const llm = createChatModel(cfg.model);
    const res = await llm.invoke(systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt);
    const text = Array.isArray(res.content)
      ? res.content.map((c: any) => c?.text ?? "").join("\n")
      : String(res.content ?? "");
    return { [cfg.targetKey]: cfg.outputFormat === "json" ? JSON.parse(text) : text } as Partial<State>;
  });
}
```

```ts
// src/modelProvider/index.ts (factory)
import { ChatOpenAI } from "@langchain/openai";
import type { Model } from "./openai";

export function createChatModel(model: Model) {
  switch (model.provider) {
    case "openai":
      return new ChatOpenAI({
        model: model.name,
        temperature: model.temperature ?? 0.2,
        maxTokens: model.maxTokens,
      });
    default:
      throw new Error(`Unsupported provider: ${model.provider}`);
  }
}
```

## 4) Edges & Routing (Single View)

```ts
// Edge options
export type EdgeOptions<State> = {
  when?: (state: State) => boolean; // if omitted → unconditional
  label?: string;
  description?: string;
};

// Unconditional
wf.addEdge(nodeA, nodeB);

// Conditional
wf.addEdge(nodeA, nodeB, { when: (s) => (s.score ?? 0) > 0.8, label: "high score" });

// Parallel: if both are true, both run
wf.addEdge(nodeA, nodeB, { when: (s) => s.flagA === true });
wf.addEdge(nodeA, nodeC, { when: (s) => s.flagB === true });

// Else-style fallback
wf.addEdge(check, ok,   { when: (s) => s.ok === true });
wf.addEdge(check, fail, { when: (s) => s.ok !== true });

// START/END helpers
wf.addEdge(wf.start, firstNode);
wf.addEdge(lastNode, wf.end);
```

Notes: routing compiles into a function per source; 0 matches → stop, 1 match → serial, >1 → parallel.

## 5) Tracing (Langfuse)

```ts
// src/core/workflow.ts (run excerpt)
import { CallbackHandler } from "@langfuse/langchain";
// ...existing code...
const tags = [ `workflow:${meta.id}`, ...Object.entries(meta.metadata || {}).map(([k,v]) => `${k}:${v}`) ];
const handler = new CallbackHandler({ sessionId: `workflow-${meta.id}-${Date.now()}`, tags });
const finalState = await app.invoke(parsed, { callbacks: [handler] });
```

Optional OTEL exporter (src/tracing/instrumentation.ts) via `LangfuseSpanProcessor`.

## 6) HTTP API (Execute Workflows)

```ts
// src/server.ts
import "dotenv/config"; import express from "express"; import cors from "cors";
import { weatherUmbrellaWorkflow } from "./workflows/weatherWorkflow";

const app = express(); app.use(cors()); app.use(express.json());
const workflows = { "weather-umbrella": weatherUmbrellaWorkflow } as const;

app.get("/health", (_req,res) => res.json({ status: "ok" }));
app.get("/api/workflows", (_req,res) => res.json({ workflows: Object.keys(workflows) }));
app.post("/api/workflows/:id/execute", async (req,res) => {
  const wf = workflows[req.params.id as keyof typeof workflows];
  if (!wf) return res.status(404).json({ error: "Workflow not found" });
  try { res.json({ id: req.params.id, input: req.body, result: await wf.run(req.body) }); }
  catch (e:any) { res.status(400).json({ error: e?.message ?? "Workflow execution failed" }); }
});

app.listen(Number(process.env.PORT ?? 3000), () => console.log(`API http://localhost:${process.env.PORT ?? 3000}`));
```

## 7) Usage & Env

```bash
# Start API
npm run api

# List workflows
curl http://localhost:3000/api/workflows

# Execute
curl -X POST http://localhost:3000/api/workflows/weather-umbrella/execute \
  -H "Content-Type: application/json" \
  -d '{"location":"San Francisco"}'
```

```bash
# .env
OPENAI_API_KEY=sk-***
LANGFUSE_PUBLIC_KEY=pk-lf-***
LANGFUSE_SECRET_KEY=sk-lf-***
LANGFUSE_HOST=https://cloud.langfuse.com
PORT=3000
```

— End —
