import { useState, useCallback, useEffect } from 'react';

export const useDrag = (initialX, initialY, onDragStop) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [rel, setRel] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Sync position with props when not dragging
  useEffect(() => {
    if (!isDragging) {
      setPosition({ x: initialX, y: initialY });
    }
  }, [initialX, initialY, isDragging]);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

    const boundingBox = e.currentTarget.getBoundingClientRect();
    
    const windowEl = e.currentTarget.closest('.window');
    if (windowEl) {
      const windowRect = windowEl.getBoundingClientRect();
      setDimensions({ width: windowRect.width, height: windowRect.height });
    } else {
      setDimensions({ width: boundingBox.width, height: boundingBox.height });
    }

    setRel({
      x: e.pageX - boundingBox.left,
      y: e.pageY - boundingBox.top,
    });
    setIsDragging(true);
    e.stopPropagation();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    let x = e.pageX - rel.x;
    let y = e.pageY - rel.y;
    
    const maxX = window.innerWidth - dimensions.width;
    const maxY = window.innerHeight - dimensions.height - 60;
    
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    
    setPosition({ x, y });
    e.preventDefault();
  }, [isDragging, rel, dimensions]);

  const onMouseUp = useCallback((e) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (onDragStop) {
      onDragStop(position);
    }
    e.stopPropagation();
  }, [isDragging, onDragStop, position]);

  useEffect(() => {
    if (isDragging) {
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
  }, [isDragging, onMouseMove, onMouseUp]);

  return { position, setPosition, onMouseDown, isDragging };
};

export default useDrag;
