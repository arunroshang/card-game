import { useState } from 'react';

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS = { hearts: 'text-red-400', diamonds: 'text-red-400', clubs: 'text-cardWhite', spades: 'text-cardWhite' };

// ── 28 Bidding Panel ──────────────────────────────────────────

export function BiddingPanel28({ gameState, mySeat, onBid, onPass }) {
  const [bidValue, setBidValue] = useState(Math.max(14, (gameState.highBid || 13) + 1));

  const minBid = Math.max(14, (gameState.highBid || 13) + 1);
  const isMyTurn = gameState.currentBidder === mySeat;
  if (!isMyTurn) {
    return (
      <div className="panel p-4 text-center">
        <p className="text-cardWhite/60 text-sm">
          {`Waiting for seat ${(gameState.currentBidder ?? 0) + 1} to bid…`}
        </p>
        {gameState.highBid > 13 && (
          <p className="text-gold text-sm mt-1">Current high bid: <strong>{gameState.highBid}</strong></p>
        )}
      </div>
    );
  }

  return (
    <div className="panel p-4 space-y-3">
      <div className="text-center">
        <p className="text-gold font-display text-lg">Your bid</p>
        {gameState.highBid > 13 && (
          <p className="text-cardWhite/60 text-xs">High bid: {gameState.highBid}</p>
        )}
      </div>

      {/* Bid stepper */}
      <div className="flex items-center justify-center gap-4">
        <button
          className="w-10 h-10 rounded-full bg-uiBg border border-uiBorder text-gold text-xl font-bold active:scale-90 transition-transform"
          onClick={() => setBidValue(v => Math.max(minBid, v - 1))}
        >−</button>
        <span className="font-display text-3xl text-cardWhite w-12 text-center">{bidValue}</span>
        <button
          className="w-10 h-10 rounded-full bg-uiBg border border-uiBorder text-gold text-xl font-bold active:scale-90 transition-transform"
          onClick={() => setBidValue(v => Math.min(28, v + 1))}
        >+</button>
      </div>

      {/* Quick bid buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        {[16, 18, 20, 22, 24, 26, 28].filter(b => b >= minBid).map(b => (
          <button key={b}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${bidValue === b ? 'bg-gold text-uiBg' : 'bg-uiBg border border-uiBorder text-cardWhite/80'}`}
            onClick={() => setBidValue(b)}
          >{b}</button>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={onPass}>Pass</button>
        <button className="btn-primary flex-1" onClick={() => onBid(bidValue)}>
          Bid {bidValue}
        </button>
      </div>
    </div>
  );
}

// ── Trump Chooser (28) ────────────────────────────────────────

export function TrumpChooser({ hand, onChoose }) {
  const [selectedSuit, setSelectedSuit] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  // Group hand by suit
  const bySuit = {};
  for (const card of hand) {
    if (!bySuit[card.suit]) bySuit[card.suit] = [];
    bySuit[card.suit].push(card);
  }

  return (
    <div className="panel p-4 space-y-3">
      <p className="text-gold font-display text-center text-lg">Choose trump suit</p>
      <p className="text-cardWhite/60 text-xs text-center">Tap a suit, then select which card to place face-down</p>

      <div className="grid grid-cols-4 gap-2">
        {SUITS.map(suit => (
          <button
            key={suit}
            className={`p-3 rounded-xl border transition-colors flex flex-col items-center gap-1
              ${selectedSuit === suit
                ? 'bg-gold/20 border-gold'
                : bySuit[suit] ? 'bg-uiBg border-uiBorder' : 'bg-uiBg border-uiBorder opacity-30 cursor-not-allowed'}`}
            onClick={() => { if (bySuit[suit]) { setSelectedSuit(suit); setSelectedCard(null); } }}
            disabled={!bySuit[suit]}
          >
            <span className={`text-2xl ${SUIT_COLORS[suit]}`}>{SUIT_SYMBOLS[suit]}</span>
            <span className="text-xs text-cardWhite/60">{bySuit[suit]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {selectedSuit && bySuit[selectedSuit] && (
        <div className="space-y-2">
          <p className="text-cardWhite/60 text-xs text-center">Pick the face-down indicator card:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {bySuit[selectedSuit].map((card, i) => (
              <button key={i}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${selectedCard === i ? 'bg-gold text-uiBg border-gold' : 'bg-uiBg border-uiBorder text-cardWhite'}`}
                onClick={() => setSelectedCard(i)}
              >
                <span className={SUIT_COLORS[selectedSuit]}>{card.rank} {SUIT_SYMBOLS[selectedSuit]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn-primary w-full"
        disabled={!selectedSuit || selectedCard === null}
        onClick={() => {
          if (selectedSuit && selectedCard !== null) {
            onChoose(bySuit[selectedSuit][selectedCard]);
          }
        }}
      >
        Confirm Trump
      </button>
    </div>
  );
}

// ── Raise bid (28 post 2nd deal) ──────────────────────────────

export function RaiseBidPanel({ highBid, mySeat, bidderSeat, partnerSeat, onRaise, onSkip, onThani }) {
  const [raiseValue, setRaiseValue] = useState(Math.max(24, highBid + 1));
  const canRaise = mySeat === bidderSeat || mySeat === partnerSeat;

  if (!canRaise) return (
    <div className="panel p-3 text-center text-cardWhite/60 text-sm">
      Waiting for bidding team to raise or play…
    </div>
  );

  return (
    <div className="panel p-4 space-y-3">
      <p className="text-gold font-display text-center">Raise bid? <span className="text-cardWhite/60 text-sm">(optional)</span></p>
      <p className="text-cardWhite/60 text-xs text-center">Current bid: {highBid} · Must raise to ≥24</p>

      <div className="flex items-center justify-center gap-4">
        <button className="w-10 h-10 rounded-full bg-uiBg border border-uiBorder text-gold text-xl font-bold active:scale-90 transition-transform"
          onClick={() => setRaiseValue(v => Math.max(24, Math.max(highBid + 1, v - 1)))}>−</button>
        <span className="font-display text-3xl text-cardWhite w-12 text-center">{raiseValue}</span>
        <button className="w-10 h-10 rounded-full bg-uiBg border border-uiBorder text-gold text-xl font-bold active:scale-90 transition-transform"
          onClick={() => setRaiseValue(v => Math.min(28, v + 1))}>+</button>
      </div>

      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={onSkip}>Play at {highBid}</button>
        <button className="btn-primary flex-1" onClick={() => onRaise(raiseValue)} disabled={raiseValue <= highBid}>
          Raise to {raiseValue}
        </button>
      </div>
      {mySeat === bidderSeat && (
        <button className="btn-danger w-full" onClick={onThani}>
          🎯 Declare Thani (solo)
        </button>
      )}
    </div>
  );
}

// ── 56 Bidding Panel ──────────────────────────────────────────

export function BiddingPanel56({ gameState, mySeat, onBid, onPass, onDouble, onRedouble }) {
  const [bidPoints, setBidPoints] = useState(Math.max(28, (gameState.highBid?.points ?? 27) + 1));
  const [bidSuit, setBidSuit] = useState('hearts');

  const minPoints = Math.max(28, (gameState.highBid?.points ?? 27) + 1);
  const isMyTurn = gameState.currentBidder === mySeat;
  const canDouble = gameState.highBid?.points >= 28 && !gameState.doubled && gameState.highBidder !== null;
  const canRedouble = gameState.doubled && !gameState.redoubled;

  if (!isMyTurn) {
    return (
      <div className="panel p-4 text-center">
        <p className="text-cardWhite/60 text-sm">
          {`Waiting for seat ${(gameState.currentBidder ?? 0) + 1}…`}
        </p>
        {gameState.highBid?.points && (
          <p className="text-gold text-sm mt-1">
            High bid: <strong>{gameState.highBid.points}</strong> {SUIT_SYMBOLS[gameState.highBid.suit] || '∅'}
            {gameState.doubled && <span className="text-teamRed ml-2">✕2</span>}
            {gameState.redoubled && <span className="text-teamRed ml-2">✕4</span>}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="panel p-4 space-y-3">
      <p className="text-gold font-display text-center text-lg">Your bid</p>

      {/* Points stepper */}
      <div className="flex items-center justify-center gap-4">
        <button className="w-10 h-10 rounded-full bg-uiBg border border-uiBorder text-gold text-xl font-bold active:scale-90 transition-transform"
          onClick={() => setBidPoints(v => Math.max(minPoints, v - 1))}>−</button>
        <span className="font-display text-3xl text-cardWhite w-12 text-center">{bidPoints}</span>
        <button className="w-10 h-10 rounded-full bg-uiBg border border-uiBorder text-gold text-xl font-bold active:scale-90 transition-transform"
          onClick={() => setBidPoints(v => Math.min(56, v + 1))}>+</button>
      </div>

      {/* Suit selector */}
      <div className="grid grid-cols-5 gap-1.5">
        {SUITS.map(suit => (
          <button key={suit}
            className={`py-2 rounded-lg border text-sm transition-colors
              ${bidSuit === suit ? 'bg-gold/20 border-gold' : 'bg-uiBg border-uiBorder'}`}
            onClick={() => setBidSuit(suit)}
          >
            <span className={SUIT_COLORS[suit]}>{SUIT_SYMBOLS[suit]}</span>
          </button>
        ))}
        <button
          className={`py-2 rounded-lg border text-xs transition-colors
            ${bidSuit === 'notrumps' ? 'bg-gold/20 border-gold text-gold' : 'bg-uiBg border-uiBorder text-cardWhite/60'}`}
          onClick={() => setBidSuit('notrumps')}
        >NT</button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={onPass}>Pass</button>
        <button className="btn-primary flex-1" onClick={() => onBid({ points: bidPoints, suit: bidSuit })}>
          Bid {bidPoints} {bidSuit === 'notrumps' ? 'NT' : SUIT_SYMBOLS[bidSuit]}
        </button>
      </div>

      {(canDouble || canRedouble) && (
        <div className="flex gap-2">
          {canDouble && <button className="btn-danger flex-1" onClick={onDouble}>Double ✕2</button>}
          {canRedouble && <button className="btn-danger flex-1" onClick={onRedouble}>Redouble ✕4</button>}
        </div>
      )}
    </div>
  );
}
