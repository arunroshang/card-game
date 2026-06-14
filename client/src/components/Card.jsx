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
  const sizeClasses = {
    sm: 'w-10 h-14 text-xs',
    md: 'w-14 h-20 text-sm',
    lg: 'w-16 h-24 text-base',
    xl: 'w-20 h-28 text-lg',
  };

  if (faceDown) {
    return (
      <div className={`card ${sizeClasses[size]} flex items-center justify-center`}
           style={{ background: 'linear-gradient(135deg, #1B4332 25%, #2D6A4F 50%, #1B4332 75%)' }}>
        <div className="text-gold/40 text-2xl">🂠</div>
      </div>
    );
  }

  const { suit, rank } = card;
  const symbol = SUIT_SYMBOLS[suit];
  const colorClass = SUIT_COLORS[suit];

  return (
    <div
      className={`card ${sizeClasses[size]} ${selected ? 'selected' : ''} 
                  ${playable ? 'playable' : ''} ${!playable && playable !== undefined ? 'not-playable' : ''}
                  flex flex-col p-1`}
      onClick={playable !== false ? onClick : undefined}
    >
      <div className={`${colorClass} font-card font-bold leading-none`}>{rank}</div>
      <div className={`${colorClass} leading-none text-lg`}>{symbol}</div>
      <div className="flex-1" />
      <div className={`${colorClass} font-card font-bold leading-none self-end rotate-180`}>{rank}</div>
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
  // Card at size "lg" is 64px wide (w-16). Overlap so a sliver of each card shows.
  const CARD_W = 64;
  const step = cards.length > 8 ? 32 : 44; // px of each card visible before the next overlaps it
  const marginLeft = step - CARD_W;        // negative → cards overlap

  return (
    <div className="w-full overflow-x-auto px-4 pt-6 pb-2 safe-bottom">
      <div
        className="flex items-end mx-auto"
        style={{ width: 'max-content', minWidth: 'min-content', minHeight: '104px' }}
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
