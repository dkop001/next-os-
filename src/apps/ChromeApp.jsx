import React, { useState, useEffect, useRef } from 'react';
import { useChromeStore } from '../store/useChromeStore';

const ChromeApp = () => {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, updateTabUrl, goBack, goForward, setTabLoading } = useChromeStore();
  const [addressInput, setAddressInput] = useState('');
  const iframeRef = useRef(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => {
    if (activeTab) {
      setAddressInput(activeTab.url === 'chrome://newtab' ? '' : activeTab.url);
    }
  }, [activeTab?.url, activeTabId]);

  const handleAddressSubmit = (e) => {
    if (e.key === 'Enter') {
      let url = addressInput.trim();
      if (url === '') return;
      
      if (!url.includes('.') || url.includes(' ')) {
        // The igu=1 parameter allows google search to be loaded in an iframe!
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}&igu=1`;
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      } else if (url.includes('google.com/search') && !url.includes('igu=1')) {
        url += '&igu=1';
      }
      
      updateTabUrl(activeTabId, url);
    }
  };

  const handleIframeLoad = () => {
    setTabLoading(activeTabId, false);
  };

  const renderContent = () => {
    if (!activeTab) return null;
    
    if (activeTab.url === 'chrome://newtab') {
      return (
        <div className="chrome-page">
          <h2 style={{ color: 'var(--text-dark)', marginBottom: '20px', fontSize: '2.5rem' }}>Google</h2>
          <input 
            type="text" 
            placeholder="Search Google or type a URL" 
            className="chrome-search"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onKeyDown={handleAddressSubmit}
            autoFocus
          />
        </div>
      );
    }

    // Use direct URL. Google search works via &igu=1. Other sites will load natively unless blocked by X-Frame-Options.
    const iframeUrl = activeTab.url;
    
    return (
      <div style={{ flex: 1, width: '100%', position: 'relative' }}>
        {activeTab.isLoading && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: 'var(--cyber-cyan)', animation: 'loading 2s infinite' }} />
        )}
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          title={activeTab.title}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
          onLoad={handleIframeLoad}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    );
  };

  if (!activeTab) return null;

  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  return (
    <div className="chrome-app" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="chrome-tabs" style={{ display: 'flex', overflowX: 'auto' }}>
        {tabs.map((tab) => (
          <div 
            key={tab.id} 
            className={`chrome-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
              {tab.title}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '12px' }}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="chrome-tab-add" onClick={addTab}>+</div>
      </div>
      
      <div className="chrome-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div className="chrome-address-bar" style={{ margin: '8px', display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => goBack(activeTabId)} 
            disabled={!canGoBack}
            style={{ background: 'none', border: 'none', color: canGoBack ? 'var(--text-primary)' : 'var(--text-dim)', cursor: canGoBack ? 'pointer' : 'default', fontSize: '16px' }}
          >
            ←
          </button>
          <button 
            onClick={() => goForward(activeTabId)} 
            disabled={!canGoForward}
            style={{ background: 'none', border: 'none', color: canGoForward ? 'var(--text-primary)' : 'var(--text-dim)', cursor: canGoForward ? 'pointer' : 'default', fontSize: '16px' }}
          >
            →
          </button>
          <button 
            onClick={() => {
              setTabLoading(activeTabId, true);
              if (iframeRef.current) iframeRef.current.src += ''; 
            }} 
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', marginRight: '4px' }}
          >
            ↻
          </button>
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '20px' }}>
            <span className="chrome-lock" style={{ marginRight: '8px' }}>🔒</span>
            <input 
              type="text" 
              value={addressInput} 
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={handleAddressSubmit}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        
        {renderContent()}
      </div>
      
      <style>{`
        @keyframes loading {
          0% { width: 0; left: 0; }
          50% { width: 100%; left: 0; }
          100% { width: 0; left: 100%; }
        }
      `}</style>
    </div>
  );
};

export default ChromeApp;
