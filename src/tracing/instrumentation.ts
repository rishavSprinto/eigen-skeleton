// src/tracing/instrumentation.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";


export const langfuseSpanProcessor =  new LangfuseSpanProcessor({
    publicKey:  process.env.LANGFUSE_PUBLIC_KEY,
    secretKey:process.env.LANGFUSE_SECRET_KEY,
    baseUrl:  process.env.LANGFUSE_BASE_URL,
})
// Setup OpenTelemetry with Langfuse export
// This enables automatic tracing of LangChain operations
const sdk = new NodeSDK({
    spanProcessors: [
        langfuseSpanProcessor
    ],
});

sdk.start();

console.log("✅ OpenTelemetry instrumentation started with Langfuse export");

