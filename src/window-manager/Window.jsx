import React, { useState } from 'react';
import { useOSStore } from '../store/useOSStore';
import { useMobile } from '../hooks/useMobile';
import { Rnd } from 'react-rnd';
import { motion } from 'framer-motion';
import './Window.css';
import './WindowMobile.css';
import NoteAI from '../apps/NoteAI';
import CrimeInspector from '../apps/CrimeInspector';
import ChromeApp from '../apps/ChromeApp';
import JarvisApp from '../apps/JarvisApp';
import TerminalApp from '../apps/TerminalApp';
import IDEApp from '../apps/IDEApp';

const Window = ({ app }) => {
  const { focusApp, minimizeApp, maximizeApp, closeApp, updateWindowPos, updateWindowSize, activeWindowId, setWindowLayout } = useOSStore();
  const isMobile = useMobile();
  const [showSnapMenu, setShowSnapMenu] = useState(false);

  // We don't need if (!app.isOpen) return null; here since WindowManager handles it with AnimatePresence

  const isFocused = app.id === activeWindowId;

  // Derive Rnd bounds
  const size = (app.isMaximized || isMobile)
    ? { width: '100%', height: '100%' } 
    : { width: app.width, height: app.height };
    
  const position = (app.isMaximized || isMobile)
    ? { x: 0, y: 0 } 
    : { x: app.x, y: app.y };

  return (
    <Rnd
      bounds=".window-manager"
      size={size}
      position={position}
      minWidth={320}
      minHeight={240}
      onDragStart={() => focusApp(app.id)}
      onResizeStart={() => focusApp(app.id)}
      onDragStop={(e, d) => {
        if (!app.isMaximized && !app.isMinimized) {
          updateWindowPos(app.id, { x: d.x, y: d.y });
        }
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        if (!app.isMaximized && !app.isMinimized && !isMobile) {
          updateWindowSize(app.id, { width: ref.offsetWidth, height: ref.offsetHeight });
          updateWindowPos(app.id, { x: position.x, y: position.y });
        }
      }}
      disableDragging={app.isMaximized || app.isMinimized || isMobile}
      enableResizing={!app.isMaximized && !app.isMinimized && !isMobile}
      dragHandleClassName="window-header"
      resizeHandleComponent={{
        bottomRight: (
          <div className="resize-handle-br">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
              <path d="M12 6L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
              <path d="M12 10L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.95"/>
            </svg>
          </div>
        )
      }}
      style={{
        zIndex: app.zIndex,
        pointerEvents: app.isMinimized ? 'none' : 'auto'
      }}
      className={`window-rnd ${isFocused ? 'focused' : ''} ${app.isMinimized ? 'minimized' : ''}`}
    >
      <motion.div 
        className={`window-inner ${isFocused ? 'focused' : ''}`}
        onMouseDownCapture={() => focusApp(app.id)}
        initial="closed"
        animate={app.isMinimized ? "minimized" : "open"}
        exit="closed"
        variants={{
          open: { scale: 1, opacity: 1, y: 0, filter: "blur(0px)" },
          minimized: { scale: 0.35, opacity: 0, y: 300, filter: "blur(5px)" },
          closed: { scale: 0.95, opacity: 0, filter: "blur(2px)" }
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Header / Titlebar */}
        {!isMobile && (
          <div 
            className="window-header" 
            onDoubleClick={() => maximizeApp(app.id)}
          >
            <div className="window-title">{app.title}</div>
            <div className="window-controls">
              <button className="control-btn minimize" onClick={(e) => { e.stopPropagation(); minimizeApp(app.id); }}>_</button>
              
              <div 
                className="maximize-wrapper"
                onMouseEnter={() => setShowSnapMenu(true)}
                onMouseLeave={() => setShowSnapMenu(false)}
                style={{ position: 'relative' }}
              >
                <button className="control-btn maximize" onClick={(e) => { e.stopPropagation(); maximizeApp(app.id); }}>[ ]</button>
                {showSnapMenu && (
                  <div className="snap-menu glass">
                    <div className="snap-layout-group">
                      <div className="snap-layout-item left" onClick={(e) => { e.stopPropagation(); setWindowLayout(app.id, 'left'); }} title="Snap Left"></div>
                      <div className="snap-layout-item right" onClick={(e) => { e.stopPropagation(); setWindowLayout(app.id, 'right'); }} title="Snap Right"></div>
                    </div>
                    <div className="snap-layout-group quarters">
                      <div className="snap-layout-item top-left" onClick={(e) => { e.stopPropagation(); setWindowLayout(app.id, 'top-left'); }} title="Snap Top Left"></div>
                      <div className="snap-layout-item top-right" onClick={(e) => { e.stopPropagation(); setWindowLayout(app.id, 'top-right'); }} title="Snap Top Right"></div>
                      <div className="snap-layout-item bottom-left" onClick={(e) => { e.stopPropagation(); setWindowLayout(app.id, 'bottom-left'); }} title="Snap Bottom Left"></div>
                      <div className="snap-layout-item bottom-right" onClick={(e) => { e.stopPropagation(); setWindowLayout(app.id, 'bottom-right'); }} title="Snap Bottom Right"></div>
                    </div>
                  </div>
                )}
              </div>
              
              <button className="control-btn close" onClick={(e) => { e.stopPropagation(); closeApp(app.id); }}>×</button>
            </div>
          </div>
        )}

        {/* Mobile Header */}
        {isMobile && (
          <div className="mobile-header">
            <button className="mobile-back-btn" onClick={(e) => { e.stopPropagation(); closeApp(app.id); }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="mobile-title">{app.title}</div>
            <div className="mobile-spacer"></div>
          </div>
        )}

        {/* Content */}
        <div className={`window-content ${app.content === 'ChromeApp' || app.content === 'JarvisApp' || app.content === 'TerminalApp' || app.content === 'IDEApp' ? 'no-padding' : ''}`} onMouseDown={() => focusApp(app.id)}>
          {app.content === 'NoteAI' && <NoteAI />}
          {app.content === 'CrimeInspector' && <CrimeInspector />}
          {app.content === 'ChromeApp' && <ChromeApp />}
          {app.content === 'JarvisApp' && <JarvisApp />}
          {app.content === 'TerminalApp' && <TerminalApp />}
          {app.content === 'IDEApp' && <IDEApp />}
        </div>
      </motion.div>
    </Rnd>
  );
};

export default Window;
