import type { TamboTool } from "@tambo-ai/react";
import { z } from "zod";
import { getGameRunner } from "./zmachine";

import { commandDescription } from "./prompts";

// Zod schemas define the shape of the tool's input and output.
// Tambo uses these to validate data at runtime and to generate
// the JSON schema that the model receives, so it knows exactly
// what to pass and what to expect back. The .describe() calls
// become part of that schema and the model reads them.
const inputSchema = z.object({
  command: z
    .string()
    .describe(
      'The Infocom command to execute (example: "TAKE LAMP", "GO NORTH", "INVENTORY")',
    ),
});

const outputSchema = z.object({
  output: z.string().describe("The response text from the game"),
  error: z.boolean().describe("Whether an error occurred"),
});

// TypeScript types inferred from the schemas above, used to
// type the tool function's parameters and return value without
// duplicating the definitions.
type ToolInput = z.infer<typeof inputSchema>;
type ToolOutput = z.infer<typeof outputSchema>;

// The tools array is passed to TamboProvider in App.tsx, which
// registers them with the model. Each tool has a name, a
// description for the model, the executable function, and the
// input/output schemas.
export const tools: TamboTool<ToolInput, ToolOutput>[] = [
  {
    name: "sendGameCommand",
    description: commandDescription,
    // This function runs in the browser when the model calls the
    // tool. It hands the command to the Z-machine and returns the
    // game's response text.
    tool: ({ command }) => {
      const runner = getGameRunner();

      if (!runner) {
        return {
          output: "Game not initialized. Please refresh the page.",
          error: true,
        };
      }

      if (!runner.isWaitingForInput()) {
        return {
          output: "Game is not ready for input.",
          error: true,
        };
      }

      try {
        const output = runner.sendCommand(command);
        return { output, error: false };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { output: `Error: ${message}`, error: true };
      }
    },
    inputSchema,
    outputSchema,
  },
];
