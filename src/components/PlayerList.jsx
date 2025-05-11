import React from 'react';
import { motion } from 'framer-motion';

const PlayerList = ({ players, currentPlayerId }) => {
  // Animation variants for list and items
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24
      }
    }
  };
  
  // Ensure players is an array, even if it's null/undefined
  const safePlayersList = Array.isArray(players) ? players.filter(player => player != null) : [];
  
  // Additional logging to debug player data
  console.log("[PLAYERLIST] Received players:", safePlayersList);
  
  // Sort players so host appears first, then alphabetically by name
  const sortedPlayers = [...safePlayersList].sort((a, b) => {
    // Host always comes first
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    // Then sort alphabetically by name
    return (a.name || '').localeCompare(b.name || '');
  });
  
  console.log("[PLAYERLIST] Sorted players:", sortedPlayers);

  return (
    <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md">
      <div className="flex justify-between items-center mb-4 border-b border-blue-400/30 pb-2">
        <h2 className="text-xl font-bold text-blue-400">
          Connected Players
        </h2>
        <span className="text-white bg-blue-600 px-2 py-1 rounded-full text-xs font-semibold">
          {safePlayersList.length}/6
        </span>
      </div>
      
      {safePlayersList.length === 0 ? (
        <div className="text-gray-400 text-center py-4">
          Waiting for players to join...
          {currentPlayerId && (
            <p className="mt-2 text-blue-400 text-sm">You are connected as host.</p>
          )}
        </div>
      ) : (
        <motion.ul
          className="space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {sortedPlayers.map((player) => {
            if (!player || !player.id) return null;
            
            // Make sure we have a name string
            const playerName = player?.name || 'Anonymous';
            const playerId = player?.id || '';
            const isCurrentPlayer = playerId === currentPlayerId;
            const joinTime = player.joinedAt ? new Date(player.joinedAt) : new Date();
            const isHostPlayer = player.isHost === true;
            
            console.log(`[PLAYERLIST] Rendering player: ${playerName}, ID: ${playerId}, isHost: ${isHostPlayer}`);
            
            return (
              <motion.li
                key={playerId}
                variants={itemVariants}
                className={`
                  flex items-center space-x-3 p-3 rounded-md
                  ${isCurrentPlayer ? 'bg-blue-900/40 border border-blue-500/50' : 'bg-gray-700/50'}
                  ${isHostPlayer ? 'ring-2 ring-yellow-500/50' : ''}
                `}
              >
                {/* Player Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden">
                  {player.avatar ? (
                    <img src={player.avatar} alt={`${playerName}'s avatar`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-white">{playerName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                
                {/* Player Info */}
                <div className="flex-grow">
                  <div className="flex items-center">
                    <p className="font-medium text-white">
                      {playerName}
                    </p>
                    {isCurrentPlayer && (
                      <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">You</span>
                    )}
                    <span className={`ml-2 text-xs ${isHostPlayer ? 'bg-yellow-500' : 'bg-green-500'} text-white px-2 py-0.5 rounded-full`}>
                      {isHostPlayer ? 'Host' : 'Agent'}
                    </span>
                  </div>
                  
                  <div className="flex items-center mt-1 text-xs text-gray-300">
                    {isHostPlayer ? (
                      <span className="flex items-center text-yellow-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Game Host
                      </span>
                    ) : (
                      <span className="flex items-center text-green-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        Joined
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Status Indicator */}
                <div className="flex-shrink-0">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
};

export default PlayerList; 