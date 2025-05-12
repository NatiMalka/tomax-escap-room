import { ref, push, serverTimestamp } from 'firebase/database';
import { database } from '../firebase';

const useHackerChat = (roomCode) => {
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
      return true;
    } catch (error) {
      console.error('[HACKER CHAT] Error sending hacker message:', error);
      return false;
    }
  };

  return { sendHackerMessage };
};

export default useHackerChat; 