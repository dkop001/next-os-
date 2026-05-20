import { create } from 'zustand';

export const useOSStore = create((set, get) => ({
  windows: [
    { 
      id: 'notes', 
      title: 'Note AI', 
      content: 'NoteAI', 
      isOpen: false, 
      isMinimized: false, 
      isMaximized: false, 
      x: 100, 
      y: 100, 
      width: 600, 
      height: 400, 
      zIndex: 1,
      iconPos: { x: 20, y: 20 },
      isPinned: true
    },
    { 
      id: 'crime', 
      title: 'Crime Inspector', 
      content: 'CrimeInspector', 
      isOpen: false, 
      isMinimized: false, 
      isMaximized: false, 
      x: 200, 
      y: 200, 
      width: 600, 
      height: 400, 
      zIndex: 2,
      iconPos: { x: 20, y: 140 },
      isPinned: true
    },
    { 
      id: 'chrome', 
      title: 'Chrome', 
      content: 'ChromeApp', 
      isOpen: false, 
      isMinimized: false, 
      isMaximized: false, 
      x: 300, 
      y: 150, 
      width: 700, 
      height: 500, 
      zIndex: 3,
      iconPos: { x: 20, y: 260 },
      isPinned: true
    },
    { 
      id: 'jarvis', 
      title: 'Jarvis AI', 
      content: 'JarvisApp', 
      isOpen: false, 
      isMinimized: false, 
      isMaximized: false, 
      x: 120, 
      y: 80, 
      width: 480, 
      height: 620, 
      zIndex: 4,
      iconPos: { x: 20, y: 380 },
      isPinned: true
    },
    { 
      id: 'terminal', 
      title: 'Dev Terminal', 
      content: 'TerminalApp', 
      isOpen: false, 
      isMinimized: false, 
      isMaximized: false, 
      x: 80, 
      y: 120, 
      width: 700, 
      height: 450, 
      zIndex: 5,
      iconPos: { x: 20, y: 500 },
      isPinned: true
    },
    { 
      id: 'ide', 
      title: 'JKC IDE', 
      content: 'IDEApp', 
      isOpen: false, 
      isMinimized: false, 
      isMaximized: false, 
      x: 50, 
      y: 50, 
      width: 980, 
      height: 650, 
      zIndex: 6,
      iconPos: { x: 140, y: 20 },
      isPinned: true
    },
  ],
  activeWindowId: 'chrome',
  maxZIndex: 3,
  isStartMenuOpen: false,

  toggleStartMenu: () => set((state) => ({ isStartMenuOpen: !state.isStartMenuOpen })),
  closeStartMenu: () => set({ isStartMenuOpen: false }),

  togglePin: (appId) => set((state) => ({
    windows: state.windows.map((w) => (w.id === appId ? { ...w, isPinned: !w.isPinned } : w))
  })),

  openApp: (appId) => set((state) => {
    const existing = state.windows.find((w) => w.id === appId);
    if (existing) {
      const newZ = state.maxZIndex + 1;
      return {
        maxZIndex: newZ,
        activeWindowId: appId,
        windows: state.windows.map((w) =>
          w.id === appId ? { ...w, isOpen: true, isMinimized: false, zIndex: newZ } : w
        ),
      };
    }
    return state;
  }),

  closeApp: (appId) => set((state) => ({
    windows: state.windows.map((w) => (w.id === appId ? { ...w, isOpen: false } : w))
  })),

  minimizeApp: (appId) => set((state) => ({
    windows: state.windows.map((w) => (w.id === appId ? { ...w, isMinimized: true } : w))
  })),

  maximizeApp: (appId) => set((state) => ({
    windows: state.windows.map((w) => (w.id === appId ? { ...w, isMaximized: !w.isMaximized } : w))
  })),

  focusApp: (appId) => set((state) => {
    const w = state.windows.find((win) => win.id === appId);
    if (w && w.zIndex < state.maxZIndex) {
      const newZ = state.maxZIndex + 1;
      return {
        maxZIndex: newZ,
        activeWindowId: appId,
        windows: state.windows.map((win) =>
          win.id === appId ? { ...win, zIndex: newZ } : win
        ),
      };
    }
    return { activeWindowId: appId };
  }),

  updateWindowPos: (appId, pos) => set((state) => ({
    windows: state.windows.map((w) => (w.id === appId ? { ...w, x: pos.x, y: pos.y } : w))
  })),

  updateWindowSize: (appId, size) => set((state) => ({
    windows: state.windows.map((w) => (w.id === appId ? { ...w, width: size.width, height: size.height } : w))
  })),

  updateIconPos: (appId, pos) => set((state) => ({
    windows: state.windows.map((w) => (w.id === appId ? { ...w, iconPos: pos } : w))
  })),

  setWindowLayout: (appId, layout) => set((state) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight - 60; // Dock area
    
    return {
      windows: state.windows.map((w) => {
        if (w.id !== appId) return w;
        
        let newPos = { x: w.x, y: w.y, width: w.width, height: w.height };
        
        switch (layout) {
          case 'left':
            newPos = { x: 0, y: 0, width: screenWidth / 2, height: screenHeight };
            break;
          case 'right':
            newPos = { x: screenWidth / 2, y: 0, width: screenWidth / 2, height: screenHeight };
            break;
          case 'top-left':
            newPos = { x: 0, y: 0, width: screenWidth / 2, height: screenHeight / 2 };
            break;
          case 'top-right':
            newPos = { x: screenWidth / 2, y: 0, width: screenWidth / 2, height: screenHeight / 2 };
            break;
          case 'bottom-left':
            newPos = { x: 0, y: screenHeight / 2, width: screenWidth / 2, height: screenHeight / 2 };
            break;
          case 'bottom-right':
            newPos = { x: screenWidth / 2, y: screenHeight / 2, width: screenWidth / 2, height: screenHeight / 2 };
            break;
          default:
            break;
        }
        
        return { ...w, ...newPos, isMaximized: false };
      })
    };
  }),
}));
