import { useState } from 'react';

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS = {
  hearts: 'suit-red',
  diamonds: 'suit-red',
  clubs: 'suit-black',
  spades: 'suit-black',
};

export function PlayingCard({ card, selected, playable, onClick, size = 'md', faceDown = false }) {
  // Explicit dimensions + font scales per size for crisp, readable cards
  const SIZES = {
    sm: { w: 46, h: 64, rank: 'text-base', corner: 'text-[10px]', center: 'text-2xl' },
    md: { w: 62, h: 88, rank: 'text-xl', corner: 'text-xs', center: 'text-3xl' },
    lg: { w: 78, h: 110, rank: 'text-3xl', corner: 'text-sm', center: 'text-5xl' },
    xl: { w: 94, h: 132, rank: 'text-4xl', corner: 'text-base', center: 'text-6xl' },
  };
  const sz = SIZES[size] || SIZES.md;

  if (faceDown) {
    return (
      <div className="card flex items-center justify-center"
           style={{ width: sz.w, height: sz.h, background: 'linear-gradient(135deg, #1B4332 25%, #2D6A4F 50%, #1B4332 75%)' }}>
        <div className="text-gold/50" style={{ fontSize: sz.h * 0.4 }}>🂠</div>
      </div>
    );
  }

  const { suit, rank } = card;
  const symbol = SUIT_SYMBOLS[suit];
  const colorClass = SUIT_COLORS[suit];

  return (
    <div
      className={`card relative ${selected ? 'selected' : ''}
                  ${playable ? 'playable' : ''} ${!playable && playable !== undefined ? 'not-playable' : ''}`}
      style={{ width: sz.w, height: sz.h }}
      onClick={playable !== false ? onClick : undefined}
    >
      {/* Top-left rank + suit */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className={`${colorClass} font-card font-bold ${sz.rank}`}>{rank}</span>
        <span className={`${colorClass} ${sz.corner} -mt-0.5`}>{symbol}</span>
      </div>
      {/* Big center suit */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${colorClass} ${sz.center} opacity-90`}>{symbol}</span>
      </div>
      {/* Bottom-right rank + suit (rotated) */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
        <span className={`${colorClass} font-card font-bold ${sz.rank}`}>{rank}</span>
        <span className={`${colorClass} ${sz.corner} -mt-0.5`}>{symbol}</span>
      </div>
    </div>
  );
}

// Fan of cards in hand — horizontal scroll with overlap
export function CardHand({ cards, selectedCard, onCardSelect, onCardPlay, playableCards, isMyTurn }) {
  const [selected, setSelected] = useState(null);

  const handleCardTap = (card, idx) => {
    if (!isMyTurn) return;
    const cardKey = `${card.suit}-${card.rank}-${card.copy ?? 0}`;
    const selectedKey = selected ? `${selected.suit}-${selected.rank}-${selected.copy ?? 0}` : null;

    if (selectedKey === cardKey) {
      // Second tap — play the card
      onCardPlay?.(card);
      setSelected(null);
    } else {
      // First tap — select
      setSelected(card);
      onCardSelect?.(card);
    }
  };

  const isPlayable = (card) => {
    if (!playableCards) return isMyTurn;
    return playableCards.some(c => c.suit === card.suit && c.rank === card.rank && (c.copy ?? 0) === (card.copy ?? 0));
  };

  const isSelected = (card) => {
    if (!selected) return false;
    return selected.suit === card.suit && selected.rank === card.rank && (selected.copy ?? 0) === (card.copy ?? 0);
  };

  if (!cards || cards.length === 0) return (
    <div className="flex items-center justify-center h-24 text-cardWhite/40 text-sm">No cards</div>
  );

  // Overlap cards in a fan using negative margins (normal flow — never collapses).
  // Card at size "lg" is 78px wide. Overlap so the rank+suit corner of each stays visible.
  const CARD_W = 78;
  const step = cards.length > 8 ? 40 : 52; // px of each card visible before the next overlaps it
  const marginLeft = step - CARD_W;        // negative → cards overlap

  return (
    <div className="w-full overflow-x-auto px-4 pt-7 pb-2 safe-bottom">
      <div
        className="flex items-end mx-auto"
        style={{ width: 'max-content', minWidth: 'min-content', minHeight: '120px' }}
      >
        {cards.map((card, idx) => (
          <div
            key={`${card.suit}-${card.rank}-${card.copy ?? idx}`}
            className="flex-shrink-0 transition-all duration-150"
            style={{ marginLeft: idx === 0 ? 0 : `${marginLeft}px`, zIndex: isSelected(card) ? 100 : idx }}
          >
            <PlayingCard
              card={card}
              selected={isSelected(card)}
              playable={isMyTurn ? isPlayable(card) : undefined}
              onClick={() => handleCardTap(card, idx)}
              size="lg"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Small card shown in trick area
export function TrickCard({ card, seat, seatLabel, isWinner }) {
  if (!card) return (
    <div className="w-10 h-14 rounded border border-white/10 bg-white/5 flex items-center justify-center">
      <span className="text-white/20 text-xs">{seatLabel}</span>
    </div>
  );

  return (
    <div className={`relative ${isWinner ? 'ring-2 ring-gold ring-offset-1 ring-offset-felt' : ''}`}>
      <PlayingCard card={card} size="sm" />
      <div className="absolute -bottom-5 left-0 right-0 text-center text-white/60 text-xs truncate">{seatLabel}</div>
    </div>
  );
}
