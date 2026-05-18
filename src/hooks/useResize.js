import { useState, useCallback, useEffect } from 'react';

export const useEdgeResize = (initialWidth, initialHeight, initialX, initialY, onResize, minWidth = 200, minHeight = 150) => {
  const [isResizing, setIsResizing] = useState(false);
  const [direction, setDirection] = useState(null);
  const [start, setStart] = useState(null);

  const onMouseDown = useCallback((e, dir) => {
    if (e.button !== 0) return;
    setIsResizing(true);
    setDirection(dir);
    setStart({
      mouseX: e.pageX,
      mouseY: e.pageY,
      width: initialWidth,
      height: initialHeight,
      x: initialX,
      y: initialY
    });
    e.stopPropagation();
    e.preventDefault();
  }, [initialWidth, initialHeight, initialX, initialY]);

  const onMouseMove = useCallback((e) => {
    if (!isResizing || !start) return;

    const deltaX = e.pageX - start.mouseX;
    const deltaY = e.pageY - start.mouseY;

    let newWidth = start.width;
    let newHeight = start.height;
    let newX = start.x;
    let newY = start.y;

    const maxScreenWidth = window.innerWidth;
    const maxScreenHeight = window.innerHeight - 60; // Reserve space for dock

    if (direction.includes('r')) {
      newWidth = Math.max(minWidth, start.width + deltaX);
      // Bound right edge
      if (start.x + newWidth > maxScreenWidth) {
        newWidth = maxScreenWidth - start.x;
      }
    }
    
    if (direction.includes('l')) {
      let clampedDeltaX = deltaX;
      // Bound left edge (X cannot be negative)
      if (start.x + deltaX < 0) {
        clampedDeltaX = -start.x;
      }
      
      const possibleWidth = start.width - clampedDeltaX;
      if (possibleWidth >= minWidth) {
        newWidth = possibleWidth;
        newX = start.x + clampedDeltaX;
      }
    }
    
    if (direction.includes('b')) {
      newHeight = Math.max(minHeight, start.height + deltaY);
      // Bound bottom edge
      if (start.y + newHeight > maxScreenHeight) {
        newHeight = maxScreenHeight - start.y;
      }
    }
    
    if (direction.includes('t')) {
      let clampedDeltaY = deltaY;
      // Bound top edge (Y cannot be negative)
      if (start.y + deltaY < 0) {
        clampedDeltaY = -start.y;
      }
      
      const possibleHeight = start.height - clampedDeltaY;
      if (possibleHeight >= minHeight) {
        newHeight = possibleHeight;
        newY = start.y + clampedDeltaY;
      }
    }

    if (onResize) {
      onResize({ width: newWidth, height: newHeight, x: newX, y: newY });
    }
  }, [isResizing, start, direction, minWidth, minHeight, onResize]);

  const onMouseUp = useCallback(() => {
    setIsResizing(false);
    setStart(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
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
  }, [isResizing, onMouseMove, onMouseUp]);

  return { onMouseDown, isResizing };
};

export default useEdgeResize;
