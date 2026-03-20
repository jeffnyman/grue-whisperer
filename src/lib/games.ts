const STORAGE_KEYS = {
  lastGamePlayed: "grue-whisperer:last-game-played",
} as const;

export interface GameInfo {
  id: string;
  title: string;
  subtitle?: string;
}

export const games: GameInfo[] = [
  {
    id: "zork1",
    title: "Zork I",
    subtitle: "The Great Underground Empire",
  },
  {
    id: "zork2",
    title: "Zork II",
    subtitle: "The Wizard of Frobozz",
  },
  {
    id: "zork3",
    title: "Zork III",
    subtitle: "The Dungeon Master",
  },
];

export function getLastGamePlayed(): string | null {
  return localStorage.getItem(STORAGE_KEYS.lastGamePlayed);
}

export function setLastGamePlayed(gameId: string): void {
  localStorage.setItem(STORAGE_KEYS.lastGamePlayed, gameId);
}

export function clearLastGamePlayed(): void {
  localStorage.removeItem(STORAGE_KEYS.lastGamePlayed);
}

export function getGameById(id: string): GameInfo | undefined {
  return games.find((g) => g.id === id);
}
