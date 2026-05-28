import React, { useState, useEffect, useRef } from 'react';
import { useChromeStore } from '../store/useChromeStore';
import { storageService } from '../services/storageService';

const ChromeApp = () => {
  const { 
    tabs, 
    activeTabId, 
    addTab, 
    closeTab, 
    setActiveTab, 
    updateTabUrl, 
    goBack, 
    goForward, 
    setTabLoading 
  } = useChromeStore();

  const [addressInput, setAddressInput] = useState('');
  const iframeRef = useRef(null);

  // Reader Mode States
  const [readerModeActive, setReaderModeActive] = useState(false);
  const [readerContent, setReaderContent] = useState(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState(null);
  
  // AI Summary States
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  
  // Custom Controls
  const [readerFontSize, setReaderFontSize] = useState(15);
  const [saveSuccessToast, setSaveSuccessToast] = useState('');

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Reset tab-specific reader states when tab changes
  useEffect(() => {
    setReaderModeActive(false);
    setReaderContent(null);
    setReaderError(null);
    setAiSummaryText('');
    setAiSummaryLoading(false);
    setSaveSuccessToast('');
    if (activeTab) {
      setAddressInput(activeTab.url === 'chrome://newtab' ? '' : activeTab.url);
    }
  }, [activeTabId, activeTab?.url]);

  const handleAddressSubmit = (e) => {
    if (e.key === 'Enter') {
      let url = addressInput.trim();
      if (url === '') return;
      
      if (!url.includes('.') || url.includes(' ')) {
        // Normal search query -> Route via embeddable Google search
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}&igu=1`;
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      
      updateTabUrl(activeTabId, url);
    }
  };

  const handleIframeLoad = () => {
    setTabLoading(activeTabId, false);
  };

  // V1 Embed Parser
  const getEmbedInfo = (url) => {
    if (!url || url === 'chrome://newtab') return null;

    try {
      // 1. YouTube Video Embed Parser
      if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        let videoId = '';
        if (url.includes('youtube.com/watch')) {
          const urlObj = new URL(url);
          videoId = urlObj.searchParams.get('v');
        } else if (url.includes('youtu.be/')) {
          const parts = url.split('/');
          videoId = parts[parts.length - 1].split('?')[0];
        } else if (url.includes('youtube.com/embed/')) {
          const parts = url.split('/');
          videoId = parts[parts.length - 1].split('?')[0];
        }
        if (videoId) {
          return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${videoId}`, name: '🎥 YouTube Mainframe Player' };
        }
      }

      // 2. Google Maps Embed Parser
      if (url.includes('google.com/maps') || url.includes('google.co.in/maps') || url.includes('maps.google.com')) {
        return { type: 'maps', embedUrl: 'https://maps.google.com/maps?q=new%20york&t=&z=13&ie=UTF8&iwloc=&output=embed', name: '🗺️ Mainframe Interactive Navigation' };
      }

      // 3. Wikipedia Mobile Parser (Highly compatible with standard frames)
      if (url.includes('wikipedia.org')) {
        let wikiUrl = url;
        wikiUrl = wikiUrl.replace('//wikipedia.org', '//en.m.wikipedia.org').replace('//en.wikipedia.org', '//en.m.wikipedia.org');
        return { type: 'wikipedia', embedUrl: wikiUrl, name: '🌐 Wikipedia Mainframe Portal' };
      }

      // 4. Spotify Embed Parser
      if (url.includes('spotify.com/')) {
        let spotifyUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
        return { type: 'spotify', embedUrl: spotifyUrl, name: '🎵 Spotify Mainframe Uplink' };
      }

      // Google Interactive Search Parameter Bypass
      if (url.includes('google.com/search')) {
        let searchUrl = url;
        if (!searchUrl.includes('igu=1')) {
          searchUrl += (searchUrl.includes('?') ? '&' : '?') + 'igu=1';
        }
        return { type: 'google', embedUrl: searchUrl, name: '🔍 Google Cyber Search' };
      }
    } catch (e) {
      console.warn("Embed URL parser error:", e);
    }

    return null;
  };

  // Reader Mode Text Scraping Handler
  const handleActivateReaderMode = async () => {
    if (!activeTab || activeTab.url === 'chrome://newtab') return;
    
    setReaderModeActive(true);
    setReaderLoading(true);
    setReaderError(null);
    setAiSummaryText('');

    try {
      const res = await fetch(`/api/fetch-page?url=${encodeURIComponent(activeTab.url)}`);
      if (!res.ok) {
        throw new Error(`Failed to decode site text: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setReaderContent(data);
    } catch (err) {
      console.error(err);
      setReaderError(err.message);
    } finally {
      setReaderLoading(false);
    }
  };

  // AI Summary Hook via Vercel SSE summarize endpoint
  const handleGenerateAISummary = async () => {
    if (!readerContent || readerContent.elements.length === 0) return;
    
    setAiSummaryLoading(true);
    setAiSummaryText('Initializing mainframe neural AI scanner...');

    try {
      // Compile reading text for summarization
      const textToScan = readerContent.elements.map(e => e.content).join('\n\n').substring(0, 4000);
      
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToScan })
      });

      if (!response.ok) {
        throw new Error('AI summary uplink failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finished = false;
      let summaryResult = '';

      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.content) {
                  summaryResult += parsed.content;
                  setAiSummaryText(summaryResult);
                } else if (parsed.error) {
                  summaryResult = `❌ AI Scanner Error: ${parsed.error}`;
                  setAiSummaryText(summaryResult);
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (e) {
      setAiSummaryText(`❌ Mainframe Neural Scan Failed: ${e.message}`);
    } finally {
      setAiSummaryLoading(false);
    }
  };

  // Save to OS Workspace File
  const handleSaveToWorkspace = async () => {
    if (!readerContent) return;
    
    try {
      // Sanitize title for file name
      const safeTitle = readerContent.title
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .substring(0, 30);
      
      const filePath = `/documents/scanned_${safeTitle || 'article'}.txt`;
      const documentText = `=== CYBERNETIC INTELLIGENCE BRIEFING ===\nURL: ${readerContent.url}\nDate Scanned: ${new Date().toLocaleDateString()}\n\nTitle: ${readerContent.title}\n\n` +
        readerContent.elements.map(e => `[${e.type.toUpperCase()}]\n${e.content}`).join('\n\n');

      await storageService.writeFile(filePath, documentText);
      
      setSaveSuccessToast(`Scanned asset loaded successfully to ${filePath}`);
      setTimeout(() => setSaveSuccessToast(''), 4000);
    } catch (e) {
      alert(`Asset injection failed: ${e.message}`);
    }
  };

  const renderContent = () => {
    if (!activeTab) return null;
    
    // 1. NEON SEARCH HOME PAGE
    if (activeTab.url === 'chrome://newtab') {
      return (
        <div className="chrome-newtab-dashboard">
          <div className="cyber-grid-overlay" />
          
          <div className="chrome-newtab-main">
            <h1 className="neon-search-title">⚡ NEON SEARCH</h1>
            <p className="neon-search-subtitle">Secure Mainframe Web Navigation Portal</p>
            
            <div className="neon-search-box-row">
              <span className="neon-input-cyber-bracket">[</span>
              <input 
                type="text" 
                placeholder="Secure uplink URL or search mainframe queries..." 
                className="chrome-newtab-search-input"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={handleAddressSubmit}
                autoFocus
              />
              <span className="neon-input-cyber-bracket">]</span>
            </div>
            
            {/* Quick Uplink Chips */}
            <div className="neon-uplinks-grid">
              <div 
                className="neon-uplink-chip"
                onClick={() => updateTabUrl(activeTabId, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
              >
                <span className="chip-icon">🎥</span>
                <span className="chip-name">YouTube Player</span>
              </div>
              <div 
                className="neon-uplink-chip"
                onClick={() => updateTabUrl(activeTabId, 'https://maps.google.com')}
              >
                <span className="chip-icon">🗺️</span>
                <span className="chip-name">Google Maps</span>
              </div>
              <div 
                className="neon-uplink-chip"
                onClick={() => updateTabUrl(activeTabId, 'https://wikipedia.org')}
              >
                <span className="chip-icon">🌐</span>
                <span className="chip-name">Wikipedia Portal</span>
              </div>
              <div 
                className="neon-uplink-chip"
                onClick={() => updateTabUrl(activeTabId, 'https://open.spotify.com')}
              >
                <span className="chip-icon">🎵</span>
                <span className="chip-name">Spotify Uplink</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 2. CYBER READER MODE PANEL
    if (readerModeActive) {
      return (
        <div className="cyber-reader-split-pane">
          {/* Main Reading Document Pane */}
          <div className="cyber-reader-main-pane">
            {readerLoading && (
              <div className="cyber-reader-loading-card">
                <span className="cyber-spinner">⚡</span>
                <span>DECRYPTING MAINFRAME PACKETS...</span>
              </div>
            )}

            {readerError && (
              <div className="cyber-reader-error-card">
                <span className="cyber-error-icon">⚠️</span>
                <h3>Proxy Decryption Blocked</h3>
                <p>{readerError}</p>
                <button onClick={handleActivateReaderMode} className="cyber-reader-retry-btn">
                  ↻ Retry Decoder Link
                </button>
              </div>
            )}

            {readerContent && (
              <div className="cyber-reader-article-scroll" style={{ fontSize: `${readerFontSize}px` }}>
                <span className="cyber-article-decoded-tag">📂 DECODED ARCHIVE: {new URL(readerContent.url).hostname}</span>
                <h1 className="cyber-article-title">{readerContent.title}</h1>
                <div className="cyber-article-divider" />
                
                <div className="cyber-article-content">
                  {readerContent.elements.map((el, idx) => {
                    if (el.type === 'h1' || el.type === 'h2' || el.type === 'h3') {
                      return <h2 key={idx} className="cyber-reader-heading">{el.content}</h2>;
                    }
                    if (el.type === 'li') {
                      return <li key={idx} className="cyber-reader-bullet">{el.content}</li>;
                    }
                    return <p key={idx} className="cyber-reader-paragraph">{el.content}</p>;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* AI summaries & Controls Panel */}
          {readerContent && (
            <div className="cyber-reader-ai-panel">
              <div className="cyber-panel-header">⚡ INTELLIGENCE CONSOLE</div>
              
              {/* Scan / Summary Container */}
              <div className="cyber-panel-summary-area">
                {aiSummaryText ? (
                  <div className="cyber-summary-text-box">
                    <div className="summary-header-glow">🤖 Neural Summary Scan:</div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{aiSummaryText}</p>
                  </div>
                ) : (
                  <div className="cyber-summary-placeholder">
                    <span>Neural AI Scanner Ready. Ready to perform intelligence sweep on current decrypted text buffer.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="cyber-panel-action-buttons">
                <button 
                  onClick={handleGenerateAISummary} 
                  disabled={aiSummaryLoading} 
                  className="cyber-panel-btn summarize"
                >
                  {aiSummaryLoading ? '🤖 Neural Scanning...' : '🤖 AI Neural Scan'}
                </button>

                <button 
                  onClick={handleSaveToWorkspace} 
                  className="cyber-panel-btn save"
                >
                  💾 Save to Mainframe
                </button>
              </div>

              {/* Toast for Save confirmation */}
              {saveSuccessToast && (
                <div className="cyber-save-toast">
                  ⚡ {saveSuccessToast}
                </div>
              )}

              {/* Reading settings */}
              <div className="cyber-panel-settings">
                <span className="settings-label">FONT SIZE CONTROLS</span>
                <div className="font-size-row">
                  <button onClick={() => setReaderFontSize(Math.max(12, readerFontSize - 2))} className="font-btn">A-</button>
                  <span className="font-indicator">{readerFontSize}px</span>
                  <button onClick={() => setReaderFontSize(Math.min(24, readerFontSize + 2))} className="font-btn">A+</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // 3. V1 EMBED MODE INTERACTION
    const embedInfo = getEmbedInfo(activeTab.url);

    if (embedInfo) {
      return (
        <div style={{ flex: 1, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div className="chrome-embed-bar">
            <span style={{ color: 'var(--ide-cyan)' }}>⚡ INTERACTIVE EMBED ACTIVE:</span>
            <span style={{ color: '#fff', marginLeft: '6px' }}>{embedInfo.name}</span>
          </div>
          {activeTab.isLoading && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: 'var(--cyber-cyan)', animation: 'loading 2s infinite', zIndex: 10 }} />
          )}
          <iframe
            ref={iframeRef}
            src={embedInfo.embedUrl}
            title={activeTab.title}
            style={{ width: '100%', flex: 1, border: 'none', backgroundColor: '#0c0d12' }}
            onLoad={handleIframeLoad}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      );
    }

    // 4. FALLBACK FALLBACK PANEL (Website Blocks Iframe Embedding)
    return (
      <div className="chrome-fallback-page">
        <div className="fallback-card">
          <span className="fallback-cyber-tag">[ MAINFRAME FIREWALL INTERCEPT ]</span>
          <div className="fallback-icon">🌐</div>
          <h2 className="fallback-title">Frame Integration Restrict</h2>
          <p className="fallback-text">
            Domain <span className="fallback-domain-name">{activeTab.url}</span> restricts embed sandboxing. Standard frame execution blocked by destination server.
          </p>

          <div className="fallback-actions">
            <button onClick={handleActivateReaderMode} className="fallback-btn primary">
              📖 Activate Cyber Reader Mode
            </button>
            <button onClick={() => window.open(activeTab.url, '_blank')} className="fallback-btn secondary">
              ↗️ Open External Link
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!activeTab) return null;

  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  return (
    <div className="chrome-app" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#08090d', color: '#e0e6ed' }}>
      <div className="chrome-tabs" style={{ display: 'flex', overflowX: 'auto', background: 'rgba(8, 9, 13, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {tabs.map((tab) => (
          <div 
            key={tab.id} 
            className={`chrome-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: tab.id === activeTabId ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
              {tab.title}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '10px' }}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="chrome-tab-add" onClick={addTab} style={{ color: 'var(--ide-cyan)' }}>+</div>
      </div>
      
      <div className="chrome-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
        {/* URL ADDRESS NAVIGATION BAR */}
        <div className="chrome-address-bar" style={{ margin: '8px', display: 'flex', gap: '12px', background: 'rgba(12,13,18,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={() => goBack(activeTabId)} 
            disabled={!canGoBack}
            style={{ background: 'none', border: 'none', color: canGoBack ? '#00f3ff' : 'rgba(255,255,255,0.2)', cursor: canGoBack ? 'pointer' : 'default', fontSize: '14px' }}
          >
            ◀
          </button>
          <button 
            onClick={() => goForward(activeTabId)} 
            disabled={!canGoForward}
            style={{ background: 'none', border: 'none', color: canGoForward ? '#00f3ff' : 'rgba(255,255,255,0.2)', cursor: canGoForward ? 'pointer' : 'default', fontSize: '14px' }}
          >
            ▶
          </button>
          <button 
            onClick={() => {
              if (readerModeActive) {
                handleActivateReaderMode();
              } else {
                setTabLoading(activeTabId, true);
                if (iframeRef.current) iframeRef.current.src += ''; 
              }
            }} 
            style={{ background: 'none', border: 'none', color: '#00f3ff', cursor: 'pointer', fontSize: '14px', marginRight: '4px' }}
          >
            ⟳
          </button>
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '5px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: 'var(--ide-green)', fontSize: '12px', marginRight: '8px' }}>⚡</span>
            <input 
              type="text" 
              value={addressInput} 
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={handleAddressSubmit}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#e0e6ed', fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>

          {/* Quick Reader Mode Toggle Button in Address Bar */}
          {activeTab.url !== 'chrome://newtab' && !getEmbedInfo(activeTab.url) && (
            <button 
              onClick={() => {
                if (readerModeActive) {
                  setReaderModeActive(false);
                } else {
                  handleActivateReaderMode();
                }
              }}
              style={{ 
                background: readerModeActive ? 'rgba(0, 243, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                border: readerModeActive ? '1px solid var(--ide-cyan)' : '1px solid rgba(255,255,255,0.1)',
                color: readerModeActive ? 'var(--ide-cyan)' : '#e0e6ed',
                cursor: 'pointer', 
                padding: '4px 10px', 
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              📖 {readerModeActive ? 'DIRECT VIEW' : 'READER MODE'}
            </button>
          )}
        </div>
        
        {renderContent()}
      </div>
      
      {/* SCOPED PREMIUM CYBER STYLING BLOCKS */}
      <style>{`
        @keyframes loading {
          0% { width: 0; left: 0; }
          50% { width: 100%; left: 0; }
          100% { width: 0; left: 100%; }
        }

        /* 1. New Tab Home Page Dashboard */
        .chrome-newtab-dashboard {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #0e111a 0%, #06070a 100%);
          position: relative;
          overflow: hidden;
        }

        .cyber-grid-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: linear-gradient(rgba(0, 243, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0, 243, 255, 0.03) 1px, transparent 1px);
          background-size: 30px 30px;
          pointer-events: none;
        }

        .chrome-newtab-main {
          z-index: 5;
          text-align: center;
          width: 100%;
          max-width: 580px;
          padding: 20px;
        }

        .neon-search-title {
          font-family: 'monospace';
          font-size: 2.2rem;
          font-weight: 900;
          color: #fff;
          text-shadow: 0 0 10px rgba(0, 243, 255, 0.4), 0 0 20px rgba(0, 243, 255, 0.2);
          margin-bottom: 2px;
          letter-spacing: 2px;
        }

        .neon-search-subtitle {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 4px;
          text-transform: uppercase;
          margin-bottom: 30px;
        }

        .neon-search-box-row {
          display: flex;
          align-items: center;
          background: rgba(12,13,18,0.7);
          border: 1px solid rgba(0, 243, 255, 0.2);
          box-shadow: 0 0 15px rgba(0, 243, 255, 0.08);
          border-radius: 6px;
          padding: 8px 16px;
          margin-bottom: 30px;
        }

        .neon-search-box-row:focus-within {
          border-color: var(--ide-cyan);
          box-shadow: 0 0 20px rgba(0, 243, 255, 0.2);
        }

        .neon-input-cyber-bracket {
          color: var(--ide-cyan);
          font-family: monospace;
          font-size: 18px;
          font-weight: bold;
        }

        .chrome-newtab-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-family: monospace;
          font-size: 13px;
          padding: 0 12px;
        }

        .neon-uplinks-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .neon-uplink-chip {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 4px;
          padding: 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease-in-out;
        }

        .neon-uplink-chip:hover {
          background: rgba(0, 243, 255, 0.05);
          border-color: var(--ide-cyan);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.15);
          transform: translateY(-2px);
        }

        .chip-icon {
          font-size: 18px;
        }

        .chip-name {
          font-size: 10px;
          color: rgba(255,255,255,0.6);
          font-family: monospace;
        }

        /* 2. Cyber Reader Layout */
        .cyber-reader-split-pane {
          flex: 1;
          display: flex;
          height: calc(100% - 46px);
          overflow: hidden;
          background: #0b0c10;
        }

        .cyber-reader-main-pane {
          flex: 3;
          height: 100%;
          overflow-y: auto;
          padding: 24px;
          border-right: 1px solid rgba(255,255,255,0.05);
          background: rgba(12, 13, 18, 0.4);
        }

        .cyber-reader-loading-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          color: var(--ide-cyan);
          font-family: monospace;
          font-size: 12px;
          letter-spacing: 2px;
        }

        .cyber-spinner {
          font-size: 24px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        .cyber-reader-error-card {
          text-align: center;
          padding: 40px 20px;
          color: #ff5555;
          font-family: monospace;
        }

        .cyber-error-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .cyber-reader-retry-btn {
          margin-top: 15px;
          background: transparent;
          border: 1px solid #ff5555;
          color: #ff5555;
          padding: 6px 14px;
          border-radius: 4px;
          cursor: pointer;
          font-family: monospace;
          transition: all 0.2s;
        }

        .cyber-reader-retry-btn:hover {
          background: rgba(255, 85, 85, 0.1);
        }

        .cyber-reader-article-scroll {
          max-width: 680px;
          margin: 0 auto;
          line-height: 1.6;
          color: #d1d8e0;
        }

        .cyber-article-decoded-tag {
          display: inline-block;
          font-family: monospace;
          font-size: 10px;
          color: var(--ide-green);
          background: rgba(0, 243, 85, 0.08);
          border: 1px solid rgba(0, 243, 85, 0.2);
          padding: 2px 8px;
          border-radius: 2px;
          margin-bottom: 12px;
        }

        .cyber-article-title {
          font-size: 1.8rem;
          color: #fff;
          font-weight: 800;
          margin-top: 0;
          margin-bottom: 16px;
        }

        .cyber-article-divider {
          height: 1px;
          background: linear-gradient(to right, var(--ide-cyan), transparent);
          margin-bottom: 24px;
        }

        .cyber-reader-heading {
          color: var(--ide-cyan);
          font-size: 1.3rem;
          margin-top: 24px;
          margin-bottom: 12px;
          font-family: monospace;
          border-left: 2px solid var(--ide-cyan);
          padding-left: 8px;
        }

        .cyber-reader-paragraph {
          margin-bottom: 16px;
          text-align: justify;
        }

        .cyber-reader-bullet {
          margin-left: 20px;
          margin-bottom: 8px;
        }

        /* AI summaries / Right Console Pane */
        .cyber-reader-ai-panel {
          flex: 1;
          min-width: 260px;
          max-width: 320px;
          height: 100%;
          padding: 16px;
          background: rgba(12, 13, 18, 0.95);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .cyber-panel-header {
          font-family: monospace;
          font-size: 12px;
          color: var(--ide-cyan);
          font-weight: bold;
          letter-spacing: 1px;
          border-bottom: 1px solid rgba(0, 243, 255, 0.2);
          padding-bottom: 6px;
        }

        .cyber-panel-summary-area {
          flex: 1;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 4px;
          padding: 12px;
          overflow-y: auto;
          font-size: 11.5px;
          line-height: 1.5;
          font-family: monospace;
          color: rgba(255,255,255,0.8);
        }

        .cyber-summary-placeholder {
          color: rgba(255,255,255,0.35);
          text-align: center;
          padding-top: 40px;
        }

        .summary-header-glow {
          color: var(--ide-cyan);
          margin-bottom: 8px;
          font-weight: bold;
        }

        .cyber-panel-action-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cyber-panel-btn {
          border: none;
          border-radius: 4px;
          padding: 10px;
          font-family: monospace;
          font-size: 11.5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .cyber-panel-btn.summarize {
          background: rgba(0, 243, 255, 0.1);
          border: 1px solid var(--ide-cyan);
          color: var(--ide-cyan);
        }

        .cyber-panel-btn.summarize:hover {
          background: rgba(0, 243, 255, 0.2);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.15);
        }

        .cyber-panel-btn.save {
          background: rgba(0, 243, 85, 0.1);
          border: 1px solid var(--ide-green);
          color: var(--ide-green);
        }

        .cyber-panel-btn.save:hover {
          background: rgba(0, 243, 85, 0.2);
          box-shadow: 0 0 10px rgba(0, 243, 85, 0.15);
        }

        .cyber-save-toast {
          font-family: monospace;
          font-size: 10.5px;
          color: var(--ide-green);
          background: rgba(0, 243, 85, 0.08);
          border: 1px solid rgba(0, 243, 85, 0.2);
          padding: 8px;
          border-radius: 4px;
          text-align: center;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(0, 243, 85, 0.2); }
          70% { box-shadow: 0 0 0 4px rgba(0, 243, 85, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 243, 85, 0); }
        }

        .cyber-panel-settings {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 4px;
          padding: 10px;
        }

        .settings-label {
          display: block;
          font-family: monospace;
          font-size: 9.5px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 6px;
        }

        .font-size-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .font-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          border-radius: 4px;
          width: 28px;
          height: 22px;
          cursor: pointer;
          font-family: monospace;
        }

        .font-btn:hover {
          background: rgba(255,255,255,0.1);
        }

        .font-indicator {
          font-family: monospace;
          font-size: 11.5px;
        }

        /* 3. Fallback View for Direct Blocked Sites */
        .chrome-fallback-page {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #0e111a 0%, #06070a 100%);
          padding: 24px;
        }

        .fallback-card {
          background: rgba(12, 13, 18, 0.85);
          border: 1px solid rgba(255, 85, 85, 0.25);
          border-radius: 6px;
          padding: 30px;
          width: 100%;
          max-width: 460px;
          text-align: center;
          box-shadow: 0 0 20px rgba(255, 85, 85, 0.05);
          position: relative;
        }

        .fallback-cyber-tag {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          font-family: monospace;
          font-size: 9px;
          color: #ff5555;
          background: #0b0c10;
          border: 1px solid rgba(255, 85, 85, 0.3);
          padding: 2px 8px;
          border-radius: 2px;
          letter-spacing: 1px;
        }

        .fallback-icon {
          font-size: 38px;
          margin-bottom: 12px;
        }

        .fallback-title {
          font-family: monospace;
          font-size: 1.3rem;
          color: #fff;
          margin-top: 0;
          margin-bottom: 12px;
          letter-spacing: 1px;
        }

        .fallback-text {
          font-size: 12px;
          line-height: 1.6;
          color: rgba(255,255,255,0.7);
          margin-bottom: 24px;
        }

        .fallback-domain-name {
          color: var(--ide-cyan);
          font-family: monospace;
          word-break: break-all;
        }

        .fallback-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .fallback-btn {
          border: none;
          padding: 10px 18px;
          font-family: monospace;
          font-size: 11px;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .fallback-btn.primary {
          background: rgba(0, 243, 255, 0.1);
          border: 1px solid var(--ide-cyan);
          color: var(--ide-cyan);
        }

        .fallback-btn.primary:hover {
          background: rgba(0, 243, 255, 0.2);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.15);
        }

        .fallback-btn.secondary {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
        }

        .fallback-btn.secondary:hover {
          background: rgba(255,255,255,0.08);
        }

        .chrome-embed-bar {
          background: rgba(12,13,18,0.9);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 6px 12px;
          font-size: 10.5px;
          font-family: monospace;
          display: flex;
          align-items: center;
        }
      `}</style>
    </div>
  );
};

export default ChromeApp;
