import { useState, useEffect, useCallback } from 'react';

export function useGameState(socket) {
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myInfo, setMyInfo] = useState(null); // { seat, team, name }
  const [chatMessages, setChatMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);
  const [trickAnimation, setTrickAnimation] = useState(null);
  const [handResult, setHandResult] = useState(null);

  const addNotification = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setNotifications(n => [...n, { id, msg, type }]);
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 3500);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('joined', ({ seat, team, players: p, chatHistory }) => {
      const stored = sessionStorage.getItem('playerName');
      setMyInfo(prev => ({ ...(prev || {}), seat, team, name: stored }));
      setPlayers(p);
      setChatMessages(chatHistory || []);
    });

    socket.on('game_state', (state) => {
      setGameState(state);
    });

    socket.on('player_joined', ({ players: p, name, seat }) => {
      setPlayers(p);
      addNotification(`${name} joined seat ${seat + 1}`, 'info');
    });

    socket.on('player_disconnected', ({ name, seat }) => {
      addNotification(`${name} disconnected — waiting 30s`, 'warning');
    });

    socket.on('bot_taking_seat', ({ name }) => {
      addNotification(`Bot taking over for ${name}`, 'info');
    });

    socket.on('trick_complete', ({ winner, points }) => {
      setTrickAnimation({ winner, points, ts: Date.now() });
      setTimeout(() => setTrickAnimation(null), 1200);
    });

    socket.on('hand_complete', ({ result, score }) => {
      setHandResult({ result, score });
    });

    socket.on('trump_revealed', ({ trumpSuit }) => {
      addNotification(`Trump revealed: ${trumpSuit.toUpperCase()}`, 'trump');
    });

    socket.on('thani_declared', ({ seat }) => {
      addNotification(`Seat ${seat + 1} declared THANI! 🎯`, 'thani');
    });

    socket.on('surrender_offered', ({ fromTeam }) => {
      addNotification(`Team ${fromTeam + 1} offers surrender`, 'warning');
    });

    socket.on('redeal', ({ reason }) => {
      addNotification(`Redeal! (${reason === 'all_jacks' ? 'Player has all Jacks' : 'Bidder has all trumps'})`, 'info');
    });

    socket.on('chat_message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('game_started', () => {
      setHandResult(null);
    });

    return () => {
      socket.off('joined');
      socket.off('game_state');
      socket.off('player_joined');
      socket.off('player_disconnected');
      socket.off('bot_taking_seat');
      socket.off('trick_complete');
      socket.off('hand_complete');
      socket.off('trump_revealed');
      socket.off('thani_declared');
      socket.off('surrender_offered');
      socket.off('redeal');
      socket.off('chat_message');
      socket.off('error');
      socket.off('game_started');
    };
  }, [socket, addNotification]);

  // Actions
  const actions = {
    joinRoom: (roomId, pin, name, seat) => {
      sessionStorage.setItem('playerName', name);
      sessionStorage.setItem('playerSeat', seat);
      setMyInfo({ name, seat: Number(seat) });
      socket?.emit('join_room', { roomId, pin, name, seat: Number(seat) });
    },
    createRoom: (gameType, playerCount) => {
      socket?.emit('create_room', { gameType, playerCount });
    },
    startGame: (roomId) => socket?.emit('start_game', { roomId }),
    placeBid: (bid) => socket?.emit('place_bid', { bid }),
    chooseTrump: (card) => socket?.emit('choose_trump', { card }),
    raiseBid: (newBid) => socket?.emit('raise_bid', { newBid }),
    skipRaise: () => socket?.emit('raise_bid', { newBid: null }),
    declareThani: () => socket?.emit('declare_thani'),
    requestTrumpReveal: () => socket?.emit('request_trump_reveal'),
    playCard: (card) => socket?.emit('play_card', { card }),
    offerSurrender: () => socket?.emit('offer_surrender'),
    respondSurrender: (accept) => socket?.emit('respond_surrender', { accept }),
    nextHand: () => { setHandResult(null); socket?.emit('next_hand'); },
    sendChat: (message) => socket?.emit('chat_message', { message }),
  };

  return {
    gameState, players, myInfo, chatMessages,
    notifications, error, trickAnimation, handResult,
    actions, setMyInfo,
  };
}
