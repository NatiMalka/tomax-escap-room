import React from 'react';
import { motion } from 'framer-motion';

const FileContent = ({ file, onClose, isLeader }) => {
  // Get file content based on file path
  const getFileContent = () => {
    switch (file.path) {
      case '/Core/BombControl/status.log':
        return `
=== BOMB STATUS LOG ===
Last updated: ${new Date().toISOString()}

SYSTEM: ARMED
SECURITY LEVEL: MAXIMUM
COUNTDOWN: ACTIVE
DISARM ATTEMPTS: 0
REMOTE ACCESS: DISABLED

WARNING: Unauthorized access detected
ACTION REQUIRED: Immediate disarm procedure
AUTHENTICATION: Level 3 Admin Access Required

NOTICE: Disarm key file is locked. Use admin_legacy credentials to unlock.
`;

      case '/Core/SystemLogs/legacy_user_error.log':
        return `
=== SYSTEM ERROR LOG ===
Error Code: AUTH_573
Timestamp: ${new Date().toISOString().split('T')[0]}
Severity: CRITICAL

User 'admin_legacy' account has been locked due to suspicious activity.
Attempted access from unauthorized IP: 192.168.1.254

Security protocol triggered:
- Account disabled
- Files locked
- Audit log created

Note from Security Team:
The legacy admin credentials have been compromised. 
For recovery, use the format: [firstname].[year_of_joining]
Search the onboarding files for this information.

Supervisor signature: D. Cooper
`;

      case '/Users/Employees/onboarding.csv':
        return `
Date,Employee ID,Last Name,First Name,Position,Year Joined,Department,Status
2018-06-12,EMP0045,Johnson,Emily,Software Engineer,2018,Engineering,Active
2004-02-15,EMP0023,Miller,Alexander,Network Administrator,2004,IT,Inactive
2020-01-30,EMP0067,Williams,Sophia,UX Designer,2020,Design,Active
2017-11-05,EMP0056,Brown,James,Data Analyst,2017,Analytics,Active
2015-08-20,EMP0034,Jones,Olivia,Project Manager,2015,Management,Active
2010-03-10,EMP0028,Davis,Daniel,Systems Engineer,2010,Engineering,Terminated
2004-03-01,EMP0024,Cohen,David,System Admin,2004,IT,Terminated
2019-09-25,EMP0061,Wilson,Emma,Marketing Specialist,2019,Marketing,Active
2004-05-17,EMP0025,Taylor,Mia,Security Specialist,2004,IT,Inactive
2022-02-01,EMP0075,Smith,Liam,Frontend Developer,2022,Engineering,Active
2004-11-30,EMP0026,Legacy,Adam,IT Admin,2004,IT,Inactive
2014-07-15,EMP0033,Anderson,Isabella,HR Manager,2014,HR,Active
`;

      case '/Documents/SecurityProtocols/level3_access.txt':
        return `
=== LEVEL 3 ACCESS RECOVERY PROTOCOL ===

For security reasons, admin_legacy account has been locked.

To restore access, you will need:
1. The admin's first name
2. The year they joined TOMAX

Access recovery format: [firstname].[year_of_joining]

Example: if John Doe joined in 2010, recovery would be: john.2010

IMPORTANT: Case sensitive! Use lowercase for the name.

Note: You can find onboarding records in the Employees directory.
`;

      case '/Core/BombControl/disarm.key':
        if (file.locked) {
          return `
[THIS FILE IS LOCKED]

Requires admin_legacy credentials to access.
Attempt to force access will trigger security alarm.
          `;
        } else {
          return `
=== DISARM AUTHORIZATION KEY ===
AUTHORIZATION: GRANTED
CODE: 7B-32F-9E1-A45-C08

DISARM PROCEDURE:
1. Access Control Panel with admin_legacy
2. Enter authorization key when prompted
3. Confirm disarm command with biometric scan
4. Wait for system acknowledgment

WARNING: Do not share this key. Any unauthorized
access will be reported to security.
          `;
        }

      default:
        return 'No content available for this file.';
    }
  };
  
  // Determine file type for styling
  const getFileType = () => {
    if (file.path.endsWith('.log')) {
      return 'log';
    } else if (file.path.endsWith('.txt')) {
      return 'text';
    } else if (file.path.endsWith('.csv')) {
      return 'csv';
    } else if (file.path.endsWith('.key')) {
      return 'key';
    } else if (file.path.endsWith('.exe')) {
      return 'executable';
    } else {
      return 'generic';
    }
  };
  
  // Get appropriate styling based on file type
  const getFileTypeStyles = () => {
    const type = getFileType();
    switch (type) {
      case 'log':
        return 'bg-gray-900 text-green-400 font-mono';
      case 'text':
        return 'bg-gray-900 text-blue-300 font-sans';
      case 'csv':
        return 'bg-gray-900 text-amber-200 font-mono';
      case 'key':
        return 'bg-gray-900 text-red-400 font-mono';
      case 'executable':
        return 'bg-gray-900 text-purple-400 font-mono';
      default:
        return 'bg-gray-900 text-white font-mono';
    }
  };
  
  // Format CSV for display
  const formatContent = () => {
    const content = getFileContent();
    const type = getFileType();
    
    if (type === 'csv') {
      return content.split('\n').map((line, index) => {
        if (!line.trim()) return null;
        
        // Header styling
        if (index === 1) {
          return (
            <div key={index} className="grid grid-cols-8 gap-2 py-1 font-bold text-white bg-gray-800 rounded px-2">
              {line.split(',').map((cell, cellIndex) => (
                <div key={cellIndex} className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {cell}
                </div>
              ))}
            </div>
          );
        }
        
        // Row styling - highlight row with "Legacy" for hint
        const isSpecialRow = line.includes('Legacy,Adam');
        
        return (
          <div 
            key={index} 
            className={`grid grid-cols-8 gap-2 py-1 ${index % 2 === 0 ? 'bg-gray-800/30' : ''} ${isSpecialRow ? 'bg-amber-900/30 border-l-4 border-amber-500' : ''} rounded px-2`}
          >
            {line.split(',').map((cell, cellIndex) => (
              <div 
                key={cellIndex} 
                className={`overflow-hidden text-ellipsis whitespace-nowrap ${isSpecialRow && cellIndex === 3 ? 'text-amber-300 font-bold' : ''} ${isSpecialRow && cellIndex === 5 ? 'text-amber-300 font-bold' : ''}`}
              >
                {cell}
              </div>
            ))}
          </div>
        );
      });
    }
    
    // Standard text content
    return content;
  };
  
  return (
    <motion.div 
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-70" onClick={onClose}></div>
      
      <motion.div 
        className="relative bg-gray-900 rounded-lg shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-700"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        {/* Window header */}
        <div className={`px-4 py-2 flex items-center justify-between border-b border-gray-700 ${file.locked ? 'bg-red-900/70' : 'bg-gray-800'}`}>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-white font-medium">{file.name}</span>
          </div>
          
          <div className="flex space-x-2">
            <button 
              className="text-gray-400 hover:text-white transition-colors"
              onClick={onClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* File content */}
        <div className={`p-4 h-96 overflow-y-auto scrollbar-thin ${getFileTypeStyles()}`}>
          {file.locked ? (
            <div className="flex flex-col items-center justify-center h-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-xl text-red-400 font-bold mb-2">File Locked</h3>
              <p className="text-gray-400 text-center max-w-md">
                This file requires higher level permissions to access.
                {file.requires && (
                  <span className="block mt-2 text-amber-400">
                    Required access: {file.requires}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap">
              {getFileType() === 'csv' ? formatContent() : getFileContent()}
            </pre>
          )}
        </div>
        
        {/* Status bar */}
        <div className="bg-gray-800 px-4 py-1 text-xs text-gray-400 border-t border-gray-700 flex justify-between">
          <div>
            {getFileType().toUpperCase()} File
          </div>
          <div>
            {new Date().toLocaleString()}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FileContent; 