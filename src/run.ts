
import "./tracing/instrumentation"
// Run workflows from the registry
import "dotenv/config";
import "./tracing/instrumentation";
// Import all workflows to register them automatically
import "./workflows";
import { workflowRegistry } from "./core/workflowRegistry";

async function main() {
    // Load workflow from registry by ID
    const workflowId = "weather-umbrella";
    const workflow = workflowRegistry.get(workflowId);

    if (!workflow) {
        console.error(`❌ Workflow '${workflowId}' not found in registry`);
        console.log("\n📋 Available workflows:", workflowRegistry.listWorkflows().join(", "));
        process.exit(1);
    }

    console.log(`🌤️  Starting workflow: ${workflowId}\n`);

    try {
        // Test input: Check weather in San Francisco
        const input = {
            location: "San Francisco",
        };

        console.log("📍 Input:", JSON.stringify(input, null, 2));
        console.log("\n⏳ Running workflow...\n");

        // Run the workflow
        const result = await workflow.run(input);

        // Log the result
        console.log("✅ Workflow completed successfully!\n");
        console.log("📊 Final State:");
        console.log(JSON.stringify(result, null, 2));

        console.log("\n--- Details ---");
        console.log(`Location: ${(result as any).location || "N/A"}`);
        console.log(`Weather: ${(result as any).weatherText || "N/A"}`);
        console.log(`Umbrella Shops: ${(result as any).shopsRaw || "N/A"}`);

        // Optional: small delay to allow async handlers to finalize (non-blocking)
        await new Promise((r) => setTimeout(r, 500));

    } catch (error) {
        console.error("\n❌ Error running workflow:");
        if (error instanceof Error) {
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

// Run the workflow
main().catch((error) => {
    console.error("\n💥 Unexpected error:", error);
    process.exit(1);
});

