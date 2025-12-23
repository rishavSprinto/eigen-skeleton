// src/core/tools/locationTool.ts
// Simple location tool that returns a city name from a predefined list

import { z } from "zod";
import type { StateGraph } from "@langchain/langgraph";
import type { ToolCallable } from "../callable";
import { callableRegistry } from "../callableRegistry";
import { DynamicStructuredTool } from "@langchain/core/tools";

export type LocationToolConfig = {
    id: string;
    name: string;
    description: string;
    cities?: string[];
    metadata?: Record<string, unknown>;
};

export type LocationToolNodeConfig = LocationToolConfig & {
    targetKey: string;
    buildInput: (state: Record<string, unknown>) => any;
};

/**
 * Create a location tool that returns city names
 */
export function createLocationTool(config: LocationToolConfig): ToolCallable {
    const cities = config.cities || [ "San Francisco", "London", "Tokyo", "Paris"];

    const run = async (input: any): Promise<any> => {
        // Return a random city from the list
        const randomCity = cities[Math.floor(Math.random() * cities.length)];
        return { city: randomCity };
    };

    const toLangChainTool = () => {
        const toolSchema = z.object({
            query: z.string().optional().describe("Optional query parameter (not used)"),
        });

        return new DynamicStructuredTool({
            name: config.name,
            description: config.description,
            schema: toolSchema,
            func: async (input) => {
                const result = await run(input);
                return JSON.stringify(result);
            },
        });
    };

    return {
        id: config.id,
        name: config.name,
        description: config.description,
        metadata: config.metadata,
        run,
        toLangChainTool,
    };
}

/**
 * Register a location tool node on a StateGraph
 */
export function registerLocationToolNode<StateType>(
    graph: StateGraph<any>,
    config: LocationToolNodeConfig
): void {
    // Create the location tool to reuse its run method
    const locationTool = createLocationTool(config);

    graph.addNode(
        config.id,
        async (state: StateType) => {
            // Build input from state
            const input = config.buildInput(state as Record<string, unknown>);

            // Run the location tool
            const result = await locationTool.run(input);

            // Extract city from result and store directly
            const cityValue = result?.city || result;

            // Return state update with just the city string
            return {
                [config.targetKey]: cityValue,
            };
        },
        {
            metadata: {
                name: config.name,
                description: config.description,
                type: "location-tool",
            },
        }
    );
}

// Register location tool node type in the callable registry
callableRegistry.register("location-tool", registerLocationToolNode);

