import React, { useState } from 'react';
import { useOSStore } from '../store/useOSStore';
import { motion, AnimatePresence } from 'framer-motion';
import './StartMenu.css';

const StartMenu = () => {
  const { windows, isStartMenuOpen, closeStartMenu, openApp, togglePin } = useOSStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Close when clicking outside is typically handled in App.jsx or here with a full-screen invisible overlay
  
  const filteredApps = windows.filter(app => 
    app.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isStartMenuOpen && (
        <>
          <div className="start-menu-overlay" onClick={closeStartMenu}></div>
          <motion.div 
            className="start-menu glass"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="start-menu-header">
              <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder="Search apps, settings, and documents" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            
            <div className="start-menu-content">
              <h3 className="section-title">All Apps</h3>
              
              {filteredApps.length === 0 ? (
                <div className="no-results">No apps found for "{searchQuery}"</div>
              ) : (
                <div className="app-grid">
                  {filteredApps.map(app => (
                    <div key={app.id} className="app-card">
                      <div 
                        className="app-card-main"
                        onClick={() => {
                          openApp(app.id);
                          closeStartMenu();
                        }}
                      >
                        <div className="app-icon">
                          {app.id === 'notes' && '📝'}
                          {app.id === 'crime' && '🕵️'}
                          {app.id === 'chrome' && '🌐'}
                          {app.id === 'jarvis' && '🤖'}
                          {app.id === 'terminal' && '💻'}
                          {app.id === 'ide' && '⚡'}
                        </div>
                        <div className="app-title">{app.title}</div>
                      </div>
                      
                      <button 
                        className={`pin-btn ${app.isPinned ? 'is-pinned' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(app.id);
                        }}
                        title={app.isPinned ? "Unpin from Taskbar" : "Pin to Taskbar"}
                      >
                        {app.isPinned ? '📌' : '📍'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StartMenu;
