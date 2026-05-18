import { create } from 'zustand';

export const useChromeStore = create((set) => ({
  tabs: [
    { id: '1', title: 'New Tab', url: 'chrome://newtab', isLoading: false, history: ['chrome://newtab'], historyIndex: 0 }
  ],
  activeTabId: '1',

  addTab: () => set((state) => {
    const newId = Date.now().toString();
    return {
      tabs: [...state.tabs, { id: newId, title: 'New Tab', url: 'chrome://newtab', isLoading: false, history: ['chrome://newtab'], historyIndex: 0 }],
      activeTabId: newId
    };
  }),

  closeTab: (tabId) => set((state) => {
    const newTabs = state.tabs.filter(t => t.id !== tabId);
    if (newTabs.length === 0) {
      const newId = Date.now().toString();
      return {
        tabs: [{ id: newId, title: 'New Tab', url: 'chrome://newtab', isLoading: false, history: ['chrome://newtab'], historyIndex: 0 }],
        activeTabId: newId
      };
    }
    
    let newActiveId = state.activeTabId;
    if (tabId === state.activeTabId) {
      newActiveId = newTabs[newTabs.length - 1].id;
    }
    
    return {
      tabs: newTabs,
      activeTabId: newActiveId
    };
  }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabUrl: (tabId, url) => set((state) => ({
    tabs: state.tabs.map(t => {
      if (t.id === tabId) {
        let title = url;
        if (url === 'chrome://newtab') title = 'New Tab';
        else {
          try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            title = urlObj.hostname;
          } catch (e) {
            title = url;
          }
        }
        
        // Add to history
        const newHistory = t.history.slice(0, t.historyIndex + 1);
        newHistory.push(url);
        
        return { ...t, url, title, isLoading: true, history: newHistory, historyIndex: newHistory.length - 1 };
      }
      return t;
    })
  })),

  goBack: (tabId) => set((state) => ({
    tabs: state.tabs.map(t => {
      if (t.id === tabId && t.historyIndex > 0) {
        const newIndex = t.historyIndex - 1;
        const newUrl = t.history[newIndex];
        return { ...t, url: newUrl, historyIndex: newIndex, isLoading: true };
      }
      return t;
    })
  })),

  goForward: (tabId) => set((state) => ({
    tabs: state.tabs.map(t => {
      if (t.id === tabId && t.historyIndex < t.history.length - 1) {
        const newIndex = t.historyIndex + 1;
        const newUrl = t.history[newIndex];
        return { ...t, url: newUrl, historyIndex: newIndex, isLoading: true };
      }
      return t;
    })
  })),

  setTabLoading: (tabId, isLoading) => set((state) => ({
    tabs: state.tabs.map(t => t.id === tabId ? { ...t, isLoading } : t)
  }))
}));
