import {
  games,
  getGameById,
  getLastGamePlayed,
  setLastGamePlayed,
  type GameInfo,
} from "./lib/games";
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
  // Initialize from the URL path first, then fall back to the last
  // played game. If someone navigates directly to "/zork1", that
  // intent should win over whatever was last played.
  const [gameSelected, setGameSelected] = useState<GameInfo | null>(() => {
    const pathGameId = window.location.pathname.slice(1);

    if (pathGameId) {
      const pathGame = getGameById(pathGameId);

      if (pathGame) {
        return pathGame;
      }
    }

    const lastGameId = getLastGamePlayed();

    if (lastGameId) {
      return getGameById(lastGameId) ?? null;
    }

    return null;
  });

  const handleSelectGame = useCallback((game: GameInfo) => {
    setLastGamePlayed(game.id);
    setGameSelected(game);
    window.history.pushState({}, "", `/${game.id}`);
  }, []);

  const handleChangeGame = useCallback(() => {
    setGameSelected(null);
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
        <p>
          {gameSelected
            ? gameSelected.title
            : "You are likely to be eaten by a grue."}
        </p>
      </header>

      <main>
        <GameSelector onSelectGame={handleSelectGame} />
      </main>
    </div>
  );
}

export default App;
