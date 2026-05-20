import React, { useEffect } from 'react';
import './App.css';
import WindowManager from './window-manager/WindowManager';
import Dock from './components/Dock';
import Desktop from './components/Desktop';
import StartMenu from './components/StartMenu';
import { storageService } from './services/storageService';

function App() {
  useEffect(() => {
    storageService.init();
  }, []);

  return (
    <div className="desktop-container">
      {/* Background grid effect */}
      <div className="wallpaper-overlay" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(rgba(0, 243, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 243, 255, 0.03) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        opacity: 0.8,
        zIndex: 0
      }}></div>

      {/* Ambient glow in background */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(26, 11, 46, 0.8) 0%, rgba(5, 5, 10, 0) 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }}></div>

      <div className="desktop-content">
        <Desktop />
        <WindowManager />
        <StartMenu />
        <Dock />
      </div>
    </div>
  );
}

export default App;
