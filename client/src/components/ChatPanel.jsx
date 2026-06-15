import { useState, useRef, useEffect } from 'react';

// ── Chat Panel ────────────────────────────────────────────────

export function ChatPanel({ messages, onSend, onClose }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-uiPanel border-b border-uiBorder safe-top">
        <span className="font-display text-gold text-lg">Chat</span>
        <button onClick={onClose} className="text-cardWhite/60 text-2xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-uiBg">
        {messages.length === 0 && (
          <p className="text-white/30 text-center text-sm mt-8">No messages yet</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="space-y-0.5">
            <span className="text-gold/70 text-xs">{msg.player_name}</span>
            <div className="bg-uiPanel rounded-lg px-3 py-2 text-sm text-cardWhite">{msg.message}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 px-4 py-3 bg-uiPanel border-t border-uiBorder safe-bottom">
        <input
          className="flex-1 bg-uiBg border border-uiBorder rounded-lg px-3 py-2.5 text-sm text-cardWhite placeholder-white/30 outline-none focus:border-gold/50"
          placeholder="Message…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          maxLength={200}
        />
        <button className="btn-primary px-4 py-2.5 text-sm" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

// ── Score Panel ───────────────────────────────────────────────

export function ScorePanel({ gameState, players, onClose }) {
  const team0Players = players.filter(p => p.team === 0);
  const team1Players = players.filter(p => p.team === 1);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-uiPanel border-b border-uiBorder safe-top">
        <span className="font-display text-gold text-lg">Scores</span>
        <button onClick={onClose} className="text-cardWhite/60 text-2xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-uiBg space-y-4">
        {/* Score display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="panel p-4 text-center">
            <div className="text-red-300 text-xs mb-1">Team 1 (Red)</div>
            <div className="font-display text-4xl text-red-300">{gameState?.score?.[0] ?? 0}</div>
            <div className="mt-2 space-y-1">
              {team0Players.map(p => (
                <div key={p.seat} className="text-cardWhite/60 text-xs">{p.name}</div>
              ))}
            </div>
          </div>
          <div className="panel p-4 text-center">
            <div className="text-blue-300 text-xs mb-1">Team 2 (Blue)</div>
            <div className="font-display text-4xl text-blue-300">{gameState?.score?.[1] ?? 0}</div>
            <div className="mt-2 space-y-1">
              {team1Players.map(p => (
                <div key={p.seat} className="text-cardWhite/60 text-xs">{p.name}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Current hand info */}
        {gameState?.highBid && (
          <div className="panel p-4 space-y-2">
            <div className="text-gold text-sm font-medium">Current Hand #{gameState.handNumber}</div>
            <div className="text-cardWhite/70 text-sm">
              Bid: <strong className="text-cardWhite">{gameState.highBid?.points || gameState.highBid}</strong>
              {gameState.trumpSuit && <span className="ml-2">Trump: {gameState.trumpSuit}</span>}
            </div>
            <div className="text-cardWhite/70 text-sm">
              Points won — Red: <strong className="text-red-300">{gameState.pointsWon?.[0] ?? 0}</strong>
              {' · '}Blue: <strong className="text-blue-300">{gameState.pointsWon?.[1] ?? 0}</strong>
            </div>
            <div className="text-cardWhite/70 text-sm">
              Tricks — Red: {gameState.trickCount?.[0] ?? 0} · Blue: {gameState.trickCount?.[1] ?? 0}
            </div>
          </div>
        )}

        {/* Scoring key */}
        <div className="panel p-4 space-y-2">
          <div className="text-gold text-sm font-medium">
            {gameState?.gameType === '28' ? '28 Scoring' : '56 Scoring'}
          </div>
          {gameState?.gameType === '28' ? (
            <div className="space-y-1 text-xs text-cardWhite/60">
              <div>Bid ≤19 → Win +1, Lose −2</div>
              <div>Bid 20–24 (Honours) → Win +2, Lose −3</div>
              <div>Bid ≥25 → Win +3, Lose −4</div>
              <div>Cot (all tricks) → double score</div>
              <div>Thani → Win +4, Lose −5</div>
            </div>
          ) : (
            <div className="space-y-1 text-xs text-cardWhite/60">
              <div>Bid 28–39 → Win +1, Lose −2</div>
              <div>Bid 40–47 (Honours) → Win +2, Lose −3</div>
              <div>Bid 48–55 → Win +3, Lose −4</div>
              <div>Bid 56 → Win +4, Lose −5</div>
              <div>Double/Redouble multiplies score</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hand Result Modal ─────────────────────────────────────────

export function HandResultModal({ result, score, onNext }) {
  if (!result) return null;

  const { success, bid, bidderTeam, bidderPoints, teamPoints, gamePoints, isThani, isCot, winTables, loseTables } = result;
  const pointsDisplay = winTables || loseTables ? (success ? `+${winTables}` : `-${loseTables}`) : (success ? `+${gamePoints}` : `-${gamePoints}`);
  const t0 = teamPoints?.[0] ?? (bidderTeam === 0 ? bidderPoints : 28 - bidderPoints);
  const t1 = teamPoints?.[1] ?? (bidderTeam === 1 ? bidderPoints : 28 - bidderPoints);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="panel p-6 max-w-sm w-full space-y-4">
        {/* Result header */}
        <div className="text-center">
          {isThani && <div className="text-purple-400 text-base font-semibold mb-1">THANI</div>}
          {isCot && <div className="text-gold text-base font-semibold mb-1">COT — ALL TRICKS!</div>}
          <div className={`font-display text-4xl ${success ? 'text-green-400' : 'text-red-400'}`}>
            {success ? '✓ Contract made' : '✗ Contract set'}
          </div>
          <div className="text-cardWhite/70 text-base mt-2">
            Bidding team (Team {bidderTeam + 1}) bid <strong className="text-gold">{bid}</strong>, captured <strong className="text-cardWhite">{bidderPoints}</strong>
          </div>
        </div>

        {/* Card points captured this hand — both teams */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-uiBg/50 rounded-lg p-3 text-center">
            <div className="text-red-300 text-sm">Team 1 captured</div>
            <div className="font-display text-3xl text-red-300">{t0}</div>
            <div className="text-white/30 text-xs">card points</div>
          </div>
          <div className="bg-uiBg/50 rounded-lg p-3 text-center">
            <div className="text-blue-300 text-sm">Team 2 captured</div>
            <div className="font-display text-3xl text-blue-300">{t1}</div>
            <div className="text-white/30 text-xs">card points</div>
          </div>
        </div>

        {/* Game-point delta */}
        <div className="text-center">
          <div className="text-cardWhite/50 text-sm">Game points this hand</div>
          <div className={`font-display text-5xl ${success ? 'text-green-400' : 'text-red-400'}`}>
            {pointsDisplay}
          </div>
        </div>

        {/* Cumulative match score */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`panel p-3 text-center ${bidderTeam === 0 && success ? 'ring-1 ring-green-500/50' : ''}`}>
            <div className="text-red-300 text-sm">Team 1 total</div>
            <div className="font-display text-3xl text-red-300">{score[0]}</div>
          </div>
          <div className={`panel p-3 text-center ${bidderTeam === 1 && success ? 'ring-1 ring-green-500/50' : ''}`}>
            <div className="text-blue-300 text-sm">Team 2 total</div>
            <div className="font-display text-3xl text-blue-300">{score[1]}</div>
          </div>
        </div>

        <button className="btn-primary w-full text-lg" onClick={onNext}>
          Next Hand →
        </button>
      </div>
    </div>
  );
}
