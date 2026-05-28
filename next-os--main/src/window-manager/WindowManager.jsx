import React from 'react';
import { useOSStore } from '../store/useOSStore';
import Window from './Window';
import { AnimatePresence } from 'framer-motion';

const WindowManager = () => {
  const { windows } = useOSStore();

  return (
    <div className="window-manager" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'calc(100% - 75px)', pointerEvents: 'none' }}>
      {/* pointerEvents: none on container so we can click desktop icons, 
          but we need to enable pointerEvents on windows themselves */}
      <AnimatePresence>
        {windows.map((app) => (
          app.isOpen && (
            <div key={app.id} style={{ pointerEvents: 'auto' }}>
              <Window app={app} />
            </div>
          )
        ))}
      </AnimatePresence>
    </div>
  );
};

export default WindowManager;
