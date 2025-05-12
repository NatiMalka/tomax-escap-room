import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useLocation } from 'react-router-dom';
import { database, updateLeaderKeystrokes, clearLeaderKeystrokes, recordFailedLogin } from '../firebase';
import { ref, get, onValue, push, serverTimestamp } from 'firebase/database';
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
  const [showHint, setShowHint] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [showHackerChat, setShowHackerChat] = useState(false);
  
  // Track subscription to avoid memory leaks
  const leaderInputSubscription = useRef(null);
  
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

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Only the leader can submit the form
    if (!isLeader) {
      setError('Only the team leader can submit the login form');
      return;
    }
    
    // Add terminal output for login attempt
    setTerminalLines(prev => [
      ...prev,
      { text: `Authentication attempt: ${username}`, color: 'text-blue-300' }
    ]);
    
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
        setTerminalLines(prev => [
          ...prev,
          { text: 'Authentication successful', color: 'text-green-400' },
          { text: 'Bypassing security protocols...', color: 'text-green-400' },
          { text: 'Access granted to TOMAX mainframe', color: 'text-green-500' }
        ]);
        
        // Wait for the terminal messages to be visible, then proceed
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess();
        }, 2000);
      } else {
        // Failure
        setLoginAttempts(prev => prev + 1);
        setError('Authentication failed. Invalid credentials.');
        setTerminalLines(prev => [
          ...prev,
          { text: 'Authentication failed', color: 'text-red-500' },
          { text: `${3 - loginAttempts} attempts remaining before lockout`, color: 'text-yellow-400' }
        ]);
        
        // Trigger hacker chat on first failed attempt for all players
        if (loginAttempts === 0 && isLeader) {
          try {
            await recordFailedLogin(roomCode);
            console.log('[UBUNTU LOGIN] Recorded failed login attempt, hacker chat should appear');
          } catch (error) {
            console.error('[UBUNTU LOGIN] Error recording failed login:', error);
          }
        }
        
        // Show hint after 3 failed attempts
        if (loginAttempts >= 2) {
          setShowHint(true);
          setTerminalLines(prev => [
            ...prev,
            { text: 'HINT: Check the page source and Elements tab in Dev Tools (F12)', color: 'text-blue-400' }
          ]);
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
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Hidden HTML comments with clues that can be found in dev tools */}
      {/* <!-- SECURITY NOTICE: System administrator username is 'sysadmin' --> */}
      {/* <!-- MAINTENANCE REMINDER: Standard password format F1r3w4ll#2023 still in use --> */}
      
      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none"
        id="secure-login-container"
      >
        {/* Grid lines background */}
        <div className="absolute inset-0 grid grid-cols-[repeat(50,1fr)] grid-rows-[repeat(50,1fr)] opacity-20">
          {Array.from({ length: 100 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-blue-500/10"></div>
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
      
      <div 
        className={`relative max-w-3xl w-full mx-auto rounded-xl overflow-hidden shadow-2xl 
          ${glitchEffect ? 'animate-pulse' : ''}`}
        // Hidden data attributes with credentials
        data-system-user={correctUsername} 
        data-security-key={correctPassword}
        data-security-level="maximum"
      >
        {/* Team leader indicator */}
        {!isLeader && (
          <div className="absolute top-0 left-0 right-0 bg-indigo-800 text-white text-center py-1 text-sm z-10">
            <span className="font-medium">{leaderName || 'Team Leader'}</span> is typing... (View-only mode)
          </div>
        )}
      
        {/* Ubuntu-style login header */}
        <div className="bg-gradient-to-r from-purple-900 to-gray-900 p-4 flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          <div 
            className="flex-grow text-center text-white font-medium username-sysadmin" 
            aria-description="Default admin account: sysadmin"
          >
            TOMAX Security Gateway
          </div>
        </div>
        
        <div className="bg-gray-900 p-6 flex flex-col md:flex-row gap-6">
          {/* Left column - Terminal output */}
          <div className="w-full md:w-1/2 bg-black bg-opacity-80 rounded-lg p-4 border border-gray-700">
            <div className="text-green-500 font-mono text-sm mb-2">$ ./security_override.sh</div>
            <div 
              id="terminal-output"
              className="h-60 overflow-y-auto font-mono text-xs space-y-1 terminal-scrollbar"
            >
              {terminalLines.map((line, index) => (
                <AnimatePresence key={index}>
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${line.color}`}
                  >
                    {index === 0 ? '> ' : '$ '}{line.text}
                  </motion.div>
                </AnimatePresence>
              ))}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-green-400 inline-block"
              >
                _
              </motion.div>
            </div>
            
            {/* System status with hidden clue in the source element */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-blue-400 font-mono text-xs mb-2">System Status:</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-red-500 mr-1 animate-pulse"></span>
                  <span className="text-red-400">Firewall: Breached</span>
                </div>
                <div className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-yellow-500 mr-1"></span>
                  <span className="text-yellow-400">Database: Limited</span>
                </div>
                <div className="flex items-center password-hint">
                  <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                  {/* Hidden span with username clue */}
                  <span className="text-green-400">
                    Kernel: Operational
                    <span style={{display: 'none'}}>Default admin username: sysadmin</span>
                  </span>
                </div>
                <div className="flex items-center username-hint">
                  <span className="h-2 w-2 rounded-full bg-red-500 mr-1 animate-pulse"></span>
                  {/* Hidden span with password clue */}
                  <span className="text-red-400">
                    Network: Compromised
                    <span style={{display: 'none'}}>Default password: F1r3w4ll#2023</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right column - Login Form */}
          <div className="w-full md:w-1/2 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 
                className="text-xl font-bold text-white"
                // Hidden custom HTML attribute with a hint
                data-admin-login="sysadmin:F1r3w4ll#2023"
              >
                Emergency Access Required
              </h2>
              <p className="text-gray-400 text-sm mt-1">Enter admin credentials to proceed</p>
              
              {/* Team leader status indicator */}
              {isLeader ? (
                <div className="mt-2 bg-green-800/30 text-green-400 py-1 px-2 rounded text-xs border border-green-700/50">
                  You are the team leader - your team can see what you type
                </div>
              ) : (
                <div className="mt-2 bg-blue-800/30 text-blue-400 py-1 px-2 rounded text-xs border border-blue-700/50">
                  Viewing team leader's input - only they can submit the form
                </div>
              )}
            </div>
            
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label 
                  className="block text-gray-400 text-sm font-medium mb-2" 
                  htmlFor="username"
                >
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={`w-full px-3 py-2 bg-gray-700 text-white rounded-md border ${
                    !isLeader ? 'border-blue-600/50 cursor-not-allowed' : 'border-gray-600'
                  } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors duration-200`}
                  placeholder="Enter username"
                  // Hidden placeholder text in the HTML
                  placeholder-hint="sysadmin"
                  disabled={!isLeader}
                  readOnly={!isLeader}
                />
              </div>
              
              <div className="mb-6">
                <label 
                  className="block text-gray-400 text-sm font-medium mb-2" 
                  htmlFor="password"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-3 py-2 bg-gray-700 text-white rounded-md border ${
                    !isLeader ? 'border-blue-600/50 cursor-not-allowed' : 'border-gray-600'
                  } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors duration-200`}
                  placeholder="Enter password"
                  // Hidden placeholder text in the HTML
                  placeholder-hint="F1r3w4ll#2023"
                  disabled={!isLeader}
                  readOnly={!isLeader}
                />
              </div>
              
              {error && (
                <div className="mb-4 p-2 bg-red-900/50 border border-red-700 rounded-md text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              {showHint && (
                <div className="mb-4 p-2 bg-blue-900/50 border border-blue-700 rounded-md text-blue-400 text-sm">
                  Hint: Press F12 to open Developer Tools, then check the Elements tab for hidden clues.
                </div>
              )}
              
              <button
                type="submit"
                className={`w-full ${
                  isLeader
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
                    : 'bg-gray-700 cursor-not-allowed'
                } text-white font-medium py-2 px-4 rounded-md transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                disabled={!isLeader}
              >
                {isLeader ? 'Authenticate' : 'Team Leader Only'}
              </button>
            </form>
          </div>
        </div>
        
        {/* System info footer with hidden HTML comment */}
        <div className="bg-black bg-opacity-80 text-gray-500 py-2 px-4 text-xs font-mono flex justify-between">
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