import React, { useState, useCallback, useEffect } from 'react';
import { useOSStore } from '../store/useOSStore';
import { useMobile } from '../hooks/useMobile';
import './Desktop.css';
import './DesktopMobile.css';

const GRID_X = 100;
const GRID_Y = 110;
const OFFSET_X = 20;
const OFFSET_Y = 20;

const Desktop = () => {
  const { openApp, windows, updateIconPos } = useOSStore();
  const isMobile = useMobile();
  const [draggingIconId, setDraggingIconId] = useState(null);
  const [rel, setRel] = useState(null);
  const [tempPos, setTempPos] = useState({ x: 0, y: 0 });

  const onMouseDown = useCallback((e, app) => {
    if (e.button !== 0) return;
    
    setDraggingIconId(app.id);
    setRel({
      x: e.pageX - app.iconPos.x,
      y: e.pageY - app.iconPos.y,
    });
    setTempPos(app.iconPos);
    e.stopPropagation();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!draggingIconId) return;
    
    const x = e.pageX - rel.x;
    const y = e.pageY - rel.y;
    
    setTempPos({ x, y });
    e.preventDefault();
  }, [draggingIconId, rel]);

  const onMouseUp = useCallback((e) => {
    if (!draggingIconId) return;
    
    // Consistent grid snapping with offset
    const snappedX = Math.round((tempPos.x - OFFSET_X) / GRID_X) * GRID_X + OFFSET_X;
    const snappedY = Math.round((tempPos.y - OFFSET_Y) / GRID_Y) * GRID_Y + OFFSET_Y;
    
    // Clamp to screen bounds
    const finalX = Math.max(OFFSET_X, Math.min(snappedX, window.innerWidth - 100));
    const finalY = Math.max(OFFSET_Y, Math.min(snappedY, window.innerHeight - 150));
    
    updateIconPos(draggingIconId, { x: finalX, y: finalY });
    setDraggingIconId(null);
    e.stopPropagation();
  }, [draggingIconId, tempPos, updateIconPos]);

  useEffect(() => {
    if (draggingIconId) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingIconId, onMouseMove, onMouseUp]);

  return (
    <div className={`desktop ${isMobile ? 'mobile' : ''}`}>
      <div className={isMobile ? "mobile-launcher" : "desktop-icons"}>
        {windows.map((app) => {
          const isDragging = draggingIconId === app.id;
          const style = isMobile ? {} : {
            left: isDragging ? tempPos.x : app.iconPos.x,
            top: isDragging ? tempPos.y : app.iconPos.y,
            transition: isDragging ? 'none' : 'left 0.2s, top 0.2s',
            zIndex: isDragging ? 1000 : 1
          };

          return (
            <div 
              key={app.id} 
              className={isMobile ? "mobile-icon" : "desktop-icon"}
              style={style}
              onMouseDown={(e) => !isMobile && onMouseDown(e, app)}
              onClick={() => isMobile && openApp(app.id)}
              onDoubleClick={() => !isMobile && openApp(app.id)}
            >
              <div className="icon-visual">
                {app.id === 'notes' && '📝'}
                {app.id === 'crime' && '🕵️'}
                {app.id === 'chrome' && '🌐'}
                {app.id === 'jarvis' && '🤖'}
                {app.id === 'terminal' && '💻'}
                {app.id === 'ide' && '⚡'}
                {app.id === 'file-explorer' && '🗂️'}
              </div>
              <div className="icon-label">{app.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Desktop;
