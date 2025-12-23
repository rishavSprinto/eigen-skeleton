// src/workflows/locationWeatherWorkflow.ts
// Workflow that gets user location using a tool, then checks weather

import { z } from "zod";
import { defineWorkflow } from "../core/workflow";
import { WeatherStateSchema } from "./weatherWorkflow";

// State & input schemas
const LocationWeatherInputSchema = z.object({
    userQuery: z.string().optional(), // Optional user query
});

// Extend weather state schema with our additional fields
const LocationWeatherStateSchema = WeatherStateSchema.extend({
    userQuery: z.string().optional(),
});

type LocationWeatherState = z.infer<typeof LocationWeatherStateSchema>;


export const locationWeatherWorkflow = defineWorkflow<LocationWeatherState>({
    id: "location-weather",
    inputSchema: LocationWeatherInputSchema,
    stateSchema: LocationWeatherStateSchema,
    metadata: {
        workflow: "location-weather",
        version: "1.0",
        category: "location-weather-analysis",
        description: "Detects user location and checks weather",
    },
}, (wf) => {
    // Step 1: Location tool node - stores location in format weather workflow expects
    const locationNode = wf.addNode("getLocation", "location-tool", {
        name: "Get User Location",
        description: "Fetches user location from location tool",
        cities: ["San Francisco", "London", "Tokyo", "Paris", "Berlin", "Sydney"],
        targetKey: "location",
        buildInput: (state: LocationWeatherState) => ({
            query: state.userQuery || "get location",
        }),
    });

    // Step 2: Weather workflow node - state already has location in correct format
    const weatherNode = wf.addNode("checkWeather", "weather-umbrella", {
    });

    // Build workflow: location detection -> weather check
    wf.addEdge(wf.start, locationNode);
    wf.addEdge(locationNode, weatherNode);
    wf.addEdge(weatherNode, wf.end);
});

