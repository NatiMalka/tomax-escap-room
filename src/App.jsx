import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import Lobby from './pages/Lobby.jsx';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby/:roomCode?" element={<Lobby />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 