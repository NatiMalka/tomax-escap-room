import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ButtonSimple';
import GlitchText from '../components/GlitchText';
import PlayerList from '../components/PlayerList';
import GamePhases from '../components/GamePhases';
import HackerChat from '../components/HackerChat';
import Timer from '../components/Timer';
import { getLobbyData, leaveLobby, startGame, voteForLeader, clearLeaderVotes, markVideoEnded, updateGamePhase, database, initializeGameTimer } from '../firebase';
import { ref, set, get, update, onValue } from 'firebase/database';

// Mock data for demonstration - initially empty
const mockPlayers = [];

const Lobby = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get user ID from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const userId = searchParams.get('uid') || '';
  const userName = searchParams.get('name') || 'Anonymous';
  
  const [lobbyData, setLobbyData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Prevent multiple unmounts
  const hasUnmounted = useRef(false);
  const dataSubscription = useRef(null);
  
  // Add player readiness state
  const [isReady, setIsReady] = useState(false);
  
  // Leader selection state
  const [isLeader, setIsLeader] = useState(false);
  const [votedFor, setVotedFor] = useState(null);
  const [leaderVotes, setLeaderVotes] = useState({});
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [showLeaderSelection, setShowLeaderSelection] = useState(false);
  
  // Video playing state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  
  // Game phase tracking - now synced with Firebase
  const [gamePhase, setGamePhase] = useState(0); // 0: Lobby, 1: First puzzle (login), etc.
  
  // Track if hacker chat should be shown
  const [showHackerChat, setShowHackerChat] = useState(false);
  const [hackerFirstMessagePlayed, setHackerFirstMessagePlayed] = useState(false);
  const hackerFirstClueAudioRef = useRef(null);
  
  // Add state for background music
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  
  // One-time initialization
  useEffect(() => {
    if (!roomCode || !userId) {
      navigate('/');
      return;
    }
    
    // This ensures we only run this effect once
    if (dataSubscription.current) return;
    
    console.log("[LOBBY] Initial setup for room:", roomCode, "User:", userId);
    
    // First, make sure our player data exists in Firebase
    const ensurePlayerData = async () => {
      try {
        // Check if player already exists
        const playerRef = ref(database, `lobbies/${roomCode}/players/${userId}`);
        const snapshot = await get(playerRef);
        
        if (snapshot.exists()) {
          console.log("[LOBBY] Player already exists in Firebase:", snapshot.val());
          // Update last seen time
          await update(playerRef, { lastActive: Date.now() });
        } else {
          console.log("[LOBBY] Player not found in Firebase, adding player data");
          // Add player to Firebase
          const playerData = {
            id: userId,
            name: userName,
            // If this is first visit to lobby page, assume they're host
            isHost: true, 
            isReady: false, // Explicitly initialize isReady to false
            isLeader: false, // Not a leader by default
            votedFor: null, // No vote by default
            joinedAt: Date.now(),
            lastActive: Date.now()
          };
          
          await set(playerRef, playerData);
          console.log("[LOBBY] Added player to Firebase:", playerData);
        }
      } catch (err) {
        console.error("[LOBBY] Error ensuring player data:", err);
      }
    };
    
    // Call the function
    ensurePlayerData();
    
    // Set up Firebase listener
    dataSubscription.current = getLobbyData(roomCode, (data) => {
      if (!data) {
        console.log("[LOBBY] No data received for lobby");
        setError('Lobby not found or has been closed');
        setTimeout(() => navigate('/'), 3000);
        return;
      }
      
      console.log("[LOBBY] Received lobby data:", data);
      setLobbyData(data);
      
      // Update leader selection state
      if (data.leaderVotes) {
        setLeaderVotes(data.leaderVotes);
        console.log('[LOBBY] Leader votes:', data.leaderVotes);
      }
      
      if (data.selectedLeader) {
        setSelectedLeader(data.selectedLeader);
        console.log('[LOBBY] Selected leader:', data.selectedLeader);
      }
      
      // Process player data
      if (data.players) {
        const playersArray = Object.values(data.players);
        
        // Make sure the current user is in the list
        const currentPlayer = playersArray.find(p => p.id === userId);
        
        if (currentPlayer) {
          setIsHost(!!currentPlayer.isHost);
          
          // Update local ready state from Firebase data
          console.log('[LOBBY] Current player found in data:', currentPlayer);
          console.log('[LOBBY] Current player readiness state:', currentPlayer.isReady);
          console.log('[LOBBY] Current player leader state:', currentPlayer.isLeader);
          console.log('[LOBBY] Current player voted for:', currentPlayer.votedFor);
          
          // Update ready state
          const readyState = currentPlayer.isReady;
          console.log('[LOBBY] Raw readiness value from Firebase:', readyState, 'Type:', typeof readyState);
          
          if (readyState === true) {
            console.log('[LOBBY] Setting player as ready (true)');
            setIsReady(true);
          } else {
            console.log('[LOBBY] Setting player as not ready (false)');
            setIsReady(false);
          }
          
          // Update leader state
          setIsLeader(!!currentPlayer.isLeader);
          setVotedFor(currentPlayer.votedFor || null);
          
          console.log("[LOBBY] Updated local state - isHost:", !!currentPlayer.isHost, 
            "isReady:", currentPlayer.isReady,
            "isLeader:", !!currentPlayer.isLeader,
            "votedFor:", currentPlayer.votedFor);
        } else {
          console.log("[LOBBY] Current player not found in data, will be added locally");
        }
        
        // Set the players, filtering out any invalid entries
        setPlayers(playersArray.filter(p => p && p.id));
      } else {
        console.log("[LOBBY] No players found in lobby data");
        setPlayers([]);
      }
      
      // Check if game has started and handle synchronized video playback
      if (data.gameState === 'playing') {
        // If we haven't started a countdown yet
        if (countdown === null) {
          // Calculate how much time has passed since the host started the game
          const now = Date.now();
          const timeSinceStart = now - data.startTime;
          
          // If the start was less than 5 seconds ago, set appropriate countdown
          if (timeSinceStart < 5000) {
            // Calculate remaining countdown (starting from 5)
            const remainingCountdown = Math.ceil((5000 - timeSinceStart) / 1000);
            console.log(`[LOBBY] Game started ${timeSinceStart}ms ago, setting countdown to ${remainingCountdown}`);
            setCountdown(remainingCountdown);
          } else {
            // If more than 5 seconds have passed, go directly to video
            console.log(`[LOBBY] Game already started, showing video directly`);
            setCountdown(0);
            setIsVideoPlaying(true);
          }
        }
        
        // Sync game phase from Firebase
        if (data.gamePhase !== undefined) {
          console.log(`[LOBBY] Syncing game phase from Firebase: ${data.gamePhase}`);
          setGamePhase(data.gamePhase);
        }
        
        // Handle video ending synchronization
        if (data.videoEnded && !videoEnded) {
          console.log("[LOBBY] Video marked as ended by another player, synchronizing");
          setIsVideoPlaying(false);
          setVideoEnded(true);
        }
        
        // Check if hacker chat should be shown
        if (data.hackerChat && Object.keys(data.hackerChat).length > 0) {
          console.log("[LOBBY] Hacker chat messages detected, showing chat");
          setShowHackerChat(true);
        }
        
        // Check if a failed login was recorded
        if (data.loginFailed === true) {
          console.log("[LOBBY] Failed login detected, showing hacker chat");
          setShowHackerChat(true);
        }
      }
      
      setLoading(false);
    });
    
    // Ensure we properly cleanup when unmounting
    return () => {
      // Only do cleanup once
      if (hasUnmounted.current) return;
      hasUnmounted.current = true;
      
      console.log("[LOBBY] Component unmounting, cleaning up...");
      
      // Unsubscribe from Firebase
      if (dataSubscription.current) {
        dataSubscription.current();
        dataSubscription.current = null;
      }
      
      // Only leave the room if we're actually navigating away
      if (document.visibilityState === 'hidden' || window.onpagehide || window.onbeforeunload) {
        console.log("[LOBBY] Browser closing or navigating away, leaving lobby");
        leaveLobby(roomCode, userId).catch(e => console.error("Error leaving lobby:", e));
      }
    };
  }, [roomCode, userId, userName, navigate]);
  
  // Keep player alive in Firebase
  useEffect(() => {
    // Ping Firebase every 10 seconds to update lastActive
    const keepAliveInterval = setInterval(async () => {
      try {
        if (roomCode && userId) {
          const playerRef = ref(database, `lobbies/${roomCode}/players/${userId}/lastActive`);
          await set(playerRef, Date.now());
          console.log("[LOBBY] Updated lastActive timestamp");
        }
      } catch (err) {
        console.error("[LOBBY] Error updating lastActive:", err);
      }
    }, 10000);
    
    return () => clearInterval(keepAliveInterval);
  }, [roomCode, userId]);
  
  // Setup navigation and beforeunload handlers
  useEffect(() => {
    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log("[LOBBY] Page hidden, may be navigating away");
      } else {
        console.log("[LOBBY] Page visible again");
      }
    };
    
    // Handle before unload (closing tab/browser)
    const handleBeforeUnload = (e) => {
      console.log("[LOBBY] Page about to unload");
      // Attempt to leave the lobby
      if (roomCode && userId) {
        // No await here as the page is unloading
        leaveLobby(roomCode, userId).catch(console.error);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomCode, userId]);

  const handleCopyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleStartGame = async () => {
    try {
      console.log('[LOBBY] Starting game...');
      // Initialize the game timer
      await initializeGameTimer(roomCode);
      // Start the game (existing functionality)
      await startGame(roomCode);
    } catch (err) {
      console.error('[LOBBY] Error starting game:', err);
      setError('Failed to start game. Please try again.');
    }
  };

  const handleExitLobby = async () => {
    try {
      // Important: Flag this as a true navigation
      hasUnmounted.current = true;
      await leaveLobby(roomCode, userId);
      navigate('/');
    } catch (error) {
      console.error("Error leaving lobby:", error);
      // Still navigate away even if there's an error
      navigate('/');
    }
  };

  // Custom effect for the countdown
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Start the mission briefing video
      setIsVideoPlaying(true);
    }
  }, [countdown]);
  
  // Handle video end
  const handleVideoEnded = async () => {
    console.log("[LOBBY] Video ended");
    setVideoEnded(true);
    setIsVideoPlaying(false);
    
    // Don't pause the background music when video ends
    // as it should continue playing throughout the game
    
    try {
      // Mark video as ended for all players to see
      await markVideoEnded(roomCode);
      
      // Update game phase to 1 (login puzzle) for all players
      await updateGamePhase(roomCode, 1);
      console.log("[LOBBY] Updated game phase to 1 for all players");
    } catch (error) {
      console.error("[LOBBY] Error updating game state:", error);
    }
  };

  // Handle completion of a game phase
  const handlePhaseComplete = async (nextPhase) => {
    console.log(`[LOBBY] Phase ${nextPhase - 1} completed, moving to phase ${nextPhase}`);
    
    try {
      // Update game phase in Firebase for all players to stay in sync
      await updateGamePhase(roomCode, nextPhase);
      console.log(`[LOBBY] Updated game phase to ${nextPhase} for all players`);
    } catch (error) {
      console.error(`[LOBBY] Error updating game phase to ${nextPhase}:`, error);
    }
  };

  // Toggle player readiness
  const handleToggleReady = async () => {
    try {
      const newReadyState = !isReady;
      console.log(`[LOBBY] Toggling ready state. Current: ${isReady}, New: ${newReadyState}`);
      
      setIsReady(newReadyState);
      
      // Update player readiness in Firebase
      if (roomCode && userId) {
        console.log(`[LOBBY] Updating player readiness in Firebase: ${roomCode}, ${userId}, ${newReadyState}`);
        
        // Log reference path for clarity
        const playerRef = ref(database, `lobbies/${roomCode}/players/${userId}`);
        console.log('[LOBBY] Firebase reference path:', playerRef.toString());
        
        // Add isReady and update lastActive
        await update(playerRef, {
          isReady: newReadyState,
          lastActive: Date.now()
        });
        
        console.log(`[LOBBY] Player readiness updated successfully: ${newReadyState}`);
        
        // Verify the update was successful
        const updatedData = await get(playerRef);
        console.log(`[LOBBY] Player data after update:`, updatedData.val());
      } else {
        console.error(`[LOBBY] Missing roomCode or userId: roomCode=${roomCode}, userId=${userId}`);
      }
    } catch (err) {
      console.error("[LOBBY] Error updating readiness:", err);
      alert("Failed to update readiness. Please try again.");
    }
  };

  // Handle voting for a leader
  const handleVoteForLeader = async (candidateId) => {
    try {
      console.log(`[LOBBY] Voting for leader: ${candidateId}`);
      
      if (candidateId === votedFor) {
        console.log(`[LOBBY] Already voted for this player, canceling vote`);
        await voteForLeader(roomCode, userId, null); // Clear vote
      } else {
        // Vote for the selected candidate
        await voteForLeader(roomCode, userId, candidateId);
      }
    } catch (err) {
      console.error("[LOBBY] Error voting for leader:", err);
      alert("Failed to submit vote. Please try again.");
    }
  };

  // Host function to reset leader votes
  const handleResetLeaderVotes = async () => {
    try {
      if (!isHost) {
        console.log("[LOBBY] Only the host can reset leader votes");
        return;
      }
      
      console.log("[LOBBY] Resetting leader votes");
      await clearLeaderVotes(roomCode);
    } catch (err) {
      console.error("[LOBBY] Error resetting leader votes:", err);
      alert("Failed to reset votes. Please try again.");
    }
  };

  // Toggle leader selection UI visibility
  const toggleLeaderSelection = () => {
    setShowLeaderSelection(!showLeaderSelection);
  };

  // Function to check if all players are ready
  const areAllPlayersReady = () => {
    if (players.length <= 1) return false; // Need at least 2 players
    
    // Host is always considered ready
    const nonHostPlayers = players.filter(player => player.isHost !== true);
    return nonHostPlayers.length > 0 && nonHostPlayers.every(player => player.isReady === true);
  };

  // Grid animation
  const GridBackground = () => {
    return (
      <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
        <div className="w-full h-full grid grid-cols-12 grid-rows-12">
          {Array.from({ length: 144 }).map((_, index) => (
            <motion.div
              key={index}
              className="border border-blue-500/20"
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: Math.random() > 0.7 ? [0.1, 0.5, 0.1] : [0.1, 0.1, 0.1],
                backgroundColor: Math.random() > 0.9 
                  ? ['rgba(59, 130, 246, 0.05)', 'rgba(239, 68, 68, 0.05)', 'rgba(59, 130, 246, 0.05)'] 
                  : ['rgba(0, 0, 0, 0.001)', 'rgba(0, 0, 0, 0.001)', 'rgba(0, 0, 0, 0.001)']
              }}
              transition={{ 
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                repeatType: "reverse"
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // Add function to toggle background music
  const toggleBackgroundMusic = () => {
    if (!audioRef.current) return;
    
    if (isMusicMuted) {
      audioRef.current.play().catch(err => {
        console.error('[LOBBY] Error playing background music:', err);
      });
    } else {
      audioRef.current.pause();
    }
    
    setIsMusicMuted(!isMusicMuted);
  };

  // Start or stop background music based on video playing state
  useEffect(() => {
    if (isVideoPlaying && audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error('[LOBBY] Error playing background music:', err);
      });
    } else if (!isVideoPlaying && audioRef.current && !audioRef.current.paused) {
      // don't pause the audio here
      // audioRef.current.pause();
    }
  }, [isVideoPlaying]);

  // Effect to update audio muted state
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isMusicMuted) {
      audioRef.current.pause();
    } else if (!isVideoPlaying) {
      audioRef.current.play().catch(err => {
        console.error('[LOBBY] Error playing background music:', err);
      });
    }
  }, [isMusicMuted, isVideoPlaying]);

  // Watch for hacker chat messages to play audio when first message appears
  useEffect(() => {
    if (!roomCode || hackerFirstMessagePlayed) return;
    
    // Set up a one-time check for the first hacker message
    const checkForFirstHackerMessage = async () => {
      try {
        const chatRef = ref(database, `lobbies/${roomCode}/hackerChat`);
        const snapshot = await get(chatRef);
        const data = snapshot.val();
        
        if (data) {
          const messages = Object.values(data);
          const firstMessage = messages.find(msg => msg.isFirstMessage);
          
          if (firstMessage && !hackerFirstMessagePlayed) {
            console.log("[LOBBY] Found first hacker message, playing audio");
            // Play the hacker first clue audio
            hackerFirstClueAudioRef.current?.play().catch(e => 
              console.error("[LOBBY] Failed to play hacker audio:", e)
            );
            setHackerFirstMessagePlayed(true);
          }
        }
      } catch (error) {
        console.error("[LOBBY] Error checking for first hacker message:", error);
      }
    };
    
    // When hacker chat appears, check for first message
    if (showHackerChat) {
      checkForFirstHackerMessage();
      
      // Also set up a listener for future messages
      const chatRef = ref(database, `lobbies/${roomCode}/hackerChat`);
      const unsubscribe = onValue(chatRef, (snapshot) => {
        const data = snapshot.val();
        if (data && !hackerFirstMessagePlayed) {
          const messages = Object.values(data);
          const firstMessage = messages.find(msg => msg.isFirstMessage);
          
          if (firstMessage) {
            console.log("[LOBBY] New first hacker message detected, playing audio");
            hackerFirstClueAudioRef.current?.play().catch(e => 
              console.error("[LOBBY] Failed to play hacker audio:", e)
            );
            setHackerFirstMessagePlayed(true);
            unsubscribe(); // Remove listener after playing
          }
        }
      });
      
      return () => unsubscribe();
    }
  }, [roomCode, showHackerChat, hackerFirstMessagePlayed]);

  if (loading) {
    return (
      <div className="relative min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center py-8 px-4">
        <GridBackground />
        <div className="text-blue-400 text-xl">Loading lobby data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center py-8 px-4">
        <GridBackground />
        <div className="text-red-400 text-xl mb-4">{error}</div>
        <Button onClick={() => navigate('/')}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-gray-900 flex flex-col items-center py-8 px-4 overflow-hidden">
      {/* Background effects */}
      <GridBackground />
      
      {/* Glitchy overlay */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-red-900/10 pointer-events-none"
        animate={{ 
          opacity: [0, 0.05, 0],
          background: 'radial-gradient(circle, rgba(3,29,82,0.05) 0%, rgba(9,9,54,0.05) 100%)',
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity,
          repeatType: "reverse"
        }}
      />

      <motion.div 
        className="z-10 container mx-auto max-w-5xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">TOMA-ESCAPE</h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 md:mt-0"
          >
            <Button 
              onClick={handleExitLobby}
              className="!py-2 !px-4 text-sm shadow-lg hover:shadow-red-500/20 transition-all duration-300"
            >
              Exit Lobby
            </Button>
          </motion.div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column - Info cards */}
          <motion.div 
            className="w-full lg:w-2/5 flex flex-col gap-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {/* Room code card */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg shadow-blue-900/10 border border-gray-700/50">
              <h2 className="text-xl font-bold text-blue-400 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Room Code
              </h2>
              <div className="flex items-center mt-3">
                <div className="bg-gray-700/70 rounded-lg py-3 px-4 flex-grow text-center border border-gray-600/50">
                  <span className="font-mono text-xl tracking-widest font-bold text-white">{roomCode || 'ERROR'}</span>
                </div>
                <motion.button
                  onClick={handleCopyRoomCode}
                  className="ml-2 bg-blue-700 hover:bg-blue-600 py-3 px-4 rounded-lg transition-colors duration-200 shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {copySuccess ? (
                    <span>✓</span>
                  ) : (
                    <span>Copy</span>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Game instructions */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg shadow-blue-900/10 border border-gray-700/50">
              <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Mission Brief
              </h2>
              <p className="text-gray-300 mb-4">
                A hacker has breached TOMA-ESCAPE systems and planted a digital bomb. Your team must work together to:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center bg-blue-900/30 text-blue-400 rounded-full h-5 w-5 min-w-5 text-xs mr-2 mt-0.5">1</span>
                  <span className="text-gray-300">Solve puzzles to find the bomb's location</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center bg-blue-900/30 text-blue-400 rounded-full h-5 w-5 min-w-5 text-xs mr-2 mt-0.5">2</span>
                  <span className="text-gray-300">Decode the disarm sequence</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center bg-blue-900/30 text-blue-400 rounded-full h-5 w-5 min-w-5 text-xs mr-2 mt-0.5">3</span>
                  <span className="text-gray-300">Save the company's critical data</span>
                </li>
              </ul>
              <div className="mt-5 bg-red-900/20 rounded-lg p-3 border border-red-800/30">
                <p className="text-red-400 text-sm flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Time limit: {lobbyData?.settings?.timeLimit || 30} minutes
                </p>
              </div>
            </div>

            {/* Start game button - only visible for host */}
            {isHost && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Button 
                  primary
                  large
                  onClick={handleStartGame}
                  className="w-full mt-2 shadow-lg shadow-blue-600/25 !py-4 rounded-xl font-bold text-lg transition-all duration-300"
                  disabled={countdown !== null}
                >
                  {countdown !== null ? `Starting in ${countdown}...` : 'Start Game'}
                </Button>
              </motion.div>
            )}
          </motion.div>

          {/* Right column - Player list & Status */}
          <motion.div 
            className="w-full lg:w-3/5 flex flex-col gap-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {/* Player list */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg shadow-blue-900/10 border border-gray-700/50">
              <div className="flex justify-between items-center mb-4 border-b border-blue-400/20 pb-3">
                <h2 className="text-xl font-bold text-blue-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  Connected Players
                </h2>
                <span className="text-white bg-blue-600 px-2 py-1 rounded-full text-xs font-semibold">
                  {players.length}/6
                </span>
              </div>
              
              {players.length === 0 ? (
                <div className="text-gray-400 text-center py-10 border border-dashed border-gray-700 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p>Waiting for players to join...</p>
                  {userId && (
                    <p className="mt-2 text-blue-400 text-sm">You are connected as host.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {players.map((player) => {
                    if (!player || !player.id) return null;
                    
                    const playerName = player?.name || 'Anonymous';
                    const playerId = player?.id || '';
                    const isCurrentPlayer = playerId === userId;
                    const isHostPlayer = player.isHost === true;
                    
                    return (
                      <div
                        key={playerId}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg transition-all duration-300
                          ${isCurrentPlayer ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-gray-700/40'}
                          ${isHostPlayer ? 'ring-1 ring-yellow-500/50' : ''}
                        `}
                      >
                        {/* Player Avatar */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center overflow-hidden
                          ${isHostPlayer 
                            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' 
                            : 'bg-gradient-to-br from-blue-400 to-purple-500'
                          }`}>
                          <span className="text-lg font-bold text-white">{playerName.charAt(0).toUpperCase()}</span>
                        </div>
                        
                        {/* Player Info */}
                        <div className="flex-grow">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">
                              {playerName}
                            </p>
                            {isCurrentPlayer && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">You</span>
                            )}
                            <span className={`text-xs ${isHostPlayer ? 'bg-yellow-500' : 'bg-green-500'} text-white px-2 py-0.5 rounded-full`}>
                              {isHostPlayer ? 'Host' : 'Agent'}
                            </span>
                            {player.isLeader && (
                              <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                                Leader
                              </span>
                            )}
                          </div>
                          
                          <div className="text-xs text-gray-300 mt-1">
                            {isHostPlayer ? (
                              <span className="flex items-center text-yellow-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Game Host
                              </span>
                            ) : (
                              <span className="flex items-center text-green-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                Joined
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Status Indicator */}
                        <div className="flex-shrink-0">
                          <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Game Status */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg shadow-blue-900/10 border border-gray-700/50">
              <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Team Readiness
              </h2>
              
              {/* Overall readiness bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Mission Readiness</span>
                  <span className="text-sm font-semibold text-blue-400">
                    {/* Calculate percentage of ready players */}
                    {(() => {
                      // Get players who are either ready or are hosts
                      const readyPlayers = players.filter(p => p.isReady === true || p.isHost === true).length;
                      // Don't count hosts twice
                      const totalPlayers = players.length;
                      const percentage = totalPlayers > 0 ? Math.round((readyPlayers / totalPlayers) * 100) : 0;
                      return `${percentage}%`;
                    })()}
                  </span>
                </div>
                <div className="h-3 w-full bg-gray-700/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(() => {
                        // Get players who are either ready or are hosts
                        const readyPlayers = players.filter(p => p.isReady === true || p.isHost === true).length;
                        // Don't count hosts twice
                        const totalPlayers = players.length;
                        const percentage = totalPlayers > 0 ? Math.round((readyPlayers / totalPlayers) * 100) : 0;
                        return percentage;
                      })()}%` 
                    }}
                  ></div>
                </div>
              </div>
              
              {/* Player status cards */}
              <div className="space-y-3 mb-4">
                {players.map(player => {
                  // Only show as ready if they're actually ready or if they're the host
                  const isPlayerReady = player.isReady === true || player.isHost === true;
                  
                  return (
                    <div key={player.id} className="bg-gray-700/30 rounded-lg overflow-hidden">
                      <div className="flex items-center p-3">
                        {/* Player avatar */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3
                          ${player.isHost 
                            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' 
                            : 'bg-gradient-to-br from-blue-400 to-purple-500'
                          }`}>
                          <span className="text-sm font-bold text-white">{player?.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        
                        {/* Player name and status */}
                        <div className="flex-grow">
                          <div className="flex items-center">
                            <span className="font-medium text-sm text-white">{player.name}</span>
                            {player.id === userId && (
                              <span className="ml-2 text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">You</span>
                            )}
                            {player.isHost && (
                              <span className="ml-2 text-xs bg-yellow-500/30 text-yellow-300 px-2 py-0.5 rounded-full">Host</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Ready status */}
                        <div className="flex-shrink-0">
                          {isPlayerReady ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-green-400" fill="currentColor" viewBox="0 0 8 8">
                                <circle cx="4" cy="4" r="3" />
                              </svg>
                              Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-gray-400" fill="currentColor" viewBox="0 0 8 8">
                                <circle cx="4" cy="4" r="3" />
                              </svg>
                              Waiting
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Individual readiness bar */}
                      <div className="h-1.5 w-full bg-gray-700/70">
                        <div 
                          className={`h-full transition-all duration-700 ease-in-out ${
                            isPlayerReady 
                              ? 'bg-gradient-to-r from-green-400 to-emerald-500 w-full' 
                              : 'bg-gradient-to-r from-gray-500 to-gray-600 w-0'
                          }`}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Readiness action button */}
              {!isHost ? (
                <button 
                  className={`w-full mt-3 bg-gradient-to-r ${isReady 
                    ? 'from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700' 
                    : 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                  } text-white font-medium py-2.5 px-4 rounded-lg shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${isReady ? 'focus:ring-orange-500' : 'focus:ring-green-500'}`}
                  onClick={(e) => {
                    console.log('[LOBBY] Ready button clicked. Current state:', isReady);
                    handleToggleReady();
                  }}
                >
                  {isReady ? 'I\'m Not Ready' : 'I\'m Ready'}
                </button>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-blue-400 mb-2">You are the host. Start the game when everyone is ready.</p>
                  {players.length > 1 && !players.every(p => p.isReady === true || p.isHost === true) && (
                    <p className="text-xs text-yellow-400">Waiting for all agents to be ready...</p>
                  )}
                </div>
              )}
            </div>
            
            {/* Team Leader Selection */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg shadow-blue-900/10 border border-gray-700/50 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-blue-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Team Leader
                </h2>
                
                {isHost && (
                  <button 
                    onClick={handleResetLeaderVotes}
                    className="text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 px-2 py-1 rounded-md transition-colors duration-200"
                  >
                    Reset Votes
                  </button>
                )}
              </div>
              
              {/* Leader description */}
              <div className="mb-4">
                <p className="text-sm text-gray-300 mb-2">
                  The team leader will have exclusive control over puzzle interactions during the mission.
                  Support agents provide assistance but cannot directly control the puzzles.
                </p>
                
                {selectedLeader ? (
                  <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
                    <p className="text-blue-300 font-medium">
                      {players.find(p => p.id === selectedLeader)?.name || 'Unknown'} has been selected as team leader
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={toggleLeaderSelection}
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-lg transition-all duration-300"
                  >
                    {showLeaderSelection ? 'Hide Selection' : 'Choose Team Leader'}
                  </button>
                )}
              </div>
              
              {/* Leader selection area */}
              {showLeaderSelection && !selectedLeader && (
                <div className="mt-4 space-y-3">
                  <p className="text-indigo-300 text-sm font-medium mb-2">Vote for a team leader:</p>
                  
                  {players.map(player => {
                    // Calculate votes for this player
                    const playerVotes = leaderVotes[player.id] 
                      ? Object.keys(leaderVotes[player.id]).length 
                      : 0;
                    
                    // Check if current user voted for this player
                    const isVotedFor = votedFor === player.id;
                    
                    // Check if this player is already chosen as leader
                    const isChosen = player.isLeader;
                    
                    return (
                      <div 
                        key={player.id}
                        className={`
                          relative p-3 rounded-lg cursor-pointer transition-all duration-300
                          ${isVotedFor ? 'bg-purple-900/50 border-2 border-purple-500/50' : 'bg-gray-700/30 border border-gray-600/50 hover:border-purple-500/30'}
                          ${isChosen ? 'bg-blue-900/50 border-2 border-blue-500/50' : ''}
                        `}
                        onClick={() => handleVoteForLeader(player.id)}
                      >
                        <div className="flex items-center">
                          {/* Player avatar */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3
                            ${player.isHost 
                              ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' 
                              : 'bg-gradient-to-br from-blue-400 to-purple-500'
                            }`}>
                            <span className="text-sm font-bold text-white">{player?.name?.charAt(0).toUpperCase()}</span>
                          </div>
                          
                          {/* Player info */}
                          <div className="flex-grow">
                            <div className="flex items-center">
                              <span className="font-medium text-sm text-white">{player.name}</span>
                              {player.id === userId && (
                                <span className="ml-2 text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">You</span>
                              )}
                              {player.isHost && (
                                <span className="ml-2 text-xs bg-yellow-500/30 text-yellow-300 px-2 py-0.5 rounded-full">Host</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Vote count */}
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-purple-300">{playerVotes} vote{playerVotes !== 1 ? 's' : ''}</span>
                            
                            {isVotedFor && (
                              <span className="h-4 w-4 flex items-center justify-center bg-purple-500 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Vote progress bar */}
                        <div className="mt-2 h-1 w-full bg-gray-700/70">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, (playerVotes / players.length) * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* If leader is selected, show details */}
              {selectedLeader && (
                <div className="mt-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Team Leader Responsibilities:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li className="text-xs text-gray-300">Interact directly with puzzles</li>
                      <li className="text-xs text-gray-300">Make final decisions on solutions</li>
                      <li className="text-xs text-gray-300">Communicate with support agents</li>
                    </ul>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-gray-400">Support Agent Responsibilities:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li className="text-xs text-gray-300">Provide guidance and ideas</li>
                      <li className="text-xs text-gray-300">Research information that might help</li>
                      <li className="text-xs text-gray-300">Keep track of discovered clues</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Countdown overlay */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
          <motion.div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ 
                scale: [0.5, 1.2, 1], 
                opacity: 1,
                textShadow: ["0 0 10px rgba(239, 68, 68, 0.7)", "0 0 20px rgba(239, 68, 68, 0.9)", "0 0 10px rgba(239, 68, 68, 0.7)"]
              }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="text-9xl font-bold text-red-500 relative"
            >
              <span className="text-9xl font-bold">{countdown}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background music that plays throughout the game */}
      <audio 
        ref={audioRef}
        src="/dark-mysterious-true-crime-music-loopable-235870.mp3"
        loop
        preload="auto"
      />
      
      {/* Hacker first clue audio */}
      <audio 
        ref={hackerFirstClueAudioRef}
        src="/hacker-clue/hacker first clue.wav"
        preload="auto"
      />

      {/* Hacker Video Overlay */}
      <AnimatePresence>
        {isVideoPlaying && (
          <motion.div
            className="fixed inset-0 bg-black flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                className="max-w-full max-h-full object-contain"
                src="/Hacker Computer  Mask Criminal.mp4"
                autoPlay
                playsInline
                muted={false}
                onEnded={handleVideoEnded}
                controls={false}
              />
              
              {/* Skip button - only visible to host */}
              {isHost && (
                <button 
                  className="absolute bottom-8 right-8 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md shadow-lg transition-colors duration-200"
                  onClick={handleVideoEnded}
                >
                  Skip Video
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Phases - Show when video has ended */}
      {videoEnded && gamePhase > 0 && (
        <GamePhases 
          currentPhase={gamePhase}
          onPhaseComplete={handlePhaseComplete}
        />
      )}
      
      {/* Hacker Chat - Appears only after failed login attempt */}
      {showHackerChat && <HackerChat />}

      {/* Floating music control button */}
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={toggleBackgroundMusic}
          className={`p-3 rounded-full transition-colors duration-200 ${
            isMusicMuted ? 'bg-red-800 hover:bg-red-700' : 'bg-green-800 hover:bg-green-700'
          }`}
          title={isMusicMuted ? "Unmute background music" : "Mute background music"}
        >
          {isMusicMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      </div>

      {/* Show the timer only when the game has started (gamePhase > 0) */}
      {gamePhase > 0 && <Timer roomCode={roomCode} gamePhase={gamePhase} />}
    </div>
  );
};

export default Lobby; 