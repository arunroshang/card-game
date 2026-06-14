import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { SocketProvider } from './hooks/useSocket';
import { HomePage } from './pages/RoomPage';
import { RoomPage } from './pages/RoomPage';

function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <div className="h-full">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
          </Routes>
        </div>
      </SocketProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
