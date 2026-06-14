export function HandResultModal({ result, score, onNext }) {
  if (!result) return null;

  const success = result.success;
  const bidderTeam = result.bidderTeam ?? 0;
  const gamePoints = result.gamePoints ?? 0;

  const badges = [];
  if (result.isThani) badges.push('Thani 🎯');
  if (result.isCot) badges.push('Cot 🏳️');
  if (result.isRedoubled) badges.push('Redoubled ×4');
  else if (result.isDoubled) badges.push('Doubled ×2');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
      <div className="panel w-full max-w-xs rounded-2xl p-6 space-y-5 text-center">

        <div>
          <div className={`text-5xl mb-2 ${success ? '' : 'grayscale'}`}>
            {success ? '🏆' : '💀'}
          </div>
          <h2 className={`font-display text-2xl font-bold ${success ? 'text-gold' : 'text-red-400'}`}>
            {success ? 'Bid Made!' : 'Bid Bust!'}
          </h2>
          <p className="text-cardWhite/60 text-sm mt-1">
            Team {bidderTeam + 1} {success ? 'won' : 'lost'} · {gamePoints} pts
          </p>
        </div>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {badges.map(b => (
              <span key={b} className="bg-gold/20 border border-gold/40 text-gold text-xs px-2 py-1 rounded-full">
                {b}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-around bg-uiBg rounded-xl py-3 px-4">
          <div>
            <div className="font-display text-2xl text-red-300">{score?.[0] ?? 0}</div>
            <div className="text-xs text-cardWhite/40 mt-0.5">Team 1</div>
          </div>
          <div className="text-cardWhite/20 self-center">vs</div>
          <div>
            <div className="font-display text-2xl text-blue-300">{score?.[1] ?? 0}</div>
            <div className="text-xs text-cardWhite/40 mt-0.5">Team 2</div>
          </div>
        </div>

        <button className="btn-primary w-full text-base py-3.5" onClick={onNext}>
          Next hand →
        </button>
      </div>
    </div>
  );
}
