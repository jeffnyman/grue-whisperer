import Voxam from "./voxam.js";

let currentRunner: ZMachine | null = null;

interface InputRequest {
  type: "INPUT_NEEDED";
  maxlen: number;
}

export class ZMachine {
  private game: Voxam;
  private gameGenerator: Generator | null = null;
  private outputBuffer = "";
  private waitingForInput = false;

  constructor(storyData: ArrayBuffer) {
    this.game = new Voxam(new Uint8Array(storyData));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // eslint-disable-next-line require-yield
    this.game.print = function* (text: string) {
      self.outputBuffer += text;
    };

    this.game.read = function* (
      maxlen: number,
    ): Generator<InputRequest, string, string> {
      self.waitingForInput = true;
      const input = yield { type: "INPUT_NEEDED", maxlen };
      self.waitingForInput = false;
      return input;
    };
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

    this.waitingForInput = false;

    return this.outputBuffer;
  }

  isWaitingForInput(): boolean {
    return this.waitingForInput;
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

export function resetGame(): void {
  currentRunner = null;
}
