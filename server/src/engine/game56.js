// ─────────────────────────────────────────────────────────────
// 56 Game Engine  —  Kerala standard rules
// Expanded form of 28 with double pack, open trump, 4/6/8 players
// Doubles, redoubles, surrender/Cot
// ─────────────────────────────────────────────────────────────

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANK_ORDER_4_6 = ['J', '9', 'A', '10', 'K', 'Q'];
const RANK_ORDER_8   = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const POINT_VALUES   = { J: 3, '9': 2, A: 1, '10': 1 };
const TOTAL_POINTS   = 56;

// ── Deck ──────────────────────────────────────────────────────

function buildDeck56(playerCount) {
  const rankOrder = playerCount === 8 ? RANK_ORDER_8 : RANK_ORDER_4_6;
  const deck = [];
  // Double pack
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of rankOrder) {
        deck.push({ suit, rank, points: POINT_VALUES[rank] || 0, copy });
      }
    }
  }
  return deck;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── State machine ─────────────────────────────────────────────
// Phases: 'bidding' → 'playing' → 'cot_surrender' → 'scoring' → 'done'

function createGame56(seats, playerCount) {
  const rankOrder = playerCount === 8 ? RANK_ORDER_8 : RANK_ORDER_4_6;
  const deck = shuffle(buildDeck56(playerCount));
  const cardsPerPlayer = 8; // always 8

  // Build seat list: alternating teams
  // seats: [{seat (0..N-1), name, team (0|1)}]

  const hands = {};
  for (const s of seats) hands[s.seat] = [];

  // Deal all cards in batches of 4, counter-clockwise from right of dealer
  const dealer = 0;
  const dealOrder = getCounterClockwiseOrder56(dealer, playerCount);
  let deckIdx = 0;
  while (deckIdx < deck.length) {
    for (const seat of dealOrder) {
      if (deckIdx < deck.length && hands[seat].length < cardsPerPlayer) {
        hands[seat].push(deck[deckIdx++]);
      }
    }
  }

  // Scoring: start each team with 12 "tables" (points); team runs out = loses
  // We'll track as a running integer score for mobile simplicity
  const state = {
    gameType: '56',
    phase: 'bidding',
    playerCount,
    rankOrder,
    seats,
    dealer,
    hands,

    bids: {},           // { seat: { points: number, suit: string|'notrumps', style: string } | 'pass' | 'double' | 'redouble' }
    currentBidder: null,
    highBid: { points: 27, suit: null }, // so first bid must be ≥28
    highBidder: null,
    passCount: 0,
    doubled: false,
    redoubled: false,
    biddingComplete: false,
    lastBidType: null, // 'bid'|'double'|'redouble'

    trumpSuit: null,   // known from start once bid finalized
    noTrumps: false,

    currentTrick: [],
    tricks: [],
    trickCount: { 0: 0, 1: 0 },
    pointsWon: { 0: 0, 1: 0 },
    currentLeader: null,

    // Cot / surrender
    isCot: false,
    cotOffered: false,
    cotOfferFrom: null,

    // Running score (simple points, not tables)
    score: { 0: 0, 1: 0 },
    handNumber: 1,
    lastHandResult: null,
  };

  // First bidder: right of dealer
  state.currentBidder = dealOrder[0];

  return state;
}

function getCounterClockwiseOrder56(dealer, playerCount) {
  const order = [];
  for (let i = 1; i <= playerCount; i++) {
    order.push((dealer + playerCount - i) % playerCount);
  }
  return order;
}

// ── Bidding ───────────────────────────────────────────────────

function placeBid56(state, seat, points, suit) {
  if (state.phase !== 'bidding') return { error: 'Not in bidding phase' };
  if (seat !== state.currentBidder) return { error: 'Not your turn' };
  if (points < 28 || points > 56) return { error: 'Bid must be 28–56' };
  if (points <= state.highBid.points) return { error: `Must bid more than ${state.highBid.points}` };

  const validSuits = [...SUITS, 'notrumps'];
  if (!validSuits.includes(suit)) return { error: 'Invalid suit' };

  state.bids[seat] = { points, suit };
  state.highBid = { points, suit };
  state.highBidder = seat;
  state.passCount = 0;
  state.doubled = false;
  state.redoubled = false;
  state.lastBidType = 'bid';
  state.currentBidder = nextCCW56(seat, state.playerCount);
  return { ok: true };
}

function passBid56(state, seat) {
  if (state.phase !== 'bidding') return { error: 'Not in bidding phase' };
  if (seat !== state.currentBidder) return { error: 'Not your turn' };

  state.bids[seat] = 'pass';
  state.passCount++;
  state.currentBidder = nextCCW56(seat, state.playerCount);

  if (state.redoubled) return finalizeBidding56(state);
  if (state.passCount >= state.playerCount - 1 && state.highBidder !== null) {
    return finalizeBidding56(state);
  }
  // If all pass initially — play no-trumps, scored as if opponents bid 28
  if (state.passCount >= state.playerCount) {
    state.highBid = { points: 28, suit: 'notrumps' };
    state.highBidder = null; // "dealer's opponents" notionally
    return finalizeBidding56(state);
  }
  return { ok: true };
}

function doubleBid56(state, seat) {
  if (state.phase !== 'bidding') return { error: 'Not in bidding phase' };
  if (seat !== state.currentBidder) return { error: 'Not your turn' };
  if (state.highBidder === null) return { error: 'Nothing to double' };
  if (getTeam56(state, seat) === getTeam56(state, state.highBidder)) return { error: 'Cannot double partner' };
  if (state.doubled) return { error: 'Already doubled' };

  state.doubled = true;
  state.bids[seat] = 'double';
  state.passCount = 0;
  state.lastBidType = 'double';
  state.currentBidder = nextCCW56(seat, state.playerCount);
  return { ok: true };
}

function redoubleBid56(state, seat) {
  if (state.phase !== 'bidding') return { error: 'Not in bidding phase' };
  if (seat !== state.currentBidder) return { error: 'Not your turn' };
  if (!state.doubled) return { error: 'No double to redouble' };
  if (getTeam56(state, seat) !== getTeam56(state, state.highBidder)) return { error: 'Only bidding team can redouble' };

  state.redoubled = true;
  state.bids[seat] = 'redouble';
  state.lastBidType = 'redouble';
  return finalizeBidding56(state);
}

function finalizeBidding56(state) {
  state.biddingComplete = true;
  state.trumpSuit = state.highBid.suit === 'notrumps' ? null : state.highBid.suit;
  state.noTrumps = state.highBid.suit === 'notrumps';

  // First player to right of dealer leads
  const dealOrder = getCounterClockwiseOrder56(state.dealer, state.playerCount);
  state.currentLeader = dealOrder[0];
  state.phase = 'playing';
  return { ok: true, biddingDone: true };
}

// ── Play ──────────────────────────────────────────────────────

function playCard56(state, seat, card) {
  if (state.phase !== 'playing') return { error: 'Not in play phase' };
  if (seat !== getCurrentPlayer56(state)) return { error: 'Not your turn' };

  const handIdx = state.hands[seat].findIndex(
    c => c.suit === card.suit && c.rank === card.rank && c.copy === card.copy
  );
  if (handIdx === -1) return { error: 'Card not in hand' };

  const suitLed = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;

  if (suitLed) {
    const canFollow = state.hands[seat].some(c => c.suit === suitLed);
    if (canFollow && card.suit !== suitLed) return { error: 'Must follow suit' };
  }

  state.hands[seat].splice(handIdx, 1);
  state.currentTrick.push({ seat, card });

  if (state.currentTrick.length === state.playerCount) {
    return resolveTrick56(state);
  }
  return { ok: true };
}

function resolveTrick56(state) {
  const trick = state.currentTrick;
  const suitLed = trick[0].card.suit;
  const rankOrder = state.rankOrder;

  let winnerIdx = 0;
  let bestWeight = -1;

  for (let i = 0; i < trick.length; i++) {
    const { card } = trick[i];
    const isTrump = !state.noTrumps && card.suit === state.trumpSuit;
    const isLed = card.suit === suitLed;
    const rankWeight = rankOrder.length - rankOrder.indexOf(card.rank);

    let w = 0;
    if (isTrump) w = 1000 + rankWeight + (i === 0 ? 0 : 0.5); // first played of equal rank wins
    else if (isLed) w = 100 + rankWeight;
    // Equal cards: first played wins (lower i = played earlier = higher effective weight)
    w -= i * 0.001; // tiny tiebreak: first played wins

    if (w > bestWeight) { bestWeight = w; winnerIdx = i; }
  }

  const winner = trick[winnerIdx].seat;
  const trickPoints = trick.reduce((sum, { card }) => sum + card.points, 0);
  const winnerTeam = getTeam56(state, winner);

  state.tricks.push({ winner, cards: trick, points: trickPoints });
  state.pointsWon[winnerTeam] += trickPoints;
  state.trickCount[winnerTeam]++;
  state.currentTrick = [];
  state.currentLeader = winner;

  const totalTricks = state.tricks.length;
  const maxTricks = 8; // each player has 8 cards

  // Check for Cot offer opportunity
  const t0 = state.trickCount[0];
  const t1 = state.trickCount[1];
  if ((t0 === 0 || t1 === 0) && totalTricks >= 4 && totalTricks < maxTricks) {
    // One team is sweeping — losing team could offer surrender
  }

  if (totalTricks === maxTricks) {
    if (t0 === maxTricks || t1 === maxTricks) state.isCot = true;
    return scoreHand56(state);
  }
  return { ok: true, trickWinner: winner, trickPoints };
}

// ── Surrender ─────────────────────────────────────────────────

function offerSurrender56(state, seat) {
  if (state.phase !== 'playing') return { error: 'Not in play phase' };
  const seatTeam = getTeam56(state, seat);
  state.cotOffered = true;
  state.cotOfferFrom = seatTeam;
  state.phase = 'cot_surrender';
  return { ok: true };
}

function respondSurrender56(state, seat, accept) {
  if (state.phase !== 'cot_surrender') return { error: 'No surrender offer active' };
  const seatTeam = getTeam56(state, seat);
  if (seatTeam === state.cotOfferFrom) return { error: 'Cannot respond to own offer' };

  if (accept) {
    state.isCot = false; // No double
    return scoreHand56(state);
  } else {
    state.phase = 'playing';
    return { ok: true, cotRejected: true };
  }
}

// ── Scoring ────────────────────────────────────────────────────

function scoreHand56(state) {
  const bidderTeam = state.highBidder !== null ? getTeam56(state, state.highBidder) : 1; // if all passed, dealer's opponents bid 28
  const defenderTeam = 1 - bidderTeam;
  const bid = state.highBid.points;
  const bidderPoints = state.pointsWon[bidderTeam];
  const success = bidderPoints >= bid;

  let tableBase = 0;
  if (bid <= 39) tableBase = 1;
  else if (bid <= 47) tableBase = 2; // Honours
  else if (bid <= 55) tableBase = 3;
  else tableBase = 4; // 56

  let multiplier = 1;
  if (state.redoubled) multiplier = 4;
  else if (state.doubled) multiplier = 2;

  if (state.isCot) multiplier *= 2;

  const winTables = tableBase * multiplier;
  const loseTables = (tableBase + 1) * multiplier;

  const result = {
    success,
    bid,
    bidderTeam,
    bidderPoints,
    winTables,
    loseTables,
    isDoubled: state.doubled,
    isRedoubled: state.redoubled,
    isCot: state.isCot,
  };

  if (success) {
    state.score[bidderTeam] += winTables;
  } else {
    state.score[bidderTeam] -= loseTables; // bidder loses points
    state.score[defenderTeam] += loseTables;
  }

  state.lastHandResult = result;
  state.phase = 'scoring';
  return { ok: true, result, score: state.score };
}

function nextHand56(state) {
  state.dealer = (state.dealer + 1) % state.playerCount;
  state.handNumber++;

  const deck = shuffle(buildDeck56(state.playerCount));
  const hands = {};
  for (const s of state.seats) hands[s.seat] = [];

  const dealOrder = getCounterClockwiseOrder56(state.dealer, state.playerCount);
  let deckIdx = 0;
  while (deckIdx < deck.length) {
    for (const seat of dealOrder) {
      if (deckIdx < deck.length && hands[seat].length < 8) {
        hands[seat].push(deck[deckIdx++]);
      }
    }
  }

  state.hands = hands;
  state.bids = {};
  state.currentBidder = dealOrder[0];
  state.highBid = { points: 27, suit: null };
  state.highBidder = null;
  state.passCount = 0;
  state.doubled = false;
  state.redoubled = false;
  state.biddingComplete = false;
  state.lastBidType = null;
  state.trumpSuit = null;
  state.noTrumps = false;
  state.currentTrick = [];
  state.tricks = [];
  state.trickCount = { 0: 0, 1: 0 };
  state.pointsWon = { 0: 0, 1: 0 };
  state.currentLeader = null;
  state.isCot = false;
  state.cotOffered = false;
  state.cotOfferFrom = null;
  state.lastHandResult = null;
  state.phase = 'bidding';
  return { ok: true };
}

// ── Helpers ────────────────────────────────────────────────────

function nextCCW56(seat, playerCount) {
  return (seat + playerCount - 1) % playerCount;
}

function getTeam56(state, seat) {
  return state.seats.find(s => s.seat === seat)?.team ?? seat % 2;
}

function getCurrentPlayer56(state) {
  if (state.currentTrick.length === 0) return state.currentLeader;
  const lastPlayed = state.currentTrick[state.currentTrick.length - 1].seat;
  return nextCCW56(lastPlayed, state.playerCount);
}

function getPlayerView56(state, viewerSeat) {
  return {
    gameType: '56',
    phase: state.phase,
    playerCount: state.playerCount,
    hand: state.hands[viewerSeat] || [],
    dealer: state.dealer,
    currentBidder: state.currentBidder,
    highBid: state.highBid,
    highBidder: state.highBidder,
    bids: state.bids,
    doubled: state.doubled,
    redoubled: state.redoubled,
    trumpSuit: state.trumpSuit,
    noTrumps: state.noTrumps,
    currentTrick: state.currentTrick,
    tricks: state.tricks,
    trickCount: state.trickCount,
    pointsWon: state.pointsWon,
    currentLeader: state.currentLeader,
    currentPlayer: getCurrentPlayer56(state),
    score: state.score,
    handNumber: state.handNumber,
    lastHandResult: state.lastHandResult,
    isCot: state.isCot,
    cotOffered: state.cotOffered,
    seats: state.seats,
    handSizes: Object.fromEntries(
      state.seats.map(s => [s.seat, state.hands[s.seat]?.length || 0])
    ),
  };
}

module.exports = {
  createGame56,
  placeBid56,
  passBid56,
  doubleBid56,
  redoubleBid56,
  playCard56,
  offerSurrender56,
  respondSurrender56,
  nextHand56,
  getPlayerView56,
  SUITS,
};
