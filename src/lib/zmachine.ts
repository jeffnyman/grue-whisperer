import Voxam from "./voxam.js";

let currentRunner: ZMachine | null = null;

const SAVE_KEY_PREFIX = "grue-whisperer-save-";

interface InputRequest {
  type: "INPUT_NEEDED";
  maxlen: number;
}

function getSaveKey(game: Voxam): string {
  return `${SAVE_KEY_PREFIX}${game.serial}-${String(game.zorkid)}`;
}

function saveToLocalStorage(game: Voxam, data: Uint8Array): boolean {
  try {
    const base64 = btoa(Array.from(data, (b) => String.fromCharCode(b)).join(""));
    localStorage.setItem(getSaveKey(game), base64);
    return true;
  } catch (err) {
    console.error("[ZMachine] Failed to save:", err);
    return false;
  }
}

function loadFromLocalStorage(game: Voxam): Uint8Array | null {
  try {
    const base64 = localStorage.getItem(getSaveKey(game));

    if (!base64) return null;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  } catch (err) {
    console.error("[ZMachine] Failed to load save:", err);
    return null;
  }
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

    // eslint-disable-next-line require-yield
    this.game.save = function* (data: Uint8Array) {
      return saveToLocalStorage(self.game, data);
    };

    // eslint-disable-next-line require-yield
    this.game.restore = function* () {
      return loadFromLocalStorage(self.game);
    };
  }

  start(): string {
    this.gameGenerator = this.game.run() as Generator;

    const intro = this.runUntilInput();

    // Auto-restore if a save exists
    if (this.hasSavedGame()) {
      const restoreOutput = this.sendCommand("RESTORE", false);
      return intro + "\n[Game restored from auto-save]\n\n" + restoreOutput;
    }

    return intro;
  }

  sendCommand(command: string, autoSave = true): string {
    if (!this.gameGenerator) {
      throw new Error("Game not started");
    }

    if (!this.waitingForInput) {
      throw new Error("Game is not waiting for input");
    }

    this.outputBuffer = "";

    const result = this.gameGenerator.next(command);
    const output = this.collectOutputFrom(result);

    // Auto-save after each command (silently)
    if (
      autoSave &&
      command.toUpperCase() !== "SAVE" &&
      command.toUpperCase() !== "RESTORE"
    ) {
      this.outputBuffer = "";
      const saveResult = this.gameGenerator.next("SAVE");
      this.collectOutputFrom(saveResult);
    }

    return output;
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
        return this.outputBuffer.trimEnd().replace(/>$/, "").trimEnd();
      }

      result = this.gameGenerator.next();
    }

    this.waitingForInput = false;

    return this.outputBuffer.trimEnd().replace(/>$/, "").trimEnd();
  }

  isWaitingForInput(): boolean {
    return this.waitingForInput;
  }

  hasSavedGame(): boolean {
    return localStorage.getItem(getSaveKey(this.game)) !== null;
  }

  clearSave(): void {
    localStorage.removeItem(getSaveKey(this.game));
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

export function getGameRunner(): ZMachine | null {
  return currentRunner;
}

export function clearGameSave(): void {
  if (currentRunner) {
    currentRunner.clearSave();
  }
}
