
import "./tracing/instrumentation"
import { weatherUmbrellaWorkflow } from "./workflows/weatherWorkflow";
import {time} from "zod/v4/mini/iso";

async function main() {
    console.log("🌤️  Starting Weather Umbrella Workflow...\n");

    try {
        // Test input: Check weather in San Francisco
        const input = {
            location: "San Francisco",
        };

        console.log("📍 Input:", JSON.stringify(input, null, 2));
        console.log("\n⏳ Running workflow...\n");

        // Run the workflow
        const result = await weatherUmbrellaWorkflow.run(input);

        // Log the result
        console.log("✅ Workflow completed successfully!\n");
        console.log("📊 Final State:");
        console.log(JSON.stringify(result, null, 2));

        console.log("\n--- Details ---");
        console.log(`Location: ${result.location}`);
        console.log(`Weather: ${result.weatherText || "N/A"}`);
        console.log(`Umbrella Shops: ${result.shopsRaw || "N/A"}`);
        setTimeout(()=>{console.log("done")},10000)

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

