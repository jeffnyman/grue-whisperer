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
import { TamboProvider, useTamboThreadInput } from "@tambo-ai/react";

interface GameDisplayProps {
  gameIntro: string | null;
}

function GameDisplay({ gameIntro }: GameDisplayProps) {
  const { isPending, setValue, submit, value } = useTamboThreadInput();

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!value.trim() || isPending) return;

    void submit();
  };

  return (
    <div className="game-display">
      <div className="messages">
        {gameIntro && (
          <div className="message game-intro-message">
            <pre>{gameIntro}</pre>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="player-prompt">
        <input
          type="text"
          placeholder="What do you want to do?"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          disabled={isPending}
          autoFocus
        ></input>
        <button
          type="submit"
          className={isPending ? "loading" : ""}
          disabled={isPending || !value.trim()}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
          }}
        >
          {isPending ? ">" : ">"}
        </button>
      </form>
    </div>
  );
}

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
  onChangeGame: () => void;
}

function GameLoader({ game, onChangeGame }: GameLoaderProps) {
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
        <button
          onClick={() => {
            window.location.reload();
          }}
        >
          Retry
        </button>
        <button onClick={onChangeGame}>Choose Different Game</button>
      </div>
    );
  }

  return <GameDisplay gameIntro={gameOutput} />;
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
          <GameLoader game={gameSelected} onChangeGame={handleChangeGame} />
        ) : (
          <GameSelector onSelectGame={handleSelectGame} />
        )}
      </main>
    </div>
  );
}

function AppWithProviders() {
  const apiKey = import.meta.env.VITE_TAMBO_API_KEY;

  const [contextKey] = useState(() => {
    const storageKey = "grue-whisperer-user-id";
    let userID = localStorage.getItem(storageKey);

    if (!userID) {
      userID = crypto.randomUUID();
      localStorage.setItem(storageKey, userID);
    }

    return userID;
  });

  if (!apiKey) {
    return (
      <div className="error-screen">
        <h1>Missing Tambo API Key</h1>
        <p>
          Please set VITE_TAMBO_API_KEY in your <em>.env</em> file
        </p>
        <p>
          Copy <em>.env.example</em> to <em>.env</em> and add your Tambo API key
        </p>
      </div>
    );
  }

  return (
    <TamboProvider apiKey={apiKey} userKey={contextKey}>
      <App />
    </TamboProvider>
  );
}

export default AppWithProviders;
