// workflows/weatherWorkflow.ts
import { z } from "zod";
import { defineWorkflow } from "../core/workflow";
import type { Model } from "../modelProvider/openai";


// State & input
const WeatherInputSchema = z.object({
    location: z.string(),
});
type WeatherInput = z.infer<typeof WeatherInputSchema>;

const WeatherStateSchema = z.object({

        location: z.string(),
    weatherText: z.string().optional(),
    shopsRaw: z.string().optional(),
});
type WeatherState = z.infer<typeof WeatherStateSchema>;

// Model
export const GPT4MiniModel: Model = {
    provider: "openai",
    name: "gpt-4.1-mini",
    temperature: 0.2,
};

export const weatherUmbrellaWorkflow = defineWorkflow<
    WeatherInput,
    WeatherState
>(
    {
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
            buildInput: (state:any) => ({
                prompt: `Is it rainy today in ${state.location}? Answer "yes" or "no". if you dont have real time data answer "yes"`,
            }),
        });

        const umbrellaNode = wf.addLlmNode("umbrellaShops", {
            model: GPT4MiniModel,
            outputFormat: "string",
            targetKey: "shopsRaw",
            buildInput: (state) => ({
                prompt: `It is raining in ${state.location}. 
List two umbrella shops nearby, one per line.`,
            }),
        });

        wf.addEdge(wf.start, weatherNode);

        wf.addEdge(weatherNode, umbrellaNode, {
            when: (state) =>
                (state.weatherText ?? "").toLowerCase().includes("yes"),
        });

        wf.addEdge(weatherNode, wf.end, {
            when: (state) =>
                !(state.weatherText ?? "").toLowerCase().includes("yes"),
        });

        wf.addEdge(umbrellaNode, wf.end);
    }
);
