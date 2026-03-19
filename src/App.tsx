import { games } from "./lib/games";
import "./App.css";

function GameSelector() {
  return (
    <div className="game-selector">
      <h2>Pick Your Darkness</h2>

      <div className="game-list">
        {games.map((game) => (
          <button key={game.id} className="game-option">
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
  return (
    <div className="app">
      <header>
        <h1>Grue Whisperer</h1>
      </header>

      <main>
        <GameSelector />
      </main>
    </div>
  );
}

export default App;
