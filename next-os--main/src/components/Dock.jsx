import React from 'react';
import { useOSStore } from '../store/useOSStore';
import './Dock.css';

const Dock = () => {
  const { windows, openApp, activeWindowId, toggleStartMenu } = useOSStore();

  const dockApps = windows.filter(app => app.isOpen || app.isPinned);

  return (
    <div className="dock-container">
      <div className="dock glass">
        {/* Start Button */}
        <div 
          className="dock-item start-button"
          onClick={(e) => { e.stopPropagation(); toggleStartMenu(); }}
          title="Start"
        >
          <div className="dock-icon">💠</div>
        </div>

        <div className="dock-divider" style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }}></div>

        {dockApps.map((app) => (
          <div 
            key={app.id} 
            className={`dock-item ${app.isOpen && !app.isMinimized ? 'active' : ''} ${app.id === activeWindowId ? 'focused' : ''} ${app.isMinimized ? 'minimized-pulse' : ''}`}
            onClick={() => openApp(app.id)}
            title={app.title}
          >
            <div className="dock-icon">
              {app.id === 'notes' && '📝'}
              {app.id === 'crime' && '🕵️'}
              {app.id === 'chrome' && '🌐'}
              {app.id === 'jarvis' && '🤖'}
              {app.id === 'terminal' && '💻'}
              {app.id === 'ide' && '⚡'}
              {app.id === 'file-explorer' && '🗂️'}
            </div>
            {app.isOpen && <div className="dock-dot"></div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dock;
