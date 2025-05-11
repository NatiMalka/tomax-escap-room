// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, remove, get } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAkFWf74yj_1o-Bx9KQwp0354nBrPFCsxA",
  authDomain: "escape-room-bb563.firebaseapp.com",
  projectId: "escape-room-bb563",
  storageBucket: "escape-room-bb563.firebasestorage.app",
  messagingSenderId: "939585325796",
  appId: "1:939585325796:web:3a1ff723706dd0be77faf1",
  measurementId: "G-6EEF5QL9JT"
};

// Enable Firebase debug logging
if (process.env.NODE_ENV === 'development') {
  console.log("[FIREBASE] Debug mode enabled");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Generate a random ID
const generateRandomId = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Helper function to sanitize data (replace undefined with null)
const sanitizeData = (data) => {
  if (data === undefined) return null;
  if (data === null) return null;
  if (typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  const result = {};
  for (const key in data) {
    result[key] = sanitizeData(data[key]);
  }
  return result;
};

// Create a new lobby
const createLobby = async (roomCode, hostData) => {
  try {
    console.log(`[FIREBASE] Creating lobby with code: ${roomCode}`, hostData);
    
    // Generate a unique ID for this player
    const playerId = generateRandomId();
    console.log(`[FIREBASE] Generated host ID: ${playerId}`);
    
    // Set user data with host privileges and sanitize it
    const playerData = sanitizeData({
      ...hostData,
      id: playerId,
      isHost: true,
      isLeader: false, // By default, no one is the leader
      isReady: false,
      votedFor: null, // Track who this player voted for as leader
      joinedAt: Date.now()
    });
    
    // Create lobby in database
    await set(ref(database, `lobbies/${roomCode}`), {
      createdAt: Date.now(),
      gameState: "lobby",
      settings: {
        timeLimit: 30 // in minutes
      },
      leaderVotes: {}, // Track votes for leader
      selectedLeader: null // The final selected leader
    });
    
    // Add host to players list
    await set(ref(database, `lobbies/${roomCode}/players/${playerId}`), playerData);
    console.log(`[FIREBASE] Host added to lobby. Path: lobbies/${roomCode}/players/${playerId}`);
    
    // Log the current lobby state
    const snapshot = await get(ref(database, `lobbies/${roomCode}`));
    console.log(`[FIREBASE] Lobby created:`, snapshot.val());
    
    // Create a record that this player is connected
    const handleBeforeUnload = () => {
      try {
        console.log(`[FIREBASE] Browser closing - removing player ${playerId} from lobby ${roomCode}`);
        remove(ref(database, `lobbies/${roomCode}/players/${playerId}`));
      } catch (e) {
        console.error("Error removing player on unload:", e);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Store the event handler function in sessionStorage so we can remove it later
    window._tomax_cleanup = window._tomax_cleanup || {};
    window._tomax_cleanup[playerId] = {
      handler: handleBeforeUnload,
      roomCode: roomCode
    };
    
    return { userId: playerId, roomCode };
  } catch (error) {
    console.error("[FIREBASE] Error creating lobby:", error);
    throw error;
  }
};

// Join an existing lobby
const joinLobby = async (roomCode, playerData) => {
  try {
    console.log(`[FIREBASE] Attempting to join lobby: ${roomCode}`, playerData);
    
    // Check if lobby exists
    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    const snapshot = await get(lobbyRef);
    
    if (!snapshot.exists()) {
      console.error(`[FIREBASE] Lobby ${roomCode} not found`);
      throw new Error("Lobby not found");
    }
    
    console.log(`[FIREBASE] Found lobby:`, snapshot.val());
    
    // Generate a unique ID for this player
    const playerId = generateRandomId();
    console.log(`[FIREBASE] Generated player ID: ${playerId}`);
    
    // Add player to lobby (sanitized)
    const newPlayerData = sanitizeData({
      ...playerData,
      id: playerId,
      isHost: false,
      isLeader: false,
      isReady: false,
      votedFor: null, // Track who this player voted for as leader
      joinedAt: Date.now()
    });
    
    await set(ref(database, `lobbies/${roomCode}/players/${playerId}`), newPlayerData);
    console.log(`[FIREBASE] Player added to lobby. Path: lobbies/${roomCode}/players/${playerId}`);
    
    // Log the current players
    const playersSnapshot = await get(ref(database, `lobbies/${roomCode}/players`));
    const players = playersSnapshot.val();
    console.log(`[FIREBASE] Current players in lobby:`, players);
    console.log(`[FIREBASE] Number of players:`, players ? Object.keys(players).length : 0);
    
    // Create a record that this player is connected with proper cleanup
    const handleBeforeUnload = () => {
      try {
        console.log(`[FIREBASE] Browser closing - removing player ${playerId} from lobby ${roomCode}`);
        remove(ref(database, `lobbies/${roomCode}/players/${playerId}`));
      } catch (e) {
        console.error("Error removing player on unload:", e);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Store the event handler function in global space so we can remove it later
    window._tomax_cleanup = window._tomax_cleanup || {};
    window._tomax_cleanup[playerId] = {
      handler: handleBeforeUnload,
      roomCode: roomCode
    };
    
    return { userId: playerId, roomCode };
  } catch (error) {
    console.error("[FIREBASE] Error joining lobby:", error);
    throw error;
  }
};

// Manually leave a lobby
const leaveLobby = async (roomCode, userId) => {
  try {
    console.log(`[FIREBASE] Player ${userId} leaving lobby ${roomCode}`);
    
    // Remove event listener
    if (window._tomax_cleanup && window._tomax_cleanup[userId]) {
      console.log(`[FIREBASE] Removing beforeunload handler for ${userId}`);
      window.removeEventListener('beforeunload', window._tomax_cleanup[userId].handler);
      delete window._tomax_cleanup[userId];
    }
    
    // Remove player from lobby
    await remove(ref(database, `lobbies/${roomCode}/players/${userId}`));
    
    // Check if lobby is empty after player leaves
    const lobbyRef = ref(database, `lobbies/${roomCode}/players`);
    const snapshot = await get(lobbyRef);
    const players = snapshot.val();
    
    console.log(`[FIREBASE] Remaining players:`, players);
    
    // If no players left, remove the lobby
    if (!players || Object.keys(players).length === 0) {
      console.log(`[FIREBASE] No players left, removing lobby ${roomCode}`);
      await remove(ref(database, `lobbies/${roomCode}`));
    } else {
      // If host left, assign a new host
      const remainingPlayers = Object.values(players);
      const hostExists = remainingPlayers.some(player => player.isHost);
      
      if (!hostExists && remainingPlayers.length > 0) {
        // Choose the player who joined first
        const sortedPlayers = remainingPlayers.sort((a, b) => a.joinedAt - b.joinedAt);
        const newHost = sortedPlayers[0];
        
        console.log(`[FIREBASE] Assigning new host: ${newHost.id}`, newHost);
        
        // Get the full player data from Firebase before update to ensure we have all properties
        const playerRef = ref(database, `lobbies/${roomCode}/players/${newHost.id}`);
        const playerSnapshot = await get(playerRef);
        const currentPlayerData = playerSnapshot.val();
        
        if (currentPlayerData) {
          // Update just the isHost flag while preserving all other data
          await update(playerRef, {
            isHost: true
          });
          
          // Verify the update
          const verifySnapshot = await get(playerRef);
          const updatedPlayer = verifySnapshot.val();
          console.log(`[FIREBASE] New host data after update:`, updatedPlayer);
        } else {
          console.error(`[FIREBASE] Could not find player data for new host ${newHost.id}`);
        }
      }
    }
  } catch (error) {
    console.error("[FIREBASE] Error leaving lobby:", error);
    throw error;
  }
};

// Start the game
const startGame = async (roomCode) => {
  try {
    console.log(`[FIREBASE] Starting game for lobby ${roomCode}`);
    // We'll set both startTime and videoStartTime to help synchronize experiences across players
    const startTime = Date.now();
    await update(ref(database, `lobbies/${roomCode}`), {
      gameState: "playing",
      startTime: startTime,
      videoStartTime: startTime + 5000, // 5 seconds after game state changes (for countdown)
      videoEnded: false
    });
  } catch (error) {
    console.error("[FIREBASE] Error starting game:", error);
    throw error;
  }
};

// Get real-time updates for lobby data
const getLobbyData = (roomCode, callback) => {
  console.log(`[FIREBASE] Setting up real-time listener for lobby ${roomCode}`);
  const lobbyRef = ref(database, `lobbies/${roomCode}`);
  
  return onValue(lobbyRef, (snapshot) => {
    const data = snapshot.val();
    console.log(`[FIREBASE] Lobby update received:`, data);
    
    if (data && data.players) {
      console.log(`[FIREBASE] Players in update:`, data.players);
      console.log(`[FIREBASE] Number of players:`, Object.keys(data.players).length);
      
      // Deep copy the players object to avoid reference issues
      const enhancedPlayers = {};
      
      // First pass: collect all player data by ID
      Object.keys(data.players).forEach(playerId => {
        const player = data.players[playerId];
        if (player) {
          // Log player data for debugging
          console.log(`[FIREBASE] Processing player ${playerId}:`, player);
          
          // Create a complete player object with default values
          enhancedPlayers[playerId] = {
            id: playerId, // Always use the key as ID
            name: player.name || 'Anonymous',
            isHost: !!player.isHost, // Convert to boolean
            isLeader: !!player.isLeader, // Convert isLeader to boolean
            isReady: !!player.isReady, // Convert isReady to boolean
            votedFor: player.votedFor || null,
            joinedAt: player.joinedAt || Date.now(),
            lastActive: player.lastActive || Date.now(),
            avatar: player.avatar || null
          };
        }
      });
      
      console.log(`[FIREBASE] Enhanced players:`, enhancedPlayers);
      
      // Replace player data with enhanced version
      data.players = enhancedPlayers;
    }
    
    callback(data);
  });
};

// Vote for a leader
const voteForLeader = async (roomCode, voterId, candidateId) => {
  try {
    console.log(`[FIREBASE] Player ${voterId} voting for leader: ${candidateId}`);
    
    // Update voter's vote in their player data
    await update(ref(database, `lobbies/${roomCode}/players/${voterId}`), {
      votedFor: candidateId,
      lastActive: Date.now()
    });
    
    // Also record the vote in the leaderVotes map for easy tallying
    await update(ref(database, `lobbies/${roomCode}/leaderVotes/${candidateId}`), {
      [voterId]: true
    });
    
    // Get all votes to check if we have consensus
    const votesSnapshot = await get(ref(database, `lobbies/${roomCode}/leaderVotes`));
    const votes = votesSnapshot.val() || {};
    
    // Get all players
    const playersSnapshot = await get(ref(database, `lobbies/${roomCode}/players`));
    const players = playersSnapshot.val() || {};
    const playerCount = Object.keys(players).length;
    
    // Count votes for each candidate
    const voteCounts = {};
    Object.keys(votes).forEach(candidateId => {
      const candidateVotes = votes[candidateId];
      voteCounts[candidateId] = candidateVotes ? Object.keys(candidateVotes).length : 0;
    });
    
    console.log(`[FIREBASE] Current vote counts:`, voteCounts);
    
    // Check if any candidate has a majority
    const majorityThreshold = Math.ceil(playerCount / 2);
    let selectedLeader = null;
    
    Object.keys(voteCounts).forEach(candidateId => {
      if (voteCounts[candidateId] >= majorityThreshold) {
        selectedLeader = candidateId;
      }
    });
    
    // If we have a majority, update the selected leader
    if (selectedLeader) {
      console.log(`[FIREBASE] Majority leader selected: ${selectedLeader}`);
      
      // Reset all players' isLeader flag first
      const updatePromises = Object.keys(players).map(playerId => 
        update(ref(database, `lobbies/${roomCode}/players/${playerId}`), {
          isLeader: false
        })
      );
      
      await Promise.all(updatePromises);
      
      // Set the new leader
      await update(ref(database, `lobbies/${roomCode}/players/${selectedLeader}`), {
        isLeader: true
      });
      
      // Record the selected leader at the room level too
      await update(ref(database, `lobbies/${roomCode}`), {
        selectedLeader
      });
    }
    
    return selectedLeader;
  } catch (error) {
    console.error("[FIREBASE] Error voting for leader:", error);
    throw error;
  }
};

// Clear all leader votes (for reset)
const clearLeaderVotes = async (roomCode) => {
  try {
    console.log(`[FIREBASE] Clearing leader votes for room ${roomCode}`);
    
    // Get all players
    const playersSnapshot = await get(ref(database, `lobbies/${roomCode}/players`));
    const players = playersSnapshot.val() || {};
    
    // Reset each player's votedFor field
    const updatePromises = Object.keys(players).map(playerId => 
      update(ref(database, `lobbies/${roomCode}/players/${playerId}`), {
        votedFor: null
      })
    );
    
    await Promise.all(updatePromises);
    
    // Clear the leaderVotes map and selected leader
    await update(ref(database, `lobbies/${roomCode}`), {
      leaderVotes: {},
      selectedLeader: null
    });
    
    console.log(`[FIREBASE] Leader votes cleared successfully`);
  } catch (error) {
    console.error("[FIREBASE] Error clearing leader votes:", error);
    throw error;
  }
};

// Mark video as ended
const markVideoEnded = async (roomCode) => {
  try {
    console.log(`[FIREBASE] Marking video as ended for room ${roomCode}`);
    await update(ref(database, `lobbies/${roomCode}`), {
      videoEnded: true
    });
  } catch (error) {
    console.error("[FIREBASE] Error marking video as ended:", error);
    throw error;
  }
};

export {
  database,
  createLobby,
  joinLobby,
  leaveLobby,
  startGame,
  getLobbyData,
  voteForLeader,
  clearLeaderVotes,
  markVideoEnded
}; 