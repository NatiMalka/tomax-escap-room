import React from 'react';
import { motion } from 'framer-motion';

const Button = ({ 
  children, 
  onClick, 
  primary = false, 
  large = false,
  className = ''
}) => {
  return (
    <motion.button
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-md font-bold
        ${primary ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}
        ${large ? 'px-8 py-4 text-xl' : 'px-6 py-3 text-lg'}
        ${className}
      `}
      whileHover={{ 
        scale: 1.05,
        boxShadow: `0 0 15px ${primary ? '#60a5fa' : '#f87171'}`
      }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.span
        className="absolute inset-0 z-0 bg-gradient-to-r from-transparent to-white/10"
        initial={{ x: '-100%', opacity: 0.5 }}
        animate={{ 
          x: ['100%', '-100%'],
          opacity: [0, 0.3, 0]
        }}
        transition={{ 
          repeat: Infinity, 
          duration: 2,
          ease: "linear"
        }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
};

export default Button; 