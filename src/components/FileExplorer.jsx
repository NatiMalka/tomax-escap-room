import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { database } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { useParams } from 'react-router-dom';
import FileContent from './FileContent';

const FileExplorer = ({ onClose, isLeader }) => {
  const { roomCode } = useParams();
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showFileContent, setShowFileContent] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  
  // Define the file system structure
  const fileSystem = {
    '/': [
      { name: 'Core', type: 'folder', path: '/Core' },
      { name: 'Users', type: 'folder', path: '/Users' },
      { name: 'Documents', type: 'folder', path: '/Documents' },
    ],
    '/Core': [
      { name: 'BombControl', type: 'folder', path: '/Core/BombControl' },
      { name: 'ControlPanel', type: 'folder', path: '/Core/ControlPanel', locked: true, requires: 'admin_legacy' },
      { name: 'SystemLogs', type: 'folder', path: '/Core/SystemLogs' },
    ],
    '/Core/BombControl': [
      { name: 'arm.exe', type: 'executable', path: '/Core/BombControl/arm.exe' },
      { name: 'status.log', type: 'file', path: '/Core/BombControl/status.log' },
      { name: 'disarm.key', type: 'file', path: '/Core/BombControl/disarm.key', locked: true },
    ],
    '/Core/SystemLogs': [
      { name: 'legacy_user_error.log', type: 'file', path: '/Core/SystemLogs/legacy_user_error.log' },
    ],
    '/Users': [
      { name: 'Admins', type: 'folder', path: '/Users/Admins' },
      { name: 'Employees', type: 'folder', path: '/Users/Employees' },
    ],
    '/Users/Admins': [
      { name: 'admin_legacy', type: 'folder', path: '/Users/Admins/admin_legacy', locked: true, status: 'disabled' },
      { name: 'sys_admin', type: 'folder', path: '/Users/Admins/sys_admin' },
    ],
    '/Users/Employees': [
      { name: 'onboarding.csv', type: 'file', path: '/Users/Employees/onboarding.csv', key: true, hint: 'חידת העובדים' },
    ],
    '/Documents': [
      { name: 'SecurityProtocols', type: 'folder', path: '/Documents/SecurityProtocols' },
    ],
    '/Documents/SecurityProtocols': [
      { name: 'level3_access.txt', type: 'file', path: '/Documents/SecurityProtocols/level3_access.txt', hint: 'רמז ל־admin_legacy' },
    ],
  };
  
  // Sync file explorer state with Firebase
  useEffect(() => {
    if (!roomCode) return;
    
    const fileExplorerRef = ref(database, `lobbies/${roomCode}/fileExplorer`);
    const unsubscribe = onValue(fileExplorerRef, (snapshot) => {
      const state = snapshot.val();
      if (state) {
        setCurrentPath(state.currentPath || '/');
        setSelectedItem(state.selectedItem || null);
        setShowFileContent(!!state.showFileContent);
        setCurrentFile(state.currentFile || null);
      }
    });
    
    return () => unsubscribe();
  }, [roomCode]);
  
  // Update Firebase when state changes
  const updateFirebaseState = (updates) => {
    if (!roomCode) return;
    
    update(ref(database, `lobbies/${roomCode}/fileExplorer`), {
      ...updates,
      lastUpdated: Date.now()
    });
  };
  
  // Handle navigation to a path
  const navigateTo = (path) => {
    setCurrentPath(path);
    setSelectedItem(null);
    updateFirebaseState({ currentPath: path, selectedItem: null });
  };
  
  // Handle item selection
  const handleItemSelect = (item) => {
    setSelectedItem(item.path === selectedItem ? null : item.path);
    updateFirebaseState({ selectedItem: item.path === selectedItem ? null : item.path });
  };
  
  // Handle double click on item
  const handleItemDoubleClick = (item) => {
    if (!isLeader) return;
    
    if (item.type === 'folder' && !item.locked) {
      navigateTo(item.path);
    } else if (item.type !== 'folder') {
      setCurrentFile(item);
      setShowFileContent(true);
      updateFirebaseState({ currentFile: item, showFileContent: true });
    }
  };
  
  // Handle navigation back
  const handleBackClick = () => {
    if (currentPath === '/') return;
    
    const pathParts = currentPath.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/') || '/';
    navigateTo(parentPath);
  };
  
  // Close file content modal
  const handleCloseFileContent = () => {
    setShowFileContent(false);
    updateFirebaseState({ showFileContent: false });
  };
  
  // Get current folder name
  const getCurrentFolderName = () => {
    if (currentPath === '/') return 'Root';
    const pathParts = currentPath.split('/');
    return pathParts[pathParts.length - 1];
  };
  
  // Get breadcrumb items
  const getBreadcrumbs = () => {
    if (currentPath === '/') return [{ name: 'Root', path: '/' }];
    
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Root', path: '/' }];
    let currentBuildPath = '';
    
    parts.forEach(part => {
      currentBuildPath += `/${part}`;
      breadcrumbs.push({ name: part, path: currentBuildPath });
    });
    
    return breadcrumbs;
  };
  
  // Get icon for file type
  const getItemIcon = (item) => {
    if (item.type === 'folder') {
      if (item.locked) {
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      }
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    } else if (item.type === 'executable') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      );
    } else if (item.locked) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    } else {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
  };
  
  return (
    <motion.div 
      className="fixed inset-0 z-20 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <motion.div 
        className="relative bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-700"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
      >
        {/* Window header */}
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-white font-medium">File Explorer</span>
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
        
        {/* Toolbar */}
        <div className="bg-gray-800 px-4 py-1 flex items-center space-x-2 border-b border-gray-700">
          <button 
            className={`text-gray-300 hover:text-white transition-colors p-1 rounded ${currentPath === '/' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}`}
            onClick={handleBackClick}
            disabled={currentPath === '/'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="h-5 border-r border-gray-600"></div>
          
          {/* Breadcrumb navigation */}
          <div className="flex items-center space-x-1 text-sm text-gray-300 overflow-x-auto scrollbar-thin">
            {getBreadcrumbs().map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && <span className="text-gray-500">/</span>}
                <button 
                  className={`hover:text-white transition-colors px-1 py-0.5 rounded hover:bg-gray-700 ${crumb.path === currentPath ? 'text-blue-400' : ''}`}
                  onClick={() => navigateTo(crumb.path)}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* File Explorer Content */}
        <div className="bg-gray-900 p-4 h-96 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {fileSystem[currentPath]?.map((item) => (
              <motion.div
                key={item.path}
                className={`flex flex-col items-center text-center p-3 rounded-lg cursor-pointer transition-colors ${selectedItem === item.path ? 'bg-blue-900/40 border border-blue-500/50' : 'hover:bg-gray-800'}`}
                onClick={() => handleItemSelect(item)}
                onDoubleClick={() => handleItemDoubleClick(item)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <div className="w-12 h-12 flex items-center justify-center mb-1">
                  {getItemIcon(item)}
                </div>
                <span className={`text-sm ${item.locked ? 'text-gray-500' : 'text-white'} break-all`}>
                  {item.name}
                </span>
                
                {/* Status indicators */}
                {item.locked && (
                  <div className="flex items-center mt-1">
                    <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-red-400 rounded">
                      {item.requires ? `Requires ${item.requires}` : 'LOCKED'}
                    </span>
                  </div>
                )}
                
                {item.status && (
                  <div className="flex items-center mt-1">
                    <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-amber-400 rounded">
                      {item.status}
                    </span>
                  </div>
                )}
                
                {item.hint && (
                  <div className="flex items-center mt-1">
                    <span className="text-xs px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 rounded border border-indigo-700/30">
                      {item.hint}
                    </span>
                  </div>
                )}
                
                {item.key && (
                  <div className="flex items-center mt-1">
                    <span className="text-xs px-1.5 py-0.5 bg-amber-900/30 text-amber-300 rounded">
                      🔑
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Status bar */}
        <div className="bg-gray-800 px-4 py-1 text-xs text-gray-400 border-t border-gray-700 flex justify-between">
          <div>
            {fileSystem[currentPath]?.length || 0} items
          </div>
          <div>
            {!isLeader && (
              <span className="text-blue-400">Leader has control</span>
            )}
          </div>
        </div>
      </motion.div>
      
      {/* File content modal */}
      {showFileContent && currentFile && (
        <FileContent 
          file={currentFile} 
          onClose={handleCloseFileContent}
          isLeader={isLeader}
        />
      )}
    </motion.div>
  );
};

export default FileExplorer; 