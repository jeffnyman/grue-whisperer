import type { TamboTool } from "@tambo-ai/react";
import { z } from "zod";
import { getGameRunner } from "./zmachine";

const inputSchema = z.object({
  command: z
    .string()
    .describe(
      'The Infocom command to execute (example: "TAKE LAMP, "GO NORTH, "INVENTORY',
    ),
});

const outputSchema = z.object({
  output: z.string().describe("The response text from the game"),
  error: z.boolean().describe("Whether an error occurred"),
});

type ToolInput = z.infer<typeof inputSchema>;
type ToolOutput = z.infer<typeof outputSchema>;

export const tools: TamboTool<ToolInput, ToolOutput>[] = [
  {
    name: "sendGameCommand",
    description: `Execute a command in the Infocom text adventure game.`,
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
