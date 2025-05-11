import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/ButtonSimple.jsx';
import GlitchText from '../components/GlitchText.jsx';
import { createLobby, joinLobby } from '../firebase';

const HomePage = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [joinFlow, setJoinFlow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate a random room code
  const generateRoomCode = () => {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const handleCreateStart = () => {
    setShowNameInput(true);
    setJoinFlow(false);
    setError('');
  };

  const handleJoinStart = () => {
    setShowJoinInput(true);
    setJoinFlow(true);
    setError('');
  };

  const handleCreateLobby = async () => {
    if (playerName.trim().length < 2) {
      setError("Please enter a name with at least 2 characters");
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const code = generateRoomCode();
      const playerData = {
        name: playerName.trim(),
        avatar: null
      };
      
      const { userId } = await createLobby(code, playerData);
      
      // Navigate to lobby with user ID for authentication reference
      navigate(`/lobby/${code}?uid=${userId}`);
    } catch (error) {
      console.error("Failed to create lobby:", error);
      setError("Failed to create lobby. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinLobby = async () => {
    if (roomCode.length < 4) {
      setError("Please enter a valid room code");
      return;
    }
    
    if (!showNameInput) {
      setShowNameInput(true);
      return;
    }
    
    if (playerName.trim().length < 2) {
      setError("Please enter a name with at least 2 characters");
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const playerData = {
        name: playerName.trim(),
        avatar: null
      };
      
      const { userId } = await joinLobby(roomCode, playerData);
      
      // Navigate to lobby with user ID for authentication reference
      navigate(`/lobby/${roomCode}?uid=${userId}`);
    } catch (error) {
      console.error("Failed to join lobby:", error);
      if (error.message === "Lobby not found") {
        setError("Room not found. Please check the code and try again.");
      } else {
        setError("Failed to join lobby. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Animation for the binary/code background
  const CodeRain = () => {
    return (
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none z-10">
        {Array.from({ length: 10 }).map((_, index) => (
          <motion.div
            key={index}
            className="absolute text-blue-500 text-xs font-mono whitespace-nowrap"
            initial={{ 
              top: -100, 
              left: `${index * 10}%`,
              opacity: 0.7
            }}
            animate={{ 
              top: '100vh',
              opacity: [0.7, 0.3, 0.7],
            }}
            transition={{ 
              duration: 10 + index * 2,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="my-1">
                {Math.random() > 0.5 ? '0' : '1'}
                {Math.random() > 0.5 ? '0' : '1'}
                {Math.random() > 0.7 ? '0' : '1'}
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    );
  };

  const renderInputForm = () => {
    if (showNameInput && !joinFlow) {
      // Create lobby flow - name input
      return (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="bg-gray-800/90 backdrop-blur-sm p-6 rounded-lg border border-blue-500/30 shadow-lg shadow-blue-800/20">
            <h2 className="text-xl text-blue-400 mb-4">Enter Your Agent Name</h2>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="AGENT NAME"
              className="px-4 py-3 w-full bg-gray-900 border border-blue-500/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              maxLength={15}
              autoFocus
              disabled={isLoading}
            />
            {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}
            
            <div className="flex gap-3">
              <Button 
                primary 
                onClick={handleCreateLobby}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create Lobby"}
              </Button>
              <Button 
                onClick={() => {
                  setShowNameInput(false);
                  setPlayerName('');
                  setError('');
                }}
                className="flex-1"
                disabled={isLoading}
              >
                Back
              </Button>
            </div>
          </div>
        </motion.div>
      );
    } else if (showJoinInput && joinFlow) {
      // Join lobby flow
      return (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="bg-gray-800/90 backdrop-blur-sm p-6 rounded-lg border border-red-500/30 shadow-lg shadow-red-800/20">
            <h2 className="text-xl text-red-400 mb-4">
              {showNameInput ? 'Enter Your Agent Name' : 'Enter Room Code'}
            </h2>
            
            {!showNameInput ? (
              // Room code input
              <>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  className="px-4 py-3 w-full bg-gray-900 border border-red-500/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 uppercase tracking-wider"
                  maxLength={6}
                  autoFocus
                  disabled={isLoading}
                />
                {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}
                
                <div className="flex gap-3">
                  <Button 
                    onClick={handleJoinLobby}
                    className="flex-1 shadow-lg shadow-red-600/25"
                    disabled={isLoading}
                  >
                    Next
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowJoinInput(false);
                      setRoomCode('');
                      setError('');
                    }}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                </div>
              </>
            ) : (
              // Agent name input
              <>
                <div className="flex items-center mb-4 bg-gray-900 p-2 rounded border border-red-500/20">
                  <span className="text-gray-400 mr-2">Room:</span>
                  <span className="font-mono text-white">{roomCode}</span>
                </div>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="AGENT NAME"
                  className="px-4 py-3 w-full bg-gray-900 border border-red-500/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                  maxLength={15}
                  autoFocus
                  disabled={isLoading}
                />
                {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <Button 
                    onClick={handleJoinLobby}
                    className="flex-1 shadow-lg shadow-red-600/25"
                    disabled={isLoading}
                  >
                    {isLoading ? "Joining..." : "Join Lobby"}
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowNameInput(false);
                      setError('');
                    }}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      );
    } else {
      // Default buttons
      return (
        <motion.div 
          className="flex flex-col md:flex-row justify-center gap-6 mt-12"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <Button 
            primary 
            large 
            onClick={handleCreateStart}
            className="shadow-lg shadow-blue-600/25"
          >
            Create Lobby
          </Button>

          <Button 
            large 
            onClick={handleJoinStart}
            className="shadow-lg shadow-red-600/25"
          >
            Join Lobby
          </Button>
        </motion.div>
      );
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gray-900 flex flex-col justify-center items-center overflow-hidden">
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: 'url(/images/image-homepage.jpg)' }}
      />
      
      {/* Darkening overlay */}
      <div className="absolute inset-0 bg-black/50 z-5" />
      
      {/* Matrix-style code rain */}
      <CodeRain />
      
      {/* Overlay glitch effect */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-red-900/10 pointer-events-none z-20"
        animate={{ 
          opacity: [0.2, 0.15, 0.2],
          background: [
            "radial-gradient(circle, rgba(3,29,82,0.1) 0%, rgba(9,9,54,0.1) 100%)",
            "radial-gradient(circle, rgba(82,3,3,0.1) 0%, rgba(54,9,9,0.1) 100%)",
            "radial-gradient(circle, rgba(3,29,82,0.1) 0%, rgba(9,9,54,0.1) 100%)"
          ]
        }}
        style={{ backgroundColor: 'rgba(0,0,0,0.001)' }}
        transition={{ 
          duration: 5, 
          repeat: Infinity,
          repeatType: "reverse"
        }}
      />

      <div className="relative z-30 container mx-auto px-4 py-12 text-center">
        {/* Logo and title */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-2">
            TOMAX: Digital Breach
          </h1>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            <p className="text-xl text-blue-400 max-w-2xl mx-auto mt-4">
              Defuse the bomb. Save the data. Time is running out...
            </p>
          </motion.div>
        </motion.div>

        {/* Input forms and buttons */}
        {renderInputForm()}

        {/* Footer note */}
        <motion.p 
          className="mt-16 text-gray-300 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          A hacker has breached TOMAX systems. Your team must work together to save the data.
        </motion.p>
      </div>
    </div>
  );
};

export default HomePage; 