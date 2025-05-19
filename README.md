# TOMAX Escape Room: Digital Breach

An online multiplayer escape room experience where players must work together to restore security to a compromised system.

## Game Overview

In this escape room, your team has discovered that a hacker has infiltrated the TOMAX company's server. The firewall has been disabled, giving the hacker access to sensitive company data. Your mission is to enable the firewall by solving a series of puzzles related to employee information.

## Key Features

- **Real-time multiplayer**: All actions are synchronized across players
- **Role-based gameplay**: One player serves as the "leader" with special permissions
- **Interactive desktop environment**: Simulates a compromised computer system
- **Collaborative puzzle solving**: Players must work together to decode the firewall protection code

## Technical Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure Firebase (see Configuration section)
4. Start the development server:
   ```
   npm run dev
   ```

## Configuration

This game uses Firebase Realtime Database for multiplayer functionality. You'll need to set up your own Firebase project:

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable Realtime Database
3. Create a `.env` file in the project root with your Firebase credentials:
   ```
   REACT_APP_FIREBASE_API_KEY=your-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
   REACT_APP_FIREBASE_DATABASE_URL=your-database-url
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   REACT_APP_FIREBASE_APP_ID=your-app-id
   ```

## How to Play

### Game Master Setup
1. Create a room and share the room code with players
2. Designate one player as the "leader" who will have special privileges

### Player Instructions
1. Join the room using the provided room code
2. Work together to solve the firewall puzzle:
   - The firewall has been disabled by a hacker
   - Only the team leader can input the code to reactivate it
   - The code is based on employee information that has been scrambled

### The Firewall Puzzle
The puzzle involves unscrambling employee names and finding the correct sequence:
1. Each scrambled name must be reorganized to find the original employee name
2. The first letter of each employee name is highlighted in red
3. The correct code is formed by arranging these first letters in order of employee seniority (oldest to newest)

### Solution
The correct code is: `ISGNORSAET`

## Game Progression
1. Players begin with a disabled firewall and locked computer
2. Team must decipher the code by unscrambling employee names
3. The leader enters the correct code to reactivate the firewall
4. Once the firewall is active, the computer becomes accessible for further challenges

## Technologies Used
- React.js
- Firebase Realtime Database
- Framer Motion for animations
- Tailwind CSS for styling

## License
This project is licensed under the MIT License. 