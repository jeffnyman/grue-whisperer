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
