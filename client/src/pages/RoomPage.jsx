import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useGameState } from '../hooks/useGameState';

const SEAT_LABELS = ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5', 'Seat 6', 'Seat 7', 'Seat 8'];

// ── Home Page ─────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [tab, setTab] = useState('join');

  // New room creation state
  const [gameType, setGameType] = useState('28');
  const [playerCount, setPlayerCount] = useState(4);
  const [creating, setCreating] = useState(false);

  // Join state
  const [roomCode, setRoomCode] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [roomInfo, setRoomInfo] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket) return;

    socket.on('room_created', ({ roomId, pin, gameType, playerCount }) => {
      setCreating(false);
      navigate(`/room/${roomId}?pin=${pin}&created=1&gt=${gameType}&pc=${playerCount}`);
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setCreating(false);
      setJoining(false);
    });

    return () => {
      socket.off('room_created');
      socket.off('error');
    };
  }, [socket, navigate]);

  const handleCreate = () => {
    if (!socket) return;
    setError('');
    setCreating(true);
    socket.emit('create_room', { gameType, playerCount: Number(playerCount) });
  };

  const handleLookupRoom = async () => {
    if (!roomCode.trim()) return;
    setError('');
    try {
      const res = await fetch(`/api/room/${roomCode.toUpperCase().trim()}`);
      if (!res.ok) { setError('Room not found'); return; }
      const data = await res.json();
      setRoomInfo(data);
    } catch {
      setError('Could not connect to server');
    }
  };

  const handleJoin = () => {
    if (!name.trim() || !pin.trim() || selectedSeat === null || !roomCode.trim()) {
      setError('Please fill in all fields and choose a seat');
      return;
    }
    setJoining(true);
    setError('');
    sessionStorage.setItem('playerName', name.trim());
    sessionStorage.setItem('roomCode', roomCode.toUpperCase().trim());
    navigate(`/room/${roomCode.toUpperCase().trim()}?pin=${pin}&seat=${selectedSeat}&name=${encodeURIComponent(name.trim())}`);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom"
         style={{ background: 'radial-gradient(ellipse at top, #1B4332 0%, #0D1B2A 60%)' }}>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🃏</div>
        <h1 className="font-display text-4xl text-gold font-bold">28 & 56</h1>
        <p className="text-cardWhite/60 text-sm mt-1">Kerala card games · Multiplayer</p>
      </div>

      {/* Tabs */}
      <div className="w-full max-w-sm">
        <div className="flex bg-uiPanel rounded-xl p-1 mb-4 gold-border">
          <button
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${tab === 'join' ? 'bg-gold text-uiBg' : 'text-cardWhite/60'}`}
            onClick={() => setTab('join')}
          >Join game</button>
          <button
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${tab === 'create' ? 'bg-gold text-uiBg' : 'text-cardWhite/60'}`}
            onClick={() => setTab('create')}
          >Create game</button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-3">
            {error}
          </div>
        )}

        {/* ── Join Tab ── */}
        {tab === 'join' && (
          <div className="space-y-3">
            <div>
              <label className="text-cardWhite/60 text-xs uppercase tracking-wide mb-1 block">Your name</label>
              <input
                className="w-full bg-uiPanel border border-uiBorder rounded-xl px-4 py-3 text-cardWhite text-base outline-none focus:border-gold/60 transition-colors"
                placeholder="Enter your name"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={24}
              />
            </div>
            <div>
              <label className="text-cardWhite/60 text-xs uppercase tracking-wide mb-1 block">Room code</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-uiPanel border border-uiBorder rounded-xl px-4 py-3 text-cardWhite text-base outline-none focus:border-gold/60 uppercase tracking-widest"
                  placeholder="ABC123"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button className="btn-secondary px-4 py-3" onClick={handleLookupRoom}>Find</button>
              </div>
            </div>
            <div>
              <label className="text-cardWhite/60 text-xs uppercase tracking-wide mb-1 block">PIN</label>
              <input
                className="w-full bg-uiPanel border border-uiBorder rounded-xl px-4 py-3 text-cardWhite text-base outline-none focus:border-gold/60 tracking-widest"
                placeholder="4-digit PIN"
                value={pin}
                onChange={e => setPin(e.target.value)}
                maxLength={4}
                inputMode="numeric"
              />
            </div>

            {roomInfo && (
              <div>
                <label className="text-cardWhite/60 text-xs uppercase tracking-wide mb-1 block">
                  Choose seat — {roomInfo.game_type} · {roomInfo.player_count} players
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: roomInfo.player_count }, (_, i) => (
                    <button key={i}
                      className={`py-3 rounded-xl text-sm font-medium border transition-colors
                        ${selectedSeat === i
                          ? 'bg-gold text-uiBg border-gold'
                          : 'bg-uiPanel border-uiBorder text-cardWhite/70'}`}
                      onClick={() => setSelectedSeat(i)}
                    >
                      <div>S{i + 1}</div>
                      <div className={`text-xs ${i % 2 === 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        Team {i % 2 + 1}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="btn-primary w-full text-base py-3.5"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? 'Joining…' : 'Join game'}
            </button>
          </div>
        )}

        {/* ── Create Tab ── */}
        {tab === 'create' && (
          <div className="space-y-4">
            <div>
              <label className="text-cardWhite/60 text-xs uppercase tracking-wide mb-2 block">Game type</label>
              <div className="grid grid-cols-2 gap-2">
                {['28', '56'].map(type => (
                  <button key={type}
                    className={`py-4 rounded-xl border text-center transition-colors
                      ${gameType === type ? 'bg-gold/20 border-gold' : 'bg-uiPanel border-uiBorder'}`}
                    onClick={() => { setGameType(type); setPlayerCount(type === '28' ? 4 : 6); }}
                  >
                    <div className={`font-display text-2xl ${gameType === type ? 'text-gold' : 'text-cardWhite'}`}>{type}</div>
                    <div className="text-cardWhite/50 text-xs mt-1">
                      {type === '28' ? '4 players' : '4 / 6 / 8 players'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {gameType === '56' && (
              <div>
                <label className="text-cardWhite/60 text-xs uppercase tracking-wide mb-2 block">Players</label>
                <div className="grid grid-cols-3 gap-2">
                  {[4, 6, 8].map(n => (
                    <button key={n}
                      className={`py-3 rounded-xl border text-sm font-medium transition-colors
                        ${playerCount === n ? 'bg-gold/20 border-gold text-gold' : 'bg-uiPanel border-uiBorder text-cardWhite/70'}`}
                      onClick={() => setPlayerCount(n)}
                    >{n} players</button>
                  ))}
                </div>
              </div>
            )}

            <div className="panel p-4 space-y-1.5 text-sm text-cardWhite/60">
              <div>✓ Hidden trump (28) / Open trump (56)</div>
              <div>✓ Cot & Thani rules active</div>
              <div>✓ Bot covers disconnected players</div>
              <div>✓ Share room code + PIN to invite</div>
            </div>

            <button className="btn-primary w-full text-base py-3.5" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create room'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Room / Lobby Page ─────────────────────────────────────────

export function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { gameState, players, myInfo, chatMessages, notifications, error, trickAnimation, handResult, actions, setMyInfo } = useGameState(socket);

  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [joined, setJoined] = useState(false);
  const [pageError, setPageError] = useState('');

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const pin = params.get('pin');
  const seatParam = params.get('seat');
  const nameParam = params.get('name');
  const isCreator = params.get('created') === '1';
  const gameType = params.get('gt') || '28';
  const playerCount = Number(params.get('pc') || 4);

  useEffect(() => {
    if (!socket || !roomId) return;

    // Fetch room info
    fetch(`/api/room/${roomId}`)
      .then(r => r.json())
      .then(data => setRoomData(data))
      .catch(() => setPageError('Room not found'));

    socket.on('joined', ({ players: p }) => {
      setLobbyPlayers(p);
      setJoined(true);
    });

    socket.on('player_joined', ({ players: p }) => setLobbyPlayers(p));

    socket.on('game_started', () => {
      // handled by useGameState
    });

    socket.on('error', ({ message }) => setPageError(message));

    // Auto-join if params present
    if (pin && seatParam !== null && nameParam) {
      const storedName = decodeURIComponent(nameParam);
      actions.joinRoom(roomId, pin, storedName, Number(seatParam));
      setMyInfo({ name: storedName, seat: Number(seatParam) });
    }

    return () => {
      socket.off('joined');
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('error');
    };
  }, [socket, roomId]);

  // If game is in progress, show game table
  if (gameState && gameState.phase !== 'done') {
    const { GameTable } = require('./GameTable'); // lazy-ish
    return <GameTable
      gameState={gameState}
      myInfo={myInfo}
      players={lobbyPlayers.length ? lobbyPlayers : players}
      chatMessages={chatMessages}
      actions={actions}
      notifications={notifications}
      error={error}
      trickAnimation={trickAnimation}
      handResult={handResult}
    />;
  }

  // Lobby view
  const pc = roomData?.player_count || playerCount;
  const gt = roomData?.game_type || gameType;
  const shareUrl = `${window.location.origin}/room/${roomId}`;

  return (
    <div className="min-h-full flex flex-col px-4 py-6 safe-top safe-bottom"
         style={{ background: 'radial-gradient(ellipse at top, #1B4332 0%, #0D1B2A 60%)' }}>

      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🃏</div>
        <h1 className="font-display text-2xl text-gold">{gt} — Room Lobby</h1>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="font-mono text-cardWhite bg-uiPanel border border-uiBorder rounded-lg px-3 py-1 text-lg tracking-widest">{roomId}</span>
          <span className="text-cardWhite/40">PIN:</span>
          <span className="font-mono text-cardWhite bg-uiPanel border border-uiBorder rounded-lg px-3 py-1 text-lg tracking-widest">{pin}</span>
        </div>
      </div>

      {pageError && (
        <div className="bg-red-900/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">{pageError}</div>
      )}

      {/* Share */}
      <div className="panel p-4 mb-4 space-y-2">
        <p className="text-cardWhite/60 text-xs uppercase tracking-wide">Share with players</p>
        <p className="text-cardWhite text-sm break-all">{shareUrl}</p>
        <button
          className="btn-secondary text-sm py-2 px-4 w-full"
          onClick={() => navigator.clipboard?.writeText(`Join my ${gt} game!\nRoom: ${roomId}\nPIN: ${pin}\n${shareUrl}`)}
        >Copy invite link</button>
      </div>

      {/* Seats */}
      <div className="panel p-4 mb-4">
        <p className="text-cardWhite/60 text-xs uppercase tracking-wide mb-3">Players ({lobbyPlayers.length}/{pc})</p>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: pc }, (_, i) => {
            const player = lobbyPlayers.find(p => p.seat === i);
            const isMe = myInfo?.seat === i;
            return (
              <div key={i}
                className={`rounded-xl p-3 border text-sm
                  ${player ? (i % 2 === 0 ? 'bg-teamRed/10 border-teamRed/30' : 'bg-teamBlue/10 border-teamBlue/30')
                    : 'bg-uiBg border-uiBorder opacity-50'}`}>
                <div className={`text-xs mb-0.5 ${i % 2 === 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  Seat {i + 1} · Team {i % 2 + 1}
                </div>
                <div className={`font-medium ${isMe ? 'text-gold' : 'text-cardWhite'}`}>
                  {player ? `${player.name}${isMe ? ' (you)' : ''}` : 'Empty'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start button (any joined player can start when full) */}
      {joined && lobbyPlayers.length >= pc && (
        <button className="btn-primary w-full text-base py-4" onClick={() => actions.startGame(roomId)}>
          Start game →
        </button>
      )}
      {joined && lobbyPlayers.length < pc && (
        <div className="text-center text-cardWhite/50 text-sm">
          Waiting for {pc - lobbyPlayers.length} more player{pc - lobbyPlayers.length !== 1 ? 's' : ''}…
        </div>
      )}
    </div>
  );
}
