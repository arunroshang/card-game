# 28 & 56 — Kerala Card Games

Multiplayer web app for the Kerala trick-taking card games **28** and **56**. Share a room code + PIN with friends, play from any phone browser.

## Features

- ✅ Full 28 rules — hidden trump, Cot, Thani, redeal conditions
- ✅ Full 56 rules — open trump, double/redouble, surrender
- ✅ 4 / 6 / 8 player support for 56
- ✅ Real-time multiplayer via WebSockets
- ✅ Bot fills in when a player disconnects (30s grace period)
- ✅ In-game chat with history
- ✅ Score tracking per session
- ✅ Mobile-first UI (tap to select, tap to play)

---

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (local or Docker)

### Setup

```bash
git clone <your-repo>
cd card-game

# Server
cd server
cp .env.example .env
# Edit .env with your local DATABASE_URL
npm install

# Client
cd ../client
npm install
```

### Run locally

```bash
# Terminal 1 — server (port 3001)
cd server
npm run dev

# Terminal 2 — client (port 5173)
cd client
npm run dev
```

Open http://localhost:5173

---

## Deploy to Railway (free tier)

Railway gives you a Node.js server + PostgreSQL in one place, with WebSocket support.

### Step 1 — Create Railway account
Go to https://railway.app and sign up (free).

### Step 2 — New project from GitHub
1. Push this repo to GitHub
2. In Railway: **New Project → Deploy from GitHub repo**
3. Select your repository

### Step 3 — Add PostgreSQL
In your Railway project: **New → Database → PostgreSQL**
Railway automatically sets `DATABASE_URL` in your environment.

### Step 4 — Set environment variables
In Railway → your service → **Variables**, add:
```
NODE_ENV=production
CLIENT_URL=https://your-app.up.railway.app
PORT=3001
```
Railway sets `DATABASE_URL` automatically from the Postgres plugin.

### Step 5 — Deploy
Railway auto-deploys on every push to your main branch.
Your app will be live at `https://your-app.up.railway.app`.

### Step 6 — Share!
Send your friends the URL. They click it, pick a room code + PIN you share, choose a seat, and play.

---

## Project Structure

```
card-game/
├── server/
│   └── src/
│       ├── index.js           # Express + Socket.IO server
│       ├── db.js              # PostgreSQL schema + connection
│       ├── engine/
│       │   ├── game28.js      # 28 game logic
│       │   ├── game56.js      # 56 game logic
│       │   └── bot.js         # Rule-based bot AI
│       ├── routes/
│       │   └── rooms.js       # Room/player DB operations
│       └── socket/
│           └── gameSocket.js  # All Socket.IO event handlers
└── client/
    └── src/
        ├── hooks/
        │   ├── useSocket.jsx  # Socket.IO context
        │   └── useGameState.js # Game event management
        ├── components/
        │   ├── Card.jsx        # Card + CardHand components
        │   ├── BiddingPanel.jsx # Bidding UI for 28 & 56
        │   ├── GameTable.jsx   # Main game screen
        │   └── ChatPanel.jsx   # Chat, Score, HandResult
        └── pages/
            └── RoomPage.jsx   # Home + Lobby + Game routing
```

---

## Game Rules Summary

### 28
- 32 cards (7–Ace), rank: J > 9 > A > 10 > K > Q > 8 > 7
- 4 players, 2 teams. Deal 4 → bid → deal 4 more
- Bidder secretly places trump card face-down
- Trump only revealed when a player can't follow suit and calls for it
- Bidder may declare **Thani** (solo — win every trick alone)
- **Cot**: Win all 8 tricks = double score; opponents may surrender first

### 56
- Double deck, 4/6/8 players, 8 cards each
- Same card rank/values as 28; total 56 points
- Trump declared openly in the bid (min bid: 28)
- Doubles and redoubles multiply the score
- Same Cot/surrender rule

---

## Tech Stack
- **Frontend**: React 18 + Tailwind CSS + Vite
- **Backend**: Node.js + Express + Socket.IO
- **Database**: PostgreSQL
- **Deployment**: Railway
