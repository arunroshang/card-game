require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');
const setupSocket = require('./socket/gameSocket');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, /\.railway\.app$/],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors({ origin: [CLIENT_URL, /\.railway\.app$/], credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// API: Get room info (for joining via link)
app.get('/api/room/:roomId', async (req, res) => {
  try {
    const { pool } = require('./db');
    const result = await pool.query(
      'SELECT id, game_type, player_count, status FROM rooms WHERE id = $1',
      [req.params.roomId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Room not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API: Get score history for a room
app.get('/api/room/:roomId/history', async (req, res) => {
  try {
    const { pool } = require('./db');
    const sessions = await pool.query(
      'SELECT * FROM game_sessions WHERE room_id = $1 ORDER BY started_at DESC LIMIT 5',
      [req.params.roomId]
    );
    if (!sessions.rows.length) return res.json({ sessions: [] });

    const sessionId = sessions.rows[0].id;
    const hands = await pool.query(
      'SELECT * FROM hands WHERE session_id = $1 ORDER BY hand_number',
      [sessionId]
    );
    res.json({ session: sessions.rows[0], hands: hands.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve React client in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (_, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

setupSocket(io);

const PORT = process.env.PORT || 3001;

async function start() {
  await initDB();
  server.listen(PORT, () => {
    console.log(`🃏 Card game server running on port ${PORT}`);
    console.log(`   Client URL: ${CLIENT_URL}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
