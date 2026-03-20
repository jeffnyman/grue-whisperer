import { games, setLastGamePlayed, type GameInfo } from "./lib/games";
import "./App.css";
import { useCallback, useState } from "react";

function GameSelector({
  onSelectGame,
}: {
  onSelectGame: (game: GameInfo) => void;
}) {
  return (
    <div className="game-selector">
      <h2>Pick Your Darkness</h2>

      <div className="game-list">
        {games.map((game) => (
          <button
            key={game.id}
            className="game-option"
            onClick={() => {
              onSelectGame(game);
            }}
          >
            <span className="game-title">{game.title}</span>
            {game.subtitle && (
              <span className="game-subtitle">{game.subtitle}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [gameSelected, setGameSelected] = useState(false);

  const handleSelectGame = useCallback((game: GameInfo) => {
    setLastGamePlayed(game.id);
    setGameSelected(true);
    window.history.pushState({}, "", `/${game.id}`);
  }, []);

  const handleChangeGame = useCallback(() => {
    setGameSelected(false);
    window.history.pushState({}, "", "/");
  }, []);

  return (
    <div className="app">
      <header>
        <h1 className={gameSelected ? undefined : "shimmer"}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleChangeGame();
            }}
          >
            Grue Whisperer
          </a>
        </h1>
      </header>

      <main>
        <GameSelector onSelectGame={handleSelectGame} />
      </main>
    </div>
  );
}

export default App;
