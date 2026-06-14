import { useState } from 'react';
import { CardHand, TrickCard, PlayingCard } from './Card';
import { BiddingPanel28, BiddingPanel56, TrumpChooser, RaiseBidPanel } from './BiddingPanel';
import { ChatPanel, ScorePanel, HandResultModal } from './ChatPanel';

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const POSITION_LABELS = ['South', 'West', 'North', 'East']; // relative to viewer

export function GameTable({ gameState, myInfo, players, chatMessages, actions, notifications, error, trickAnimation, handResult }) {
  const [showChat, setShowChat] = useState(false);
  const [showScore, setShowScore] = useState(false);

  const mySeat = myInfo?.seat;
  const isMyTurn = gameState?.currentPlayer === mySeat;
  const gameType = gameState?.gameType;

  // Map seats to positions relative to viewer
  // Viewer is always "South" (bottom)
  const getRelativePosition = (seat) => {
    if (seat === mySeat) return 'south';
    const diff = ((seat - mySeat) + (gameState?.playerCount || 4)) % (gameState?.playerCount || 4);
    if (diff === 1 || diff === gameState?.playerCount - 3) return 'east';  // simplified
    if (diff === 2) return 'north';
    return 'west';
  };

  const getPlayerBySeat = (seat) => players.find(p => p.seat === seat);

  // Other players in display order (west, north, east for 4-player)
  const otherSeats = gameState
    ? Array.from({ length: gameState.playerCount || 4 }, (_, i) => i).filter(s => s !== mySeat)
    : [];

  // Current trick cards mapped by position
  const trickBySeat = {};
  gameState?.currentTrick?.forEach(({ seat, card }) => { trickBySeat[seat] = card; });

  // Determine trick winner for highlight
  const trickWinnerSeat = trickAnimation?.winner;

  return (
    <div className="flex flex-col h-full felt-table safe-top relative overflow-hidden">

      {/* ── Notifications ── */}
      <div className="absolute top-14 left-0 right-0 z-50 flex flex-col items-center gap-1 pointer-events-none px-4">
        {notifications.map(n => (
          <div key={n.id} className={`px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm
            ${n.type === 'warning' ? 'bg-yellow-800/80 text-yellow-200' :
              n.type === 'trump' ? 'bg-gold/80 text-uiBg' :
              n.type === 'thani' ? 'bg-purple-800/80 text-purple-200' :
              'bg-uiPanel/80 text-cardWhite'}`}>
            {n.msg}
          </div>
        ))}
        {error && (
          <div className="bg-red-900/90 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}
      </div>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-feltDark/60 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <span className="font-display text-gold font-bold text-lg">{gameType}</span>
          <span className="text-cardWhite/40 text-xs">Hand #{gameState?.handNumber}</span>
        </div>

        {/* Score display */}
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="text-red-300 text-sm font-medium">{gameState?.score?.[0] ?? 0}</span>
            <span className="text-white/40 text-sm">·</span>
            <span className="text-blue-300 text-sm font-medium">{gameState?.score?.[1] ?? 0}</span>
          </div>
          <button onClick={() => setShowScore(true)} className="text-gold/60 text-xs px-2 py-1 rounded border border-gold/20 active:bg-gold/10">
            Scores
          </button>
          <button onClick={() => setShowChat(true)} className="text-gold/60 text-xs px-2 py-1 rounded border border-gold/20 active:bg-gold/10 relative">
            Chat
          </button>
        </div>
      </div>

      {/* ── Trump indicator ── */}
      {gameState?.trumpSuit && (
        <div className="absolute top-12 left-3 z-20">
          <div className="bg-gold/20 border border-gold/40 rounded-lg px-2 py-1 text-xs text-gold">
            Trump: {SUIT_SYMBOLS[gameState.trumpSuit]}
          </div>
        </div>
      )}
      {gameState?.trumpSuitForBidder && !gameState?.trumpSuit && (
        <div className="absolute top-12 left-3 z-20">
          <div className="bg-uiPanel/80 border border-gold/30 rounded-lg px-2 py-1 text-xs text-gold/80">
            Your trump: {SUIT_SYMBOLS[gameState.trumpSuitForBidder]} (hidden)
          </div>
        </div>
      )}

      {/* ── Other players ── */}
      <div className="flex-1 relative">
        {/* North player */}
        {otherSeats.filter(s => {
          const diff = ((s - mySeat) + (gameState?.playerCount || 4)) % (gameState?.playerCount || 4);
          return diff === 2 || (gameState?.playerCount === 6 && diff === 3);
        }).map(seat => (
          <PlayerInfo key={seat} seat={seat} position="top"
            player={getPlayerBySeat(seat)}
            handSize={gameState?.handSizes?.[seat] || 0}
            isActive={gameState?.currentPlayer === seat}
            bid={gameState?.bids?.[seat]}
            trickCard={trickBySeat[seat]}
            isWinner={trickWinnerSeat === seat}
          />
        ))}

        {/* West player */}
        {otherSeats.filter(s => {
          const diff = ((s - mySeat) + (gameState?.playerCount || 4)) % (gameState?.playerCount || 4);
          return diff === (gameState?.playerCount || 4) - 1;
        }).map(seat => (
          <PlayerInfo key={seat} seat={seat} position="left"
            player={getPlayerBySeat(seat)}
            handSize={gameState?.handSizes?.[seat] || 0}
            isActive={gameState?.currentPlayer === seat}
            bid={gameState?.bids?.[seat]}
            trickCard={trickBySeat[seat]}
            isWinner={trickWinnerSeat === seat}
          />
        ))}

        {/* East player */}
        {otherSeats.filter(s => {
          const diff = ((s - mySeat) + (gameState?.playerCount || 4)) % (gameState?.playerCount || 4);
          return diff === 1;
        }).map(seat => (
          <PlayerInfo key={seat} seat={seat} position="right"
            player={getPlayerBySeat(seat)}
            handSize={gameState?.handSizes?.[seat] || 0}
            isActive={gameState?.currentPlayer === seat}
            bid={gameState?.bids?.[seat]}
            trickCard={trickBySeat[seat]}
            isWinner={trickWinnerSeat === seat}
          />
        ))}

        {/* ── Centre trick area ── */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: 160, height: 140 }}>
            {/* North card */}
            {Object.entries(trickBySeat).map(([seat, card]) => {
              const s = Number(seat);
              const diff = ((s - mySeat) + (gameState?.playerCount || 4)) % (gameState?.playerCount || 4);
              const pos = diff === 0 ? 'bottom' : diff === 1 ? 'right' : diff === 2 ? 'top' : 'left';
              const positions = {
                top: 'absolute top-0 left-1/2 -translate-x-1/2',
                bottom: 'absolute bottom-0 left-1/2 -translate-x-1/2',
                left: 'absolute left-0 top-1/2 -translate-y-1/2',
                right: 'absolute right-0 top-1/2 -translate-y-1/2',
              };
              return (
                <div key={seat} className={positions[pos]}>
                  <div className={trickWinnerSeat === s ? 'ring-2 ring-gold rounded-lg' : ''}>
                    <PlayingCard card={card} size="sm" />
                  </div>
                </div>
              );
            })}

            {/* Trick count */}
            <div className="absolute inset-0 flex items-center justify-center">
              {gameState?.trickCount && (
                <div className="text-center">
                  <div className="text-red-300 text-xs">{gameState.trickCount[0]}</div>
                  <div className="text-white/30 text-xs">tricks</div>
                  <div className="text-blue-300 text-xs">{gameState.trickCount[1]}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Panel (bidding / trump select / play prompt) ── */}
      <div className="px-3 pb-2">
        <ActionPanel
          gameState={gameState}
          mySeat={mySeat}
          myInfo={myInfo}
          actions={actions}
          players={players}
        />
      </div>

      {/* ── My hand ── */}
      <div className="pb-1">
        <div className="flex items-center justify-between px-4 mb-1">
          <span className="text-cardWhite/60 text-xs">{myInfo?.name}</span>
          <span className={`text-xs font-medium ${isMyTurn ? 'text-gold animate-pulse' : 'text-white/30'}`}>
            {isMyTurn ? '▶ Your turn' : 'Your hand'}
          </span>
        </div>
        {gameState?.hand && (
          <CardHand
            cards={gameState.hand}
            isMyTurn={isMyTurn && gameState.phase === 'playing'}
            onCardPlay={(card) => actions.playCard(card)}
          />
        )}
      </div>

      {/* ── Trump reveal button ── */}
      {gameState?.phase === 'playing' && !gameState?.trumpRevealed && gameType === '28' && isMyTurn && (
        <div className="px-3 pb-2">
          <button className="btn-secondary w-full text-sm" onClick={actions.requestTrumpReveal}>
            🃏 Call trump reveal
          </button>
        </div>
      )}

      {/* ── Surrender button ── */}
      {gameState?.phase === 'playing' && (
        <div className="px-3 pb-1">
          <button className="text-white/30 text-xs underline active:text-white/60"
            onClick={actions.offerSurrender}>
            Offer surrender (Cot)
          </button>
        </div>
      )}

      {/* ── Surrender response ── */}
      {gameState?.phase === 'cot_surrender' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="panel p-6 space-y-4 max-w-xs w-full">
            <p className="text-gold font-display text-center text-xl">Surrender offered</p>
            <p className="text-cardWhite/70 text-center text-sm">Accept = normal score. Reject = double-or-nothing</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => actions.respondSurrender(false)}>Reject</button>
              <button className="btn-primary flex-1" onClick={() => actions.respondSurrender(true)}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      {showChat && (
        <ChatPanel messages={chatMessages} onSend={actions.sendChat} onClose={() => setShowChat(false)} />
      )}
      {showScore && (
        <ScorePanel gameState={gameState} players={players} onClose={() => setShowScore(false)} />
      )}
      {handResult && (
        <HandResultModal result={handResult.result} score={handResult.score} onNext={actions.nextHand} />
      )}
    </div>
  );
}

// ── Player Info Badge ─────────────────────────────────────────

function PlayerInfo({ seat, player, position, handSize, isActive, bid, trickCard, isWinner }) {
  const positions = {
    top: 'absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center',
    left: 'absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center',
    right: 'absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center',
  };

  const team = player?.team;

  return (
    <div className={positions[position]}>
      <div className={`rounded-xl px-2 py-1 text-xs font-medium border
        ${isActive ? 'animate-pulse-glow border-gold bg-gold/10 text-gold' :
          team === 0 ? 'border-teamRed/30 bg-teamRed/10 text-red-300' :
          'border-teamBlue/30 bg-teamBlue/10 text-blue-300'}
        ${!player?.connected ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-1">
          {!player?.connected && <span>🤖</span>}
          <span className="truncate max-w-[72px]">{player?.name || `P${seat + 1}`}</span>
        </div>
        <div className="text-white/40 text-center">{handSize} cards</div>
        {bid !== undefined && (
          <div className="text-center mt-0.5">
            {bid === 'pass' ? <span className="text-white/40">Pass</span> :
              typeof bid === 'object' ? <span className="text-gold">{bid.points}</span> :
              <span className="text-gold">{bid}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Action Panel ──────────────────────────────────────────────

function ActionPanel({ gameState, mySeat, actions, players }) {
  if (!gameState) return null;
  const { phase, gameType } = gameState;
  const isMyTurn = gameState.currentPlayer === mySeat || gameState.currentBidder === mySeat;

  if (phase === 'bidding' && gameType === '28') {
    return <BiddingPanel28 gameState={gameState} mySeat={mySeat}
      onBid={actions.placeBid} onPass={actions.placeBid.bind(null, 'pass')} />;
  }

  if (phase === 'choosing_trump' && gameState.highBidder === mySeat) {
    return <TrumpChooser hand={gameState.hand} onChoose={actions.chooseTrump} />;
  }

  if (phase === 'choosing_trump') {
    return <div className="panel p-3 text-center text-cardWhite/60 text-sm">
      Waiting for bidder to choose trump…
    </div>;
  }

  if (phase === 'bidding2') {
    const partnerSeat = (gameState.highBidder + 2) % 4;
    return <RaiseBidPanel
      highBid={gameState.highBid}
      mySeat={mySeat}
      bidderSeat={gameState.highBidder}
      partnerSeat={partnerSeat}
      onRaise={actions.raiseBid}
      onSkip={actions.skipRaise}
      onThani={actions.declareThani}
    />;
  }

  if (phase === 'bidding' && gameType === '56') {
    return <BiddingPanel56 gameState={gameState} mySeat={mySeat}
      onBid={actions.placeBid} onPass={actions.placeBid.bind(null, 'pass')}
      onDouble={actions.placeBid.bind(null, 'double')}
      onRedouble={actions.placeBid.bind(null, 'redouble')} />;
  }

  if (phase === 'playing') {
    if (gameState.currentPlayer === mySeat) {
      return (
        <div className="panel px-4 py-2 text-center text-gold text-sm font-medium animate-pulse-glow">
          ▶ Tap a card to select, tap again to play
        </div>
      );
    }
    return (
      <div className="panel px-4 py-2 text-center text-cardWhite/50 text-sm">
        Waiting for seat {(gameState.currentPlayer ?? 0) + 1}…
      </div>
    );
  }

  if (phase === 'scoring') {
    return null; // Handled by HandResultModal
  }

  return null;
}
