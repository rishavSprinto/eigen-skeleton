// workflows/weatherWorkflow.ts
import { z } from "zod";
import { defineWorkflow } from "../core/workflow";
import type { Model } from "../modelProvider/openai";


// State & input schemas
const WeatherInputSchema = z.object({
    location: z.string(),
});

const WeatherStateSchema = z.object({
    location: z.string(),
    weatherText: z.string().optional(),
    shopsRaw: z.string().optional(),
});

type WeatherStateType = z.infer<typeof WeatherStateSchema>;

// Model
export const GPT4MiniModel: Model = {
    provider: "openai",
    name: "gpt-4.1-mini",
    temperature: 0.2,
};

export const weatherUmbrellaWorkflow = defineWorkflow<WeatherStateType>({
    id: "weather-umbrella",
    inputSchema: WeatherInputSchema,
    stateSchema: WeatherStateSchema,
        metadata: {
            workflow: "weather-umbrella",
            version: "1.0",
            category: "weather-analysis",
            environment: "production",
        },
    },
    (wf) => {
        const weatherNode = wf.addLlmNode("weatherCheck", {
            model: GPT4MiniModel,
            outputFormat: "string",
            targetKey: "weatherText",
            buildInput: (state: WeatherStateType) => ({
                prompt: `Is it rainy today in ${state.location}? Answer "yes" or "no". if you dont have real time data answer "yes"`,
            }),
        });

        const umbrellaNode = wf.addLlmNode("umbrellaShops", {
            model: GPT4MiniModel,
            outputFormat: "string",
            targetKey: "shopsRaw",
            buildInput: (state: WeatherStateType) => ({
                prompt: `It is raining in ${state.location}.
List two umbrella shops nearby, one per line.`,
            }),
        });

        wf.addEdge(wf.start, weatherNode);

        wf.addEdge(weatherNode, umbrellaNode, {
            when: (state: WeatherStateType) =>
                (state.weatherText ?? "").toLowerCase().includes("yes"),
        });

        wf.addEdge(weatherNode, wf.end, {
            when: (state: WeatherStateType) =>
                !(state.weatherText ?? "").toLowerCase().includes("yes"),
        });

        wf.addEdge(umbrellaNode, wf.end);
    }
);
