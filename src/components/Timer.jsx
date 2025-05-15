import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, serverTimestamp, get, update } from 'firebase/database';
import { database } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';

const Timer = ({ roomCode, gamePhase }) => {
  const [timeRemaining, setTimeRemaining] = useState(30 * 60); // 30 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showPenalty, setShowPenalty] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState(0);
  const [penaltyFormatted, setPenaltyFormatted] = useState("00:00");
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [showPenaltyCount, setShowPenaltyCount] = useState(false);
  
  // Audio refs
  const penaltyAudioRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Initialize timer when component mounts
  useEffect(() => {
    if (!roomCode) return;

    const timerRef = ref(database, `lobbies/${roomCode}/timer`);
    
    // Listen for timer updates
    const unsubscribe = onValue(timerRef, (snapshot) => {
      const timerData = snapshot.val();
      
      if (timerData) {
        // If timer is running, calculate remaining time based on server timestamp
        if (timerData.isRunning) {
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - timerData.startTime) / 1000);
          const remainingTime = Math.max(0, timerData.duration - elapsedSeconds);
          
          setTimeRemaining(remainingTime);
          setIsTimerRunning(true);
          setTimerStarted(true);
        } else {
          // If timer is not running, use the stored remaining time
          setTimeRemaining(timerData.remainingTime || timerData.duration);
          setIsTimerRunning(false);
          setTimerStarted(timerData.hasStarted || false);
        }

        // Update penalty count if it exists
        if (timerData.penalty && timerData.penalty.count !== undefined) {
          const newCount = timerData.penalty.count;
          if (newCount > 0 && newCount !== penaltyCount) {
            setPenaltyCount(newCount);
            setShowPenaltyCount(true);

            // Hide the count after 30 seconds
            setTimeout(() => {
              setShowPenaltyCount(false);
            }, 30000);
          }
        }

        // Handle penalty if it exists
        if (timerData.penalty && timerData.penalty.active) {
          const penaltySeconds = timerData.penalty.amount || 120; // Default to 2 minutes
          const formattedPenalty = timerData.penalty.formattedAmount || formatTime(penaltySeconds);
          
          setPenaltyAmount(penaltySeconds);
          setPenaltyFormatted(formattedPenalty);
          setShowPenalty(true);
          
          // Play penalty sound
          penaltyAudioRef.current?.play().catch(e => 
            console.error("[TIMER] Failed to play penalty audio:", e)
          );
          
          // Hide penalty message after 5 seconds
          setTimeout(() => {
            setShowPenalty(false);
          }, 8000);
          
          // Clear the penalty in Firebase - FIX: use proper object structure
          update(timerRef, {
            penalty: {
              ...timerData.penalty,
              active: false
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, [roomCode, penaltyCount]);

  // Check if we should start the timer (when game phase is 1 - first challenge)
  useEffect(() => {
    const startTimerIfNeeded = async () => {
      if (!roomCode || gamePhase !== 1 || timerStarted) return;

      const timerRef = ref(database, `lobbies/${roomCode}/timer`);
      const snapshot = await get(timerRef);
      const timerData = snapshot.val();

      // Only start timer if it hasn't been started before
      if (!timerData || !timerData.hasStarted) {
        await set(timerRef, {
          duration: 30 * 60, // 30 minutes in seconds
          startTime: Date.now(),
          isRunning: true,
          remainingTime: 30 * 60,
          hasStarted: true,
          penalty: {
            active: false,
            amount: 0,
            count: 0
          }
        });
      }
    };

    startTimerIfNeeded();
  }, [roomCode, gamePhase, timerStarted]);

  // Countdown timer
  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Pulse effect for last 5 minutes
  useEffect(() => {
    if (timeRemaining <= 300) {
      const pulseInterval = setInterval(() => {
        setPulse(prev => !prev);
      }, timeRemaining <= 60 ? 500 : 1000);
      
      return () => clearInterval(pulseInterval);
    }
  }, [timeRemaining]);

  // Determine timer color based on remaining time
  const getTimerColor = () => {
    if (timeRemaining <= 60) return 'text-red-500'; // Last minute
    if (timeRemaining <= 300) return 'text-orange-400'; // Last 5 minutes
    return 'text-green-400';
  };

  return (
    <>
      <motion.div 
        className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex flex-col items-center 
                  ${pulse && timeRemaining <= 60 ? 'bg-red-900/80' : 'bg-black/80'} 
                  backdrop-blur-sm border-2 ${timeRemaining <= 60 ? 'border-red-500' : timeRemaining <= 300 ? 'border-orange-400' : 'border-cyan-500'} 
                  drop-shadow-glow`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          boxShadow: timeRemaining <= 60 && pulse 
            ? '0 0 20px rgba(239, 68, 68, 0.7)' 
            : timeRemaining <= 300 && pulse 
              ? '0 0 15px rgba(251, 146, 60, 0.5)' 
              : '0 0 10px rgba(34, 211, 238, 0.3)'
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-sm text-gray-300 mb-1 font-bold tracking-wider">ESCAPE COUNTDOWN</div>
        <div className={`font-mono text-3xl font-bold ${getTimerColor()} flex items-center ${timeRemaining <= 300 ? 'animate-pulse' : ''}`}>
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="timer-digits">{formatTime(timeRemaining)}</span>
        </div>
        
        {/* Show penalties count if any */}
        <AnimatePresence>
          {showPenaltyCount && penaltyCount > 0 && (
            <motion.div 
              className="text-red-400 text-xs mt-1 font-medium flex items-center"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              PENALTIES: {penaltyCount}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Critical time alert */}
        {timeRemaining <= 60 && (
          <motion.div 
            className="text-red-500 text-xs mt-1 font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            SECURITY BREACH IMMINENT
          </motion.div>
        )}
      </motion.div>

      {/* Penalty notification overlay */}
      <AnimatePresence>
        {showPenalty && (
          <motion.div 
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div 
              className="bg-red-900/90 border-2 border-red-500 rounded-lg p-6 text-center max-w-md backdrop-blur-sm shadow-2xl shadow-red-500/30"
              initial={{ scale: 0.8, y: -50 }}
              animate={{ 
                scale: 1, 
                y: 0,
                boxShadow: '0 0 30px rgba(239, 68, 68, 0.6)'
              }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ 
                type: "spring", 
                stiffness: 500, 
                damping: 30 
              }}
            >
              <motion.div
                className="absolute -top-3 -right-3 bg-red-600 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold border-2 border-white"
                animate={{ scale: 1.2 }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 10,
                  duration: 0.5
                }}
              >
                {penaltyCount}
              </motion.div>
              
              <div className="text-red-500 text-4xl mb-3 font-bold flex justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                TIME PENALTY
              </div>
              <p className="text-white text-xl mb-4 font-semibold">SECURITY BREACH DETECTED</p>
              <p className="text-white mb-4">
                Incorrect login attempt! <br/>Security protocols have reduced your remaining time by:
              </p>
              <div className="text-red-400 text-3xl font-mono font-bold mb-4 animate-pulse">
                -{penaltyFormatted}
              </div>
              <motion.div 
                className="text-yellow-400 text-sm font-medium border border-yellow-500/30 bg-yellow-900/30 p-2 rounded"
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {penaltyCount > 1 ? 
                  `This is your ${penaltyCount}${penaltyCount === 2 ? 'nd' : penaltyCount === 3 ? 'rd' : 'th'} penalty! Be extremely careful!` : 
                  'Be careful with further login attempts!'}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay flash effect for penalty */}
      <AnimatePresence>
        {showPenalty && (
          <motion.div 
            className="fixed inset-0 bg-red-500/10 z-40 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          />
        )}
      </AnimatePresence>

      {/* Audio elements */}
      <audio ref={penaltyAudioRef} src="/sounds/penalty-alarm.mp3" preload="auto" />
      
      {/* Add some CSS for the glowing effect */}
      <style jsx="true">{`
        @keyframes glow {
          0% { text-shadow: 0 0 5px currentColor; }
          50% { text-shadow: 0 0 15px currentColor, 0 0 25px currentColor; }
          100% { text-shadow: 0 0 5px currentColor; }
        }
        
        .timer-digits {
          animation: ${timeRemaining <= 60 ? 'glow 1s infinite' : timeRemaining <= 300 ? 'glow 2s infinite' : 'none'};
        }
        
        .drop-shadow-glow {
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.5));
        }
      `}</style>
    </>
  );
};

export default Timer; 