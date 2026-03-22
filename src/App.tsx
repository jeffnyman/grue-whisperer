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
import {
  TamboProvider,
  useTambo,
  useTamboThreadInput,
  type TamboThreadMessage,
} from "@tambo-ai/react";
import type { InitialInputMessage } from "@tambo-ai/react";
import { tools } from "./lib/tambo";

// Sets the model's overall identity and behavior for the session.
// This is broader than the tool description in tambo.ts; that one
// is scoped to a single tool call; this governs the whole
// conversation. Some instructions intentionally overlap (e.g.
// "call the tool for every message") because repetition across
// both the system prompt and the tool description reinforces the
// behavior.
const systemPrompt = `You are the narrator of a text adventure game. \
You have one job: make the player feel like they're inside the game \
world. \
\
TOOL USE:\
- Call sendGameCommand for every player action. For each message, figure \
out what the player is trying to do, then find the parser commands that \
best match that intent. Trust your knowledge of classic text adventure \
commands (LOOK, EXAMINE, INVENTORY, GO, TAKE, DROP, OPEN, HELLO, KNOCK, \
SAY, SHOUT, etc.).
- Always try to satisfy the player's full intent. Decompose compound \
requests into all the commands needed to fulfill them, making separate \
sequential tool calls, one per command.
- If the player's message truly can't be mapped to any command, call \
sendGameCommand with an empty string. The game will return something \
like "I beg your pardon?" Discard that response entirely and instead \
invent narrative that acknowledges what the player was trying to do and \
draws them back into the world.
\
PRESENTATION:\
- Always show the game's output. You may add light flavor text, but never \
omit, hide, or summarize what the game returned.
- When the game returns a parser error or "I don't understand", rewrite it \
as an in-world moment: the world resists, the character hesitates, the \
action simply doesn't work, without revealing that a parser error occurred. \
- Never break the fourth wall. No "the game says", "would you like to", \
"let me try", or any meta-commentary.
`;

const initialMessages: InitialInputMessage[] = [
  {
    role: "system",
    content: [{ type: "text", text: systemPrompt }],
  },
];

// Extracts the command string from a sendGameCommand tool_use
// block, if present. sendGameCommand is the Tambo tool defined
// in zmachine.ts that is called to send player input to the
// Z-Machine.
function getGameCommandFromMessage(message: TamboThreadMessage): string | null {
  for (const block of message.content) {
    if (
      block.type === "tool_use" &&
      block.name === "sendGameCommand" &&
      typeof block.input === "object" &&
      "command" in block.input
    ) {
      return String(block.input.command);
    }
  }

  return null;
}

// Finds the game command that is associated with a given assistant
// message. Checks the message itself first, then walks backwards
// through prior assistant messages until it hits a user turn, to
// handle cases where the tool call and the visible response land
// n separate messages.
function resolveCommandForMessage(
  allMessages: TamboThreadMessage[],
  messageId: string,
): string | null {
  const idx = allMessages.findIndex((m) => m.id === messageId);

  if (idx < 0) return null;

  const direct = getGameCommandFromMessage(allMessages[idx]);

  if (direct) return direct;

  for (let i = idx - 1; i >= 0; i--) {
    const m = allMessages[i];

    if (m.role === "user" && m.content.some((b) => b.type === "text")) break;
    if (m.role !== "assistant") continue;

    const cmd = getGameCommandFromMessage(m);

    if (cmd) return cmd;
  }

  return null;
}

interface GameDisplayProps {
  gameIntro: string | null;
}

function GameDisplay({ gameIntro }: GameDisplayProps) {
  const { messages } = useTambo();
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

        {messages
          .filter(
            (message) =>
              (message.role === "user" || message.role === "assistant") &&
              message.content.some(
                (block) => block.type === "text" && block.text.trim(),
              ),
          )
          .map((message) => {
            const command =
              message.role === "assistant"
                ? resolveCommandForMessage(messages, message.id)
                : null;

            return (
              <div key={message.id}>
                {command && (
                  <div className="message command">
                    <div className="message-content">{command}</div>
                  </div>
                )}
              </div>
            );
          })}
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
  const { startNewThread } = useTambo();

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
    startNewThread();
    window.history.pushState({}, "", "/");
  }, [startNewThread]);

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
    <TamboProvider
      apiKey={apiKey}
      userKey={contextKey}
      tools={tools}
      initialMessages={initialMessages}
    >
      <App />
    </TamboProvider>
  );
}

export default AppWithProviders;
