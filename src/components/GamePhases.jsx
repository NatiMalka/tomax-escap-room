import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UbuntuLogin from './UbuntuLogin';

// Game phases:
// 0: Video intro
// 1: Login screen puzzle
// 2: TBD - Next puzzles will be added here
// 3: TBD - Final puzzles

const GamePhases = ({ currentPhase, onPhaseComplete }) => {
  const [phase, setPhase] = useState(currentPhase || 1);
  
  // Update internal phase when the prop changes (synced from Firebase)
  useEffect(() => {
    if (currentPhase !== undefined && currentPhase !== phase) {
      console.log(`[GAME PHASES] Updating phase from ${phase} to ${currentPhase} (from Firebase)`);
      setPhase(currentPhase);
    }
  }, [currentPhase, phase]);

  const handlePhaseComplete = (phaseNumber) => {
    console.log(`[GAME PHASES] Phase ${phaseNumber} completed`);
    
    // Notify parent component to update Firebase
    if (onPhaseComplete) {
      onPhaseComplete(phaseNumber + 1);
    }
  };

  // Render the current phase content
  const renderPhaseContent = () => {
    console.log(`[GAME PHASES] Rendering phase ${phase}`);
    
    switch (phase) {
      case 1:
        return (
          <div className="relative z-30">
            <UbuntuLogin 
              onLoginSuccess={() => handlePhaseComplete(1)} 
            />
          </div>
        );
      
      case 2:
        // Placeholder for the next phase
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-30">
            <div className="text-white text-2xl max-w-3xl w-full mx-auto bg-gray-900/90 p-8 rounded-xl shadow-2xl border border-blue-500/30">
              <h2 className="text-3xl font-bold mb-4 text-blue-400">Phase 2: System Decryption</h2>
              <p className="mb-4">You need to decode the encrypted messages in the welcome_admin.txt file to proceed.</p>
              <div className="bg-black/80 p-4 rounded-lg font-mono text-sm text-green-400">
                <p>The file contains multiple layers of encryption:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Binary code</li>
                  <li>Base64 encoding</li>
                  <li>ROT13 cipher</li>
                </ul>
                <p className="mt-4">Find and decrypt the file to receive the next instructions.</p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {renderPhaseContent()}
    </AnimatePresence>
  );
};

export default GamePhases; 