import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue, update, push, serverTimestamp } from 'firebase/database';
import FileExplorer from './FileExplorer';
import FirewallStatus from './FirewallStatus';
import HackerChat from './HackerChat';

const SystemDesktop = ({ onMissionComplete }) => {
  const { roomCode } = useParams();
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showFirewall, setShowFirewall] = useState(false);
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [firewallActive, setFirewallActive] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [hackerMessageSent, setHackerMessageSent] = useState(false);
  const [useServerBackground, setUseServerBackground] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  
  // Check leader status
  useEffect(() => {
    if (!roomCode) return;
    
    const checkLeaderStatus = () => {
      const userId = new URLSearchParams(window.location.search).get('uid');
      if (!userId) return;
      
      const playerRef = ref(database, `lobbies/${roomCode}/players`);
      return onValue(playerRef, (snapshot) => {
        const players = snapshot.val() || {};
        
        // Find if current player is leader
        Object.values(players).forEach(player => {
          if (player.id === userId && player.isLeader) {
            setIsLeader(true);
          }
        });
      });
    };
    
    const unsubscribe = checkLeaderStatus();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomCode]);
  
  // Setup video background when component mounts
  useEffect(() => {
    // Setup the video to play as soon as it's loaded
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.error("Error playing video background:", err);
      });
    }
  }, []);
  
  // Update clock every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Play hacker success audio when component mounts
  useEffect(() => {
    if (!roomCode || audioPlayed) return;
    
    const audioStatusRef = ref(database, `lobbies/${roomCode}/hackerLoginAudio`);
    
    // Check if audio has already been played for this room
    onValue(audioStatusRef, (snapshot) => {
      const audioStatus = snapshot.val();
      
      // If leader and audio not played yet, trigger play for all
      if (isLeader && !audioStatus?.played) {
        update(ref(database, `lobbies/${roomCode}`), {
          hackerLoginAudio: {
            played: true,
            timestamp: Date.now()
          }
        });
      }
      
      // If audio should be played and we haven't played it locally
      if (audioStatus?.played && !audioPlayed) {
        if (audioRef.current) {
          audioRef.current.volume = 0.6; // Set volume to 60%
          audioRef.current.play()
            .then(() => {
              console.log("Hacker login success audio played");
              setAudioPlayed(true);
            })
            .catch(err => {
              console.error("Error playing audio:", err);
              // Still mark as played even if there's an error
              setAudioPlayed(true);
            });
        }
      }
    });
  }, [roomCode, isLeader, audioPlayed]);
  
  // Send hacker taunting message when audio plays
  useEffect(() => {
    if (!roomCode || !audioPlayed || hackerMessageSent) return;
    
    const hackerMessageStatusRef = ref(database, `lobbies/${roomCode}/hackerDesktopMessage`);
    
    // Check if message has already been sent for this room
    onValue(hackerMessageStatusRef, (snapshot) => {
      const messageStatus = snapshot.val();
      
      // If leader and message not sent yet, trigger message for all
      if (isLeader && !messageStatus?.sent) {
        update(ref(database, `lobbies/${roomCode}`), {
          hackerDesktopMessage: {
            sent: true,
            timestamp: Date.now()
          }
        });
        
        // Send the hacker message to the chat
        sendHackerMessage();
      }
    });
  }, [roomCode, isLeader, audioPlayed, hackerMessageSent]);
  
  // Send hacker message function
  const sendHackerMessage = async () => {
    if (!roomCode || hackerMessageSent) return;
    
    try {
      const chatRef = ref(database, `lobbies/${roomCode}/hackerChat`);
      
      // Send message with slight delay for dramatic effect
      setTimeout(async () => {
        await push(chatRef, {
          sender: 'hacker',
          text: "Well well… you finally made it in\n\nTook you long enough. I was starting to think the whole team was just a group of overpaid coffee addicts with fancy job titles\n\nBut hey, congrats – you've managed to log in. Cute\n\nDon't get too excited though. You're still playing in my system\n\nThe bomb is armed, the clock is ticking, and every second you waste brings your precious data closer to oblivion\n\nLet's see if your \"rockstar team\" can actually do something for once\n\nTick tock",
          timestamp: serverTimestamp()
        });
        
        setHackerMessageSent(true);
        console.log('[HACKER CHAT] Sent desktop taunting message');
      }, 2000); // Wait 2 seconds after audio before sending message
    } catch (error) {
      console.error('[HACKER CHAT] Error sending hacker message:', error);
    }
  };
  
  // Animation delay for initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFirstRender(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle PC icon click
  const handlePCClick = () => {
    // Only allow PC access if firewall is active
    if (!firewallActive) return;
    
    setShowFileExplorer(true);
    
    // Sync with Firebase so all players see it
    if (roomCode) {
      update(ref(database, `lobbies/${roomCode}/desktopState`), {
        fileExplorerOpen: true
      });
    }
  };
  
  // Handle Firewall icon click
  const handleFirewallClick = () => {
    // Toggle firewall window visibility
    setShowFirewall(prevState => !prevState);
    
    // Sync with Firebase so all players see the same state
    if (roomCode) {
      update(ref(database, `lobbies/${roomCode}/desktopState`), {
        firewallWindowOpen: !showFirewall
      });
    }
  };
  
  // Sync desktop state with Firebase
  useEffect(() => {
    if (!roomCode) return;
    
    const desktopRef = ref(database, `lobbies/${roomCode}/desktopState`);
    const unsubscribe = onValue(desktopRef, (snapshot) => {
      const state = snapshot.val();
      if (state) {
        setShowFileExplorer(!!state.fileExplorerOpen);
        setShowFirewall(!!state.firewallWindowOpen);
        setUseServerBackground(!!state.useServerBackground);
      }
    });
    
    return () => unsubscribe();
  }, [roomCode]);
  
  // Sync firewall status with Firebase
  useEffect(() => {
    if (!roomCode) return;
    
    // Initialize firewall state if it doesn't exist
    update(ref(database, `lobbies/${roomCode}`), {
      firewallState: {
        active: false,
        inputCode: '',
        typingUser: null
      }
    });
    
    const firewallRef = ref(database, `lobbies/${roomCode}/firewallState`);
    const unsubscribe = onValue(firewallRef, (snapshot) => {
      const state = snapshot.val();
      if (state) {
        setFirewallActive(!!state.active);
      }
    });
    
    return () => unsubscribe();
  }, [roomCode]);
  
  // Format time for display
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString();
  };
  
  // Close the firewall window
  const handleCloseFirewall = () => {
    setShowFirewall(false);
    
    // Sync with Firebase
    if (roomCode) {
      update(ref(database, `lobbies/${roomCode}/desktopState`), {
        firewallWindowOpen: false
      });
    }
  };
  
  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Hidden audio element for hacker login success sound */}
      <audio ref={audioRef} preload="auto">
        <source src="/hacker-clue/hacker login sucess.wav" type="audio/wav" />
      </audio>
      
      <motion.div 
        className="absolute inset-0 m-1 md:m-4 rounded-lg overflow-hidden flex flex-col bg-gray-900 border border-gray-700 shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Window title bar */}
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </div>
            <span className="text-white font-bold">TOMA-ESCAPE</span>
          </div>
          <div className="text-xs text-gray-400">
            SECURE TERMINAL
          </div>
        </div>

        {/* Desktop area with video wallpaper */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Background */}
          <div className="absolute inset-0 z-0">
            {useServerBackground ? (
              /* Server room background */
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
                {/* Server rack pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="grid grid-cols-8 grid-rows-6 h-full w-full gap-2 p-4">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <div key={i} className="bg-blue-500/30 rounded-sm border border-blue-400/20 relative">
                        <div className="absolute top-1 left-1 w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                        <div className="absolute top-1 right-1 w-1 h-1 bg-blue-400 rounded-full"></div>
                        <div className="absolute bottom-1 left-1 w-1 h-1 bg-yellow-400 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Animated data streams */}
                <div className="absolute inset-0 overflow-hidden">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                      style={{
                        top: `${20 + i * 15}%`,
                        left: '-100%',
                        width: '200%',
                        animation: `dataStream ${3 + i * 0.5}s linear infinite`
                      }}
                    />
                  ))}
                </div>
                
                {/* Dark overlay to ensure content visibility */}
                <div className="absolute inset-0 bg-black/30"></div>
              </div>
            ) : (
              /* Original video background */
              <>
                <video 
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src="/images/anonymous-mask.1920x1080.mp4" type="video/mp4" />
                </video>
                {/* Dark overlay to ensure content visibility */}
                <div className="absolute inset-0 bg-black/40"></div>
              </>
            )}
          </div>
          
          {/* Desktop Icons */}
          <div className="flex-1 p-4 grid grid-cols-6 md:grid-cols-12 gap-4 content-start relative z-10">
            <motion.div
              className={`flex flex-col items-center cursor-pointer p-2 rounded hover:bg-black/20 transition-colors duration-200 w-24 ${!firewallActive && 'opacity-50'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={firewallActive && isLeader ? handlePCClick : null}
              whileHover={firewallActive ? { scale: 1.05 } : {}}
              whileTap={firewallActive ? { scale: 0.95 } : {}}
            >
              <div className={`w-16 h-16 ${firewallActive ? 'bg-gradient-to-br from-blue-600 to-indigo-800' : 'bg-gradient-to-br from-gray-700 to-gray-900'} rounded-md shadow-lg flex items-center justify-center text-white`}>
                {firewallActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                )}
              </div>
              <span className="text-sm mt-1 text-white font-medium drop-shadow-md">System</span>
              
              {!firewallActive && (
                <span className="text-xs text-red-300 bg-red-900/60 px-2 py-0.5 rounded mt-1">LOCKED</span>
              )}
              
              {firewallActive && !isLeader && (
                <span className="text-xs text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded mt-1">Leader only</span>
              )}
            </motion.div>
            
            {/* Firewall Icon */}
            <motion.div
              className="flex flex-col items-center cursor-pointer p-2 rounded hover:bg-black/20 transition-colors duration-200 w-24"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={handleFirewallClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className={`w-16 h-16 ${firewallActive ? 'bg-gradient-to-br from-green-600 to-green-800' : 'bg-gradient-to-br from-red-600 to-red-900'} rounded-md shadow-lg flex items-center justify-center text-white relative overflow-hidden group`}>
                {/* Shield icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                
                {/* Pulsing effect for inactive firewall */}
                {!firewallActive && (
                  <div className="absolute inset-0 bg-red-500/20 animate-pulse"></div>
                )}
                
                {/* Scanning effect for active firewall */}
                {firewallActive && (
                  <div className="absolute h-full w-20 bg-gradient-to-r from-transparent via-green-300/30 to-transparent -left-20 animate-[scan_2s_linear_infinite]"></div>
                )}
              </div>
              <span className="text-sm mt-1 text-white font-medium drop-shadow-md">Firewall</span>
              
              <span className={`text-xs ${firewallActive ? 'text-green-300 bg-green-900/60' : 'text-red-300 bg-red-900/60'} px-2 py-0.5 rounded mt-1`}>
                {firewallActive ? 'PROTECTED' : 'DISABLED'}
              </span>
            </motion.div>
          </div>
          
          {/* Taskbar */}
          <motion.div
            className="h-12 bg-gray-900/90 backdrop-blur-md border-t border-gray-700 flex items-center px-4 text-white z-10"
            initial={{ y: 50 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
              <span className="text-lg font-bold">TOMA-ESCAPE</span>
            </div>
            
            <div className="flex-1"></div>
            
            <div className="flex items-center space-x-4">
              {!firewallActive && (
                <div className="flex items-center text-red-500 animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Firewall Down</span>
                </div>
              )}
              <div className="text-sm text-gray-300">
                {formatTime(currentTime)}
              </div>
              <div className="text-sm text-gray-300">
                {formatDate(currentTime)}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
      
      {/* Firewall Status Window */}
      <AnimatePresence>
        {showFirewall && (
          <FirewallStatus 
            isLeader={isLeader} 
            roomCode={roomCode} 
            onClose={handleCloseFirewall} 
          />
        )}
      </AnimatePresence>
      
      {/* File Explorer */}
      <AnimatePresence>
        {showFileExplorer && (
          <FileExplorer onClose={() => setShowFileExplorer(false)} isLeader={isLeader} />
        )}
      </AnimatePresence>

      {/* Hacker Chat */}
      <HackerChat />
      
      {/* Custom animations */}
      <style jsx>{`
        @keyframes scan {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(100% + 5rem)); }
        }
        
        @keyframes dataStream {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </motion.div>
  );
};

export default SystemDesktop; 