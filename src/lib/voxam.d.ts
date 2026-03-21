declare class Voxam {
  constructor(arr: ArrayLike<number>);

  highlight(fixpitch: boolean): void;
  isTandy: boolean;
  print(text: string, scripting: boolean): void;
  read(maxlen: number): void;
  restarted(): void;
  restore(): void;
  run(): IterableIterator<unknown>;
  save(buf: Uint8Array): void;
  serial: string;
  screen(window: number): void;
  split(height: number): void;
  statusType: boolean;
  updateStatusLine(text: string, v18: number, v17: number): void;
  verify(): boolean;
  zorkid: number;

  static version: {
    major: number;
    minor: number;
    subminor: number;
    timestamp: number;
  };
}

export = Voxam;
