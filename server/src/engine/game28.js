// ─────────────────────────────────────────────────────────────
// 28 Game Engine  —  Kerala standard rules
// J(3) > 9(2) > A(1) > 10(1) > K > Q > 8 > 7
// Hidden trump, Cot, Thani, redeal rules
// ─────────────────────────────────────────────────────────────

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANK_ORDER = ['J', '9', 'A', '10', 'K', 'Q', '8', '7']; // index 0 = highest
const POINT_VALUES = { J: 3, '9': 2, A: 1, '10': 1 };
const TOTAL_POINTS = 28;

// ── Deck ──────────────────────────────────────────────────────

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      deck.push({ suit, rank, points: POINT_VALUES[rank] || 0 });
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

// ── Card comparison ───────────────────────────────────────────

function cardRank(card, trumpSuit, suitLed) {
  // Returns a numeric weight: higher = stronger
  // Trumps always beat non-trumps; within a suit, rank by RANK_ORDER index
  const istrump = card.suit === trumpSuit;
  const isLed = card.suit === suitLed;
  const rankIdx = RANK_ORDER.indexOf(card.rank); // lower = stronger, so invert
  const rankWeight = RANK_ORDER.length - rankIdx;

  if (istrump) return 1000 + rankWeight;
  if (isLed) return 100 + rankWeight;
  return 0; // can't win
}

// ── State machine ─────────────────────────────────────────────
// Phases: 'dealing' → 'bidding' → 'bidding2' (post 2nd deal, optional raise)
//         → 'thani_declare' → 'playing' → 'cot_surrender' → 'scoring' → 'done'

function createGame28(seats) {
  // seats: array of { seat, name, team } for 4 players
  const deck = shuffle(buildDeck());

  const state = {
    gameType: '28',
    phase: 'bidding',
    seats,                          // [{seat, name, team}]
    dealer: 0,                      // seat index of dealer
    hands: { 0: [], 1: [], 2: [], 3: [] },
    trumpCard: null,                // { suit, rank, points } — face down
    trumpSuit: null,                // revealed after trump is called
    trumpRevealed: false,
    trumpRevealedOnTrick: null,
    trumpIndicatorSeat: null,       // seat that placed the face-down trump

    bids: {},                       // { seat: number }
    currentBidder: null,
    highBid: 13,                    // so first bidder must bid ≥14
    highBidder: null,
    passCount: 0,
    biddingComplete: false,

    isThani: false,
    thaniDeclared: false,

    currentTrick: [],               // [{seat, card}]
    tricks: [],                     // completed tricks: [{winner, cards, points}]
    trickCount: { 0: 0, 1: 0 },    // tricks per team
    pointsWon: { 0: 0, 1: 0 },
    currentLeader: null,

    // Cot tracking
    isCot: false,
    cotOffered: false,

    // Score (game points, cumulative across hands)
    score: { 0: 0, 1: 0 },
    handNumber: 1,
    lastHandResult: null,
  };

  // Deal first 4 cards counter-clockwise starting from player right of dealer
  const dealOrder = getCounterClockwiseOrder(state.dealer, 4);
  for (let i = 0; i < 4; i++) {
    for (const seat of dealOrder) {
      state.hands[seat].push(deck.pop());
    }
  }
  state._deck = deck; // remaining 16 cards dealt after bidding
  state.currentBidder = dealOrder[0]; // right of dealer bids first

  return state;
}

function getCounterClockwiseOrder(dealer, count) {
  const order = [];
  for (let i = 1; i <= count; i++) {
    order.push((dealer + 4 - i) % 4);
  }
  return order;
}

// ── Bidding ───────────────────────────────────────────────────

function placeBid(state, seat, bid) {
  if (state.phase !== 'bidding') return { error: 'Not in bidding phase' };
  if (seat !== state.currentBidder) return { error: 'Not your turn to bid' };

  const minBid = state.highBid === 13 ? 14 : state.highBid + 1;

  // Special: bidding over partner's bid when opp passed — must bid ≥20
  if (state.highBidder !== null) {
    const partnerSeat = getPartner(seat);
    if (state.highBidder === partnerSeat) {
      const leftOpp = getLeftOpponent(seat);
      if (state.bids[leftOpp] === 'pass' && bid < 20) {
        return { error: 'Must bid at least 20 when raising partner' };
      }
    }
  }

  if (bid < minBid || bid > 28) return { error: `Bid must be between ${minBid} and 28` };

  state.bids[seat] = bid;
  state.highBid = bid;
  state.highBidder = seat;
  state.passCount = 0;
  state.currentBidder = nextCounterClockwise(seat);
  return { ok: true };
}

function passBid(state, seat) {
  if (state.phase !== 'bidding') return { error: 'Not in bidding phase' };
  if (seat !== state.currentBidder) return { error: 'Not your turn' };
  if (state.highBid === 13 && Object.keys(state.bids).length === 0) {
    return { error: 'First player must bid at least 14' };
  }

  state.bids[seat] = 'pass';
  state.passCount++;
  state.currentBidder = nextCounterClockwise(seat);

  // Bidding ends when 3 consecutive passes after a bid
  if (state.passCount >= 3 && state.highBidder !== null) {
    return finalizeBidding(state);
  }
  return { ok: true };
}

function finalizeBidding(state) {
  state.biddingComplete = true;
  state.trumpIndicatorSeat = state.highBidder;
  // Round-1 winner must now choose trump — client sends chooseTrump()
  state.phase = 'choosing_trump';
  return { ok: true, awaitingTrump: true, bidder: state.highBidder };
}

// ── Round 1 trump choice → deal 2nd 4 cards → open ROUND 2 auction ──

function chooseTrump(state, seat, card) {
  // Round-1 winner places a card of their chosen trump suit face-down
  if (state.phase !== 'choosing_trump') return { error: 'Not choosing trump phase' };
  if (seat !== state.highBidder) return { error: 'Only the bidder chooses trump' };

  const handIdx = state.hands[seat].findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (handIdx === -1) return { error: 'Card not in hand' };

  state.trumpCard = state.hands[seat].splice(handIdx, 1)[0];
  state.trumpIndicatorSeat = seat;
  // Trump suit stays hidden (trumpSuit null) until revealed in play

  // Deal the remaining 4 cards to everyone (now 8 each)
  const dealOrder = getCounterClockwiseOrder(state.dealer, 4);
  for (let i = 0; i < 4; i++) {
    for (const s of dealOrder) {
      if (state._deck.length > 0) state.hands[s].push(state._deck.pop());
    }
  }
  // Return the face-down trump card to the chooser's hand (back to 8)
  state.hands[seat].push(state.trumpCard);

  // Open ROUND 2: full auction, starts with the round-1 winner, minimum bid 20.
  state.round1Bid = state.highBid;          // remember round-1 contract as the floor
  state.round1Bidder = state.highBidder;
  state.round2 = true;
  state.round2Acted = [];                    // seats that have acted at least once
  state.passCount = 0;
  state.currentBidder = state.highBidder;     // round-1 winner acts first
  state.phase = 'bidding2';
  return { ok: true, round2: true, firstBidder: state.highBidder };
}

// Minimum legal bid in round 2 for the player to act: at least 20, and above current high
function round2MinBid(state) {
  return Math.max(20, state.highBid + 1);
}

function placeBid2(state, seat, bid) {
  if (state.phase !== 'bidding2') return { error: 'Not in round 2 bidding' };
  if (seat !== state.currentBidder) return { error: 'Not your turn' };
  const min = round2MinBid(state);
  if (bid < min || bid > 28) return { error: `Round 2 bid must be ${min}–28` };

  state.bids[seat] = bid;
  state.highBid = bid;
  state.highBidder = seat;
  state.passCount = 0;
  if (!state.round2Acted.includes(seat)) state.round2Acted.push(seat);
  state.currentBidder = nextCounterClockwise(seat);
  return { ok: true };
}

function passBid2(state, seat) {
  if (state.phase !== 'bidding2') return { error: 'Not in round 2 bidding' };
  if (seat !== state.currentBidder) return { error: 'Not your turn' };

  if (!state.round2Acted.includes(seat)) state.round2Acted.push(seat);
  state.passCount++;
  state.currentBidder = nextCounterClockwise(seat);

  // End once every player has had a turn AND the standing bid has gone
  // unchallenged by the others (3 consecutive passes around the table).
  const everyoneActed = state.round2Acted.length >= 4;
  if (everyoneActed && state.passCount >= 3) {
    return finalizeBidding2(state);
  }
  return { ok: true };
}

function finalizeBidding2(state) {
  // The final high bidder holds the contract and chooses (or changes) trump.
  state.phase = 'choosing_trump2';
  return { ok: true, awaitingTrump2: true, bidder: state.highBidder };
}

// ── Round 2 trump choice (winner may keep or change the trump) ──

function chooseTrump2(state, seat, card, thani = false) {
  if (state.phase !== 'choosing_trump2') return { error: 'Not choosing trump phase' };
  if (seat !== state.highBidder) return { error: 'Only the contract holder chooses trump' };

  const handIdx = state.hands[seat].findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (handIdx === -1) return { error: 'Card not in hand' };

  // The contract holder now holds the hidden trump indicator (kept in hand).
  state.trumpCard = state.hands[seat][handIdx];
  state.trumpIndicatorSeat = seat;
  state.trumpRevealed = false;
  state.trumpSuit = null;

  if (thani) {
    state.isThani = true;
    state.thaniDeclared = true;
    state.currentLeader = state.highBidder; // bidder leads
    state.phase = 'playing';
    revealTrump(state); // trump revealed at start for Thani
    return { ok: true, thani: true };
  }

  return startPlay(state);
}

function declareThani(state, seat) {
  // Optional: the round-2 contract holder declares a solo hand
  if (state.phase !== 'choosing_trump2') return { error: 'Thani is declared at the round 2 trump step' };
  if (seat !== state.highBidder) return { error: 'Only the contract holder can declare Thani' };
  if (!state.trumpCard) return { error: 'Choose a trump first' };
  state.isThani = true;
  state.thaniDeclared = true;
  state.currentLeader = state.highBidder; // bidder leads
  state.phase = 'playing';
  revealTrump(state); // trump is revealed at the start for Thani
  return { ok: true, thani: true };
}

// ── Check redeal conditions ───────────────────────────────────

function checkRedeal(state) {
  // 1. Any player has all 4 Jacks
  for (const seat of [0, 1, 2, 3]) {
    const jacks = state.hands[seat].filter(c => c.rank === 'J');
    if (jacks.length === 4) return { redeal: true, reason: 'all_jacks', seat };
  }
  // 2. Bidding team holds all 8 trumps (only checkable after trump is known)
  if (state.trumpSuit) {
    const bidderTeam = getTeam(state, state.highBidder);
    const teamSeats = getTeamSeats(state, bidderTeam);
    const teamTrumps = teamSeats.flatMap(s => state.hands[s].filter(c => c.suit === state.trumpSuit));
    if (teamTrumps.length === 8) return { redeal: true, reason: 'all_trumps' };
  }
  return { redeal: false };
}

// ── Play phase ────────────────────────────────────────────────

function startPlay(state) {
  state.phase = 'playing';
  // First lead: player to right of dealer
  const dealOrder = getCounterClockwiseOrder(state.dealer, 4);
  state.currentLeader = dealOrder[0];
  return { ok: true };
}

function playCard(state, seat, card) {
  if (state.phase !== 'playing') return { error: 'Not in play phase' };
  if (seat !== getCurrentPlayer(state)) return { error: 'Not your turn' };

  const handIdx = state.hands[seat].findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (handIdx === -1) return { error: 'Card not in hand' };

  const suitLed = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
  const validation = validateCardPlay(state, seat, card, suitLed);
  if (!validation.ok) return { error: validation.error };

  // Remove from hand
  state.hands[seat].splice(handIdx, 1);
  state.currentTrick.push({ seat, card });

  // If this card reveals trump (bidder plays face-down trump card)
  if (!state.trumpRevealed && card.suit === (state.trumpCard?.suit) && card.rank === state.trumpCard?.rank) {
    // Will be revealed when called — see revealTrump()
  }

  if (state.currentTrick.length === 4) {
    return resolveTrick(state);
  }
  return { ok: true };
}

function validateCardPlay(state, seat, card, suitLed) {
  const hand = state.hands[seat];

  if (!suitLed) return { ok: true }; // Leading — any card valid (with bidder restriction)

  const hasSuitLed = hand.some(c => c.suit === suitLed);

  if (hasSuitLed) {
    // Must follow suit
    if (card.suit !== suitLed) return { error: 'Must follow suit' };
    return { ok: true };
  }

  // Can't follow suit
  if (seat === state.trumpIndicatorSeat && !state.trumpRevealed) {
    // Bidder restrictions in phase 1
    if (suitLed === state.trumpCard.suit) {
      // Someone led bidder's trump suit — bidder can't reveal here, must play from hand or discard
      return { ok: true }; // bidder plays from hand (non-trump) or discards
    }
    // Non-trump led, bidder has no cards of that suit
    // Bidder may NOT play a trump from hand — must reveal the face-down trump or discard non-trump
    if (card.suit === state.trumpCard.suit && !(card.suit === state.trumpCard.suit && card.rank === state.trumpCard.rank)) {
      return { error: 'Bidder cannot play trump from hand — reveal your trump indicator card instead' };
    }
  }

  return { ok: true };
}

function requestTrumpReveal(state, seat) {
  // A player who can't follow suit may call for trump reveal
  if (state.trumpRevealed) return { error: 'Trump already revealed' };
  const suitLed = state.currentTrick[0]?.card?.suit;
  if (!suitLed) return { error: 'No suit led yet' };
  const hand = state.hands[seat];
  if (hand.some(c => c.suit === suitLed)) return { error: 'You must follow suit' };

  revealTrump(state);
  state.trumpRevealedOnTrick = state.tricks.length;
  return { ok: true, trumpSuit: state.trumpSuit };
}

function revealTrump(state) {
  state.trumpRevealed = true;
  state.trumpSuit = state.trumpCard.suit;
}

function resolveTrick(state) {
  const trick = state.currentTrick;
  const suitLed = trick[0].card.suit;

  // Determine winner — trump beats non-trump; same suit by rank; if trump not yet revealed
  // any trump cards played before reveal don't count as trump
  let winnerIdx = 0;
  let bestWeight = -1;

  for (let i = 0; i < trick.length; i++) {
    const { card } = trick[i];
    // Cards of trump suit played BEFORE reveal don't count as trump
    const cardIsEffectiveTrump = state.trumpRevealed && card.suit === state.trumpSuit &&
      (state.trumpRevealedOnTrick === null || state.tricks.length >= state.trumpRevealedOnTrick ||
        i >= trick.findIndex(t => t === trick[i])); // simplified: after reveal moment in trick
    const w = cardIsEffectiveTrump
      ? 1000 + (RANK_ORDER.length - RANK_ORDER.indexOf(card.rank))
      : card.suit === suitLed
        ? 100 + (RANK_ORDER.length - RANK_ORDER.indexOf(card.rank))
        : 0;
    if (w > bestWeight) { bestWeight = w; winnerIdx = i; }
  }

  const winner = trick[winnerIdx].seat;
  const trickPoints = trick.reduce((sum, { card }) => sum + card.points, 0);
  const winnerTeam = getTeam(state, winner);

  state.tricks.push({ winner, cards: trick, points: trickPoints });
  state.pointsWon[winnerTeam] += trickPoints;
  state.trickCount[winnerTeam]++;
  state.currentTrick = [];
  state.currentLeader = winner;

  // Check Thani loss (partner won a trick)
  if (state.isThani) {
    const bidderTeam = getTeam(state, state.highBidder);
    const partnerWon = winnerTeam === bidderTeam && winner !== state.highBidder;
    if (partnerWon) {
      return scoreHand(state); // Thani lost immediately
    }
  }

  // Check Cot possibility (one team won all tricks so far)
  const totalTricks = state.tricks.length;
  if (totalTricks === 7 && !state.trumpRevealed) {
    // Bidder must reveal trump before leading trick 8
    revealTrump(state);
  }

  if (totalTricks === 8) {
    // Check Cot before scoring
    const t0 = state.trickCount[0];
    const t1 = state.trickCount[1];
    if (t0 === 8 || t1 === 8) {
      state.isCot = true;
    }
    return scoreHand(state);
  }

  return { ok: true, trickWinner: winner, trickPoints };
}

// ── Cot surrender ──────────────────────────────────────────────

function offerSurrender(state, seat) {
  // Losing team can offer surrender if they see Cot coming
  if (state.phase !== 'playing') return { error: 'Not in play phase' };
  const seatTeam = getTeam(state, seat);
  const bidderTeam = getTeam(state, state.highBidder);
  const winningTeam = seatTeam === bidderTeam ? 1 - bidderTeam : bidderTeam; // losing team is not bidder
  // Determine which team is currently losing
  // Simplified: seat's team offers surrender — winning team must respond
  state.cotOffered = true;
  state.cotOfferFrom = seatTeam;
  state.phase = 'cot_surrender';
  return { ok: true };
}

function respondSurrender(state, seat, accept) {
  if (state.phase !== 'cot_surrender') return { error: 'No surrender offer active' };
  const seatTeam = getTeam(state, seat);
  if (seatTeam === state.cotOfferFrom) return { error: 'Cannot respond to your own offer' };

  if (accept) {
    // Accept surrender — score normally, no double
    state.isCot = false;
    return scoreHand(state);
  } else {
    // Reject — play on, Cot doubles the stakes
    state.phase = 'playing';
    return { ok: true, cotRejected: true };
  }
}

// ── Scoring ────────────────────────────────────────────────────

function scoreHand(state) {
  const bidderTeam = getTeam(state, state.highBidder);
  const defenderTeam = 1 - bidderTeam;
  const bidderPoints = state.pointsWon[bidderTeam];
  const bid = state.highBid;
  const success = bidderPoints >= bid;

  let gamePoints = 0;
  if (bid <= 19) gamePoints = success ? 1 : -2;
  else if (bid <= 24) gamePoints = success ? 2 : -3; // Honours
  else gamePoints = success ? 3 : -4;

  if (state.isThani) {
    // Check if bidder won ALL 8 tricks alone
    const bidderTricks = state.tricks.filter(t => t.winner === state.highBidder).length;
    const thaniSuccess = bidderTricks === 8;
    gamePoints = thaniSuccess ? 4 : -5;
  }

  if (state.isCot) {
    gamePoints *= 2;
  }

  const result = {
    success: state.isThani ? gamePoints > 0 : success,
    bid,
    bidderTeam,
    bidderPoints,
    gamePoints: Math.abs(gamePoints),
    isThani: state.isThani,
    isCot: state.isCot,
  };

  if (success || (state.isThani && gamePoints > 0)) {
    state.score[bidderTeam] += Math.abs(gamePoints);
  } else {
    state.score[defenderTeam] += Math.abs(gamePoints);
  }

  state.lastHandResult = result;
  state.phase = 'scoring';
  return { ok: true, result, score: state.score };
}

function nextHand(state) {
  // Rotate dealer, reset for new hand
  state.dealer = nextCounterClockwise(state.dealer);
  state.handNumber++;

  const deck = shuffle(buildDeck());
  state.hands = { 0: [], 1: [], 2: [], 3: [] };
  state.bids = {};
  state.currentBidder = null;
  state.highBid = 13;
  state.highBidder = null;
  state.passCount = 0;
  state.biddingComplete = false;
  state.trumpCard = null;
  state.trumpSuit = null;
  state.trumpRevealed = false;
  state.trumpRevealedOnTrick = null;
  state.trumpIndicatorSeat = null;
  state.currentTrick = [];
  state.tricks = [];
  state.trickCount = { 0: 0, 1: 0 };
  state.pointsWon = { 0: 0, 1: 0 };
  state.currentLeader = null;
  state.isThani = false;
  state.thaniDeclared = false;
  state.isCot = false;
  state.cotOffered = false;
  state.lastHandResult = null;
  state.round2 = false;
  state.round2Acted = [];
  state.round1Bid = null;
  state.round1Bidder = null;
  state.phase = 'bidding';

  const dealOrder = getCounterClockwiseOrder(state.dealer, 4);
  for (let i = 0; i < 4; i++) {
    for (const seat of dealOrder) {
      state.hands[seat].push(deck.pop());
    }
  }
  state._deck = deck;
  state.currentBidder = dealOrder[0];
  return { ok: true };
}

// ── Helpers ────────────────────────────────────────────────────

function getPartner(seat) {
  return (seat + 2) % 4;
}

function getLeftOpponent(seat) {
  return (seat + 3) % 4;
}

function nextCounterClockwise(seat) {
  return (seat + 3) % 4;
}

function getTeam(state, seat) {
  return state.seats.find(s => s.seat === seat)?.team ?? seat % 2;
}

function getTeamSeats(state, team) {
  return state.seats.filter(s => s.team === team).map(s => s.seat);
}

function getCurrentPlayer(state) {
  if (state.currentTrick.length === 0) return state.currentLeader;
  const lastPlayed = state.currentTrick[state.currentTrick.length - 1].seat;
  return nextCounterClockwise(lastPlayed);
}

// ── Public view (hide other players' hands and face-down trump) ──

function getPlayerView(state, viewerSeat) {
  const view = {
    gameType: '28',
    phase: state.phase,
    hand: state.hands[viewerSeat] || [],
    dealer: state.dealer,
    currentBidder: state.currentBidder,
    highBid: state.highBid,
    highBidder: state.highBidder,
    bids: state.bids,
    // Round 2 auction info for the client
    round2: state.phase === 'bidding2',
    round2MinBid: state.phase === 'bidding2' ? round2MinBid(state) : null,
    trumpRevealed: state.trumpRevealed,
    trumpSuit: state.trumpRevealed ? state.trumpSuit : null,
    // Only bidder knows the trump suit before reveal
    trumpSuitForBidder: viewerSeat === state.trumpIndicatorSeat ? state.trumpCard?.suit : null,
    currentTrick: state.currentTrick,
    tricks: state.tricks,
    trickCount: state.trickCount,
    pointsWon: state.pointsWon,
    currentLeader: state.currentLeader,
    currentPlayer: getCurrentPlayer(state),
    score: state.score,
    handNumber: state.handNumber,
    lastHandResult: state.lastHandResult,
    isThani: state.isThani,
    isCot: state.isCot,
    cotOffered: state.cotOffered,
    seats: state.seats,
    // Hand sizes (not contents) for other players
    handSizes: Object.fromEntries(
      [0, 1, 2, 3].map(s => [s, state.hands[s]?.length || 0])
    ),
  };
  return view;
}

module.exports = {
  createGame28,
  placeBid,
  passBid,
  chooseTrump,
  placeBid2,
  passBid2,
  chooseTrump2,
  round2MinBid,
  declareThani,
  requestTrumpReveal,
  playCard,
  offerSurrender,
  respondSurrender,
  nextHand,
  getPlayerView,
  checkRedeal,
  SUITS,
};
