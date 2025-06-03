import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ref, onValue, update, push, serverTimestamp } from 'firebase/database';
import { database, applyTimePenalty } from '../firebase';

const FirewallStatus = ({ isLeader, roomCode, onClose }) => {
  const [firewallActive, setFirewallActive] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [shake, setShake] = useState(false);
  const [isPenaltyApplied, setIsPenaltyApplied] = useState(false);
  const [isInputActive, setIsInputActive] = useState(false);
  
  // New states for virus scan and reboot sequence
  const [showVirusScan, setShowVirusScan] = useState(false);
  const [virusScanProgress, setVirusScanProgress] = useState(0);
  const [scanningFile, setScanningFile] = useState('');
  const [showRebootRequired, setShowRebootRequired] = useState(false);
  const [showRebootScreen, setShowRebootScreen] = useState(false);
  const [rebootProgress, setRebootProgress] = useState(0);
  const [systemReady, setSystemReady] = useState(false);
  const [systemRebooted, setSystemRebooted] = useState(false);
  
  // State for tracking after-reboot message
  const [afterRebootMessageSent, setAfterRebootMessageSent] = useState(false);
  
  const inputRef = useRef(null);
  const errorSoundRef = useRef(null);
  const afterRebootAudioRef = useRef(null);
  
  const correctCode = '876';
  
  // Position state with initial centered position
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Sync with firebase
  useEffect(() => {
    if (!roomCode) return;
    
    const firewallRef = ref(database, `lobbies/${roomCode}/firewallState`);
    
    // Initialize firewall state if it doesn't exist, but don't overwrite existing values
    
    // Check if firewall state exists first
    onValue(firewallRef, (snapshot) => {
      const existingData = snapshot.val();
      
      // Only initialize if no data exists
      if (!existingData) {
        update(ref(database, `lobbies/${roomCode}`), {
          firewallState: {
            active: false,
            inputCode: '',
            typingUser: null,
            position: { x: 0, y: 0 },
            error: '',
            failedAttempts: 0,
            isInputActive: false,
            showVirusScan: false,
            virusScanProgress: 0,
            scanningFile: '',
            showRebootRequired: false,
            showRebootScreen: false,
            rebootProgress: 0,
            systemReady: false,
            systemRebooted: false
          }
        });
      }
    }, { onlyOnce: true });
    
    const unsubscribe = onValue(firewallRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFirewallActive(data.active);
        setInputCode(data.inputCode || '');
        setTypingUser(data.typingUser);
        setError(data.error || '');
        setFailedAttempts(data.failedAttempts || 0);
        setIsInputActive(data.isInputActive || false);
        
        // Sync virus scan and reboot states
        setShowVirusScan(data.showVirusScan || false);
        setVirusScanProgress(data.virusScanProgress || 0);
        setScanningFile(data.scanningFile || '');
        setShowRebootRequired(data.showRebootRequired || false);
        setShowRebootScreen(data.showRebootScreen || false);
        setRebootProgress(data.rebootProgress || 0);
        setSystemReady(data.systemReady || false);
        setSystemRebooted(data.systemRebooted || false);
        
        // Debug log to track state
        console.log('[FIREWALL] State update:', {
          active: data.active,
          systemRebooted: data.systemRebooted,
          showVirusScan: data.showVirusScan,
          showRebootRequired: data.showRebootRequired,
          showRebootScreen: data.showRebootScreen
        });
        
        // Trigger shake animation for all players when there's an error
        if (data.error && data.lastErrorTime && Date.now() - data.lastErrorTime < 1000) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          
          // Play error sound
          if (errorSoundRef.current) {
            errorSoundRef.current.play().catch(e => 
              console.error("Failed to play error sound:", e)
            );
          }
        }
      }
    });
    
    return () => unsubscribe();
  }, [roomCode]);
  
  // Focus the input when activated for leader
  useEffect(() => {
    if (isLeader && inputRef.current && isInputActive && !firewallActive) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isLeader, isInputActive, firewallActive]);

  // Ensure firewall stays active after system reboot
  useEffect(() => {
    if (systemRebooted && !firewallActive) {
      // If system has been rebooted but firewall is not active, reactivate it
      updateFirewallState({
        active: true,
        systemRebooted: true
      });
    }
  }, [systemRebooted, firewallActive]);
  
  // Handle after-reboot sound and hacker message
  useEffect(() => {
    if (!roomCode || !systemRebooted || afterRebootMessageSent) return;
    
    const afterRebootStatusRef = ref(database, `lobbies/${roomCode}/afterRebootMessage`);
    
    // Use a one-time check instead of a persistent listener
    const checkAfterRebootStatus = async () => {
      try {
        // One-time read to check if message has already been sent
        const snapshot = await new Promise((resolve) => {
          onValue(afterRebootStatusRef, resolve, { once: true });
        });
        
        const messageStatus = snapshot.val();
        
        // If message was already sent, just mark locally as sent and don't play audio again
        if (messageStatus?.sent) {
          setAfterRebootMessageSent(true);
          return;
        }
        
        // If leader and message not sent yet, trigger audio and message for all
        if (isLeader && !messageStatus?.sent) {
          // Mark message as sent in Firebase first
          await update(ref(database, `lobbies/${roomCode}`), {
            afterRebootMessage: {
              sent: true,
              timestamp: Date.now()
            }
          });
          
          // Play the after-reboot audio
          if (afterRebootAudioRef.current) {
            afterRebootAudioRef.current.volume = 0.6;
            afterRebootAudioRef.current.play()
              .then(() => {
                console.log("After-reboot audio played");
              })
              .catch(err => {
                console.error("Error playing after-reboot audio:", err);
              });
          }
          
          // Send the hacker message with a delay for dramatic effect
          setTimeout(async () => {
            try {
              const chatRef = ref(database, `lobbies/${roomCode}/hackerChat`);
              await push(chatRef, {
                sender: 'hacker',
                text: `Oh wow…
You actually got the firewall running.
Took you long enough.

But while you were busy high-fiving and Googling basic configs…
I locked down the root folder.

You're welcome.

Now you're even more screwed than before.

Don't worry — I left you another "hint."
It's in the image I just sent.

Try not to drool on your keyboards while staring at it.

Let's see if the brain trust can figure this one out.

Tick tock, script kiddies.`,
                timestamp: serverTimestamp()
              });
              
              console.log('[HACKER CHAT] Sent after-reboot taunting message');
              
              // Send the image file 6 seconds after the text message
              setTimeout(async () => {
                try {
                  await push(chatRef, {
                    sender: 'hacker',
                    text: '[File: wall-riddle.jpeg]',
                    isFile: true,
                    fileName: 'wall-riddle.jpeg',
                    timestamp: serverTimestamp()
                  });
                  
                  console.log('[HACKER CHAT] Sent wall-riddle.jpeg image');
                } catch (error) {
                  console.error('[HACKER CHAT] Error sending wall-riddle image:', error);
                }
              }, 6000); // Wait 6 seconds after text message
              
            } catch (error) {
              console.error('[HACKER CHAT] Error sending after-reboot message:', error);
            }
          }, 3000); // Wait 3 seconds after audio starts
          
          setAfterRebootMessageSent(true);
        }
      } catch (error) {
        console.error('[HACKER CHAT] Error checking after-reboot status:', error);
      }
    };
    
    checkAfterRebootStatus();
  }, [roomCode, isLeader, systemRebooted, afterRebootMessageSent]);
  
  const updateFirewallState = (updates) => {
    if (roomCode) {
      update(ref(database, `lobbies/${roomCode}/firewallState`), {
        ...updates,
        lastUpdated: Date.now()
      });
    }
  };
  
  const activateInput = () => {
    if (!isLeader || firewallActive) return;
    
    const userName = new URLSearchParams(window.location.search).get('name') || 'Leader';
    
    updateFirewallState({
      isInputActive: true,
      typingUser: userName,
      error: '' // Clear any existing error when activating input
    });
  };
  
  const deactivateInput = () => {
    if (!isLeader) return;
    
    updateFirewallState({
      isInputActive: false,
      typingUser: null
    });
  };
  
  const checkCode = async (codeToCheck) => {
    if (codeToCheck === correctCode) {
      // Success - start virus scan sequence
      updateFirewallState({
        error: '',
        inputCode: codeToCheck,
        isInputActive: false,
        typingUser: null
      });
      
      // Start virus scan sequence
      startVirusScanSequence();
    } else {
      // Failure - show error and apply time penalty
      const newFailedAttempts = failedAttempts + 1;
      let errorMsg = 'Invalid override code. Access denied.';
      
      // Apply time penalty for failed attempts
      if (newFailedAttempts > 0) {
        try {
          // Apply 2-minute penalty for each failed attempt
          const penaltyResult = await applyTimePenalty(roomCode, 120);
          setIsPenaltyApplied(true);
          
          if (penaltyResult && penaltyResult.success) {
            errorMsg = `Invalid override code. TIME PENALTY APPLIED: -${penaltyResult.formattedPenalty}`;
          } else {
            errorMsg = 'Invalid override code. Security protocols attempted to apply penalty.';
          }
        } catch (err) {
          console.error('[FIREWALL] Error applying time penalty:', err);
          errorMsg = 'Invalid override code. Security system error.';
        }
      }
      
      updateFirewallState({
        error: errorMsg,
        failedAttempts: newFailedAttempts,
        inputCode: '',
        lastErrorTime: Date.now(),
        isInputActive: false,
        typingUser: null
      });
      
      // Clear the input and error after a delay
      setTimeout(() => {
        updateFirewallState({
          inputCode: '',
          error: ''
        });
      }, 3000);
    }
  };
  
  const handleActivateCode = () => {
    if (!isLeader || !inputCode || inputCode.length !== 3) return;
    
    checkCode(inputCode);
  };
  
  const handleKeyPress = (e) => {
    if (!isLeader || firewallActive || !isInputActive) return;
    
    // Get current user's name from URL params
    const userId = new URLSearchParams(window.location.search).get('uid');
    const userName = new URLSearchParams(window.location.search).get('name') || 'Leader';
    
    // Only allow numbers for the firewall code
    if (/^[0-9]$/.test(e.key)) {
      if (inputCode.length < 3) {
        const newCode = inputCode + e.key;
        
        // Update code in firebase
        updateFirewallState({
          inputCode: newCode,
          typingUser: userName,
          error: '' // Clear any existing error when typing
        });
      }
    } else if (e.key === 'Backspace') {
      // Handle backspace
      const newCode = inputCode.slice(0, -1);
      updateFirewallState({
        inputCode: newCode,
        typingUser: userName
      });
    } else if (e.key === 'Enter' && inputCode.length === 3) {
      // Allow enter to submit when code is complete
      handleActivateCode();
    } else if (e.key === 'Escape') {
      // Escape to deactivate input
      deactivateInput();
    }
  };

  // Virus scan sequence
  const startVirusScanSequence = () => {
    if (!isLeader) return; // Only leader can start the sequence
    
    updateFirewallState({
      showVirusScan: true,
      virusScanProgress: 0,
      scanningFile: ''
    });
    
    const virusFiles = [
      'system32/malware.exe',
      'temp/trojan_horse.dll',
      'downloads/suspicious_file.zip',
      'cache/backdoor.sys',
      'logs/keylogger.dat',
      'registry/rootkit.reg',
      'startup/virus.bat',
      'network/botnet.cfg'
    ];
    
    let currentFileIndex = 0;
    let progress = 0;
    
    const scanInterval = setInterval(() => {
      progress += Math.random() * 15 + 5; // Random progress between 5-20%
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(scanInterval);
        
        // Show reboot required after scan completes
        setTimeout(() => {
          updateFirewallState({
            showVirusScan: false,
            showRebootRequired: true
          });
        }, 1000);
      } else {
        // Update scanning file every few progress increments
        if (Math.floor(progress / 12.5) !== Math.floor((progress - 10) / 12.5)) {
          currentFileIndex = Math.min(currentFileIndex + 1, virusFiles.length - 1);
        }
        
        updateFirewallState({
          virusScanProgress: progress,
          scanningFile: virusFiles[currentFileIndex]
        });
      }
    }, 300);
  };

  // Reboot sequence
  const startRebootSequence = () => {
    if (!isLeader) return; // Only leader can start the sequence
    
    updateFirewallState({
      showRebootRequired: false,
      showRebootScreen: true,
      rebootProgress: 0
    });
    
    let progress = 0;
    const rebootInterval = setInterval(() => {
      progress += Math.random() * 8 + 2; // Random progress between 2-10%
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(rebootInterval);
        
        // Complete reboot and activate firewall
        setTimeout(() => {
          updateFirewallState({
            showRebootScreen: false,
            systemReady: true,
            active: true,
            systemRebooted: true,
            // Clear any temporary states that might interfere
            showVirusScan: false,
            showRebootRequired: false,
            inputCode: '',
            error: '',
            isInputActive: false,
            typingUser: null
          });
          
          // Update desktop background in Firebase
          if (roomCode) {
            update(ref(database, `lobbies/${roomCode}/desktopState`), {
              backgroundChanged: true,
              useServerBackground: true
            });
          }
        }, 2000);
      } else {
        updateFirewallState({
          rebootProgress: progress
        });
      }
    }, 200);
  };

  // Flashing effect for the border
  const [isBorderFlashing, setIsBorderFlashing] = useState(true);
  
  useEffect(() => {
    if (firewallActive) {
      setIsBorderFlashing(false);
      return;
    }
    
    const interval = setInterval(() => {
      setIsBorderFlashing(prev => !prev);
    }, 500);
    
    return () => clearInterval(interval);
  }, [firewallActive]);
  
  // Handle drag end to update position in Firebase
  const handleDragEnd = (event, info) => {
    const newPosition = { x: info.offset.x, y: info.offset.y };
    setPosition(newPosition);
    
    if (roomCode) {
      update(ref(database, `lobbies/${roomCode}/firewallState`), {
        position: newPosition
      });
    }
  };
  
  // Calculate firewall status percentage for progress display
  const firewallStatusPercentage = firewallActive ? 100 : Math.min(Math.max(inputCode.length * 33, 0), 90);
  
  return (
    <>
      {/* Error sound effect */}
      <audio ref={errorSoundRef} preload="auto">
        <source src="/hacker-clue/error.wav" type="audio/wav" />
      </audio>
      
      {/* After-reboot sound effect */}
      <audio ref={afterRebootAudioRef} preload="auto">
        <source src="/affter-reboot.wav" type="audio/wav" />
      </audio>
      
      <motion.div 
        className="absolute z-20 w-[800px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, x: 0, y: 0 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          x: position.x,
          y: position.y,
          transition: { 
            type: "spring", 
            stiffness: 300, 
            damping: 25 
          }
        }}
        exit={{ opacity: 0, scale: 0.95 }}
        drag={true}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ 
          left: "50%",
          top: "50%",
          marginLeft: "-400px",
          marginTop: "-250px",
          boxShadow: `0 0 30px rgba(255, ${firewallActive ? '255' : '0'}, ${firewallActive ? '255' : '0'}, ${isBorderFlashing ? 0.3 : 0.15})`
        }}
      >
        {/* Title bar */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-4 py-3 flex items-center justify-between cursor-move">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-3 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-lg tracking-wide">TOMA-ESCAPE Security Shield</div>
              <div className="text-blue-200 text-xs opacity-75">Enterprise Firewall v3.7</div>
            </div>
          </div>
          
          <div className="flex space-x-2 items-center">
            <div className="w-3 h-3 bg-blue-200 rounded-full opacity-70"></div>
            <div className="w-3 h-3 bg-blue-200 rounded-full opacity-70"></div>
            <button 
              onClick={onClose}
              className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content - Side by side layout */}
        <div className="p-4 text-slate-200 flex gap-4 max-h-[70vh] overflow-y-auto">
          
          {/* Virus Scan Screen */}
          {showVirusScan && (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-slate-900 bg-opacity-95 rounded-lg p-8 border border-green-700 backdrop-blur-sm w-full max-w-md">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  
                  <h3 className="text-xl font-bold text-green-400 mb-2">Virus Scan in Progress</h3>
                  <p className="text-slate-300 text-sm mb-4">Scanning system for malicious files...</p>
                  
                  <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
                    <div 
                      className="bg-green-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${virusScanProgress}%` }}
                    ></div>
                  </div>
                  
                  <div className="text-green-400 font-mono text-sm mb-2">
                    {Math.floor(virusScanProgress)}% Complete
                  </div>
                  
                  {scanningFile && (
                    <div className="text-slate-400 text-xs font-mono bg-slate-800 p-2 rounded">
                      Scanning: {scanningFile}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Reboot Required Screen */}
          {showRebootRequired && (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-slate-900 bg-opacity-95 rounded-lg p-8 border border-yellow-700 backdrop-blur-sm w-full max-w-md">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-yellow-600 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  
                  <h3 className="text-xl font-bold text-yellow-400 mb-2">System Reboot Required</h3>
                  <p className="text-slate-300 text-sm mb-6">
                    Virus scan completed successfully. System reboot is required to apply security updates and activate firewall protection.
                  </p>
                  
                  <div className="bg-green-900 bg-opacity-30 p-3 rounded mb-6 text-sm text-green-300">
                    ✓ 8 threats detected and removed<br/>
                    ✓ Security patches applied<br/>
                    ✓ Firewall configuration updated
                  </div>
                  
                  {isLeader && (
                    <button
                      onClick={startRebootSequence}
                      className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-md transition-colors duration-200"
                    >
                      Reboot System Now
                    </button>
                  )}
                  
                  {!isLeader && (
                    <div className="text-xs text-blue-300 bg-blue-900/30 px-3 py-2 rounded">
                      Waiting for team leader to initiate reboot...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Reboot Screen */}
          {showRebootScreen && (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-black bg-opacity-95 rounded-lg p-8 border border-blue-700 backdrop-blur-sm w-full max-w-md">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  
                  <h3 className="text-xl font-bold text-blue-400 mb-2">System Rebooting</h3>
                  <p className="text-slate-300 text-sm mb-4">Please wait while the system restarts...</p>
                  
                  <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
                    <div 
                      className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${rebootProgress}%` }}
                    ></div>
                  </div>
                  
                  <div className="text-blue-400 font-mono text-sm mb-4">
                    {Math.floor(rebootProgress)}% Complete
                  </div>
                  
                  <div className="text-slate-400 text-xs font-mono bg-slate-800 p-2 rounded">
                    {rebootProgress < 30 && "Shutting down services..."}
                    {rebootProgress >= 30 && rebootProgress < 60 && "Applying security updates..."}
                    {rebootProgress >= 60 && rebootProgress < 90 && "Starting system services..."}
                    {rebootProgress >= 90 && "Finalizing startup..."}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Normal firewall content when not in special sequences */}
          {!showVirusScan && !showRebootRequired && !showRebootScreen && (
            <>
              {/* Left Panel - Status and Controls */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Status indicator panel */}
            <div className="bg-slate-950 bg-opacity-60 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${firewallActive ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  <h3 className="font-semibold">System Status</h3>
                </div>
                <div className="text-xs px-2 py-1 rounded bg-slate-700 bg-opacity-50">
                  {firewallActive ? 'PROTECTED' : 'VULNERABLE'}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Firewall Status</span>
                    <span className={firewallActive ? 'text-green-400' : 'text-red-400'}>
                      {firewallActive ? 'ACTIVE' : 'DOWN'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
                    <div 
                      className={`h-full ${firewallActive ? 'bg-green-500' : 'bg-red-500'} transition-all duration-500`}
                      style={{ width: `${firewallStatusPercentage}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Intrusion Detection</span>
                  <span className={firewallActive ? 'text-green-400' : 'text-red-400'}>
                    {firewallActive ? 'OPERATIONAL' : 'OFFLINE'}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Packet Filtering</span>
                  <span className={firewallActive ? 'text-green-400' : 'text-red-400'}>
                    {firewallActive ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Show riddle/input only if system hasn't been rebooted yet AND firewall is not active */}
            {!systemRebooted && !firewallActive && (
              <>
                <div className="bg-red-900 bg-opacity-20 rounded-lg p-3 border border-red-800">
                  <div className="flex items-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-semibold text-red-100">Critical Security Alert</span>
                  </div>
                  <p className="text-red-100 text-sm leading-relaxed mb-2">
                    Unauthorized access detected. An unknown entity has disabled your primary security systems.
                    Administrator authentication required to restore protection.
                  </p>
                  <div className="bg-red-950 bg-opacity-50 p-2 rounded text-xs text-red-200 font-mono">
                    <span className="text-red-400">ERROR:</span> Security protocols compromised<br/>
                    <span className="text-red-400">SOURCE:</span> External intrusion<br/>
                    <span className="text-red-400">ACTION:</span> Immediate authentication required
                  </div>
                </div>
                
                <motion.div 
                  className="bg-slate-800 bg-opacity-60 rounded-lg p-3"
                  animate={shake ? { x: [-5, 5, -5, 5, 0] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <h3 className="font-medium mb-2 text-blue-100">Firewall Recovery Protocol</h3>
                  <p className="text-sm text-slate-300 mb-3">Enter emergency override code to reactivate firewall:</p>
                  
                  <div 
                    className={`bg-slate-900 p-3 rounded-md mb-3 border-l-4 ${
                      error ? 'border-red-500' : isInputActive ? 'border-green-500' : 'border-blue-500'
                    } focus:outline-none transition-colors duration-200 ${
                      isLeader && !firewallActive ? 'cursor-pointer hover:bg-slate-800' : 'cursor-default'
                    }`}
                    tabIndex={isLeader ? 0 : -1}
                    ref={inputRef}
                    onKeyDown={isInputActive ? handleKeyPress : undefined}
                    onClick={!isInputActive ? activateInput : undefined}
                  >
                    <div className="font-mono tracking-wider text-lg text-blue-100">
                      {isInputActive ? (
                        <>
                          {inputCode || <span className="text-slate-500 text-sm italic">Enter 3-digit override code...</span>}
                          {isLeader && (
                            <span className="ml-1 inline-block w-2 h-5 bg-green-400 animate-pulse"></span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500 text-sm italic">
                          {isLeader ? 'Click here to enter override code...' : 'Waiting for team leader to enter code...'}
                        </span>
                      )}
                    </div>
                    {typingUser && isInputActive && (
                      <div className="text-xs text-slate-400 mt-1 italic">
                        {typingUser} is entering code...
                      </div>
                    )}
                    {isInputActive && isLeader && (
                      <div className="text-xs text-slate-500 mt-1">
                        Press ESC to cancel • Enter to submit when complete
                      </div>
                    )}
                  </div>
                  
                  {/* Activate button */}
                  {isInputActive && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={handleActivateCode}
                        disabled={!isLeader || inputCode.length !== 3}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                          isLeader && inputCode.length === 3
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Activate
                        </div>
                      </button>
                      <button
                        onClick={deactivateInput}
                        disabled={!isLeader}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  
                  {/* Error message */}
                  {error && (
                    <motion.div 
                      className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded-md text-red-400 text-sm"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {error}
                    </motion.div>
                  )}
                  
                  {/* Failed attempts warning */}
                  {failedAttempts > 0 && (
                    <div className="mb-3 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700/50 rounded px-2 py-1">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Security violations detected: {failedAttempts} - Time penalties applied
                      </div>
                    </div>
                  )}
                  
                  {/* Leadership status */}
                  {!isLeader && (
                    <div className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Only team leader can input override code
                    </div>
                  )}
                  
                  {isLeader && !isInputActive && (
                    <div className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                      Administrator Mode Active - Click input field to enter code
                    </div>
                  )}
                </motion.div>
              </>
            )}
            
            {firewallActive && (
              <>
                <div className="bg-green-900 bg-opacity-20 rounded-lg p-3 border border-green-800">
                  <div className="flex items-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-semibold text-green-100">Protection Active</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center">
                      <div className="w-4 h-1 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <p className="text-green-100 text-sm">Scanning system for intrusions...</p>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-1 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <p className="text-green-100 text-sm">Blocking unauthorized access points...</p>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-1 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <p className="text-green-100 text-sm">Cleaning malicious processes...</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 p-2 bg-green-950 bg-opacity-50 rounded text-sm text-green-200">
                    System protection restored. Thank you, Administrator.
                  </div>
                </div>
                
                <div className="bg-slate-800 bg-opacity-40 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-blue-100">System Health</h3>
                    <div className="px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded">GOOD</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900 bg-opacity-50 p-2 rounded text-center">
                      <div className="text-2xl font-semibold text-green-400">100%</div>
                      <div className="text-xs text-slate-400">Firewall Status</div>
                    </div>
                    <div className="bg-slate-900 bg-opacity-50 p-2 rounded text-center">
                      <div className="text-2xl font-semibold text-blue-400">0</div>
                      <div className="text-xs text-slate-400">Active Threats</div>
                    </div>
                    <div className="bg-slate-900 bg-opacity-50 p-2 rounded text-center">
                      <div className="text-2xl font-semibold text-purple-400">3</div>
                      <div className="text-xs text-slate-400">Systems Secured</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
              {/* Right Panel - Security Protocol Analysis - only show if system hasn't been rebooted */}
              {!systemRebooted && !firewallActive && (
                <div className="flex-1">
                  <div className="bg-slate-900 bg-opacity-80 rounded-lg p-4 border border-slate-700 backdrop-blur-sm h-full">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-orange-400">Security Protocol Analysis</h3>
                  <div className="text-xs px-2 py-0.5 bg-blue-900 bg-opacity-40 rounded text-blue-300">
                    EMERGENCY OVERRIDE
                  </div>
                </div>
                
                <p className="text-orange-300 font-medium mb-4">
                  Critical: Firewall authentication matrix compromised. Analyze security patterns to determine override sequence:
                </p>
                
                <div className="space-y-3 mb-4">
                  {/* Row 1 */}
                  <div className="flex items-center">
                    <div className="flex">
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">1</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">2</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">3</div>
                    </div>
                    <div className="ml-4 text-purple-300 text-sm font-medium">No authentication digit valid</div>
                  </div>
                  
                  {/* Row 2 */}
                  <div className="flex items-center">
                    <div className="flex">
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">4</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">5</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">6</div>
                    </div>
                    <div className="ml-4 text-purple-300 text-sm font-medium">1 digit valid, correct position</div>
                  </div>
                  
                  {/* Row 3 */}
                  <div className="flex items-center">
                    <div className="flex">
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">6</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">1</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">2</div>
                    </div>
                    <div className="ml-4 text-purple-300 text-sm font-medium">1 digit valid, wrong position</div>
                  </div>
                  
                  {/* Row 4 */}
                  <div className="flex items-center">
                    <div className="flex">
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">5</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">4</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">7</div>
                    </div>
                    <div className="ml-4 text-purple-300 text-sm font-medium">1 digit valid, wrong position</div>
                  </div>
                  
                  {/* Row 5 */}
                  <div className="flex items-center">
                    <div className="flex">
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">8</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">4</div>
                      <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg">9</div>
                    </div>
                    <div className="ml-4 text-purple-300 text-sm font-medium">1 digit valid, correct position</div>
                  </div>
                </div>
                
                {/* Firewall terminal illustration */}
                <div className="mt-4 flex justify-center">
                  <div className="w-36 h-24 bg-gray-800 rounded-md relative p-3 flex items-center justify-center border border-gray-600">
                    <div className="w-full h-full bg-gray-900 rounded border border-gray-500 flex items-center justify-center">
                      <div className="text-green-400 font-mono text-xs">
                        FIREWALL<br/>
                        TERMINAL
                      </div>
                    </div>
                    {/* Terminal indicator lights */}
                    <div className="absolute top-1 right-1 flex space-x-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <div className="flex justify-center">
                    <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg text-orange-300">?</div>
                    <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg text-orange-300">?</div>
                    <div className="w-10 h-10 border border-orange-400 flex items-center justify-center font-bold text-lg text-orange-300">?</div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Emergency Override Sequence</p>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default FirewallStatus; 