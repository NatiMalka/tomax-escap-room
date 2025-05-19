import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UbuntuLogin from './UbuntuLogin';
import SystemDesktop from './SystemDesktop';

// Game phases:
// 0: Video intro
// 1: Login screen puzzle
// 2: System Desktop with folder structure
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
        // System Desktop with File Explorer
        return (
          <div className="relative z-30">
            <SystemDesktop 
              onMissionComplete={() => handlePhaseComplete(2)}
            />
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