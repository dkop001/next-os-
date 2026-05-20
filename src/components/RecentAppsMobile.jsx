import React from 'react';
import { useOSStore } from '../store/useOSStore';
import './RecentAppsMobile.css';

const RecentAppsMobile = ({ onClose }) => {
  const { windows, focusApp, closeApp } = useOSStore();
  
  // Only show windows that are currently open
  const openWindows = windows.filter(w => w.isOpen);

  if (openWindows.length === 0) {
    return (
      <div className="recent-apps-overlay" onClick={onClose}>
        <div className="no-recent-apps">No recent apps</div>
      </div>
    );
  }

  return (
    <div className="recent-apps-overlay" onClick={onClose}>
      <div className="recent-apps-container" onClick={e => e.stopPropagation()}>
        <div className="recent-apps-header">
          <span>Recent Apps</span>
          <button className="close-recents-btn" onClick={onClose}>×</button>
        </div>
        <div className="recent-apps-list">
          {openWindows.map(app => (
            <div key={app.id} className="recent-app-card">
              <div className="recent-app-header">
                <div className="recent-app-icon">
                  {app.id === 'notes' && '📝'}
                  {app.id === 'crime' && '🕵️'}
                  {app.id === 'chrome' && '🌐'}
                  {app.id === 'jarvis' && '🤖'}
                  {app.id === 'terminal' && '💻'}
                  {app.id === 'ide' && '⚡'}
                </div>
                <div className="recent-app-title">{app.title}</div>
                <button 
                  className="recent-app-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeApp(app.id);
                  }}
                >×</button>
              </div>
              <div 
                className="recent-app-preview"
                onClick={() => {
                  focusApp(app.id);
                  onClose();
                }}
              >
                Tap to switch
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecentAppsMobile;
