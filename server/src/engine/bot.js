// ─────────────────────────────────────────────────────────────
// Bot AI — conservative rule-based player for 28 and 56
// Used when a player disconnects during a game
// ─────────────────────────────────────────────────────────────

const RANK_ORDER_28 = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const RANK_ORDER_56_4_6 = ['J', '9', 'A', '10', 'K', 'Q'];
const RANK_ORDER_56_8 = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const POINT_VALUES = { J: 3, '9': 2, A: 1, '10': 1 };

// ── Bot bidding ───────────────────────────────────────────────

function botBid28(hand, highBid) {
  const points = hand.reduce((s, c) => s + (POINT_VALUES[c.rank] || 0), 0);
  const minBid = Math.max(14, highBid + 1);
  // Simple heuristic: bid based on point strength
  let botBid = 14 + Math.floor(points / 2);
  if (botBid < minBid) return 'pass';
  if (botBid > 28) botBid = 28;
  return botBid;
}

function botChooseTrump28(hand) {
  // Pick suit with most points, prefer suits with Jacks
  const suitScores = {};
  for (const card of hand) {
    if (!suitScores[card.suit]) suitScores[card.suit] = 0;
    suitScores[card.suit] += POINT_VALUES[card.rank] || 0;
    if (card.rank === 'J') suitScores[card.suit] += 5; // bonus for Jack
  }
  const best = Object.entries(suitScores).sort((a, b) => b[1] - a[1])[0];
  const trumpSuit = best[0];
  // Return the lowest-value card of that suit to use as the face-down indicator
  const trumpCards = hand.filter(c => c.suit === trumpSuit)
    .sort((a, b) => rankWeight(a.rank, RANK_ORDER_28) - rankWeight(b.rank, RANK_ORDER_28));
  return trumpCards[trumpCards.length - 1]; // weakest trump as indicator
}

function botBid56(hand, highBid, playerCount) {
  const rankOrder = playerCount === 8 ? RANK_ORDER_56_8 : RANK_ORDER_56_4_6;
  const points = hand.reduce((s, c) => s + (POINT_VALUES[c.rank] || 0), 0);
  const minPoints = Math.max(28, highBid.points + 1);

  // Simple strength estimation
  const strength = points;
  if (strength < 8) return 'pass';

  const bestSuit = getBestSuit(hand);
  const bidPoints = Math.min(56, Math.max(minPoints, 28 + Math.floor(strength / 2)));
  if (bidPoints > highBid.points) return { points: bidPoints, suit: bestSuit };
  return 'pass';
}

// ── Bot card play ─────────────────────────────────────────────

function botPlayCard28(state, seat) {
  const hand = state.hands[seat];
  const suitLed = state.currentTrick[0]?.card?.suit;
  const trumpSuit = state.trumpRevealed ? state.trumpSuit : null;
  const rankOrder = RANK_ORDER_28;

  if (!suitLed) {
    // Bot is leading — lead highest non-trump value card
    return leadCard(hand, trumpSuit, rankOrder);
  }

  const followCards = hand.filter(c => c.suit === suitLed);
  if (followCards.length > 0) {
    return playFollowSuit(followCards, state.currentTrick, rankOrder);
  }

  // Can't follow suit
  if (trumpSuit) {
    const trumpCards = hand.filter(c => c.suit === trumpSuit);
    if (trumpCards.length > 0) {
      // Trump in if it might win
      return trumpCards.sort((a, b) => rankWeight(a.rank, rankOrder) - rankWeight(b.rank, rankOrder))[0];
    }
  }

  // Discard lowest value card
  return discardLowest(hand, rankOrder);
}

function botPlayCard56(state, seat) {
  const hand = state.hands[seat];
  const suitLed = state.currentTrick[0]?.card?.suit;
  const trumpSuit = state.trumpSuit;
  const rankOrder = state.rankOrder;

  if (!suitLed) return leadCard(hand, trumpSuit, rankOrder);

  const followCards = hand.filter(c => c.suit === suitLed);
  if (followCards.length > 0) return playFollowSuit(followCards, state.currentTrick, rankOrder);

  if (trumpSuit) {
    const trumpCards = hand.filter(c => c.suit === trumpSuit);
    if (trumpCards.length > 0) {
      return trumpCards.sort((a, b) => rankWeight(a.rank, rankOrder) - rankWeight(b.rank, rankOrder))[0];
    }
  }

  return discardLowest(hand, rankOrder);
}

// ── Card selection helpers ────────────────────────────────────

function leadCard(hand, trumpSuit, rankOrder) {
  // Lead highest-value non-trump, or trump if only trumps remain
  const nonTrumps = trumpSuit ? hand.filter(c => c.suit !== trumpSuit) : hand;
  const pool = nonTrumps.length > 0 ? nonTrumps : hand;
  return pool.sort((a, b) => {
    const pdiff = (POINT_VALUES[b.rank] || 0) - (POINT_VALUES[a.rank] || 0);
    if (pdiff !== 0) return pdiff;
    return rankWeight(a.rank, rankOrder) - rankWeight(b.rank, rankOrder);
  })[0];
}

function playFollowSuit(cards, trick, rankOrder) {
  // Try to win if partner isn't already winning
  const currentWinnerCard = trick.reduce((best, entry) => {
    const w = rankWeight(entry.card.rank, rankOrder);
    return w < rankWeight(best.card.rank, rankOrder) ? entry : best;
  }, trick[0]);

  const canWin = cards.some(c => rankWeight(c.rank, rankOrder) < rankWeight(currentWinnerCard.card.rank, rankOrder));
  if (canWin) {
    // Play lowest winning card
    return cards
      .filter(c => rankWeight(c.rank, rankOrder) < rankWeight(currentWinnerCard.card.rank, rankOrder))
      .sort((a, b) => rankWeight(a.rank, rankOrder) - rankWeight(b.rank, rankOrder))
      .pop(); // highest of the winners (safest win)
  }
  // Can't win — play lowest value card
  return discardLowest(cards, rankOrder);
}

function discardLowest(hand, rankOrder) {
  return hand.sort((a, b) => {
    const pdiff = (POINT_VALUES[a.rank] || 0) - (POINT_VALUES[b.rank] || 0);
    if (pdiff !== 0) return pdiff;
    return rankWeight(b.rank, rankOrder) - rankWeight(a.rank, rankOrder);
  })[0];
}

function rankWeight(rank, rankOrder) {
  return rankOrder.indexOf(rank); // lower index = stronger
}

function getBestSuit(hand) {
  const suitScores = {};
  for (const card of hand) {
    if (!suitScores[card.suit]) suitScores[card.suit] = 0;
    suitScores[card.suit] += POINT_VALUES[card.rank] || 0;
    if (card.rank === 'J') suitScores[card.suit] += 5;
  }
  return Object.entries(suitScores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'hearts';
}

module.exports = {
  botBid28,
  botChooseTrump28,
  botBid56,
  botPlayCard28,
  botPlayCard56,
};
