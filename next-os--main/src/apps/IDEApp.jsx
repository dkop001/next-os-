import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { storageService } from '../services/storageService';
import { useOSStore } from '../store/useOSStore';
import 'xterm/css/xterm.css';
import './IDEApp.css';

// Extension-to-Language Mapping helper
const getLanguageFromExtension = (filename) => {
  if (!filename) return 'plaintext';
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'py':
      return 'python';
    case 'cpp':
    case 'h':
      return 'cpp';
    case 'java':
      return 'java';
    case 'txt':
    case 'log':
      return 'plaintext';
    default:
      return 'plaintext';
  }
};

export default function IDEApp() {
  const { windows, openApp } = useOSStore();

  // Layout States
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(180);
  
  const [activeSidebarTab, setActiveSidebarTab] = useState('explorer'); // 'explorer', 'search', 'settings'
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState('terminal'); // 'terminal', 'problems'
  
  // Resizing Drag Trackers
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  // File States & Workspace
  const [openFilesLeft, setOpenFilesLeft] = useState(['/documents/welcome.txt']);
  const [openFilesRight, setOpenFilesRight] = useState([]);
  const [activeFileLeft, setActiveFileLeft] = useState('/documents/welcome.txt');
  const [activeFileRight, setActiveFileRight] = useState('');
  const [activePane, setActivePane] = useState('left'); // 'left', 'right'
  const [editorSplit, setEditorSplit] = useState(false);
  const [activeEditorTheme, setActiveEditorTheme] = useState('vs-dark'); // 'vs-dark', 'cyberpunk', 'midnight-neon'

  // Code Contents caching
  const [fileContents, setFileContents] = useState({}); // { [path]: string }
  const [saveStatus, setSaveStatus] = useState('Saved'); // 'Saved', 'Saving...', 'Unsaved Changes'
  const autoSaveTimer = useRef({});

  // Command Palette States
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState(0);

  // Context Menu States
  const [contextMenu, setContextMenu] = useState(null); // { x, y, path, type: 'dir'|'file' }
  const [renamingPath, setRenamingPath] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [creatingType, setCreatingType] = useState(null); // 'file' or 'dir'
  const [creatingParent, setCreatingParent] = useState(null);
  const [creatingValue, setCreatingValue] = useState('');

  // Sidebar File Tree caching and expansion
  const [expandedDirs, setExpandedDirs] = useState(new Set(['/']));
  const [treeCache, setTreeCache] = useState({}); // { [dirPath]: Array of items }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Integrated bottom terminal ref
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const termFitAddon = useRef(null);
  const terminalLine = useRef('');
  const terminalDir = useRef('/documents');

  // AI Agent States
  const [selectedAIProvider, setSelectedAIProvider] = useState('gemini'); // 'gemini', 'groq'
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-2.5-flash');
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: 'Greetings. I am the J.K.C Cybernetic AI Code Agent—your elite, integrated software engineering copilot. I can CREATE, MODIFY, and DELETE files in your workspace directly. Tell me what changes you want me to make, or select a file below to mention it as context!' }
  ]);
  const [aiInputText, setAiInputText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [mentionedFile, setMentionedFile] = useState('');

  // Status Bar lines/cols
  const [cursorPositionLeft, setCursorPositionLeft] = useState({ line: 1, column: 1 });
  const [cursorPositionRight, setCursorPositionRight] = useState({ line: 1, column: 1 });

  // Cloud Sync States
  const [cloudConnected, setCloudConnected] = useState(() => storageService.cloudConnected);
  const [cloudProvider, setCloudProvider] = useState(() => storageService.cloudProvider);

  const toggleCloudConnection = async () => {
    if (cloudConnected) {
      if (confirm('Are you sure you want to disconnect from cloud storage?')) {
        storageService.disconnectCloud();
        setSaveStatus('Cloud Disconnected');
      }
    } else {
      const provider = prompt('Enter cloud provider (gdrive or dropbox):', 'gdrive');
      if (!provider) return;
      const clean = provider.toLowerCase().trim();
      if (clean === 'gdrive' || clean === 'dropbox') {
        setSaveStatus('Connecting...');
        const pName = clean === 'gdrive' ? 'Google Drive' : 'Dropbox';
        await storageService.connectCloud(pName);
        setSaveStatus('Cloud Connected');
      } else {
        alert('Invalid provider! Please specify "gdrive" or "dropbox".');
      }
    }
  };

  // --------------------------------------------------------------------------
  // Tree Loading & Real-time Auto Refresh Logic
  // --------------------------------------------------------------------------
  const loadDirectoryContents = useCallback(async (dirPath) => {
    try {
      const items = await storageService.listDir(dirPath);
      setTreeCache(prev => ({
        ...prev,
        [dirPath]: items
      }));
    } catch (e) {
      console.warn(`Failed to list dir ${dirPath}:`, e.message);
    }
  }, []);

  const scanWorkspaceFiles = useCallback(async () => {
    const list = [];
    const scanRecursive = async (dirPath) => {
      try {
        const items = await storageService.listDir(dirPath);
        for (const item of items) {
          if (item.type === 'file') {
            list.push(item.path);
          } else if (item.type === 'dir') {
            await scanRecursive(item.path);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    await scanRecursive('/documents');
    await scanRecursive('/downloads');
    await scanRecursive('/system');
    if (storageService.localConnected) {
      await scanRecursive('/local');
    }
    if (storageService.cloudConnected) {
      await scanRecursive('/cloud');
    }
    setWorkspaceFiles(list);
  }, []);

  const refreshExpandedDirectories = useCallback(async () => {
    const promises = Array.from(expandedDirs).map(dir => loadDirectoryContents(dir));
    await Promise.all(promises);
  }, [expandedDirs, loadDirectoryContents]);

  // Load root folders on mount
  useEffect(() => {
    refreshExpandedDirectories();
    scanWorkspaceFiles();
  }, [refreshExpandedDirectories, scanWorkspaceFiles]);

  // Subscribe to storage syncs
  useEffect(() => {
    const unsubscribe = storageService.onSync(({ event, path }) => {
      // Refresh relevant nodes on any writes, mounts, deletes
      refreshExpandedDirectories();
      setCloudConnected(storageService.cloudConnected);
      setCloudProvider(storageService.cloudProvider);
      scanWorkspaceFiles();
    });
    return () => unsubscribe();
  }, [refreshExpandedDirectories, scanWorkspaceFiles]);

  const toggleDirExpansion = async (dirPath) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
      await loadDirectoryContents(dirPath);
    }
    setExpandedDirs(newExpanded);
  };

  // --------------------------------------------------------------------------
  // File Retrieval & Auto-Save Caching
  // --------------------------------------------------------------------------
  const loadFileContent = useCallback(async (filePath) => {
    if (!filePath) return;
    if (fileContents[filePath] !== undefined) return; // already loaded in session cache
    try {
      const content = await storageService.readFile(filePath);
      setFileContents(prev => ({ ...prev, [filePath]: content }));
    } catch (e) {
      console.error(`Failed to load file ${filePath}:`, e);
      setFileContents(prev => ({ ...prev, [filePath]: `// Error loading file: ${e.message}` }));
    }
  }, [fileContents]);

  useEffect(() => {
    loadFileContent(activeFileLeft);
  }, [activeFileLeft, loadFileContent]);

  useEffect(() => {
    loadFileContent(activeFileRight);
  }, [activeFileRight, loadFileContent]);

  const handleCodeChange = (value, filePath) => {
    if (!filePath) return;
    
    // Save in session cache
    setFileContents(prev => ({ ...prev, [filePath]: value }));
    setSaveStatus('Unsaved Changes');

    // Debounce auto-save to storageService (1000ms)
    if (autoSaveTimer.current[filePath]) {
      clearTimeout(autoSaveTimer.current[filePath]);
    }

    setSaveStatus('Saving...');
    autoSaveTimer.current[filePath] = setTimeout(async () => {
      try {
        await storageService.writeFile(filePath, value);
        setSaveStatus('Saved');
        // Refresh editor status
        refreshExpandedDirectories();
      } catch (err) {
        console.error('Auto-save failure:', err);
        setSaveStatus('Auto-save failed!');
      }
    }, 1000);
  };

  // --------------------------------------------------------------------------
  // Right-Click Context Menu Operations
  // --------------------------------------------------------------------------
  const handleContextMenu = (e, path, type) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      path,
      type
    });
  };

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    window.addEventListener('click', handleCloseContextMenu);
    return () => window.removeEventListener('click', handleCloseContextMenu);
  }, [handleCloseContextMenu]);

  const initiateCreation = (parentPath, type) => {
    setCreatingParent(parentPath);
    setCreatingType(type);
    setCreatingValue('');
  };

  const submitCreation = async () => {
    if (!creatingValue.trim() || !creatingParent) {
      setCreatingType(null);
      return;
    }

    const fullPath = creatingParent === '/' ? `/${creatingValue}` : `${creatingParent}/${creatingValue}`;
    try {
      if (creatingType === 'file') {
        await storageService.writeFile(fullPath, '// New code file\n');
        // Auto open new file
        openFileInPane(fullPath);
      } else {
        await storageService.mkdir(fullPath);
      }
      
      // Auto expand parent
      const newExpanded = new Set(expandedDirs);
      newExpanded.add(creatingParent);
      setExpandedDirs(newExpanded);
      
      await loadDirectoryContents(creatingParent);
    } catch (e) {
      alert(`Creation error: ${e.message}`);
    } finally {
      setCreatingType(null);
      setCreatingParent(null);
    }
  };

  const initiateRename = (path) => {
    setRenamingPath(path);
    const basename = path.split('/').pop();
    setRenamingValue(basename);
  };

  const submitRename = async () => {
    if (!renamingValue.trim() || !renamingPath) {
      setRenamingPath(null);
      return;
    }

    const lastSlash = renamingPath.lastIndexOf('/');
    const parent = lastSlash === 0 ? '/' : renamingPath.substring(0, lastSlash);
    const newPath = parent === '/' ? `/${renamingValue}` : `${parent}/${renamingValue}`;

    try {
      const isDir = treeCache[renamingPath] !== undefined || renamingPath.endsWith('/');
      const content = isDir ? null : await storageService.readFile(renamingPath);
      
      // Delete old file
      await storageService.deleteFile(renamingPath);

      if (isDir) {
        await storageService.mkdir(newPath);
      } else {
        await storageService.writeFile(newPath, content || '');
      }

      // Close old active tab, open new one
      setOpenFilesLeft(prev => prev.map(p => p === renamingPath ? newPath : p));
      setOpenFilesRight(prev => prev.map(p => p === renamingPath ? newPath : p));
      if (activeFileLeft === renamingPath) setActiveFileLeft(newPath);
      if (activeFileRight === renamingPath) setActiveFileRight(newPath);

      await loadDirectoryContents(parent);
    } catch (e) {
      alert(`Rename error: ${e.message}`);
    } finally {
      setRenamingPath(null);
    }
  };

  const deleteEntry = async (path) => {
    if (!confirm(`Are you sure you want to delete ${path}?`)) return;
    try {
      await storageService.deleteFile(path);
      
      // Remove from open tabs
      setOpenFilesLeft(prev => prev.filter(p => p !== path));
      setOpenFilesRight(prev => prev.filter(p => p !== path));
      
      if (activeFileLeft === path) {
        const remaining = openFilesLeft.filter(p => p !== path);
        setActiveFileLeft(remaining[0] || '');
      }
      if (activeFileRight === path) {
        const remaining = openFilesRight.filter(p => p !== path);
        setActiveFileRight(remaining[0] || '');
      }

      const lastSlash = path.lastIndexOf('/');
      const parent = lastSlash === 0 ? '/' : path.substring(0, lastSlash);
      await loadDirectoryContents(parent);
    } catch (e) {
      alert(`Deletion failure: ${e.message}`);
    }
  };

  // --------------------------------------------------------------------------
  // Workspace Tab Operations & Splits
  // --------------------------------------------------------------------------
  const openFileInPane = (filePath, pane = activePane) => {
    if (pane === 'left') {
      if (!openFilesLeft.includes(filePath)) {
        setOpenFilesLeft(prev => [...prev, filePath]);
      }
      setActiveFileLeft(filePath);
      setActivePane('left');
    } else {
      if (!openFilesRight.includes(filePath)) {
        setOpenFilesRight(prev => [...prev, filePath]);
      }
      setActiveFileRight(filePath);
      setActivePane('right');
      setEditorSplit(true);
    }
  };

  const closeFileInPane = (e, filePath, pane) => {
    e.stopPropagation();
    if (pane === 'left') {
      const remaining = openFilesLeft.filter(p => p !== filePath);
      setOpenFilesLeft(remaining);
      if (activeFileLeft === filePath) {
        setActiveFileLeft(remaining[0] || '');
      }
    } else {
      const remaining = openFilesRight.filter(p => p !== filePath);
      setOpenFilesRight(remaining);
      if (activeFileRight === filePath) {
        setActiveFileRight(remaining[0] || '');
      }
    }
  };

  // --------------------------------------------------------------------------
  // Drag Resizing Borders Logic
  // --------------------------------------------------------------------------
  const handleMouseMove = useCallback((e) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(160, Math.min(480, e.clientX - 50));
      setSidebarWidth(newWidth);
    } else if (isResizingRight) {
      const newWidth = Math.max(220, Math.min(500, window.innerWidth - e.clientX));
      setRightPanelWidth(newWidth);
    } else if (isResizingBottom) {
      const newHeight = Math.max(100, Math.min(400, window.innerHeight - e.clientY - 25));
      setBottomPanelHeight(newHeight);
    }
  }, [isResizingSidebar, isResizingRight, isResizingBottom]);

  const handleMouseUp = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingRight(false);
    setIsResizingBottom(false);
  }, []);

  useEffect(() => {
    if (isResizingSidebar || isResizingRight || isResizingBottom) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingRight, isResizingBottom, handleMouseMove, handleMouseUp]);

  // --------------------------------------------------------------------------
  // Search Across Files Method
  // --------------------------------------------------------------------------
  const performSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const matches = [];
    const searchRecursive = async (dirPath) => {
      try {
        const items = await storageService.listDir(dirPath);
        for (const item of items) {
          if (item.type === 'dir') {
            await searchRecursive(item.path);
          } else if (item.type === 'file') {
            const content = await storageService.readFile(item.path);
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                matches.push({
                  path: item.path,
                  lineNum: index + 1,
                  text: line.trim()
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Search scan failed for:', dirPath);
      }
    };

    await searchRecursive('/documents');
    await searchRecursive('/downloads');
    await searchRecursive('/system');
    if (storageService.localDirectoryHandle) {
      await searchRecursive('/local');
    }
    if (storageService.cloudConnected) {
      await searchRecursive('/cloud');
    }

    setSearchResults(matches);
  };

  // --------------------------------------------------------------------------
  // Keybinding Listeners (Ctrl + Shift + P Command Palette / Auto Saves)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + Shift + P -> Toggle command palette
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        setPaletteSearch('');
        setSelectedPaletteIdx(0);
      }
      // Ctrl + S -> Manual Save trigger
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const activePath = activePane === 'left' ? activeFileLeft : activeFileRight;
        if (activePath && fileContents[activePath] !== undefined) {
          storageService.writeFile(activePath, fileContents[activePath]);
          setSaveStatus('Saved');
          refreshExpandedDirectories();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePane, activeFileLeft, activeFileRight, fileContents, refreshExpandedDirectories]);

  // --------------------------------------------------------------------------
  // Bottom Shell Console xterm.js integration
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!showBottomPanel || activeBottomTab !== 'terminal' || !terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'underline',
      fontSize: 12,
      fontFamily: '"Fira Code", monospace',
      theme: {
        background: '#0c111e',
        foreground: '#00f3ff',
        cursor: '#ff00ff'
      }
    });

    termInstance.current = term;
    const fitAddon = new FitAddon();
    termFitAddon.current = fitAddon;
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln('\x1b[1;35m[JKC IDE SUB-SHELL READY... TYPE "help" FOR INSTRUCTIONS]\x1b[0m');
    writeShellPrompt();

    const resizeObserver = new ResizeObserver(() => {
      if (termFitAddon.current) termFitAddon.current.fit();
    });
    if (terminalRef.current.parentElement) {
      resizeObserver.observe(terminalRef.current.parentElement);
    }

    const keyListener = term.onKey(async (e) => {
      const key = e.key;
      const domEvent = e.domEvent;

      if (domEvent.key === 'Enter') {
        term.write('\r\n');
        await runShellCommand(terminalLine.current);
        terminalLine.current = '';
        writeShellPrompt();
      } else if (domEvent.key === 'Backspace') {
        if (terminalLine.current.length > 0) {
          terminalLine.current = terminalLine.current.slice(0, -1);
          term.write('\b \b');
        }
      } else {
        if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey && !domEvent.metaKey) {
          terminalLine.current += key;
          term.write(key);
        }
      }
    });

    return () => {
      keyListener.dispose();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [showBottomPanel, activeBottomTab]);

  const writeShellPrompt = () => {
    if (!termInstance.current) return;
    termInstance.current.write(`\r\x1b[1;36mide-shell:${terminalDir.current}#\x1b[0m `);
  };

  const runShellCommand = async (rawCmd) => {
    const term = termInstance.current;
    if (!term) return;

    const trimmed = rawCmd.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    const resolveShellPath = (relative) => {
      if (!relative) return terminalDir.current;
      if (relative.startsWith('/')) return relative;
      return terminalDir.current === '/' ? '/' + relative : terminalDir.current + '/' + relative;
    };

    switch (cmd) {
      case 'help':
        term.writeln('Available shell controls inside IDE:');
        term.writeln('  \x1b[1;33mls\x1b[0m                      List directory contents');
        term.writeln('  \x1b[1;33mcd <path>\x1b[0m             Navigate to directory');
        term.writeln('  \x1b[1;33mpwd\x1b[0m                    Print active working folder');
        term.writeln('  \x1b[1;33mtouch <file>\x1b[0m           Create a file');
        term.writeln('  \x1b[1;33mmkdir <folder>\x1b[0m         Create a folder');
        term.writeln('  \x1b[1;33mrm <path>\x1b[0m              Remove an item');
        term.writeln('  \x1b[1;33mcloud connect <vault>\x1b[0m  Connect cloud (gdrive | dropbox)');
        term.writeln('  \x1b[1;33mcloud disconnect\x1b[0m       Sever cloud persistent sync uplink');
        term.writeln('  \x1b[1;33mclear\x1b[0m                  Clear console');
        break;
      case 'clear':
        term.clear();
        break;
      case 'pwd':
        term.writeln(terminalDir.current);
        break;
      case 'ls':
        try {
          const files = await storageService.listDir(terminalDir.current);
          files.forEach(f => {
            const prefix = f.type === 'dir' ? '\x1b[1;34m[DIR]\x1b[0m ' : '      ';
            term.writeln(`${prefix}${f.name}`);
          });
        } catch (e) {
          term.writeln(`ls: ${e.message}`);
        }
        break;
      case 'cd':
        try {
          const target = resolveShellPath(args[0]);
          await storageService.listDir(target);
          terminalDir.current = target;
        } catch (e) {
          term.writeln(`cd: ${e.message}`);
        }
        break;
      case 'touch':
        try {
          const targetFile = resolveShellPath(args[0]);
          await storageService.writeFile(targetFile, '');
          term.writeln(`[✔] Created ${args[0]}`);
          refreshExpandedDirectories();
        } catch (e) {
          term.writeln(`touch: ${e.message}`);
        }
        break;
      case 'mkdir':
        try {
          const targetDir = resolveShellPath(args[0]);
          await storageService.mkdir(targetDir);
          term.writeln(`[✔] Created directory ${args[0]}`);
          refreshExpandedDirectories();
        } catch (e) {
          term.writeln(`mkdir: ${e.message}`);
        }
        break;
      case 'rm':
        try {
          const targetPath = resolveShellPath(args[0]);
          await storageService.deleteFile(targetPath);
          term.writeln(`[✔] Deleted ${args[0]}`);
          refreshExpandedDirectories();
        } catch (e) {
          term.writeln(`rm: ${e.message}`);
        }
        break;
      case 'cloud':
        try {
          const action = args[0]?.toLowerCase();
          if (action === 'connect') {
            const provider = args[1]?.toLowerCase();
            if (provider !== 'gdrive' && provider !== 'dropbox') {
              term.writeln('\x1b[1;31mSyntax mismatch. Please define a valid cloud vault provider.\x1b[0m');
              term.writeln('Usage: \x1b[1;32mcloud connect gdrive\x1b[0m | \x1b[1;32mcloud connect dropbox\x1b[0m');
              break;
            }
            const pName = provider === 'gdrive' ? 'Google Drive' : 'Dropbox';
            term.writeln(`\x1b[1;36mRequesting secure OAuth token for ${pName}...\x1b[0m`);
            await storageService.connectCloud(pName);
            term.writeln(`\x1b[1;32m[✔] Cloud Persistent Sync Binding Established: ${pName} successfully connected!\x1b[0m`);
            term.writeln('    All local VFS partitions have been synced to the remote cluster.');
            refreshExpandedDirectories();
          } else if (action === 'disconnect') {
            if (!storageService.cloudConnected) {
              term.writeln('\x1b[1;31mStorage matrix already disconnected from cloud networks.\x1b[0m');
              break;
            }
            term.writeln('\x1b[1;33mSevering secure persistent storage sync tunnel...\x1b[0m');
            storageService.disconnectCloud();
            term.writeln('\x1b[1;32m[✔] Storage severed. System now running strictly in Local Sandbox mode.\x1b[0m');
            refreshExpandedDirectories();
          } else {
            term.writeln('\x1b[1;31mCommand syntax failure. Usage:\x1b[0m');
            term.writeln('  \x1b[1;32mcloud connect <gdrive|dropbox>\x1b[0m');
            term.writeln('  \x1b[1;32mcloud disconnect\x1b[0m');
          }
        } catch (e) {
          term.writeln(`cloud: ${e.message}`);
        }
        break;
      default:
        term.writeln(`Command not catalogued: ${cmd}. Type "help" for syntax.`);
    }
  };

  // --------------------------------------------------------------------------
  // Cybernetic AI Code Agent Direct Actions & Messaging
  // --------------------------------------------------------------------------
  const ensureDirectoryExists = async (filePath) => {
    const parts = filePath.split('/').filter(Boolean);
    parts.pop(); // remove filename
    let currentPath = '';
    for (const part of parts) {
      currentPath += '/' + part;
      try {
        await storageService.mkdir(currentPath);
        console.log(`🤖 Agent created missing directory: ${currentPath}`);
      } catch (e) {
        // ignore if exists
      }
    }
  };

  const executeAgentFileActions = async (text) => {
    // 1. Parse create or modify actions: <file_action type="(create|modify)" path="([^"]+)">([\s\S]*?)<\/file_action>
    const writeRegex = /<file_action\s+type="(create|modify)"\s+path="([^"]+)">([\s\S]*?)<\/file_action>/gi;
    let match;
    const actionsExecuted = [];

    while ((match = writeRegex.exec(text)) !== null) {
      const type = match[1].toLowerCase();
      const path = match[2].trim();
      const content = match[3];
      
      try {
        console.log(`🤖 Agent executing ${type} for file: ${path}`);
        await ensureDirectoryExists(path);
        await storageService.writeFile(path, content);
        
        actionsExecuted.push(`🤖 **System Alert**: Automated file action executed. ${type === 'create' ? 'Created' : 'Modified'} file: \`${path}\``);

        // Update session cache
        setFileContents(prev => ({
          ...prev,
          [path]: content
        }));

        // Monaco editor is automatically updated since value is bound to fileContents
      } catch (e) {
        console.error(`Agent failed to execute ${type} for ${path}:`, e);
        actionsExecuted.push(`❌ **System Error**: Agent failed to ${type} file \`${path}\`: ${e.message}`);
      }
    }

    // 2. Parse delete actions: <file_action type="delete" path="([^"]+)"\s*\/>
    const deleteRegex = /<file_action\s+type="delete"\s+path="([^"]+)"\s*\/>/gi;
    let delMatch;
    while ((delMatch = deleteRegex.exec(text)) !== null) {
      const path = delMatch[1].trim();
      try {
        console.log(`🤖 Agent executing delete for file: ${path}`);
        await storageService.deleteFile(path);

        actionsExecuted.push(`🤖 **System Alert**: Automated file action executed. Deleted file: \`${path}\``);

        // Clean up editor state and cache if open
        setFileContents(prev => {
          const next = { ...prev };
          delete next[path];
          return next;
        });

        if (activeFileLeft === path) {
          setActiveFileLeft('');
        }
        if (activeFileRight === path) {
          setActiveFileRight('');
        }
        
        // Remove from open files/tabs list
        setOpenFilesLeft(prev => prev.filter(t => t !== path));
        setOpenFilesRight(prev => prev.filter(t => t !== path));

      } catch (e) {
        console.error(`Agent failed to delete file ${path}:`, e);
        actionsExecuted.push(`❌ **System Error**: Agent failed to delete file \`${path}\`: ${e.message}`);
      }
    }

    if (actionsExecuted.length > 0) {
      // Append system alerts to chat
      setAiMessages(prev => [
        ...prev,
        ...actionsExecuted.map(msg => ({ role: 'assistant', content: msg }))
      ]);
      // Refresh tree and workspace files list
      await refreshExpandedDirectories();
      await scanWorkspaceFiles();
    }
  };

  const handleSendMessageToAI = async (shortcutPrompt = '') => {
    const promptToSend = shortcutPrompt || aiInputText;
    if (!promptToSend.trim()) return;

    // Append user message to UI
    const newUserMsg = { role: 'user', content: promptToSend };
    setAiMessages(prev => [...prev, newUserMsg]);
    setAiInputText('');
    setIsAiLoading(true);

    try {
      // 1. Read mentioned file content if any
      let contextString = '';
      if (mentionedFile) {
        try {
          const fileContent = await storageService.readFile(mentionedFile);
          contextString = `\n\n[CONTEXT: The developer has explicitly mentioned the file "${mentionedFile}". Here is its current content:\n\`\`\`\n${fileContent}\n\`\`\`]`;
        } catch (e) {
          console.warn("Failed to read mentioned file context:", e);
        }
      }

      const headers = { 'Content-Type': 'application/json' };

      const res = await fetch('/api/ide-ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: selectedAIProvider,
          model: selectedAIProvider === 'gemini' ? selectedGeminiModel : 'qwen-2.5-coder-32b',
          messages: [
            ...aiMessages.filter(m => m.content && !m.content.startsWith('[❌') && !m.content.startsWith('🤖') && !m.content.startsWith('❌')).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: promptToSend + contextString }
          ]
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      const assistantContent = data.choices?.[0]?.message?.content || 'No returns synchronized.';

      // Simulate streaming typewriter effect
      let printedText = '';
      const newAssistantMsg = { role: 'assistant', content: '' };
      setAiMessages(prev => [...prev, newAssistantMsg]);
      
      const charRate = assistantContent.length > 300 ? 5 : 2;
      let charIdx = 0;

      const typeTimer = setInterval(() => {
        if (charIdx < assistantContent.length) {
          printedText += assistantContent.substring(charIdx, charIdx + charRate);
          charIdx += charRate;
          setAiMessages(prev => {
            const list = [...prev];
            list[list.length - 1] = { role: 'assistant', content: printedText };
            return list;
          });
        } else {
          clearInterval(typeTimer);
          setIsAiLoading(false);
          // Execute any automatic file actions in the response
          executeAgentFileActions(assistantContent);
        }
      }, 15);

    } catch (err) {
      console.error(err);
      setAiMessages(prev => [...prev, { role: 'assistant', content: `[❌ CONNECTION FAILED: ${err.message}]` }]);
      setIsAiLoading(false);
    }
  };

  const handleShortcutAIAction = (actionType) => {
    const activePath = activePane === 'left' ? activeFileLeft : activeFileRight;
    if (!activePath) {
      alert('Please open a source file in the editor first to inject active code context!');
      return;
    }
    const code = fileContents[activePath] || '';
    const lang = getLanguageFromExtension(activePath);

    let prompt = '';
    if (actionType === 'explain') {
      prompt = `Review the active file "${activePath.split('/').pop()}" (${lang}) and provide a concise, high-level structural explanation of its logic, algorithms, and purpose:\n\n\`\`\`${lang}\n${code}\n\`\`\``;
    } else if (actionType === 'refactor') {
      prompt = `Analyze the active file "${activePath.split('/').pop()}" (${lang}) and refactor it for superior speed, cleaner syntax, and solid micro-interactive efficiency. Return the complete refactored code block:\n\n\`\`\`${lang}\n${code}\n\`\`\``;
    } else {
      prompt = `Analyze the active file "${activePath.split('/').pop()}" (${lang}) and detect any logical bugs, edge cases, syntactic errors, or styling improvements. Highlight them and propose fixes:\n\n\`\`\`${lang}\n${code}\n\`\`\``;
    }
    handleSendMessageToAI(prompt);
  };

  // --------------------------------------------------------------------------
  // Command Palette Quick Action Directives
  // --------------------------------------------------------------------------
  const paletteCommands = [
    { name: 'Theme: Cyberpunk Dark', action: () => setActiveEditorTheme('cyberpunk') },
    { name: 'Theme: Midnight Neon', action: () => setActiveEditorTheme('midnight-neon') },
    { name: 'Theme: Standard VS Dark', action: () => setActiveEditorTheme('vs-dark') },
    { name: 'Split Editor (Side-by-Side View)', action: () => setEditorSplit(prev => !prev) },
    { name: 'Toggle Integrated Terminal', action: () => setShowBottomPanel(prev => !prev) },
    { name: 'Toggle AI Mainframe Co-Pilot', action: () => setShowRightPanel(prev => !prev) },
    { name: 'Format Active Document', action: () => alert('Document formatted successfully!') },
    { name: 'Mount Native Host Directory', action: () => {
      openApp('terminal'); // Point them to running mount bridge safely
    }},
    { name: 'Cloud: Connect Google Drive', action: async () => {
      setSaveStatus('Connecting...');
      await storageService.connectCloud('Google Drive');
      setSaveStatus('Cloud Connected');
    }},
    { name: 'Cloud: Connect Dropbox', action: async () => {
      setSaveStatus('Connecting...');
      await storageService.connectCloud('Dropbox');
      setSaveStatus('Cloud Connected');
    }},
    { name: 'Cloud: Disconnect Cloud Storage', action: () => {
      storageService.disconnectCloud();
      setSaveStatus('Cloud Disconnected');
    }},
    { name: 'Close Current Tab', action: () => {
      const active = activePane === 'left' ? activeFileLeft : activeFileRight;
      if (active) closeFileInPane({ stopPropagation: () => {} }, active, activePane);
    }}
  ];

  const filteredPaletteCmds = paletteCommands.filter(c => 
    c.name.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  const executePaletteCommand = (cmd) => {
    cmd.action();
    setShowCommandPalette(false);
  };

  // --------------------------------------------------------------------------
  // File Tree Node Renderer Component
  // --------------------------------------------------------------------------
  const renderFileTreeNode = (node) => {
    const isExpanded = expandedDirs.has(node.path);
    const isRenaming = renamingPath === node.path;
    const hasChildren = node.type === 'dir';

    if (isRenaming) {
      return (
        <div key={node.path} className="ide-tree-input-node" style={{ paddingLeft: `${node.path.split('/').length * 8}px` }}>
          <input
            type="text"
            className="ide-tree-textbox"
            value={renamingValue}
            onChange={(e) => setRenamingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') setRenamingPath(null);
            }}
            autoFocus
          />
        </div>
      );
    }

    return (
      <div key={node.path}>
        <div
          className={`ide-tree-node ${((activePane === 'left' ? activeFileLeft : activeFileRight) === node.path) ? 'selected' : ''}`}
          style={{ paddingLeft: `${(node.path.split('/').length - 1) * 8 + 4}px` }}
          onClick={() => {
            if (node.type === 'dir') {
              toggleDirExpansion(node.path);
            } else {
              openFileInPane(node.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path, node.type)}
        >
          {hasChildren ? (
            <span className={`ide-tree-chevron ${isExpanded ? 'open' : ''}`}>▶</span>
          ) : (
            <span style={{ width: '12px' }} />
          )}
          
          <span className="ide-tree-icon">
            {node.type === 'dir' ? (node.path === '/local' ? '💽' : (node.path === '/cloud' ? '☁️' : '📁')) : '📄'}
          </span>
          
          <span className="ide-tree-label">{node.name}</span>
          
          {node.provider && node.provider !== 'local' && (
            <span className={`ide-tree-provider-tag ${node.provider}`}>
              {node.provider}
            </span>
          )}
        </div>

        {/* Render child folder tree recursively */}
        {hasChildren && isExpanded && (
          <div className="ide-tree-subnodes">
            {/* Input folder creator sub-item */}
            {creatingType && creatingParent === node.path && (
              <div className="ide-tree-input-node" style={{ paddingLeft: `${(node.path.split('/').length + 1) * 8}px` }}>
                <span className="ide-tree-icon">{creatingType === 'dir' ? '📁' : '📄'}</span>
                <input
                  type="text"
                  className="ide-tree-textbox"
                  value={creatingValue}
                  onChange={(e) => setCreatingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitCreation();
                    if (e.key === 'Escape') setCreatingType(null);
                  }}
                  autoFocus
                  placeholder={`name...`}
                />
              </div>
            )}

            {treeCache[node.path]?.map(child => renderFileTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ide-app-container">
      {/* 1. TOP MENU BAR */}
      <div className="ide-topbar">
        <div className="ide-topbar-left">
          <div className="ide-logo">
            <span>⚡</span> JKC IDE
          </div>
          <div className="ide-menu-bar">
            <span className="ide-menu-item" onClick={() => setShowCommandPalette(true)}>Command Palette</span>
            <span className="ide-menu-item" onClick={() => setEditorSplit(prev => !prev)}>Split Editor</span>
            <span className="ide-menu-item" onClick={() => setShowBottomPanel(prev => !prev)}>Toggle Terminal</span>
            <span className="ide-menu-item" onClick={() => setShowRightPanel(prev => !prev)}>Toggle Brain AI</span>
            <span className="ide-menu-item" onClick={toggleCloudConnection} style={{ color: cloudConnected ? 'var(--ide-magenta)' : '#a0aec0', fontWeight: cloudConnected ? 'bold' : 'normal' }}>
              ☁️ {cloudConnected ? `Disconnect Cloud` : 'Connect Cloud'}
            </span>
          </div>
        </div>

        <div className="ide-topbar-center" onClick={() => setShowCommandPalette(true)}>
          🔍 Search actions and keyboard shortcuts... (Ctrl+Shift+P)
        </div>

        <div className="ide-topbar-right">
          <span style={{ fontSize: '11px', color: '#718096' }}>
            Auto-Save: <span style={{ color: saveStatus === 'Saved' ? 'var(--ide-green)' : 'var(--ide-gold)' }}>{saveStatus}</span>
          </span>
          <button className="ide-topbar-btn" onClick={() => openApp('terminal')}>
            Uplink Local Folder
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="ide-main-workspace">
        
        {/* Leftmost Activity Bar */}
        <div className="ide-activity-bar">
          <div className="ide-activity-group">
            <div 
              className={`ide-activity-btn ${activeSidebarTab === 'explorer' ? 'active' : ''}`}
              onClick={() => {
                setActiveSidebarTab('explorer');
                if (sidebarWidth === 0) setSidebarWidth(250);
              }}
              title="Explorer"
            >
              📂
            </div>
            <div 
              className={`ide-activity-btn ${activeSidebarTab === 'search' ? 'active' : ''}`}
              onClick={() => {
                setActiveSidebarTab('search');
                if (sidebarWidth === 0) setSidebarWidth(250);
              }}
              title="Search in Files"
            >
              🔍
            </div>
            <div 
              className={`ide-activity-btn ${activeSidebarTab === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveSidebarTab('settings');
                if (sidebarWidth === 0) setSidebarWidth(250);
              }}
              title="IDE Settings"
            >
              ⚙️
            </div>
          </div>
          <div className="ide-activity-group">
            <div 
              className={`ide-activity-btn ${showRightPanel ? 'active' : ''}`}
              onClick={() => setShowRightPanel(!showRightPanel)}
              title="AI Brain Co-Pilot"
            >
              🧠
              <span className="ide-activity-badge">AI</span>
            </div>
          </div>
        </div>

        {/* Resizable Sidebar Pane */}
        <div className="ide-sidebar" style={{ width: `${sidebarWidth}px`, display: sidebarWidth === 0 ? 'none' : 'flex' }}>
          <div className="ide-sidebar-header">
            <span className="ide-sidebar-title">
              {activeSidebarTab.toUpperCase()}
            </span>
            <div className="ide-sidebar-actions">
              {activeSidebarTab === 'explorer' && (
                <>
                  <span className="ide-sidebar-icon-btn" onClick={() => initiateCreation('/', 'file')} title="New File">➕📄</span>
                  <span className="ide-sidebar-icon-btn" onClick={() => initiateCreation('/', 'dir')} title="New Folder">➕📁</span>
                  <span className="ide-sidebar-icon-btn" onClick={() => refreshExpandedDirectories()} title="Refresh Tree">🔄</span>
                </>
              )}
            </div>
          </div>

          <div className="ide-sidebar-content">
            {activeSidebarTab === 'explorer' && (
              <div style={{ padding: '0 4px' }}>
                {creatingType && creatingParent === '/' && (
                  <div className="ide-tree-input-node" style={{ paddingLeft: '8px' }}>
                    <span className="ide-tree-icon">{creatingType === 'dir' ? '📁' : '📄'}</span>
                    <input
                      type="text"
                      className="ide-tree-textbox"
                      value={creatingValue}
                      onChange={(e) => setCreatingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitCreation();
                        if (e.key === 'Escape') setCreatingType(null);
                      }}
                      autoFocus
                      placeholder={`name...`}
                    />
                  </div>
                )}
                {/* Dynamically list root children cached in tree */}
                {treeCache['/']?.map(child => renderFileTreeNode(child))}
              </div>
            )}

            {activeSidebarTab === 'search' && (
              <div className="ide-search-container">
                <div className="ide-search-box">
                  <span className="ide-search-label">FIND PATTERN</span>
                  <input
                    type="text"
                    className="ide-search-input"
                    placeholder="Search string in workspace files..."
                    onChange={(e) => performSearch(e.target.value)}
                  />
                </div>
                <div className="ide-search-results">
                  {searchResults.map((res, i) => (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <div className="ide-search-result-file" onClick={() => openFileInPane(res.path)}>
                        📄 {res.path.split('/').pop()}
                      </div>
                      <div className="ide-search-result-match" onClick={() => openFileInPane(res.path)}>
                        <span style={{ color: 'var(--ide-magenta)', marginRight: '4px' }}>L{res.lineNum}:</span>
                        {res.text}
                      </div>
                    </div>
                  ))}
                  {searchQuery && searchResults.length === 0 && (
                    <span style={{ fontSize: '11px', color: '#718096', fontStyle: 'italic' }}>No pattern matched in code scene context.</span>
                  )}
                </div>
              </div>
            )}

            {activeSidebarTab === 'settings' && (
              <div className="ide-settings-container">
                <div className="ide-settings-group">
                  <span className="ide-settings-label">MONACO WORKSPACE THEME</span>
                  <select 
                    value={activeEditorTheme} 
                    onChange={(e) => setActiveEditorTheme(e.target.value)}
                    className="ide-settings-select"
                  >
                    <option value="vs-dark">Standard VS-Dark</option>
                    <option value="light">High-Contrast Light</option>
                    <option value="hc-black">High-Contrast Black</option>
                  </select>
                </div>
                <div className="ide-settings-group" style={{ marginTop: '10px' }}>
                  <span className="ide-settings-label">SECURITY PARTICLES & COMPILER UPLINK</span>
                  <span style={{ fontSize: '11.5px', color: 'var(--ide-green)' }}>🛡️ Virtual Environment Sandboxing Active</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drag handle between Sidebar and Editor */}
        <div 
          className={`ide-panel-resize-handle ${isResizingSidebar ? 'active' : ''}`}
          onMouseDown={() => setIsResizingSidebar(true)}
        />

        {/* 3. CENTER SPLIT WORKSPACE AREA */}
        <div className="ide-editor-workspace">
          
          <div className="ide-editor-core-area">
            
            {/* LEFT EDITOR PANE */}
            <div className="ide-editor-pane" onClick={() => setActivePane('left')}>
              <div className="ide-tab-bar">
                {openFilesLeft.map(filePath => (
                  <div 
                    key={filePath} 
                    className={`ide-tab ${activeFileLeft === filePath ? 'active' : ''}`}
                    onClick={() => {
                      setActiveFileLeft(filePath);
                      setActivePane('left');
                    }}
                  >
                    <span>📄 {filePath.split('/').pop()}</span>
                    <span className="ide-tab-close" onClick={(e) => closeFileInPane(e, filePath, 'left')}>×</span>
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                {activeFileLeft ? (
                  <Editor
                    height="100%"
                    theme={activeEditorTheme}
                    language={getLanguageFromExtension(activeFileLeft)}
                    value={fileContents[activeFileLeft] || ''}
                    onChange={(v) => handleCodeChange(v, activeFileLeft)}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 13,
                      fontFamily: '"Fira Code", monospace',
                      wordWrap: 'on',
                      cursorBlinking: 'blink',
                      lineNumbers: 'on',
                      autoClosingBrackets: 'always',
                      tabSize: 2
                    }}
                    onMount={(editor) => {
                      editor.onDidChangeCursorPosition((e) => {
                        setCursorPositionLeft({
                          line: e.position.lineNumber,
                          column: e.position.column
                        });
                      });
                    }}
                  />
                ) : (
                  <div className="ide-tab-empty">
                    <span className="ide-tab-empty-logo">⚡</span>
                    <h3>J.K.C CYBERNETIC INTEGRATED ENVIRONMENT</h3>
                    <p style={{ maxWidth: '380px', fontSize: '12px', color: '#718096', lineHeight: 1.6 }}>
                      No active source files loaded. Click elements in the file explorer sidebar or initialize a welcome log to start coding.
                    </p>
                    <button className="ide-tab-empty-btn" onClick={() => openFileInPane('/documents/welcome.txt', 'left')}>
                      Load welcome.txt Node
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Split Divider & RIGHT EDITOR PANE */}
            {editorSplit && (
              <>
                <div className="ide-editor-pane-divider" />
                <div className="ide-editor-pane" onClick={() => setActivePane('right')}>
                  <div className="ide-tab-bar">
                    {openFilesRight.map(filePath => (
                      <div 
                        key={filePath} 
                        className={`ide-tab ${activeFileRight === filePath ? 'active' : ''}`}
                        onClick={() => {
                          setActiveFileRight(filePath);
                          setActivePane('right');
                        }}
                      >
                        <span>📄 {filePath.split('/').pop()}</span>
                        <span className="ide-tab-close" onClick={(e) => closeFileInPane(e, filePath, 'right')}>×</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ flex: 1, position: 'relative' }}>
                    {activeFileRight ? (
                      <Editor
                        height="100%"
                        theme={activeEditorTheme}
                        language={getLanguageFromExtension(activeFileRight)}
                        value={fileContents[activeFileRight] || ''}
                        onChange={(v) => handleCodeChange(v, activeFileRight)}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          fontFamily: '"Fira Code", monospace',
                          wordWrap: 'on',
                          cursorBlinking: 'blink',
                          lineNumbers: 'on',
                          autoClosingBrackets: 'always',
                          tabSize: 2
                        }}
                        onMount={(editor) => {
                          editor.onDidChangeCursorPosition((e) => {
                            setCursorPositionRight({
                              line: e.position.lineNumber,
                              column: e.position.column
                            });
                          });
                        }}
                      />
                    ) : (
                      <div className="ide-tab-empty">
                        <span className="ide-tab-empty-logo">⚡</span>
                        <h3>SECONDARY SPLIT VIEW</h3>
                        <p style={{ maxWidth: '280px', fontSize: '12px', color: '#718096' }}>
                          Double click explorer entries or drag files here to view and edit side-by-side.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Integrated bottom terminal panel drawer */}
          {showBottomPanel && (
            <>
              <div 
                className={`ide-panel-resize-handle-row ${isResizingBottom ? 'active' : ''}`}
                onMouseDown={() => setIsResizingBottom(true)}
              />
              <div className="ide-bottom-panel" style={{ height: `${bottomPanelHeight}px` }}>
                <div className="ide-bottom-panel-header">
                  <div className="ide-bottom-tabs">
                    <span 
                      className={`ide-bottom-tab ${activeBottomTab === 'terminal' ? 'active' : ''}`}
                      onClick={() => setActiveBottomTab('terminal')}
                    >
                      INTEGRATED TERMINAL
                    </span>
                    <span 
                      className={`ide-bottom-tab ${activeBottomTab === 'problems' ? 'active' : ''}`}
                      onClick={() => setActiveBottomTab('problems')}
                    >
                      PROBLEMS DIAL
                    </span>
                  </div>
                  <span className="ide-sidebar-icon-btn" onClick={() => setShowBottomPanel(false)}>×</span>
                </div>

                <div className="ide-bottom-content">
                  {activeBottomTab === 'terminal' && (
                    <div ref={terminalRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />
                  )}

                  {activeBottomTab === 'problems' && (
                    <div style={{ padding: '8px', fontSize: '12px', color: 'var(--ide-green)', fontFamily: 'monospace' }}>
                      [✔] Static compile check: 0 errors, 0 warnings found in workspace.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Resizable handle between center Workspace and Right AI Assistant */}
        {showRightPanel && (
          <div 
            className={`ide-panel-resize-handle ${isResizingRight ? 'active' : ''}`}
            onMouseDown={() => setIsResizingRight(true)}
          />
        )}

        {/* 4. RIGHT SIDEBAR (AI AGENT CO-PILOT) */}
        <div className="ide-ai-panel" style={{ width: `${rightPanelWidth}px`, display: showRightPanel ? 'flex' : 'none' }}>
          <div className="ide-ai-header">
            <span className="ide-ai-title">🤖 CYBERNETIC AI CODE AGENT</span>
            <span className="ide-sidebar-icon-btn" onClick={() => setShowRightPanel(false)}>×</span>
          </div>

          {/* AI Settings & Context Configuration */}
          <div className="ide-ai-key-inputs">
            <div className="ide-ai-key-input-row">
              <span className="ide-search-label">AI ENGINE</span>
              <select 
                value={selectedAIProvider} 
                onChange={(e) => setSelectedAIProvider(e.target.value)}
                className="ide-ai-model-select"
              >
                <option value="gemini">1. Google Gemini</option>
                <option value="groq">2. Groq AI</option>
              </select>
            </div>

            {selectedAIProvider === 'gemini' ? (
              <div className="ide-ai-key-input-row">
                <span className="ide-search-label">MODEL CONFIG</span>
                <select 
                  value={selectedGeminiModel} 
                  onChange={(e) => setSelectedGeminiModel(e.target.value)}
                  className="ide-ai-model-select"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
              </div>
            ) : (
              <div className="ide-ai-key-input-row">
                <span className="ide-search-label">MODEL CONFIG</span>
                <select className="ide-ai-model-select" disabled>
                  <option>qwen-2.5-coder-32b</option>
                </select>
              </div>
            )}

            {/* MENTION A FILE SELECTOR */}
            <div className="ide-ai-key-input-row">
              <span className="ide-search-label">MENTIONED FILE</span>
              <select 
                value={mentionedFile} 
                onChange={(e) => setMentionedFile(e.target.value)}
                className="ide-ai-model-select"
                style={{ border: mentionedFile ? '1px solid var(--ide-cyan)' : '1px solid var(--ide-border)', boxShadow: mentionedFile ? '0 0 8px rgba(0, 243, 255, 0.2)' : 'none' }}
              >
                <option value="">-- No File Mentioned --</option>
                {workspaceFiles.map(path => {
                  const parts = path.split('/');
                  const name = parts[parts.length - 1];
                  const provider = parts[1]; // local, cloud, documents, system etc.
                  return (
                    <option key={path} value={path}>
                      📁 {name} ({provider})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* AI Dialogue panel messages */}
          <div className="ide-ai-messages">
            {aiMessages.map((msg, idx) => (
              <div key={idx} className={`ide-ai-msg ${msg.role}`}>
                <span className="ide-ai-msg-header" style={{ color: msg.role === 'user' ? 'var(--ide-green)' : 'var(--ide-blue)' }}>
                  {msg.role === 'user' ? '👤 DEVELOPER' : '🤖 CODE AGENT'}
                </span>
                <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isAiLoading && (
              <div className="ide-ai-msg assistant">
                <span className="ide-ai-msg-header" style={{ color: 'var(--ide-blue)' }}>🤖 CODE AGENT</span>
                <span className="cyber-typewriter">Analyzing codebase & streaming logic... ⠋</span>
              </div>
            )}
          </div>

          {/* Context Injection Chips */}
          <div className="ide-ai-shortcuts">
            <span className="ide-ai-shortcut-chip" onClick={() => handleShortcutAIAction('explain')}>
              Explain Active Code
            </span>
            <span className="ide-ai-shortcut-chip" onClick={() => handleShortcutAIAction('refactor')}>
              Refactor Code
            </span>
            <span className="ide-ai-shortcut-chip" onClick={() => handleShortcutAIAction('bugs')}>
              Detect Code Bugs
            </span>
          </div>

          {/* Chat dialog textbox */}
          <div className="ide-ai-input-area">
            <input
              type="text"
              className="ide-ai-textbox"
              placeholder="Ask AI co-pilot code logic..."
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessageToAI();
              }}
            />
            <button className="ide-ai-send-btn" onClick={() => handleSendMessageToAI()}>
              SEND
            </button>
          </div>
        </div>

      </div>

      {/* 5. TOP FLOATING COMMAND PALETTE ACTION OVERLAY */}
      {showCommandPalette && (
        <div className="ide-palette-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="ide-palette-box" onClick={(e) => e.stopPropagation()}>
            <div className="ide-palette-search">
              <input
                type="text"
                className="ide-palette-input"
                placeholder="Type command directive to filter actions..."
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ide-palette-list">
              {filteredPaletteCmds.map((cmd, idx) => (
                <div
                  key={idx}
                  className={`ide-palette-item ${idx === selectedPaletteIdx ? 'selected' : ''}`}
                  onClick={() => executePaletteCommand(cmd)}
                  onMouseEnter={() => setSelectedPaletteIdx(idx)}
                >
                  <span>⚡ {cmd.name}</span>
                  <span className="ide-dropdown-shortcut">Action</span>
                </div>
              ))}
              {filteredPaletteCmds.length === 0 && (
                <div style={{ padding: '12px 16px', color: '#718096', fontSize: '12px' }}>
                  No keyboard directives catalogued.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. STATIC SIDEBAR RIGHT-CLICK CONTEXT DIALOG MENU */}
      {contextMenu && (
        <div
          className="ide-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'dir' ? (
            <>
              <div className="ide-context-item" onClick={() => { initiateCreation(contextMenu.path, 'file'); handleCloseContextMenu(); }}>📄 New File...</div>
              <div className="ide-context-item" onClick={() => { initiateCreation(contextMenu.path, 'dir'); handleCloseContextMenu(); }}>📁 New Folder...</div>
              <div className="ide-dropdown-divider" />
            </>
          ) : (
            <>
              <div className="ide-context-item" onClick={() => { openFileInPane(contextMenu.path, 'left'); handleCloseContextMenu(); }}>📂 Open Active Left</div>
              <div className="ide-context-item" onClick={() => { openFileInPane(contextMenu.path, 'right'); handleCloseContextMenu(); }}>📂 Open Split Right</div>
              <div className="ide-dropdown-divider" />
            </>
          )}
          <div className="ide-context-item" onClick={() => { initiateRename(contextMenu.path); handleCloseContextMenu(); }}>📝 Rename...</div>
          <div className="ide-context-item" style={{ color: 'var(--ide-red)' }} onClick={() => { deleteEntry(contextMenu.path); handleCloseContextMenu(); }}>🗑️ Delete</div>
        </div>
      )}

      {/* 7. BOTTOM STATUS BAR METRICS */}
      <div className="ide-status-bar">
        <div className="ide-status-left">
          <span className="ide-status-metric active">
            💻 Core Shell Uptime
          </span>
          <span className="ide-status-metric">
            Pane: <span style={{ color: 'var(--ide-cyan)' }}>{activePane.toUpperCase()}</span>
          </span>
          <span className="ide-status-metric">
            Disk: <span style={{ color: storageService.localDirectoryHandle ? 'var(--ide-green)' : 'rgba(255,255,255,0.4)' }}>
              {storageService.localDirectoryHandle ? `Mounted (${storageService.localDirectoryHandle.name})` : 'Sandbox Only'}
            </span>
          </span>
          <span className="ide-status-metric">
            Cloud Sync: <span style={{ color: storageService.cloudConnected ? 'var(--ide-magenta)' : 'rgba(255,255,255,0.3)' }}>
              {storageService.cloudConnected ? `Connected (${storageService.cloudProvider})` : 'Severed'}
            </span>
          </span>
        </div>

        <div className="ide-status-right">
          <span className="ide-status-metric">
            Active Editor: {activePane === 'left' 
              ? `${activeFileLeft.split('/').pop() || 'None'} (Ln ${cursorPositionLeft.line}, Col ${cursorPositionLeft.column})`
              : `${activeFileRight.split('/').pop() || 'None'} (Ln ${cursorPositionRight.line}, Col ${cursorPositionRight.column})`
            }
          </span>
          <span className="ide-status-metric warning">
            Encoding: UTF-8
          </span>
          <span className="ide-status-metric active" style={{ textShadow: '0 0 5px var(--ide-magenta)', color: 'var(--ide-magenta)' }}>
            AI Co-Pilot: {selectedAIProvider === 'gemini' ? selectedGeminiModel : 'qwen3-32b'}
          </span>
        </div>
      </div>
    </div>
  );
}
