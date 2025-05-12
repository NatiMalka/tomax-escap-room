import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { database } from '../firebase';
import { ref, push, onValue, serverTimestamp, get } from 'firebase/database';
import { useParams } from 'react-router-dom';

const HackerChat = () => {
  const { roomCode } = useParams();
  const [messages, setMessages] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [currentGamePhase, setCurrentGamePhase] = useState(1);
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [openFile, setOpenFile] = useState(null);
  
  // Sound effect references
  const messageAudioRef = useRef(null);
  const fileAudioRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Set of follow-up clues to reveal based on game phase and time
  const clues = [
    {
      phase: 1,
      delay: 300000, // 5 minutes after chat appears
      text: "Did you find the welcome_admin.txt file? Try accessing it directly in your browser by adding it to the end of the URL."
    },
    {
      phase: 2,
      delay: 30000, // 30 seconds after entering phase 2
      text: "Binary, Base64, ROT13... different layers of encoding for different layers of security. Decrypt them all to proceed."
    }
  ];

  // Initialize with the first hacker message
  useEffect(() => {
    if (!roomCode) return;
    
    // Set up listener for chat messages
    const chatRef = ref(database, `lobbies/${roomCode}/hackerChat`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert the object to an array and sort by timestamp
        const messageArray = Object.entries(data)
          .map(([id, msg]) => ({ id, ...msg }))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Check if we have a new message to play a sound
        if (messageArray.length > messages.length && !isFirstRender) {
          const newestMessage = messageArray[messageArray.length - 1];
          
          // Play appropriate sound based on message type
          if (soundEnabled) {
            if (newestMessage.isFile) {
              fileAudioRef.current?.play().catch(e => console.log("Audio play prevented:", e));
            } else if (!newestMessage.isFirstMessage) {
              messageAudioRef.current?.play().catch(e => console.log("Audio play prevented:", e));
            }
          }
        }
        
        setMessages(messageArray);
        
        // If chat is minimized, increment unread count
        if (!isExpanded && messageArray.length > messages.length) {
          setUnreadCount(prev => prev + (messageArray.length - messages.length));
        }
      }
    });

    // Set up listener for game phase to send phase-appropriate clues
    const phaseRef = ref(database, `lobbies/${roomCode}/gamePhase`);
    const phaseUnsubscribe = onValue(phaseRef, (snapshot) => {
      const phase = snapshot.val();
      if (phase !== null && phase !== undefined) {
        setCurrentGamePhase(phase);
      }
    });
    
    return () => {
      unsubscribe();
      phaseUnsubscribe();
    };
  }, [roomCode, messages.length, isExpanded, isFirstRender, soundEnabled]);

  // Set first render to false after component mounts
  useEffect(() => {
    // Add a small delay to ensure animation is visible
    const timer = setTimeout(() => {
      setIsFirstRender(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Preload audio files when component mounts
  useEffect(() => {
    // Try to preload audio files
    try {
      if (messageAudioRef.current) {
        messageAudioRef.current.load();
      }
      if (fileAudioRef.current) {
        fileAudioRef.current.load();
      }
    } catch (error) {
      console.error("Error preloading audio:", error);
    }
  }, []);

  // Send a message from the hacker
  const sendHackerMessage = async (message) => {
    if (!roomCode) return;
    
    try {
      const chatRef = ref(database, `lobbies/${roomCode}/hackerChat`);
      await push(chatRef, {
        sender: 'hacker',
        text: message,
        timestamp: serverTimestamp()
      });
      console.log('[HACKER CHAT] Sent hacker message:', message);
    } catch (error) {
      console.error('[HACKER CHAT] Error sending hacker message:', error);
    }
  };

  // Send periodic clues based on game phase
  useEffect(() => {
    if (!roomCode) return;
    
    const clueTimers = [];
    
    // Set up timers for clues relevant to the current phase
    clues.forEach(clue => {
      if (clue.phase === currentGamePhase) {
        // Check if this clue has already been sent
        const alreadySent = messages.some(msg => 
          msg.sender === 'hacker' && msg.text === clue.text
        );
        
        if (!alreadySent) {
          const timer = setTimeout(() => {
            sendHackerMessage(clue.text);
          }, clue.delay);
          
          clueTimers.push(timer);
        }
      }
    });
    
    return () => {
      // Clean up all timers when component unmounts or phase changes
      clueTimers.forEach(timer => clearTimeout(timer));
    };
  }, [roomCode, currentGamePhase, messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  // Toggle chat expansion
  const toggleChat = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setUnreadCount(0); // Clear unread count when expanding
    }
  };

  // Toggle sound
  const toggleSound = (e) => {
    e.stopPropagation(); // Prevent triggering chat toggle
    setSoundEnabled(!soundEnabled);
  };

  // Open file content in a modal
  const handleFileClick = (message) => {
    setOpenFile(message);
  };

  // Close the file modal
  const closeFileModal = () => {
    setOpenFile(null);
  };

  return (
    <>
      {/* Sound effect audio elements */}
      <audio ref={messageAudioRef} preload="auto">
        <source src="/hacker_message.mp3" type="audio/mp3" />
      </audio>
      <audio ref={fileAudioRef} preload="auto">
        <source src="/file_received.mp3" type="audio/mp3" />
      </audio>
    
      <motion.div 
        className={`fixed ${isExpanded ? 'w-80 md:w-96' : 'w-12'} 
          transition-all duration-300 z-[9999] bottom-0 right-4`}
        style={{ boxShadow: '0 0 15px rgba(185, 28, 28, 0.5)' }}
        initial={isFirstRender ? { y: 300, opacity: 0 } : { y: 0, opacity: 1 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 20,
          duration: 0.8
        }}
      >
        {/* Attention-grabbing pulse effect when chat first appears */}
        {isFirstRender && (
          <motion.div
            className="absolute -inset-2 rounded-full bg-red-600/40 z-[-1]"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.7, 1, 0] 
            }}
            transition={{ 
              duration: 2,
              repeat: 3,
              repeatType: "loop" 
            }}
          />
        )}
        
        {/* Chat header */}
        <motion.div 
          className="bg-red-900 text-white p-2 rounded-t-lg cursor-pointer flex items-center justify-between shadow-lg"
          onClick={toggleChat}
          whileHover={{ backgroundColor: '#991b1b' }}
          layout
        >
          <div className="flex items-center">
            <div className="h-2 w-2 bg-red-400 rounded-full animate-pulse mr-2"></div>
            {isExpanded && (
              <span className="font-mono text-sm font-bold">HACKER CONNECTION</span>
            )}
          </div>
          {!isExpanded && unreadCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </div>
          )}
          <div className="flex items-center">
            {isExpanded && (
              <button 
                className={`mr-3 text-xs rounded-full p-1 ${soundEnabled ? 'bg-green-600/50 hover:bg-green-600' : 'bg-red-800/50 hover:bg-red-800'} transition-colors`}
                onClick={toggleSound}
                title={soundEnabled ? "Mute sounds" : "Enable sounds"}
              >
                {soundEnabled ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>
            )}
            {isExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </div>
        </motion.div>

        {/* Chat body */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-900 border border-red-900 rounded-b-lg shadow-lg"
            >
              <div 
                ref={chatContainerRef}
                className="h-80 overflow-y-auto p-3 font-mono text-sm terminal-scrollbar"
              >
                <AnimatePresence>
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`mb-4 ${message.sender === 'hacker' ? 'text-red-400' : 'text-green-400'}`}
                    >
                      <div className="flex items-start">
                        <span className="text-xs opacity-70 mr-2">[{new Date(message.timestamp || Date.now()).toLocaleTimeString()}]</span>
                        <span className="mr-2">{message.sender === 'hacker' ? '>' : '>'}</span>
                        {message.isFile ? (
                          <div 
                            className="flex items-center cursor-pointer hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                            onClick={() => handleFileClick(message)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-red-300 underline">{message.fileName}</span>
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap font-mono inline-block">
                            {message.text}
                          </pre>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </AnimatePresence>
                
                {/* Cursor blink effect */}
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block w-2 h-4 bg-red-500 ml-1"
                ></motion.span>
              </div>

              {/* Visual effects to make the chat feel "hacked" */}
              <div className="relative h-10 w-full bg-gray-800 border-t border-red-900/50 p-2 flex items-center">
                <div className="text-red-400 text-xs opacity-70 cursor-not-allowed w-full">
                  <motion.div
                    initial={{ y: 0 }}
                    animate={{ y: [-1, 1, -1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    CONNECTION INTERCEPTED - COMMUNICATION OFFLINE
                  </motion.div>
                </div>
                
                {/* Glitch lines */}
                <motion.div 
                  className="absolute left-0 top-0 h-[1px] bg-red-500"
                  animate={{ 
                    width: ['0%', '100%', '0%'],
                    opacity: [0, 1, 0],
                    left: ['0%', '0%', '100%']
                  }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: 'loop' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <style jsx>{`
          .terminal-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .terminal-scrollbar::-webkit-scrollbar-track {
            background: #111;
          }
          .terminal-scrollbar::-webkit-scrollbar-thumb {
            background-color: #700;
            border-radius: 3px;
          }
        `}</style>
      </motion.div>

      {/* File Modal */}
      <AnimatePresence>
        {openFile && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeFileModal}
          >
            <motion.div 
              className="bg-gray-900 border-2 border-red-600 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* File header */}
              <div className="bg-red-900 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-white font-mono font-bold">{openFile.fileName}</h3>
                </div>
                <button 
                  className="text-white hover:text-red-200 transition-colors"
                  onClick={closeFileModal}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* File content */}
              <div className="p-4 font-mono text-white overflow-y-auto terminal-scrollbar max-h-[calc(90vh-4rem)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-red-400">// HACKER SECURED FILE //</div>
                  <div className="text-xs text-red-400">{new Date().toLocaleString()}</div>
                </div>
                <pre className="whitespace-pre-wrap bg-black/50 p-4 rounded border border-red-500/30 text-sm">
                  {openFile.text.replace(`[File: ${openFile.fileName}]`, '')}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default HackerChat; 