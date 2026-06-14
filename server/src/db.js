const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(8) PRIMARY KEY,
    pin VARCHAR(4) NOT NULL,
    game_type VARCHAR(4) NOT NULL CHECK (game_type IN ('28', '56')),
    player_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    host_socket_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(8) REFERENCES rooms(id) ON DELETE CASCADE,
    socket_id VARCHAR(64),
    name VARCHAR(32) NOT NULL,
    seat INTEGER NOT NULL,
    team INTEGER NOT NULL CHECK (team IN (0, 1)),
    is_bot BOOLEAN DEFAULT FALSE,
    connected BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, seat)
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(8) REFERENCES rooms(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    winner_team INTEGER CHECK (winner_team IN (0, 1)),
    team0_score INTEGER DEFAULT 0,
    team1_score INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS hands (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
    hand_number INTEGER NOT NULL,
    game_type VARCHAR(4) NOT NULL,
    bidder_seat INTEGER NOT NULL,
    bid INTEGER NOT NULL,
    trump_suit VARCHAR(10),
    bidding_team INTEGER NOT NULL CHECK (bidding_team IN (0, 1)),
    points_won INTEGER,
    bid_successful BOOLEAN,
    is_thani BOOLEAN DEFAULT FALSE,
    is_cot BOOLEAN DEFAULT FALSE,
    is_doubled BOOLEAN DEFAULT FALSE,
    is_redoubled BOOLEAN DEFAULT FALSE,
    team0_points_delta INTEGER DEFAULT 0,
    team1_points_delta INTEGER DEFAULT 0,
    played_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(8) REFERENCES rooms(id) ON DELETE CASCADE,
    player_name VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
  CREATE INDEX IF NOT EXISTS idx_hands_session ON hands(session_id);
  CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id);
`;

async function initDB() {
  try {
    await pool.query(SCHEMA);
    console.log('✅ Database schema ready');
  } catch (err) {
    console.error('❌ Database init failed:', err.message);
    throw err;
  }
}

module.exports = { pool, initDB };
