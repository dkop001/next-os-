import React, { useEffect, useState } from 'react';
import './App.css';
import './MobileFab.css';
import './components/BackgroundSphere.css';
import WindowManager from './window-manager/WindowManager';
import Dock from './components/Dock';
import Desktop from './components/Desktop';
import StartMenu from './components/StartMenu';
import { storageService } from './services/storageService';
import { useMobile } from './hooks/useMobile';
import RecentAppsMobile from './components/RecentAppsMobile';
import BackgroundSphere from './components/BackgroundSphere';

function App() {
  const isMobile = useMobile();
  const [showRecentApps, setShowRecentApps] = useState(false);
  useEffect(() => {
    storageService.init();
  }, []);

  return (
    <div className="desktop-container">
      <BackgroundSphere />

      {/* Background grid overlay */}
      <div className="wallpaper-overlay"></div>

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
