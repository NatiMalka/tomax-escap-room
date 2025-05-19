import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../firebase';

const FirewallStatus = ({ isLeader, roomCode, onClose }) => {
  const [firewallActive, setFirewallActive] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const inputRef = useRef(null);
  
  const correctCode = 'ISGNORSAET';
  
  const scrambledEmployees = [
    { scrambled: 'NOR', original: 'RON', firstLetter: 'R' },
    { scrambled: 'ETLNNEA', original: 'NETANEL', firstLetter: 'N' },
    { scrambled: 'SINHA', original: 'SHANI', firstLetter: 'S' },
    { scrambled: 'IGRO', original: 'IGOR', firstLetter: 'I' },
    { scrambled: 'ATL', original: 'TAL', firstLetter: 'T' },
    { scrambled: 'YUG', original: 'GUY', firstLetter: 'G' },
    { scrambled: 'HARSHA', original: 'SHAHAR', firstLetter: 'S' },
    { scrambled: 'NEDE', original: 'EDEN', firstLetter: 'E' },
    { scrambled: 'EOMR', original: 'OMER', firstLetter: 'O' },
    { scrambled: 'ORD', original: 'DOR', firstLetter: 'D' },
    { scrambled: 'NALO', original: 'ALON', firstLetter: 'A' }
  ];
  
  // Position state with initial centered position
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Sync with firebase
  useEffect(() => {
    if (!roomCode) return;
    
    const firewallRef = ref(database, `lobbies/${roomCode}/firewallState`);
    
    // Initialize firewall state if it doesn't exist
    update(ref(database, `lobbies/${roomCode}`), {
      firewallState: {
        active: false,
        inputCode: '',
        typingUser: null,
        position: { x: 0, y: 0 }
      }
    });
    
    const unsubscribe = onValue(firewallRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFirewallActive(data.active);
        setInputCode(data.inputCode || '');
        setTypingUser(data.typingUser);
      }
    });
    
    return () => unsubscribe();
  }, [roomCode]);
  
  // Focus the input when rendered for leader
  useEffect(() => {
    if (isLeader && inputRef.current && !firewallActive) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 500);
    }
  }, [isLeader, firewallActive]);
  
  const handleKeyPress = (e) => {
    if (!isLeader) return;
    
    // Get current user's name from URL params
    const userId = new URLSearchParams(window.location.search).get('uid');
    const userName = new URLSearchParams(window.location.search).get('name') || 'Leader';
    
    // Only allow uppercase letters
    if (/^[A-Z]$/.test(e.key.toUpperCase())) {
      const newCode = inputCode + e.key.toUpperCase();
      
      // Update code in firebase
      update(ref(database, `lobbies/${roomCode}/firewallState`), {
        inputCode: newCode,
        typingUser: userName
      });
      
      // Check if code is correct
      if (newCode === correctCode) {
        // Activate firewall
        update(ref(database, `lobbies/${roomCode}/firewallState`), {
          active: true
        });
      }
    } else if (e.key === 'Backspace') {
      // Handle backspace
      const newCode = inputCode.slice(0, -1);
      update(ref(database, `lobbies/${roomCode}/firewallState`), {
        inputCode: newCode,
        typingUser: userName
      });
    }
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
  const firewallStatusPercentage = firewallActive ? 100 : Math.min(Math.max(inputCode.length * 10, 0), 90);
  
  return (
    <motion.div 
      className="absolute z-20 w-[420px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-2xl overflow-hidden"
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
        marginLeft: "-210px",
        marginTop: "-200px",
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
      
      {/* Content */}
      <div className="p-4 text-slate-200 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
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
        
        {!firewallActive && (
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
            
            <div className="bg-slate-800 bg-opacity-60 rounded-lg p-3">
              <h3 className="font-medium mb-2 text-blue-100">Authentication Required</h3>
              <p className="text-sm text-slate-300 mb-3">Enter security override code to reactivate firewall:</p>
              
              <div 
                className="bg-slate-900 p-3 rounded-md mb-3 border-l-4 border-blue-500 focus:outline-none"
                tabIndex={isLeader ? 0 : -1}
                ref={inputRef}
                onKeyDown={handleKeyPress}
                onClick={() => isLeader && inputRef.current && inputRef.current.focus()}
              >
                <div className="font-mono tracking-wider text-lg text-blue-100">
                  {inputCode || <span className="text-slate-500 text-sm italic">Enter authentication code...</span>}
                  {isLeader && <span className="ml-1 inline-block w-2 h-5 bg-blue-400 animate-pulse"></span>}
                </div>
                {typingUser && (
                  <div className="text-xs text-slate-400 mt-1 italic">
                    {typingUser} is entering code...
                  </div>
                )}
              </div>
              
              <div className="flex justify-between">
                <button
                  className={`px-3 py-1.5 text-xs rounded flex items-center gap-1
                    ${showSolution 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                  onClick={() => setShowSolution(!showSolution)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {showSolution ? 'Hide Database Records' : 'View Database Records'}
                </button>
                
                {isLeader && (
                  <div className="text-xs text-blue-300 bg-blue-900 bg-opacity-30 px-2 rounded flex items-center">
                    Administrator Mode Active
                  </div>
                )}
              </div>
            </div>
            
            {showSolution && (
              <div className="bg-slate-900 bg-opacity-80 rounded-lg p-3 border border-slate-700 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-blue-300">EMPLOYEE DATABASE RECORDS</h3>
                  <div className="text-xs px-2 py-0.5 bg-blue-900 bg-opacity-40 rounded text-blue-300">
                    READ ONLY
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {scrambledEmployees.slice(0, 6).map((emp, index) => (
                    <div key={index} className="bg-slate-800 bg-opacity-50 p-1.5 rounded text-xs flex items-center gap-1.5">
                      <div className="h-4 w-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">
                        {index + 1}
                      </div>
                      <div className="font-mono">
                        <span className="text-slate-400">{emp.scrambled}</span>
                        <span className="text-slate-500 mx-1">→</span>
                        <span className="text-blue-200">
                          <span className="text-red-400 font-bold">{emp.firstLetter}</span>
                          {emp.original.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {scrambledEmployees.slice(6).map((emp, index) => (
                    <div key={index + 6} className="bg-slate-800 bg-opacity-50 p-1.5 rounded text-xs flex items-center gap-1.5">
                      <div className="h-4 w-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">
                        {index + 7}
                      </div>
                      <div className="font-mono">
                        <span className="text-slate-400">{emp.scrambled}</span>
                        <span className="text-slate-500 mx-1">→</span>
                        <span className="text-blue-200">
                          <span className="text-red-400 font-bold">{emp.firstLetter}</span>
                          {emp.original.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="text-xs text-blue-300 bg-blue-900 bg-opacity-20 p-1.5 rounded mt-2">
                  <p>CODE FORMAT: First letters by employee seniority (oldest to newest)</p>
                </div>
              </div>
            )}
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
    </motion.div>
  );
};

export default FirewallStatus; 