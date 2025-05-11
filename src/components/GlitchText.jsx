import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const GlitchText = ({ 
  text,
  as = 'h1',
  className = '',
  glitchIntensity = 'medium' 
}) => {
  const [displayText, setDisplayText] = useState(text);
  
  // Characters to use for the glitch effect
  const glitchChars = '!<>-_\\|/[]{}$%^&*+~#=@';
  
  // Determine frequency based on intensity
  const getGlitchFrequency = () => {
    switch(glitchIntensity) {
      case 'low': return 2000;
      case 'high': return 500;
      default: return 1000;
    }
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      // Random chance of glitching based on intensity
      const shouldGlitch = Math.random() < 
        (glitchIntensity === 'low' ? 0.3 : glitchIntensity === 'high' ? 0.7 : 0.5);
      
      if (shouldGlitch) {
        // Create a glitched version of the text
        const glitchedText = text.split('').map(char => {
          // Random chance of replacing each character
          return Math.random() < 0.2 
            ? glitchChars[Math.floor(Math.random() * glitchChars.length)]
            : char;
        }).join('');
        
        setDisplayText(glitchedText);
        
        // Quick timeout to reset back to normal
        setTimeout(() => {
          setDisplayText(text);
        }, 100);
      }
    }, getGlitchFrequency());
    
    return () => clearInterval(intervalId);
  }, [text, glitchIntensity]);

  // Render the appropriate element based on the 'as' prop
  const renderElement = () => {
    const props = {
      className: `font-mono relative ${className}`,
      style: {
        textShadow: '0.05em 0 0 rgba(255, 0, 0, 0.75), -0.05em -0.025em 0 rgba(0, 255, 0, 0.75), 0.025em 0.05em 0 rgba(0, 0, 255, 0.75)'
      }
    };
    
    switch(as) {
      case 'h1': return <h1 {...props}>{displayText}</h1>;
      case 'h2': return <h2 {...props}>{displayText}</h2>;
      case 'h3': return <h3 {...props}>{displayText}</h3>;
      case 'h4': return <h4 {...props}>{displayText}</h4>;
      case 'h5': return <h5 {...props}>{displayText}</h5>;
      case 'h6': return <h6 {...props}>{displayText}</h6>;
      case 'p': return <p {...props}>{displayText}</p>;
      case 'span': return <span {...props}>{displayText}</span>;
      default: return <div {...props}>{displayText}</div>;
    }
  };

  return renderElement();
};

export default GlitchText; 