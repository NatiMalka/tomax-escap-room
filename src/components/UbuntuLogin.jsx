import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useLocation } from 'react-router-dom';
import { database, updateLeaderKeystrokes, clearLeaderKeystrokes, recordFailedLogin, startGameTimer, applyTimePenalty } from '../firebase';
import { ref, get, onValue, update, push, serverTimestamp } from 'firebase/database';
import useHackerChat from './useHackerChat';

const UbuntuLogin = ({ onLoginSuccess }) => {
  const { roomCode } = useParams();
  const location = useLocation();
  const { sendHackerMessage } = useHackerChat(roomCode);
  
  // Get user ID from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const userId = searchParams.get('uid') || '';
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLeader, setIsLeader] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [showHackerChat, setShowHackerChat] = useState(false);
  const [isPenaltyApplied, setIsPenaltyApplied] = useState(false);
  
  // Track subscription to avoid memory leaks
  const leaderInputSubscription = useRef(null);
  const authMessageSubscription = useRef(null);
  
  const [terminalLines, setTerminalLines] = useState([
    { text: 'System booting...', color: 'text-green-400' },
    { text: 'TOMAX Security System v3.7.1', color: 'text-blue-400' },
    { text: 'Initializing security protocols...', color: 'text-green-400' },
    { text: 'WARNING: Unauthorized access detected', color: 'text-red-500' },
    { text: 'Emergency login required', color: 'text-yellow-400' },
  ]);

  // The correct credentials - in a real game these would be discovered through the dev tools
  const correctUsername = 'sysadmin';
  const correctPassword = 'F1r3w4ll#2023';

  // Add audio ref for error sound
  const errorSoundRef = useRef(null);

  // Check if the current user is the team leader
  useEffect(() => {
    const checkLeaderStatus = async () => {
      if (!roomCode || !userId) return;
      
      try {
        const playersRef = ref(database, `lobbies/${roomCode}/players`);
        const playersSnapshot = await get(playersRef);
        const players = playersSnapshot.val() || {};
        
        // Find current player and check if they're the leader
        const currentPlayer = Object.values(players).find(player => player.id === userId);
        if (currentPlayer) {
          console.log('[UBUNTU LOGIN] Checking leader status:', currentPlayer);
          setIsLeader(!!currentPlayer.isLeader);
          
          // Find the name of the leader for display purposes
          const leader = Object.values(players).find(player => player.isLeader);
          if (leader) {
            setLeaderName(leader.name || 'Team Leader');
          }
        }
      } catch (error) {
        console.error('[UBUNTU LOGIN] Error checking leader status:', error);
      }
    };
    
    checkLeaderStatus();
  }, [roomCode, userId]);
  
  // Set up real-time sync for leader's keystrokes
  useEffect(() => {
    if (!roomCode) return;
    
    // Clean up previous subscription if it exists
    if (leaderInputSubscription.current) {
      leaderInputSubscription.current();
      leaderInputSubscription.current = null;
    }
    
    // Only subscribe if we're not the leader (we're a viewer)
    if (!isLeader) {
      console.log('[UBUNTU LOGIN] Setting up keystroke sync for non-leader');
      const inputRef = ref(database, `lobbies/${roomCode}/leaderInput`);
      
      leaderInputSubscription.current = onValue(inputRef, (snapshot) => {
        const inputData = snapshot.val();
        if (inputData && syncEnabled) {
          console.log('[UBUNTU LOGIN] Received leader input data:', inputData);
          
          // Update local state to match leader's input
          if (inputData.username !== undefined) {
            setUsername(inputData.username || '');
          }
          if (inputData.password !== undefined) {
            setPassword(inputData.password || '');
          }
        }
      });
    }
    
    return () => {
      // Cleanup subscription when component unmounts
      if (leaderInputSubscription.current) {
        leaderInputSubscription.current();
        leaderInputSubscription.current = null;
      }
    };
  }, [roomCode, isLeader, syncEnabled]);

  // Add effect for component unmounting to clean up all subscriptions
  useEffect(() => {
    return () => {
      // Cleanup all subscriptions when component unmounts
      if (leaderInputSubscription.current) {
        leaderInputSubscription.current();
        leaderInputSubscription.current = null;
      }
      
      if (authMessageSubscription.current) {
        authMessageSubscription.current();
        authMessageSubscription.current = null;
      }
    };
  }, []);

  // Set up real-time sync for authentication messages
  useEffect(() => {
    if (!roomCode) return;
    
    // Clean up previous subscription if it exists
    if (authMessageSubscription.current) {
      authMessageSubscription.current();
      authMessageSubscription.current = null;
    }
    
    // Subscribe to authentication messages for all users
    console.log('[UBUNTU LOGIN] Setting up auth message sync');
    const authMessageRef = ref(database, `lobbies/${roomCode}/authMessage`);
    
    authMessageSubscription.current = onValue(authMessageRef, (snapshot) => {
      const authMessageData = snapshot.val();
      if (authMessageData) {
        console.log('[UBUNTU LOGIN] Received auth message data:', authMessageData);
        
        // Update local state with auth message data
        if (authMessageData.error !== undefined) {
          setError(authMessageData.error || '');
        }
        
        if (authMessageData.loginAttempts !== undefined) {
          setLoginAttempts(authMessageData.loginAttempts || 0);
        }
        
        // Update terminal lines if provided
        if (authMessageData.terminalLines) {
          setTerminalLines(prevLines => {
            // Filter out any lines that match the message pattern we're adding
            // to avoid duplicates if the leader has multiple failed attempts
            const filteredLines = prevLines.filter(line => 
              !line.text.includes('Authentication failed') && 
              !line.text.includes('Authentication successful') &&
              !line.text.includes('attempts remaining before lockout')
            );
            return [...filteredLines, ...authMessageData.terminalLines];
          });
        }
      }
    });
    
    return () => {
      // Cleanup subscription when component unmounts
      if (authMessageSubscription.current) {
        authMessageSubscription.current();
        authMessageSubscription.current = null;
      }
    };
  }, [roomCode]);

  // Start the timer when the component mounts (first challenge)
  useEffect(() => {
    const startTimer = async () => {
      if (!roomCode) return;
      
      try {
        console.log('[UBUNTU LOGIN] Starting game timer for first challenge');
        await startGameTimer(roomCode);
      } catch (error) {
        console.error('[UBUNTU LOGIN] Error starting game timer:', error);
      }
    };
    
    startTimer();
  }, [roomCode]);

  // Handle input changes for the leader
  const handleInputChange = async (fieldName, value) => {
    if (fieldName === 'username') {
      setUsername(value);
    } else if (fieldName === 'password') {
      setPassword(value);
    }
    
    // If we're the leader, sync this change to Firebase
    if (isLeader && roomCode) {
      try {
        await updateLeaderKeystrokes(roomCode, fieldName, value);
      } catch (error) {
        console.error(`[UBUNTU LOGIN] Error syncing ${fieldName}:`, error);
      }
    }
  };

  // Update authentication messages in Firebase
  const updateAuthMessage = async (data) => {
    if (!roomCode) return;
    
    try {
      const authMessageRef = ref(database, `lobbies/${roomCode}/authMessage`);
      await update(authMessageRef, {
        ...data,
        lastUpdated: Date.now()
      });
      console.log('[UBUNTU LOGIN] Updated auth message:', data);
    } catch (error) {
      console.error('[UBUNTU LOGIN] Error updating auth message:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Only the leader can submit the form
    if (!isLeader) {
      setError('Only the team leader can submit the login form');
      return;
    }
    
    // Add terminal output for login attempt
    const newTerminalLine = { text: `Authentication attempt: ${username}`, color: 'text-blue-300' };
    setTerminalLines(prev => [...prev, newTerminalLine]);
    
    // Temporarily disable sync to prevent flicker during animation
    setSyncEnabled(false);
    
    // Clear keystroke data from Firebase
    if (roomCode) {
      try {
        await clearLeaderKeystrokes(roomCode);
      } catch (error) {
        console.error('[UBUNTU LOGIN] Error clearing keystrokes:', error);
      }
    }
    
    // Simulate processing
    setTimeout(async () => {
      if (username === correctUsername && password === correctPassword) {
        // Success!
        const successLines = [
          { text: 'Authentication successful', color: 'text-green-400' },
          { text: 'Bypassing security protocols...', color: 'text-green-400' },
          { text: 'Access granted to TOMAX mainframe', color: 'text-green-500' }
        ];
        
        setTerminalLines(prev => [...prev, ...successLines]);
        
        // Sync success message with all players
        await updateAuthMessage({ 
          error: '',
          terminalLines: successLines
        });
        
        // Wait for the terminal messages to be visible, then proceed
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess();
        }, 2000);
      } else {
        // Failure
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        
        // Play error sound
        errorSoundRef.current?.play().catch(e => 
          console.error("[UBUNTU LOGIN] Failed to play error sound:", e)
        );
        
        const errorMsg = 'Authentication failed. Invalid credentials.';
        setError(errorMsg);
        
        // Time penalty after the first attempt
        let failureLines = [];
        if (newAttempts > 1) {
          // Apply time penalty
          try {
            // Apply 2-minute penalty
            const penaltyResult = await applyTimePenalty(roomCode, 120);
            setIsPenaltyApplied(true);
            
            if (penaltyResult && penaltyResult.success) {
              // Add detailed penalty warning to terminal
              failureLines = [
                { text: 'Authentication failed', color: 'text-red-500' },
                { text: 'SECURITY ALERT: Unauthorized access attempt detected', color: 'text-red-500' },
                { text: `TIME PENALTY APPLIED: -${penaltyResult.formattedPenalty}`, color: 'text-red-500' },
                { text: `Security protocols activated (Penalty #${penaltyResult.penaltyCount})`, color: 'text-red-500' },
                { text: `${3 - newAttempts} attempts remaining before lockout`, color: 'text-yellow-400' }
              ];
              
              // Optional - Add additional hacker chat message about penalties
              setTimeout(async () => {
                try {
                  if (isLeader) {
                    await sendHackerMessage(
                      'You think you can brute force your way in? How predictable. Every failed attempt costs you precious time... Tick tock.',
                      'hacker',
                      false
                    );
                  }
                } catch (e) {
                  console.error('[UBUNTU LOGIN] Error sending hacker penalty message:', e);
                }
              }, 3000);
            } else {
              throw new Error('Penalty application failed');
            }
          } catch (err) {
            console.error('[UBUNTU LOGIN] Error applying time penalty:', err);
            failureLines = [
              { text: 'Authentication failed', color: 'text-red-500' },
              { text: 'WARNING: Security protocols attempted to apply penalty', color: 'text-yellow-400' },
              { text: `${3 - newAttempts} attempts remaining before lockout`, color: 'text-yellow-400' }
            ];
          }
        } else {
          failureLines = [
            { text: 'Authentication failed', color: 'text-red-500' },
            { text: 'WARNING: Next failed attempt will result in time penalty', color: 'text-yellow-400' },
            { text: `${3 - newAttempts} attempts remaining before lockout`, color: 'text-yellow-400' }
          ];
        }
        
        setTerminalLines(prev => [...prev, ...failureLines]);
        
        // Sync failure message with all players
        await updateAuthMessage({
          error: errorMsg,
          loginAttempts: newAttempts,
          terminalLines: failureLines
        });
        
        // Trigger hacker chat on first failed attempt for all players
        if (loginAttempts === 0 && isLeader) {
          try {
            await recordFailedLogin(roomCode);
            console.log('[UBUNTU LOGIN] Recorded failed login attempt, hacker chat should appear');
          } catch (error) {
            console.error('[UBUNTU LOGIN] Error recording failed login:', error);
          }
        }
        
        // Re-enable sync after error handling
        setSyncEnabled(true);
      }
    }, 800);
  };

  // Simulated terminal typing effect
  useEffect(() => {
    const terminalElement = document.getElementById('terminal-output');
    if (terminalElement) {
      terminalElement.scrollTop = terminalElement.scrollHeight;
    }
  }, [terminalLines]);

  // Random background glitch effect
  const [glitchEffect, setGlitchEffect] = useState(false);
  
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitchEffect(true);
      setTimeout(() => setGlitchEffect(false), 150);
    }, Math.random() * 5000 + 2000);
    
    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <motion.div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Hidden HTML comments with clues that can be found in dev tools */}
      {/* <!-- SECURITY NOTICE: System administrator username is 'sysadmin' --> */}
      {/* <!-- MAINTENANCE REMINDER: Standard password format F1r3w4ll#2023 still in use --> */}
      
      {/* Enhanced cybersecurity background animation */}
      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none"
        id="secure-login-container"
      >
        {/* Digital rain effect */}
        <div className="absolute inset-0 opacity-20">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={`rain-${i}`}
              className="absolute text-green-500/30 text-xs font-mono whitespace-pre"
              initial={{ 
                top: `${Math.random() * 100}%`, 
                left: `${Math.random() * 100}%`,
                opacity: 0.3
              }}
              animate={{
                opacity: [0.1, 0.3, 0.1],
                top: ['0%', '100%'],
              }}
              transition={{ 
                duration: 15 + Math.random() * 20,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              {Array.from({ length: 10 }).map((_, j) => (
                <div key={j}>
                  {`${'0'.repeat(Math.floor(Math.random() * 10))}1${Math.random().toString(36).substring(2, 10)}`}
                </div>
              ))}
            </motion.div>
          ))}
        </div>

        {/* Scan lines effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent opacity-30 pointer-events-none" 
           style={{ backgroundSize: '100% 8px' }}>
        </div>
        
        {/* Grid lines background - more visible and dynamic */}
        <div className="absolute inset-0 grid grid-cols-[repeat(50,1fr)] grid-rows-[repeat(50,1fr)] opacity-15">
          {Array.from({ length: 100 }).map((_, i) => (
            <motion.div 
              key={i} 
              className="border-[0.5px] border-blue-500/10"
              animate={{
                borderColor: Math.random() > 0.9 
                  ? ['rgba(59, 130, 246, 0.1)', 'rgba(239, 68, 68, 0.1)', 'rgba(59, 130, 246, 0.1)'] 
                  : ['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.1)']
              }}
              transition={{ 
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                repeatType: "reverse"
              }}
            />
          ))}
        </div>
        
        {/* Animated code lines in background */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-green-500/30 text-xs font-mono whitespace-pre"
            initial={{ 
              top: `${Math.random() * 100}%`, 
              left: `${Math.random() * 100}%`,
              opacity: 0.3
            }}
            animate={{
              opacity: [0.1, 0.3, 0.1],
              top: `${Math.random() * 100}%`,
            }}
            transition={{ 
              duration: 10 + Math.random() * 20,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j}>
                {`${'0'.repeat(Math.floor(Math.random() * 10))}1${Math.random().toString(36).substring(2, 10)}`}
              </div>
            ))}
          </motion.div>
        ))}
      </div>
      
      {/* Hidden div with credentials */}
      <div style={{display: 'none'}} id="admin-credentials" className="secret-data sysadmin-password-hint">
        <span data-user="sysadmin">Administrator account</span>
        <span data-pass="F1r3w4ll#2023">Security protocol</span>
      </div>
      
      {/* Main login container - increased size and improved style */}
      <div 
        className={`relative max-w-5xl w-full mx-auto rounded-xl overflow-hidden shadow-2xl 
          ${glitchEffect ? 'animate-pulse' : ''}`}
        // Hidden data attributes with credentials
        data-system-user={correctUsername} 
        data-security-key={correctPassword}
        data-security-level="maximum"
      >
        {/* Floating circuit pattern decorations */}
        <motion.div 
          className="absolute -top-20 -right-20 w-64 h-64 opacity-30 pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="40" stroke="#4f46e5" strokeWidth="0.5" fill="none" />
            <circle cx="50" cy="50" r="30" stroke="#4f46e5" strokeWidth="0.5" fill="none" />
            <circle cx="50" cy="50" r="20" stroke="#4f46e5" strokeWidth="0.5" fill="none" />
            <path d="M50,10 L50,90 M10,50 L90,50 M25,25 L75,75 M25,75 L75,25" stroke="#4f46e5" strokeWidth="0.25" />
          </svg>
        </motion.div>
        
        <motion.div 
          className="absolute -bottom-20 -left-20 w-64 h-64 opacity-30 pointer-events-none"
          animate={{ rotate: -360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="40" stroke="#4f46e5" strokeWidth="0.5" fill="none" />
            <circle cx="50" cy="50" r="30" stroke="#4f46e5" strokeWidth="0.5" fill="none" />
            <circle cx="50" cy="50" r="20" stroke="#4f46e5" strokeWidth="0.5" fill="none" />
            <path d="M50,10 L50,90 M10,50 L90,50 M25,25 L75,75 M25,75 L75,25" stroke="#4f46e5" strokeWidth="0.25" />
          </svg>
        </motion.div>
        
        {/* Team leader indicator */}
        {!isLeader && (
          <div className="absolute top-0 left-0 right-0 bg-indigo-800 text-white text-center py-2 text-base z-10 font-medium tracking-wider border-b border-indigo-700/50">
            <span className="font-medium">{leaderName || 'Team Leader'}</span> is typing... (View-only mode)
          </div>
        )}
      
        {/* Modern header with elevated design */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-gray-900 p-4 flex items-center border-b border-indigo-700/50">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500 mr-2.5 shadow-lg shadow-red-500/30"></div>
          <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 mr-2.5 shadow-lg shadow-yellow-500/30"></div>
          <div className="w-3.5 h-3.5 rounded-full bg-green-500 mr-2.5 shadow-lg shadow-green-500/30"></div>
          <div 
            className="flex-grow text-center text-white font-medium username-sysadmin text-lg tracking-wider" 
            aria-description="Default admin account: sysadmin"
          >
            TOMAX Security Gateway
          </div>
        </div>
        
        <div className="bg-gray-900 p-6 md:p-10 flex flex-col md:flex-row gap-8">
          {/* Left column - Terminal output with enhanced style */}
          <div className="w-full md:w-1/2 bg-black bg-opacity-80 rounded-lg p-5 border border-gray-700 shadow-2xl relative overflow-hidden">
            {/* Terminal glowing effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent pointer-events-none"></div>
            
            <div className="text-green-500 font-mono text-sm mb-3 flex items-center">
              <span className="mr-2 text-gray-500">$</span>
              <span className="text-gray-300">./</span>
              <span className="text-cyan-400">security_override</span>
              <span className="text-gray-300">.sh</span>
            </div>
            
            <div 
              id="terminal-output"
              className="h-80 overflow-y-auto font-mono text-sm space-y-1.5 terminal-scrollbar"
            >
              {terminalLines.map((line, index) => (
                <AnimatePresence key={index}>
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${line.color} flex`}
                  >
                    <span className="text-gray-500 mr-2">{index === 0 ? '>' : '$'}</span>
                    <span>{line.text}</span>
                  </motion.div>
                </AnimatePresence>
              ))}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-green-400 inline-block h-4 w-2.5 bg-green-500"
              />
            </div>
            
            {/* System status with hidden clue in the source element - improved styling */}
            <div className="mt-5 pt-4 border-t border-gray-700/50">
              <div className="text-blue-400 font-mono text-sm mb-3 flex items-center">
                <span className="mr-2 text-gray-500">#</span>
                <span>System Status:</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                <div className="flex items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 mr-2 animate-pulse shadow-sm shadow-red-500"></span>
                  <span className="text-red-400">Firewall: Breached</span>
                </div>
                <div className="flex items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 mr-2 shadow-sm shadow-yellow-500/50"></span>
                  <span className="text-yellow-400">Database: Limited</span>
                </div>
                <div className="flex items-center password-hint">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2 shadow-sm shadow-green-500/50"></span>
                  {/* Hidden span with username clue */}
                  <span className="text-green-400">
                    Kernel: Operational
                    <span style={{display: 'none'}}>Default admin username: sysadmin</span>
                  </span>
                </div>
                <div className="flex items-center username-hint">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 mr-2 animate-pulse shadow-sm shadow-red-500/50"></span>
                  {/* Hidden span with password clue */}
                  <span className="text-red-400">
                    Network: Compromised
                    <span style={{display: 'none'}}>Default password: F1r3w4ll#2023</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right column - Login Form with enhanced style */}
          <div className="w-full md:w-1/2 bg-gray-800/90 backdrop-filter backdrop-blur-sm rounded-lg p-8 border border-gray-700/70 shadow-2xl relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/10 to-transparent pointer-events-none"></div>
            
            <div className="text-center mb-8">
              <div className="w-24 h-24 mx-auto bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-blue-600/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 
                className="text-2xl font-bold text-white mb-1"
                // Hidden custom HTML attribute with a hint
                data-admin-login="sysadmin:F1r3w4ll#2023"
              >
                Emergency Access Required
              </h2>
              <p className="text-gray-400 text-base mt-1">Enter admin credentials to proceed</p>
              
              {/* Team leader status indicator - improved */}
              {isLeader ? (
                <div className="mt-3 bg-green-800/30 text-green-400 py-2 px-3 rounded-md text-sm border border-green-700/50 shadow-inner">
                  You are the team leader - your team can see what you type
                </div>
              ) : (
                <div className="mt-3 bg-blue-800/30 text-blue-400 py-2 px-3 rounded-md text-sm border border-blue-700/50 shadow-inner">
                  Viewing team leader's input - only they can submit the form
                </div>
              )}
            </div>
            
            <form onSubmit={handleLogin}>
              <div className="mb-5">
                <label 
                  className="block text-gray-300 text-sm font-medium mb-2" 
                  htmlFor="username"
                >
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-700/80 text-white rounded-md border ${
                    !isLeader ? 'border-blue-600/50 cursor-not-allowed' : 'border-gray-600/50'
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none transition-colors duration-200 text-base tracking-wide shadow-inner`}
                  placeholder="Enter username"
                  // Hidden placeholder text in the HTML
                  placeholder-hint="sysadmin"
                  disabled={!isLeader}
                  readOnly={!isLeader}
                />
              </div>
              
              <div className="mb-6">
                <label 
                  className="block text-gray-300 text-sm font-medium mb-2" 
                  htmlFor="password"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-700/80 text-white rounded-md border ${
                    !isLeader ? 'border-blue-600/50 cursor-not-allowed' : 'border-gray-600/50'
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none transition-colors duration-200 text-base tracking-wide shadow-inner`}
                  placeholder="Enter password"
                  // Hidden placeholder text in the HTML
                  placeholder-hint="F1r3w4ll#2023"
                  disabled={!isLeader}
                  readOnly={!isLeader}
                />
              </div>
              
              {error && (
                <div className="mb-5 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                className={`w-full ${
                  isLeader
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
                    : 'bg-gray-700 cursor-not-allowed'
                } text-white font-medium py-3 px-4 rounded-md text-base transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 shadow-lg shadow-blue-700/20`}
                disabled={!isLeader}
              >
                {isLeader ? 'Authenticate' : 'Team Leader Only'}
              </button>
            </form>
          </div>
        </div>
        
        {/* System info footer with enhanced style */}
        <div className="bg-black/90 backdrop-filter backdrop-blur-sm text-gray-500 py-2.5 px-4 text-xs font-mono flex justify-between border-t border-gray-800/80">
          <div>TOMAX OS v4.5.2</div>
          <div className="flex space-x-4">
            <div className="text-green-400">[CPU: 87%]</div>
            <div className="text-yellow-400">[MEM: 1.2GB/4GB]</div>
            <div>
              <span className="text-blue-400 mr-1">root@tomax:</span>
              <span className="text-purple-400">~#</span>
              {/* Hiding credentials in source code */}
              {/* <!--
                DEVELOPER NOTE:
                Emergency access credentials:
                Username: sysadmin
                Password: F1r3w4ll#2023
                Please remove this comment before production deployment!
              --> */}
            </div>
          </div>
        </div>
      </div>
      
      {/* Export show hacker chat status */}
      {showHackerChat && (
        <div id="hacker-chat-trigger" data-show-chat="true" style={{ display: 'none' }}></div>
      )}
      
      {/* Add error sound for failed attempts */}
      <audio ref={errorSoundRef} src="/error-sound.mp3" preload="auto" />
      
      {/* Penalty alarm animation */}
      <AnimatePresence>
        {isPenaltyApplied && (
          <motion.div 
            className="fixed inset-0 bg-red-500/20 z-30 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            onAnimationComplete={() => {
              setIsPenaltyApplied(false);
              console.log('[UBUNTU LOGIN] Penalty animation completed, resetting flag');
            }}
          />
        )}
      </AnimatePresence>
      
      {/* CSS for terminal scrollbar */}
      <style jsx>{`
        .terminal-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .terminal-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        .terminal-scrollbar::-webkit-scrollbar-thumb {
          background-color: #333;
          border-radius: 3px;
        }
        
        /* Hidden CSS with clue */
        .secret-data[data-user="sysadmin"][data-pass="F1r3w4ll#2023"] {
          background: url('/admin-access.jpg');
        }
      `}</style>
    </motion.div>
  );
};

export default UbuntuLogin; 