import Voxam from "./voxam.js";

export class ZMachine {
  // @ts-expect-error - not read yet
  private game: Voxam;

  constructor(storyData: ArrayBuffer) {
    this.game = new Voxam(new Uint8Array(storyData));
  }
}
