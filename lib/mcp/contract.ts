import type { OptimizationReport, ProviderConfig } from "@/lib/types";

/**
 * Future MCP surface: expose this operation as an optimize_arabic_prompt tool.
 * Keep credentials server-side and inject provider adapters at the transport boundary.
 */
export interface OptimizeArabicPromptTool {
  name: "optimize_arabic_prompt";
  input: { prompt: string; config: ProviderConfig };
  output: OptimizationReport;
}
