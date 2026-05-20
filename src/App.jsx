import React, { useEffect, useState } from 'react';
import './App.css';
import './MobileFab.css';
import WindowManager from './window-manager/WindowManager';
import Dock from './components/Dock';
import Desktop from './components/Desktop';
import StartMenu from './components/StartMenu';
import { storageService } from './services/storageService';
import { useMobile } from './hooks/useMobile';
import RecentAppsMobile from './components/RecentAppsMobile';

function App() {
  const isMobile = useMobile();
  const [showRecentApps, setShowRecentApps] = useState(false);
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
        {!isMobile && <StartMenu />}
        {!isMobile && <Dock />}
        
        {isMobile && (
          <button 
            className="mobile-recents-fab"
            onClick={() => setShowRecentApps(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        )}

        {isMobile && showRecentApps && (
          <RecentAppsMobile onClose={() => setShowRecentApps(false)} />
        )}
      </div>
    </div>
  );
}

export default App;
