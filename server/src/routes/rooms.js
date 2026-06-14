const { pool } = require('../db');

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function createRoom(gameType, playerCount) {
  let roomId, attempts = 0;
  do {
    roomId = generateRoomCode();
    attempts++;
    if (attempts > 10) throw new Error('Could not generate unique room ID');
    const existing = await pool.query('SELECT id FROM rooms WHERE id = $1', [roomId]);
    if (existing.rows.length === 0) break;
  } while (true);

  const pin = generatePin();

  await pool.query(
    `INSERT INTO rooms (id, pin, game_type, player_count, status) VALUES ($1, $2, $3, $4, 'waiting')`,
    [roomId, pin, gameType, playerCount]
  );

  return { roomId, pin };
}

async function getRoom(roomId) {
  const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
  return result.rows[0] || null;
}

async function validatePin(roomId, pin) {
  const room = await getRoom(roomId);
  if (!room) return { valid: false, error: 'Room not found' };
  if (room.pin !== pin) return { valid: false, error: 'Wrong PIN' };
  if (room.status === 'finished') return { valid: false, error: 'Game has ended' };
  return { valid: true, room };
}

async function addPlayer(roomId, name, seat, team, socketId) {
  try {
    const result = await pool.query(
      `INSERT INTO players (room_id, socket_id, name, seat, team, is_bot, connected)
       VALUES ($1, $2, $3, $4, $5, false, true)
       ON CONFLICT (room_id, seat) DO UPDATE SET
         socket_id = EXCLUDED.socket_id,
         name = EXCLUDED.name,
         connected = true
       RETURNING *`,
      [roomId, socketId, name, seat, team]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') return { error: 'Seat already taken' };
    throw err;
  }
}

async function getPlayers(roomId) {
  const result = await pool.query(
    'SELECT * FROM players WHERE room_id = $1 ORDER BY seat',
    [roomId]
  );
  return result.rows;
}

async function markPlayerDisconnected(socketId) {
  const result = await pool.query(
    `UPDATE players SET connected = false
     WHERE socket_id = $1 RETURNING room_id, seat, name`,
    [socketId]
  );
  return result.rows[0] || null;
}

async function markPlayerConnected(roomId, seat, socketId) {
  await pool.query(
    `UPDATE players SET connected = true, socket_id = $1
     WHERE room_id = $2 AND seat = $3`,
    [socketId, roomId, seat]
  );
}

async function updateRoomStatus(roomId, status) {
  await pool.query(
    'UPDATE rooms SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, roomId]
  );
}

async function saveChatMessage(roomId, playerName, message) {
  const result = await pool.query(
    `INSERT INTO chat_messages (room_id, player_name, message)
     VALUES ($1, $2, $3) RETURNING *`,
    [roomId, playerName, message]
  );
  return result.rows[0];
}

async function getChatHistory(roomId, limit = 50) {
  const result = await pool.query(
    `SELECT player_name, message, sent_at FROM chat_messages
     WHERE room_id = $1 ORDER BY sent_at DESC LIMIT $2`,
    [roomId, limit]
  );
  return result.rows.reverse();
}

async function saveHandResult(sessionId, handData) {
  const result = await pool.query(
    `INSERT INTO hands (session_id, hand_number, game_type, bidder_seat, bid,
       trump_suit, bidding_team, points_won, bid_successful, is_thani, is_cot,
       is_doubled, is_redoubled, team0_points_delta, team1_points_delta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      sessionId, handData.handNumber, handData.gameType, handData.bidderSeat,
      handData.bid, handData.trumpSuit, handData.biddingTeam, handData.pointsWon,
      handData.bidSuccessful, handData.isThani || false, handData.isCot || false,
      handData.isDoubled || false, handData.isRedoubled || false,
      handData.team0Delta, handData.team1Delta,
    ]
  );
  return result.rows[0];
}

async function createSession(roomId) {
  const result = await pool.query(
    'INSERT INTO game_sessions (room_id) VALUES ($1) RETURNING id',
    [roomId]
  );
  return result.rows[0].id;
}

async function endSession(sessionId, winnerTeam, team0Score, team1Score) {
  await pool.query(
    `UPDATE game_sessions SET ended_at = NOW(), winner_team = $1,
     team0_score = $2, team1_score = $3 WHERE id = $4`,
    [winnerTeam, team0Score, team1Score, sessionId]
  );
}

module.exports = {
  createRoom, getRoom, validatePin,
  addPlayer, getPlayers, markPlayerDisconnected,
  markPlayerConnected, updateRoomStatus,
  saveChatMessage, getChatHistory,
  saveHandResult, createSession, endSession,
};
