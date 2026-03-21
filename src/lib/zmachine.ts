import Voxam from "./voxam.js";

let currentRunner: ZMachine | null = null;

interface InputRequest {
  type: "INPUT_NEEDED";
}

export class ZMachine {
  private game: Voxam;
  private gameGenerator: Generator | null = null;
  private outputBuffer = "";

  constructor(storyData: ArrayBuffer) {
    this.game = new Voxam(new Uint8Array(storyData));
  }

  start(): string {
    this.gameGenerator = this.game.run() as Generator;

    const intro = this.runUntilInput();

    return intro;
  }

  runUntilInput(): string {
    if (!this.gameGenerator) {
      throw new Error("Game not started");
    }

    const result = this.gameGenerator.next();

    return this.collectOutputFrom(result);
  }

  collectOutputFrom(result: IteratorResult<unknown>): string {
    if (!this.gameGenerator) {
      throw new Error("Game not started");
    }

    while (!result.done) {
      const value = result.value as InputRequest | undefined;

      if (value?.type === "INPUT_NEEDED") {
        return this.outputBuffer;
      }

      result = this.gameGenerator.next();
    }

    return this.outputBuffer;
  }
}

export function isGameInitialized(): boolean {
  return currentRunner !== null;
}

export async function initializeGame(storyUrl: string): Promise<string> {
  const response = await fetch(storyUrl);

  if (
    !response.ok ||
    response.headers.get("content-type")?.includes("text/html")
  ) {
    throw new Error(`Failed to load game: ${storyUrl}`);
  }

  const storyData = await response.arrayBuffer();
  currentRunner = new ZMachine(storyData);

  return currentRunner.start();
}
