import {
  clearLastGamePlayed,
  games,
  getGameById,
  getLastGamePlayed,
  setLastGamePlayed,
  type GameInfo,
} from "./lib/games";
import "./App.css";
import { useCallback, useEffect, useState } from "react";
import { initializeGame, isGameInitialized, resetGame } from "./lib/zmachine";

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

interface GameLoaderProps {
  game: GameInfo;
}

function GameLoader({ game }: GameLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameOutput, setGameOutput] = useState<string | null>(null);

  useEffect(() => {
    if (isGameInitialized()) {
      setLoading(false);
      return;
    }

    initializeGame(game.file)
      .then((output) => {
        setGameOutput(output);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load game");
        setLoading(false);
      });
  }, [game.file]);

  if (loading) {
    return (
      <div className="loading-screen">
        <h1>Loading {game.title}</h1>
        <p>The darkness is loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="game">
      <p>Game Goes Here</p>
      <p>{gameOutput}</p>
    </div>
  );
}

function App() {
  // Initialize from the URL path first, then fall back to the last
  // played game. If someone navigates directly to "/zork1", that
  // intent should win over whatever was last played. If there is
  // ever only one game in the list, that game would be selected
  // automatically.
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

    if (games.length === 1) {
      return games[0];
    }

    return null;
  });

  // On initial load, sync the URL with the game that was
  // previously selected.
  useEffect(() => {
    if (gameSelected && window.location.pathname !== `/${gameSelected.id}`) {
      window.history.replaceState({}, "", `/${gameSelected.id}`);
    }
  });

  const handleSelectGame = useCallback((game: GameInfo) => {
    setLastGamePlayed(game.id);
    setGameSelected(game);
    window.history.pushState({}, "", `/${game.id}`);
  }, []);

  const handleChangeGame = useCallback(() => {
    resetGame();
    clearLastGamePlayed();
    setGameSelected(null);
    window.history.pushState({}, "", "/");
  }, []);

  return (
    <div className="app">
      <header className={gameSelected ? "game-active" : undefined}>
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
        {gameSelected ? (
          <GameLoader game={gameSelected} />
        ) : (
          <GameSelector onSelectGame={handleSelectGame} />
        )}
      </main>
    </div>
  );
}

export default App;
