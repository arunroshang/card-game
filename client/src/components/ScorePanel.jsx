export function ScorePanel({ gameState, players, onClose }) {
  const score = gameState?.score ?? [0, 0];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4" onClick={onClose}>
      <div className="panel w-full max-w-sm rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h2 className="font-display text-gold text-xl">Scores</h2>
          <button onClick={onClose} className="text-cardWhite/40 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="flex justify-around text-center py-2">
          <div>
            <div className="font-display text-4xl text-red-300">{score[0]}</div>
            <div className="text-xs text-cardWhite/50 mt-1">Team 1</div>
          </div>
          <div className="text-cardWhite/20 text-3xl self-center">vs</div>
          <div>
            <div className="font-display text-4xl text-blue-300">{score[1]}</div>
            <div className="text-xs text-cardWhite/50 mt-1">Team 2</div>
          </div>
        </div>

        <div className="space-y-1 border-t border-uiBorder pt-3">
          <p className="text-cardWhite/40 text-xs uppercase tracking-wide mb-2">Players</p>
          {players.map(p => (
            <div key={p.seat} className="flex items-center justify-between py-1.5">
              <span className="text-cardWhite text-sm">{p.name}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                p.team === 0 ? 'bg-teamRed/20 text-red-300' : 'bg-teamBlue/20 text-blue-300'
              }`}>
                Team {p.team + 1} · Seat {p.seat + 1}
              </span>
            </div>
          ))}
        </div>

        <button className="btn-secondary w-full" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
