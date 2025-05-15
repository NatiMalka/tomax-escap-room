import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue } from 'firebase/database';
import { database } from '../firebase';
import { useParams } from 'react-router-dom';

// Polyfill for findLastIndex if not available in browser
if (!Array.prototype.findLastIndex) {
  Array.prototype.findLastIndex = function(callback) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (callback(this[i], i, this)) {
        return i;
      }
    }
    return -1;
  };
}

const KeypadLock = ({ onUnlock, onClose, fileName }) => {
  const { roomCode } = useParams();
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [shake, setShake] = useState(false);
  
  // The correct code is 2004 (year when TOMAX was founded, based on the clue)
  const correctCode = ['2', '0', '0', '4'];
  
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
  
  // Sync keypad state with Firebase for all users
  useEffect(() => {
    if (!roomCode) return;
    
    // Set up listener for keypad state
    const keypadRef = ref(database, `lobbies/${roomCode}/keypadState`);
    const unsubscribe = onValue(keypadRef, (snapshot) => {
      const keypadState = snapshot.val();
      if (keypadState && !success) {
        setCode(keypadState.code || ['', '', '', '']);
        setSuccess(keypadState.unlocked || false);
        
        if (keypadState.unlocked && onUnlock) {
          onUnlock();
        }
      }
    });
    
    return () => unsubscribe();
  }, [roomCode, onUnlock, success]);
  
  // Handle digit button press
  const handleDigitPress = (digit) => {
    if (!isLeader || success) return;
    
    const newCode = [...code];
    const emptyIndex = newCode.findIndex(d => d === '');
    
    if (emptyIndex !== -1) {
      newCode[emptyIndex] = digit;
      setCode(newCode);
      
      // Sync with Firebase
      update(ref(database, `lobbies/${roomCode}/keypadState`), {
        code: newCode,
      });
      
      // If this was the last digit, check the code
      if (emptyIndex === 3) {
        setTimeout(() => {
          checkCode(newCode);
        }, 500);
      }
    }
  };
  
  // Delete last entered digit
  const handleDelete = () => {
    if (!isLeader || success) return;
    
    const newCode = [...code];
    const lastFilledIndex = newCode.findLastIndex(d => d !== '');
    
    if (lastFilledIndex !== -1) {
      newCode[lastFilledIndex] = '';
      setCode(newCode);
      
      // Sync with Firebase
      update(ref(database, `lobbies/${roomCode}/keypadState`), {
        code: newCode,
      });
    }
  };
  
  // Clear the entire code
  const handleClear = () => {
    if (!isLeader || success) return;
    
    setCode(['', '', '', '']);
    
    // Sync with Firebase
    update(ref(database, `lobbies/${roomCode}/keypadState`), {
      code: ['', '', '', ''],
    });
  };
  
  // Check if the entered code is correct
  const checkCode = (codeToCheck) => {
    if (codeToCheck.join('') === correctCode.join('')) {
      setSuccess(true);
      setError('');
      
      // Update Firebase to show unlocked state to all players
      update(ref(database, `lobbies/${roomCode}/keypadState`), {
        unlocked: true,
        code: codeToCheck,
      });
      
      if (onUnlock) {
        onUnlock();
      }
    } else {
      setError('Invalid code. Try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      
      // Clear the code after a short delay
      setTimeout(() => {
        setCode(['', '', '', '']);
        update(ref(database, `lobbies/${roomCode}/keypadState`), {
          code: ['', '', '', ''],
        });
      }, 1000);
    }
  };
  
  // Format a digit for display
  const formatDigit = (digit, index) => {
    return digit ? '•' : '_';
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10001] p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className={`bg-gray-900 border-2 ${success ? 'border-green-600' : 'border-red-600'} rounded-lg shadow-2xl max-w-md w-full overflow-hidden`}
        initial={{ scale: 0.9, y: 20 }}
        animate={shake ? { scale: 1, y: 0, x: [0, -10, 10, -10, 10, 0] } : { scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        transition={shake ? { duration: 0.5 } : {}}
      >
        {/* Header */}
        <div className={`${success ? 'bg-green-900' : 'bg-red-900'} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-white font-mono font-bold text-lg">SECURE FILE: {fileName}</h3>
          </div>
          {success && (
            <button 
              className="text-white hover:text-green-200 transition-colors"
              onClick={onClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="p-6">
          {success ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="mb-4 flex justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-green-400 text-xl font-bold mb-3">File Unlocked!</h2>
              <p className="text-gray-300 mb-4">Access granted to secured file.</p>
              <button
                onClick={onClose}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors w-full"
              >
                View File Contents
              </button>
            </motion.div>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-center mb-6">
                  <h2 className="text-red-400 text-xl font-bold mb-2">Access Restricted</h2>
                  <p className="text-gray-300 text-base">Enter 4-digit security code to decrypt file</p>
                </div>
                
                {/* Separated hint */}
                <div className="flex justify-center mb-6">
                  <div className="text-amber-400 text-base bg-gray-800/90 py-2 px-5 rounded-md border border-amber-500/40 shadow-md inline-block">
                    <motion.span
                      animate={{ opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="font-bold tracking-wide"
                    >
                      When did it all begin?
                    </motion.span>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                      className="ml-2 text-xs text-amber-500/80"
                    >
                      (4 digits)
                    </motion.span>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <div className="relative">
                    {/* Code display */}
                    <div className="flex gap-4 mb-8 justify-center">
                      {code.map((digit, index) => (
                        <motion.div
                          key={index}
                          className="w-14 h-20 bg-gray-800 border-2 border-red-500/50 rounded-md flex items-center justify-center text-3xl font-mono shadow-lg shadow-red-500/10"
                          initial={{ rotateY: 0 }}
                          animate={{ rotateY: digit ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <span className={`text-white ${digit ? 'text-red-400 font-bold' : ''}`}>{formatDigit(digit, index)}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {error && (
                  <div className="text-red-500 text-center text-sm mb-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {error}
                    </motion.div>
                  </div>
                )}
                
                {/* Leadership status message */}
                {!isLeader && (
                  <div className="text-blue-400 text-center text-sm mb-4 bg-blue-900/20 border border-blue-500/30 rounded p-2">
                    Only the team leader can input the code
                  </div>
                )}
                
                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'delete'].map((key, index) => (
                    <motion.button
                      key={key}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ backgroundColor: typeof key === 'number' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)' }}
                      className={`
                        h-14 rounded-md flex items-center justify-center font-mono text-xl font-semibold
                        ${isLeader ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}
                        ${typeof key === 'number' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-700 text-red-400'}
                        ${!isLeader ? 'border border-blue-500/30' : 'border border-red-500/20'}
                        transition-all duration-200 hover:shadow-lg
                      `}
                      onClick={() => {
                        if (typeof key === 'number') {
                          handleDigitPress(key.toString());
                        } else if (key === 'delete') {
                          handleDelete();
                        } else if (key === 'clear') {
                          handleClear();
                        }
                      }}
                      disabled={!isLeader}
                    >
                      {key === 'delete' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                      ) : key === 'clear' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ) : (
                        key
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
              
              <div className="text-gray-200 text-sm mt-6 bg-gray-800 p-4 rounded-md border border-amber-500/30 shadow-lg">
                <p className="mb-3 text-amber-400 font-semibold text-center uppercase tracking-wider">Important Clue</p>
                <p className="mb-2">
                  Sometimes, in order to break forward, you need to know <span className="text-amber-400 font-bold">when it all began</span>.
                </p>
                <p className="mb-2">
                  Look in the place where stories of beginnings are told.
                </p>
                <p>
                  Where words like <span className="text-amber-400 font-bold">vision</span>, <span className="text-amber-400 font-bold">values</span>, and <span className="text-amber-400 font-bold">mission</span> actually mean something.
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default KeypadLock; 