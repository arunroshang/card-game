// ─────────────────────────────────────────────────────────────
// Socket.IO Game Coordinator
// All real-time events: join, bid, play, chat, disconnect, bot
// ─────────────────────────────────────────────────────────────

const {
  createGame28, placeBid, passBid, chooseTrump,
  raiseBid, skipRaise, declareThani,
  requestTrumpReveal, playCard, offerSurrender,
  respondSurrender, nextHand, getPlayerView, checkRedeal,
} = require('../engine/game28');

const {
  createGame56, placeBid56, passBid56, doubleBid56,
  redoubleBid56, playCard56, offerSurrender56,
  respondSurrender56, nextHand56, getPlayerView56,
} = require('../engine/game56');

const {
  botBid28, botChooseTrump28, botBid56,
  botPlayCard28, botPlayCard56,
} = require('../engine/bot');

const roomManager = require('../routes/rooms');

// In-memory game states (keyed by roomId)
const gameStates = {};
// Disconnect timers
const disconnectTimers = {};
// Session IDs
const sessionIds = {};

const BOT_DELAY_MS = 1200; // realistic bot thinking time
const DISCONNECT_GRACE_MS = 30000;

module.exports = function setupSocket(io) {

  io.on('connection', (socket) => {

    // ── Join Room ──────────────────────────────────────────────
    socket.on('join_room', async ({ roomId, pin, name, seat }) => {
      try {
        const { valid, room, error } = await roomManager.validatePin(roomId, pin);
        if (!valid) return socket.emit('error', { message: error });

        // Check seat available
        const players = await roomManager.getPlayers(roomId);
        const takenSeats = players.filter(p => !p.is_bot).map(p => p.seat);

        // If player is rejoining their old seat
        const existingPlayer = players.find(p => p.seat === seat && p.name === name);

        if (!existingPlayer && takenSeats.includes(seat)) {
          return socket.emit('error', { message: 'Seat already taken' });
        }

        const team = getTeamForSeat(seat, room.player_count);
        await roomManager.addPlayer(roomId, name, seat, team, socket.id);
        await roomManager.markPlayerConnected(roomId, seat, socket.id);

        socket.join(roomId);
        socket.data = { roomId, name, seat, team };

        // Cancel any pending disconnect bot for this seat
        const timerKey = `${roomId}:${seat}`;
        if (disconnectTimers[timerKey]) {
          clearTimeout(disconnectTimers[timerKey]);
          delete disconnectTimers[timerKey];
        }

        const updatedPlayers = await roomManager.getPlayers(roomId);
        const chatHistory = await roomManager.getChatHistory(roomId);

        socket.emit('joined', {
          seat,
          team,
          roomId,
          gameType: room.game_type,
          playerCount: room.player_count,
          players: updatedPlayers,
          chatHistory,
        });

        io.to(roomId).emit('player_joined', {
          players: updatedPlayers,
          name,
          seat,
        });

        // If game already in progress, send current state
        if (gameStates[roomId]) {
          const state = gameStates[roomId];
          const viewFn = room.game_type === '28' ? getPlayerView : getPlayerView56;
          socket.emit('game_state', viewFn(state, seat));
        }

      } catch (err) {
        console.error('join_room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ── Create Room ────────────────────────────────────────────
    socket.on('create_room', async ({ gameType, playerCount }) => {
      try {
        if (!['28', '56'].includes(gameType)) return socket.emit('error', { message: 'Invalid game type' });
        const validCounts = gameType === '28' ? [4] : [4, 6, 8];
        if (!validCounts.includes(Number(playerCount))) {
          return socket.emit('error', { message: `Invalid player count for ${gameType}` });
        }

        const { roomId, pin } = await roomManager.createRoom(gameType, Number(playerCount));
        socket.emit('room_created', { roomId, pin, gameType, playerCount });
      } catch (err) {
        console.error('create_room error:', err);
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    // ── Start Game ─────────────────────────────────────────────
    socket.on('start_game', async ({ roomId }) => {
      try {
        const room = await roomManager.getRoom(roomId);
        if (!room) return socket.emit('error', { message: 'Room not found' });

        const players = await roomManager.getPlayers(roomId);
        const humanCount = players.filter(p => !p.is_bot && p.connected).length;

        if (humanCount < room.player_count) {
          return socket.emit('error', { message: `Need ${room.player_count} players to start` });
        }

        const seats = players.map(p => ({
          seat: p.seat,
          name: p.name,
          team: p.team,
          isBot: p.is_bot,
        }));

        let state;
        if (room.game_type === '28') {
          state = createGame28(seats);
        } else {
          state = createGame56(seats, room.player_count);
        }

        gameStates[roomId] = state;
        const sessionId = await roomManager.createSession(roomId);
        sessionIds[roomId] = sessionId;

        await roomManager.updateRoomStatus(roomId, 'playing');

        // Broadcast individual views (each player only sees their hand)
        broadcastGameState(io, roomId, state, room.game_type, players);

        io.to(roomId).emit('game_started', {
          gameType: room.game_type,
          playerCount: room.player_count,
          seats,
        });

      } catch (err) {
        console.error('start_game error:', err);
        socket.emit('error', { message: 'Failed to start game' });
      }
    });

    // ── Bidding ────────────────────────────────────────────────

    socket.on('place_bid', async ({ bid }) => {
      const { roomId, seat } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];

      let result;
      if (state.gameType === '28') {
        result = bid === 'pass' ? passBid(state, seat) : placeBid(state, seat, bid);
      } else {
        if (bid === 'pass') result = passBid56(state, seat);
        else if (bid === 'double') result = doubleBid56(state, seat);
        else if (bid === 'redouble') result = redoubleBid56(state, seat);
        else result = placeBid56(state, seat, bid.points, bid.suit);
      }

      if (result.error) return socket.emit('error', { message: result.error });

      const room = await roomManager.getRoom(roomId);
      const players = await roomManager.getPlayers(roomId);
      broadcastGameState(io, roomId, state, state.gameType, players);

      if (result.awaitingTrump) {
        io.to(roomId).emit('awaiting_trump', { bidder: state.highBidder });
      }
      if (result.biddingDone) {
        io.to(roomId).emit('bidding_complete', {
          highBid: state.highBid,
          highBidder: state.highBidder,
          trumpSuit: state.trumpSuit || '?',
        });
      }
    });

    // ── Choose Trump (28 only) ────────────────────────────────

    socket.on('choose_trump', async ({ card }) => {
      const { roomId, seat } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];

      const result = chooseTrump(state, seat, card);
      if (result.error) return socket.emit('error', { message: result.error });

      // Check redeal conditions
      const redeal = checkRedeal(state);
      if (redeal.redeal) {
        io.to(roomId).emit('redeal', { reason: redeal.reason });
        const players = await roomManager.getPlayers(roomId);
        const seats = players.map(p => ({ seat: p.seat, name: p.name, team: p.team }));
        gameStates[roomId] = createGame28(seats);
        const newState = gameStates[roomId];
        broadcastGameState(io, roomId, newState, '28', players);
        return;
      }

      const players = await roomManager.getPlayers(roomId);
      broadcastGameState(io, roomId, state, '28', players);
      io.to(roomId).emit('trump_chosen', { bidder: seat });
    });

    socket.on('raise_bid', async ({ newBid }) => {
      const { roomId, seat } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];
      const result = newBid ? raiseBid(state, seat, newBid) : skipRaise(state);
      if (result?.error) return socket.emit('error', { message: result.error });
      const players = await roomManager.getPlayers(roomId);
      broadcastGameState(io, roomId, state, '28', players);
    });

    socket.on('declare_thani', async () => {
      const { roomId, seat } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];
      const result = declareThani(state, seat);
      if (result.error) return socket.emit('error', { message: result.error });
      const players = await roomManager.getPlayers(roomId);
      io.to(roomId).emit('thani_declared', { seat });
      broadcastGameState(io, roomId, state, '28', players);
    });

    socket.on('request_trump_reveal', async () => {
      const { roomId, seat } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];
      const result = requestTrumpReveal(state, seat);
      if (result.error) return socket.emit('error', { message: result.error });
      const players = await roomManager.getPlayers(roomId);
      io.to(roomId).emit('trump_revealed', { trumpSuit: result.trumpSuit });
      broadcastGameState(io, roomId, state, '28', players);
    });

    // ── Play Card ──────────────────────────────────────────────

    socket.on('play_card', async ({ card }) => {
      const { roomId, seat } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];

      const result = state.gameType === '28'
        ? playCard(state, seat, card)
        : playCard56(state, seat, card);

      if (result.error) return socket.emit('error', { message: result.error });

      const players = await roomManager.getPlayers(roomId);
      broadcastGameState(io, roomId, state, state.gameType, players);

      if (result.trickWinner !== undefined) {
        io.to(roomId).emit('trick_complete', {
          winner: result.trickWinner,
          points: result.trickPoints,
        });
      }

      if (state.phase === 'scoring') {
        await handleHandComplete(io, roomId, state, players);
      }

      // Trigger bot move if next player is a bot
      scheduleNextBotMove(io, roomId, state, players);
    });

    // ── Surrender / Cot ───────────────────────────────────────

    socket.on('offer_surrender', async () => {
      const { roomId, seat } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];
      const result = state.gameType === '28'
        ? offerSurrender(state, seat)
        : offerSurrender56(state, seat);
      if (result.error) return socket.emit('error', { message: result.error });
      io.to(roomId).emit('surrender_offered', { fromTeam: state.cotOfferFrom });
    });

    socket.on('respond_surrender', async ({ accept }) => {
      const { roomId, seat } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];
      const result = state.gameType === '28'
        ? respondSurrender(state, seat, accept)
        : respondSurrender56(state, seat, accept);
      if (result.error) return socket.emit('error', { message: result.error });
      const players = await roomManager.getPlayers(roomId);
      broadcastGameState(io, roomId, state, state.gameType, players);
      if (state.phase === 'scoring') {
        await handleHandComplete(io, roomId, state, players);
      }
    });

    // ── Next Hand ──────────────────────────────────────────────

    socket.on('next_hand', async () => {
      const { roomId } = socket.data || {};
      if (!roomId || !gameStates[roomId]) return;
      const state = gameStates[roomId];
      const result = state.gameType === '28' ? nextHand(state) : nextHand56(state);
      const players = await roomManager.getPlayers(roomId);
      broadcastGameState(io, roomId, state, state.gameType, players);
    });

    // ── Chat ───────────────────────────────────────────────────

    socket.on('chat_message', async ({ message }) => {
      const { roomId, name } = socket.data || {};
      if (!roomId || !message?.trim()) return;
      const trimmed = message.trim().slice(0, 200);
      const saved = await roomManager.saveChatMessage(roomId, name, trimmed);
      io.to(roomId).emit('chat_message', {
        playerName: name,
        message: trimmed,
        sentAt: saved.sent_at,
      });
    });

    // ── Disconnect ─────────────────────────────────────────────

    socket.on('disconnect', async () => {
      const { roomId, seat, name } = socket.data || {};
      if (!roomId) return;

      const disconnected = await roomManager.markPlayerDisconnected(socket.id);
      if (!disconnected) return;

      io.to(roomId).emit('player_disconnected', { seat, name });

      // Give 30s grace period before bot takes over
      if (gameStates[roomId]) {
        const timerKey = `${roomId}:${seat}`;
        disconnectTimers[timerKey] = setTimeout(async () => {
          const state = gameStates[roomId];
          if (!state) return;
          const players = await roomManager.getPlayers(roomId);
          const player = players.find(p => p.seat === seat);
          if (!player || player.connected) return; // they reconnected

          io.to(roomId).emit('bot_taking_seat', { seat, name });
          scheduleNextBotMove(io, roomId, state, players, seat);
        }, DISCONNECT_GRACE_MS);
      }
    });

  }); // end io.on('connection')


  // ── Helpers ──────────────────────────────────────────────────

  function broadcastGameState(io, roomId, state, gameType, players) {
    for (const player of players) {
      const viewFn = gameType === '28' ? getPlayerView : getPlayerView56;
      const view = viewFn(state, player.seat);
      const sockets = [...io.sockets.sockets.values()]
        .filter(s => s.data?.roomId === roomId && s.data?.seat === player.seat);
      for (const s of sockets) {
        s.emit('game_state', view);
      }
    }
  }

  async function handleHandComplete(io, roomId, state, players) {
    const result = state.lastHandResult;
    io.to(roomId).emit('hand_complete', {
      result,
      score: state.score,
    });

    // Persist hand to DB
    await roomManager.saveHandResult(sessionIds[roomId], {
      handNumber: state.handNumber,
      gameType: state.gameType,
      bidderSeat: state.highBidder,
      bid: state.highBid?.points || state.highBid,
      trumpSuit: state.trumpSuit,
      biddingTeam: result.bidderTeam,
      pointsWon: result.bidderPoints,
      bidSuccessful: result.success,
      isThani: result.isThani,
      isCot: result.isCot,
      isDoubled: result.isDoubled,
      isRedoubled: result.isRedoubled,
      team0Delta: state.gameType === '28'
        ? (result.bidderTeam === 0 ? (result.success ? result.gamePoints : -result.gamePoints) : (result.success ? -result.gamePoints : result.gamePoints))
        : state.score[0],
      team1Delta: 0, // simplified
    });
  }

  function scheduleNextBotMove(io, roomId, state, players, forceSeat) {
    if (state.phase !== 'playing' && state.phase !== 'bidding' &&
        state.phase !== 'choosing_trump' && state.phase !== 'bidding2') return;

    const activeSeat = forceSeat ?? getActiveSeat(state);
    if (activeSeat === undefined || activeSeat === null) return;

    const player = players.find(p => p.seat === activeSeat);
    const isBot = player?.is_bot || !player?.connected;
    if (!isBot) return;

    setTimeout(() => {
      executeBotMove(io, roomId, state, activeSeat, players);
    }, BOT_DELAY_MS);
  }

  async function executeBotMove(io, roomId, state, seat, players) {
    if (!gameStates[roomId]) return;

    try {
      if (state.gameType === '28') {
        await executeBotMove28(io, roomId, state, seat, players);
      } else {
        await executeBotMove56(io, roomId, state, seat, players);
      }
    } catch (err) {
      console.error('Bot move error:', err);
    }
  }

  async function executeBotMove28(io, roomId, state, seat, players) {
    if (state.phase === 'bidding') {
      const bid = botBid28(state.hands[seat], state.highBid);
      if (bid === 'pass') passBid(state, seat);
      else placeBid(state, seat, bid);

      if (state.phase === 'choosing_trump') {
        const trumpCard = botChooseTrump28(state.hands[seat]);
        chooseTrump(state, seat, trumpCard);
        skipRaise(state);
      }
    } else if (state.phase === 'bidding2') {
      skipRaise(state);
    } else if (state.phase === 'playing') {
      const card = botPlayCard28(state, seat);
      if (card) {
        const result = playCard(state, seat, card);
        if (result.trickWinner !== undefined) {
          io.to(roomId).emit('trick_complete', { winner: result.trickWinner, points: result.trickPoints });
        }
        if (state.phase === 'scoring') {
          await handleHandComplete(io, roomId, state, players);
        }
      }
    }

    broadcastGameState(io, roomId, state, '28', players);
    scheduleNextBotMove(io, roomId, state, players);
  }

  async function executeBotMove56(io, roomId, state, seat, players) {
    if (state.phase === 'bidding') {
      const bid = botBid56(state.hands[seat], state.highBid, state.playerCount);
      if (bid === 'pass') passBid56(state, seat);
      else placeBid56(state, seat, bid.points, bid.suit);
    } else if (state.phase === 'playing') {
      const card = botPlayCard56(state, seat);
      if (card) {
        const result = playCard56(state, seat, card);
        if (result.trickWinner !== undefined) {
          io.to(roomId).emit('trick_complete', { winner: result.trickWinner, points: result.trickPoints });
        }
        if (state.phase === 'scoring') {
          await handleHandComplete(io, roomId, state, players);
        }
      }
    }

    broadcastGameState(io, roomId, state, '56', players);
    scheduleNextBotMove(io, roomId, state, players);
  }

  function getActiveSeat(state) {
    if (state.phase === 'bidding') return state.currentBidder;
    if (state.phase === 'choosing_trump') return state.highBidder;
    if (state.phase === 'bidding2') return state.highBidder;
    if (state.phase === 'playing') {
      if (state.gameType === '28') {
        const { getCurrentPlayer28 } = require('../engine/game28');
        // Inline the logic
        if (state.currentTrick.length === 0) return state.currentLeader;
        const last = state.currentTrick[state.currentTrick.length - 1].seat;
        return (last + 3) % 4;
      } else {
        if (state.currentTrick.length === 0) return state.currentLeader;
        const last = state.currentTrick[state.currentTrick.length - 1].seat;
        return (last + state.playerCount - 1) % state.playerCount;
      }
    }
    return null;
  }

  function getTeamForSeat(seat, playerCount) {
    // Alternating teams: 0,2,4... = team 0; 1,3,5... = team 1
    return seat % 2;
  }

};
