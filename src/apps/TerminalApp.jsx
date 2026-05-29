import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useOSStore } from '../store/useOSStore';
import { storageService } from '../services/storageService';
import 'xterm/css/xterm.css';
import './TerminalApp.css';

// ASCII Banner for J.K.C O.S Dev Terminal
const TERMINAL_BANNER = [
  "  ____   _  __      ___   ____  ",
  " |  _ \\ | |/ /     / _ \\ / ___| ",
  " | | | || ' / ____| | | |\\___ \\ ",
  " | |_| || . \\|____| |_| | ___) |",
  " |____/ |_|\\_\\      \\___/ |____/ ",
  "                                 ",
  "\x1b[1;36m  === CYBERNETIC WEB CORE OS DEV TERMINAL v1.1.0 ===\x1b[0m",
  "  System core status: \x1b[1;32mONLINE\x1b[0m | Precinct firewall: \x1b[1;35mACTIVE\x1b[0m",
  "  Type \x1b[1;33mhelp\x1b[0m to list available console directives.",
  ""
];

// Helper to resolve relative path strings with '.' and '..' against a base path
const resolvePath = (base, relative) => {
  if (!relative) return base;
  let res = '';
  if (relative.startsWith('/')) {
    res = relative;
  } else {
    res = base === '/' ? '/' + relative : base + '/' + relative;
  }
  
  // Resolve '.' and '..'
  const parts = res.split('/').filter(Boolean);
  const resolvedParts = [];
  for (const part of parts) {
    if (part === '.') {
      continue;
    } else if (part === '..') {
      if (resolvedParts.length > 0) {
        resolvedParts.pop();
      }
    } else {
      resolvedParts.push(part);
    }
  }
  return '/' + resolvedParts.join('/');
};

const TerminalApp = () => {
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddonRef = useRef(null);
  const { openApp, windows } = useOSStore();

  // React state for consent overlay to bypass user gesture blocks safely
  const [showMountOverlay, setShowMountOverlay] = useState(false);

  // Command History tracking
  const commandHistory = useRef([]);
  const historyIdx = useRef(-1);
  const currentLine = useRef('');
  const currentDir = useRef('/documents'); // start in documents directory

  useEffect(() => {
    if (!terminalRef.current) return;

    // 1. Initialize xterm.js Terminal instance
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Fira Code", "Courier New", monospace',
      letterSpacing: 0.5,
      theme: {
        background: 'rgba(5, 8, 16, 0.95)',
        foreground: '#00f3ff', // glowing cyber cyan
        cursor: '#ff00ff', // glowing magenta cursor
        black: '#000000',
        red: '#ff0055',
        green: '#00ff66',
        yellow: '#ffcc00',
        blue: '#0066ff',
        magenta: '#ff00ff',
        cyan: '#00f3ff',
        white: '#ffffff',
        brightBlack: '#555555',
        brightRed: '#ff3377',
        brightGreen: '#33ff88',
        brightYellow: '#ffdd33',
        brightBlue: '#3388ff',
        brightMagenta: '#ff33ff',
        brightCyan: '#33f5ff',
        brightWhite: '#ffffff'
      },
      allowProposedApi: true
    });

    termInstance.current = term;

    // 2. Initialize FitAddon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    // 3. Mount terminal onto DOM container
    term.open(terminalRef.current);
    fitAddon.fit();

    // Write banner
    TERMINAL_BANNER.forEach(line => term.writeln(line));
    writePrompt();

    // 4. Set up ResizeObserver to handle custom dimensions (maximized, resized)
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });
    
    // Observe parent element for changes
    if (terminalRef.current.parentElement) {
      resizeObserver.observe(terminalRef.current.parentElement);
    }

    // 5. Handle Keyboard Events inside Terminal
    const disposable = term.onKey(async (e) => {
      const key = e.key;
      const domEvent = e.domEvent;

      if (domEvent.key === 'Enter') {
        term.write('\r\n');
        await handleCommand(currentLine.current);
        currentLine.current = '';
        // Only write prompt if overlay is NOT showing (to prevent double inputs/prompts)
        if (!showMountOverlay) {
          writePrompt();
        }
      } 
      else if (domEvent.key === 'Backspace') {
        if (currentLine.current.length > 0) {
          currentLine.current = currentLine.current.slice(0, -1);
          term.write('\b \b'); // backspace, write space, backspace
        }
      } 
      else if (domEvent.key === 'ArrowUp') {
        // Command history retrieval (previous commands)
        if (commandHistory.current.length > 0) {
          if (historyIdx.current === -1) {
            historyIdx.current = commandHistory.current.length - 1;
          } else if (historyIdx.current > 0) {
            historyIdx.current--;
          }
          clearCurrentInput();
          currentLine.current = commandHistory.current[historyIdx.current];
          term.write(currentLine.current);
        }
      } 
      else if (domEvent.key === 'ArrowDown') {
        if (historyIdx.current !== -1) {
          if (historyIdx.current < commandHistory.current.length - 1) {
            historyIdx.current++;
            clearCurrentInput();
            currentLine.current = commandHistory.current[historyIdx.current];
            term.write(currentLine.current);
          } else {
            historyIdx.current = -1;
            clearCurrentInput();
            currentLine.current = '';
          }
        }
      } 
      else {
        // Standard printable ASCII input
        if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey && !domEvent.metaKey) {
          currentLine.current += key;
          term.write(key);
        }
      }
    });

    return () => {
      disposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [showMountOverlay]);

  // Erases all input written on the prompt line so far
  const clearCurrentInput = () => {
    if (!termInstance.current) return;
    const term = termInstance.current;
    
    // Move cursor back and clear to line end
    for (let i = 0; i < currentLine.current.length; i++) {
      term.write('\b \b');
    }
  };

  // Renders prompt line
  const writePrompt = () => {
    if (!termInstance.current) return;
    const term = termInstance.current;
    
    // Format: jkc-os@dev:/documents# 
    const dirColor = "\x1b[1;33m"; // yellow
    const resetColor = "\x1b[0m";
    const promptStr = `\r\x1b[1;35mjkc-os\x1b[0m@\x1b[1;36mdev\x1b[0m:${dirColor}${currentDir.current}${resetColor}# `;
    term.write(promptStr);
  };

  /**
   * Main Command Router
   */
  const handleCommand = async (rawCmd) => {
    const term = termInstance.current;
    if (!term) return;

    const trimmed = rawCmd.trim();
    if (!trimmed) return;

    // Save to command history list
    commandHistory.current.push(trimmed);
    historyIdx.current = -1; // reset history pointer

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        term.writeln('\x1b[1;36m┌────────────────── AVAILABLE CYBERNETIC COMMANDS ──────────────────┐\x1b[0m');
        term.writeln('\x1b[1;35m  [ SYSTEM CONTROLS ]\x1b[0m');
        term.writeln('    \x1b[1;33mhelp\x1b[0m                       Display this directive directory');
        term.writeln('    \x1b[1;33mclear\x1b[0m                      Flush terminal screen buffer');
        term.writeln('    \x1b[1;33msystem info\x1b[0m                Generate premium diagnostic telemetry report');
        term.writeln('    \x1b[1;33mopen <app>\x1b[0m                 Launch a WebOS application window');
        term.writeln('                               Usage: \x1b[1;32mopen notes | chrome | jarvis | crime\x1b[0m');
        term.writeln('');
        term.writeln('\x1b[1;35m  [ STORAGE MOUNTING ]\x1b[0m');
        term.writeln('    \x1b[1;33mmount\x1b[0m                      Uplink physical host folder to \x1b[1;34m/local\x1b[0m namespace');
        term.writeln('    \x1b[1;33mstorage\x1b[0m                    View current localized and cloud volume capacity');
        term.writeln('    \x1b[1;33mcloud <action>\x1b[0m             Control connected hybrid cloud storage');
        term.writeln('                               Usage: \x1b[1;32mcloud connect <gdrive|dropbox> | cloud disconnect\x1b[0m');
        term.writeln('');
        term.writeln('\x1b[1;35m  [ NAVIGATION & READING ]\x1b[0m');
        term.writeln('    \x1b[1;33mpwd\x1b[0m                        Print current active path location');
        term.writeln('    \x1b[1;33mls\x1b[0m                         List contents of the current directory');
        term.writeln('    \x1b[1;33mcd <path>\x1b[0m                  Traverse folders (relative or absolute)');
        term.writeln('    \x1b[1;33mcat <file>\x1b[0m                 Display file text contents on screen');
        term.writeln('');
        term.writeln('\x1b[1;35m  [ FILE CREATION ]\x1b[0m');
        term.writeln('    \x1b[1;33mtouch <file>\x1b[0m               Initialize a new empty file at path');
        term.writeln('    \x1b[1;33mmkdir <folder>\x1b[0m             Initialize a new sub-folder at path');
        term.writeln('');
        term.writeln('\x1b[1;35m  [ FILE EDITING ]\x1b[0m');
        term.writeln('    \x1b[1;33medit <file> <text>\x1b[0m         Overwrite/update the contents of a file with text');
        term.writeln('');
        term.writeln('\x1b[1;35m  [ DELETION ]\x1b[0m');
        term.writeln('    \x1b[1;33mrm <path>\x1b[0m                  Remove a file or empty folder');
        term.writeln('');
        term.writeln('\x1b[1;35m  [ AI MAINFRAME ]\x1b[0m');
        term.writeln('    \x1b[1;33mjarvis <prompt>\x1b[0m            Consult secure Jarvis mainframe directly');
        term.writeln('                               Example: \x1b[1;32mjarvis write a react hook for localstorage\x1b[0m');
        term.writeln('\x1b[1;36m└───────────────────────────────────────────────────────────────────┘\x1b[0m');
        break;

      case 'clear':
        term.clear();
        break;

      case 'pwd':
        term.writeln(currentDir.current);
        break;

      case 'cd':
        try {
          const target = args[0] ? resolvePath(currentDir.current, args[0]) : '/';
          // Verify directory exists
          await storageService.listDir(target);
          currentDir.current = target;
        } catch (err) {
          term.writeln(`\x1b[1;31mcd: ${err.message}\x1b[0m`);
        }
        break;

      case 'ls':
        try {
          const files = await storageService.listDir(currentDir.current);
          if (files.length === 0) {
            term.writeln('\x1b[3;90mDirectory is currently empty.\x1b[0m');
          } else {
            term.writeln('\x1b[1;35mMODE        PROVIDER    SIZE (B)    LAST MODIFIED         NAME\x1b[0m');
            files.forEach(f => {
              const typeStr = f.type === 'dir' ? 'd----' : '-----';
              const sizeStr = f.type === 'dir' ? '<DIR>' : String(f.size).padStart(8);
              const provStr = f.provider.padEnd(8);
              
              // Cyber styling color codes
              const colorCode = f.type === 'dir' ? '\x1b[1;34m' : (f.provider === 'physical' ? '\x1b[1;32m' : '');
              const nameStr = f.type === 'dir' ? `${colorCode}${f.name}/\x1b[0m` : `${colorCode}${f.name}\x1b[0m`;
              const dateStr = f.updatedAt ? new Date(f.updatedAt).toLocaleString().padEnd(21) : 'unknown'.padEnd(21);
              
              term.writeln(`${typeStr}       ${provStr}    ${sizeStr}    ${dateStr} ${nameStr}`);
            });
          }
        } catch (e) {
          term.writeln(`\x1b[1;31mError listing folder: ${e.message}\x1b[0m`);
        }
        break;

      case 'cat':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mUsage: cat <file>\x1b[0m');
          break;
        }
        try {
          const targetFile = resolvePath(currentDir.current, args[0]);
          const text = await storageService.readFile(targetFile);
          const lines = text.split('\n');
          lines.forEach(line => term.writeln(line));
        } catch (e) {
          term.writeln(`\x1b[1;31mcat: ${e.message}\x1b[0m`);
        }
        break;

      case 'touch':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mUsage: touch <file> [initial content]\x1b[0m');
          break;
        }
        try {
          const targetFile = resolvePath(currentDir.current, args[0]);
          const content = args.slice(1).join(' ') || '';
          await storageService.writeFile(targetFile, content);
          term.writeln(`\x1b[1;32m[✔] File created: ${args[0]}\x1b[0m`);
        } catch (e) {
          term.writeln(`\x1b[1;31mtouch: ${e.message}\x1b[0m`);
        }
        break;

      case 'edit':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mUsage: edit <file> <content_text>\x1b[0m');
          break;
        }
        try {
          const targetFile = resolvePath(currentDir.current, args[0]);
          const content = args.slice(1).join(' ');
          await storageService.writeFile(targetFile, content);
          term.writeln(`\x1b[1;32m[✔] File edited successfully: ${args[0]}\x1b[0m`);
        } catch (e) {
          term.writeln(`\x1b[1;31medit: ${e.message}\x1b[0m`);
        }
        break;

      case 'mkdir':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mUsage: mkdir <folder>\x1b[0m');
          break;
        }
        try {
          const targetDir = resolvePath(currentDir.current, args[0]);
          await storageService.mkdir(targetDir);
          term.writeln(`\x1b[1;32m[✔] Directory created: ${args[0]}\x1b[0m`);
        } catch (e) {
          term.writeln(`\x1b[1;31mmkdir: ${e.message}\x1b[0m`);
        }
        break;

      case 'rm':
        if (args.length === 0) {
          term.writeln('\x1b[1;31mUsage: rm <file_or_folder>\x1b[0m');
          break;
        }
        try {
          const targetPath = resolvePath(currentDir.current, args[0]);
          await storageService.deleteFile(targetPath);
          term.writeln(`\x1b[1;32m[✔] File or empty directory removed: ${args[0]}\x1b[0m`);
        } catch (e) {
          term.writeln(`\x1b[1;31mrm: ${e.message}\x1b[0m`);
        }
        break;

      case 'mount':
        if (!window.showDirectoryPicker) {
          term.writeln('\x1b[1;31m[❌] File System Access API is not supported by your current browser.\x1b[0m');
          term.writeln('Please use a modern Chromium-based browser (Chrome, Edge, Opera) to link physical storage.');
          break;
        }
        term.writeln('\x1b[1;33m[!] Initializing Secure Storage Bridge overlay...\x1b[0m');
        term.writeln('Authorize permission selection using the highlighted bridge buttons.');
        setShowMountOverlay(true);
        break;

      case 'echo':
        term.writeln(args.join(' '));
        break;

      case 'system':
        if (args[0] === 'info') {
          await runSystemDiagnostic();
        } else {
          term.writeln("Unknown system command. Usage: \x1b[1;32msystem info\x1b[0m");
        }
        break;

      case 'open':
        const targetApp = args[0]?.toLowerCase();
        if (!targetApp) {
          term.writeln("\x1b[1;31mDirective syntax error. Which app would you like to run?\x1b[0m");
          term.writeln("Usage: \x1b[1;32mopen notes\x1b[0m | \x1b[1;32mopen chrome\x1b[0m | \x1b[1;32mopen jarvis\x1b[0m | \x1b[1;32mopen crime\x1b[0m");
          break;
        }

        // Map short alias to app IDs in store
        let appId = null;
        if (targetApp === 'notes' || targetApp === 'note') appId = 'notes';
        else if (targetApp === 'chrome' || targetApp === 'browser') appId = 'chrome';
        else if (targetApp === 'jarvis' || targetApp === 'ai') appId = 'jarvis';
        else if (targetApp === 'crime' || targetApp === 'inspector') appId = 'crime';

        const appDetails = windows.find(w => w.id === appId);
        if (appDetails) {
          term.writeln(`Launching J.K.C WebOS frame: \x1b[1;32m${appDetails.title}\x1b[0m...`);
          openApp(appId);
        } else {
          term.writeln(`\x1b[1;31mApp binary '${targetApp}' not catalogued in J.K.C store matrix.\x1b[0m`);
        }
        break;

      case 'storage':
        displayStorageReport();
        break;

      case 'cloud':
        await handleCloudDirectives(args);
        break;

      case 'jarvis':
        if (args.length === 0) {
          term.writeln("Consult Jarvis directly by supplying a prompt.");
          term.writeln("Usage: \x1b[1;32mjarvis explain closure functions\x1b[0m");
          break;
        }
        await consultJarvisMainframe(args.join(' '));
        break;

      default:
        term.writeln(`\x1b[1;31mDirective not recognized: '${cmd}'. Type \x1b[1;33mhelp\x1b[1;31m for main console parameters.\x1b[0m`);
    }
  };

  /**
   * System Telemetry diagnostic display
   */
  const runSystemDiagnostic = async () => {
    const term = termInstance.current;
    term.writeln('\x1b[1;36mInitializing core diagnostic telemetry matrix...\x1b[0m');
    
    // Simulated diagnostic scrolling
    await new Promise(r => setTimeout(r, 400));
    term.writeln('  [+] Accessing BIOS hardware descriptors...');
    await new Promise(r => setTimeout(r, 300));
    term.writeln('  [+] Resolving local precinct hyperthreads...');
    await new Promise(r => setTimeout(r, 450));
    term.writeln('  [+] Mapping active sandbox memory allocations...');
    await new Promise(r => setTimeout(r, 200));

    const metrics = storageService.getStorageMetrics();
    const cloudStatus = metrics.cloudConnected ? `CONNECTED (\x1b[1;32m${metrics.cloudProvider}\x1b[0m)` : '\x1b[1;31mDISCONNECTED\x1b[0m';
    const activeApps = windows.filter(w => w.isOpen).map(w => w.title).join(', ') || 'None';

    term.writeln('');
    term.writeln('\x1b[1;36m┌─────────────────── JKC HARDWARE DIAGNOSTIC REPORT ──────────────────┐\x1b[0m');
    term.writeln(`| \x1b[1;33mOPERATING SYSTEM\x1b[0m   J.K.C Cybernetic WebOS v1.0.0 (Windows NT Core)  |`);
    term.writeln(`| \x1b[1;33mCPU ENGINE\x1b[0m         16x Core Neural-Grid Quantum Processor           |`);
    term.writeln(`| \x1b[1;33mSYS MEMORY\x1b[0m         64 GB Virtual High-Bandwidth Cyber-RAM           |`);
    term.writeln(`| \x1b[1;33mLOCAL CAPACITY\x1b[0m     LocalStorage Core: 5.0 MB                        |`);
    term.writeln(`| \x1b[1;33mCLOUD PERSIST\x1b[0m      ${cloudStatus.padEnd(61)}|`);
    term.writeln(`| \x1b[1;33mSESSION UPTIME\x1b[0m     ${String(Math.round(performance.now() / 1000)).padStart(5)} seconds. (Active Threads: 47)               |`);
    term.writeln(`| \x1b[1;33mACTIVE APPLICATIONS\x1b[0m ${activeApps.substring(0, 48).padEnd(49)}|`);
    term.writeln('\x1b[1;36m└─────────────────────────────────────────────────────────────────────┘\x1b[0m');
    term.writeln('');
  };

  /**
   * Virtual storage metrics display
   */
  const displayStorageReport = () => {
    const term = termInstance.current;
    const metrics = storageService.getStorageMetrics();
    
    term.writeln('\x1b[1;35mVirtual Storage Matrix Report:\x1b[0m');
    term.writeln(`  Files Tracked:      ${metrics.fileCount}`);
    term.writeln(`  Storage Utilized:   ${metrics.totalBytes} Bytes`);
    term.writeln(`  Provider Volumes:    Local Files: ${metrics.localCount} | Cloud Uploads: ${metrics.cloudCount}`);
    term.writeln(`  Cloud Sync Link:    ${metrics.cloudConnected ? `CONNECTED (via ${metrics.cloudProvider})` : 'UNCONNECTED (Local Sandbox Only)'}`);
    term.writeln(`  Mounted Disk:       ${storageService.localDirectoryHandle ? 'MOUNTED at \x1b[1;34m/local\x1b[0m ("' + storageService.localDirectoryHandle.name + '")' : 'UNMOUNTED'}`);
    
    if (!metrics.cloudConnected) {
      term.writeln('');
      term.writeln('  \x1b[1;36m[i] Expand system capacity and unlock hybrid capabilities:\x1b[0m');
      term.writeln('      Type \x1b[1;32mcloud connect gdrive\x1b[0m or \x1b[1;32mcloud connect dropbox\x1b[0m to initiate cloud binding.');
    }
  };

  /**
   * Cloud binder command handler
   */
  const handleCloudDirectives = async (args) => {
    const term = termInstance.current;
    const action = args[0]?.toLowerCase();

    if (action === 'connect') {
      const provider = args[1]?.toLowerCase();
      if (provider !== 'gdrive' && provider !== 'dropbox') {
        term.writeln('\x1b[1;31mSyntax mismatch. Please define a valid cloud vault provider.\x1b[0m');
        term.writeln('Usage: \x1b[1;32mcloud connect gdrive\x1b[0m | \x1b[1;32mcloud connect dropbox\x1b[0m');
        return;
      }

      const pName = provider === 'gdrive' ? 'Google Drive' : 'Dropbox';
      term.writeln(`\x1b[1;36mRequesting secure OAuth token for ${pName}...\x1b[0m`);
      
      // Animated Loading spinner
      const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let idx = 0;
      const interval = setInterval(() => {
        term.write(`\r  ${frames[idx]} Connecting security token uplink...`);
        idx = (idx + 1) % frames.length;
      }, 100);

      try {
        await storageService.connectCloud(pName);
        clearInterval(interval);
        term.write('\r');
        term.writeln(`\x1b[1;32m[✔] Cloud Persistent Sync Binding Established: ${pName} successfully connected!\x1b[0m`);
        term.writeln('    All local VFS partitions have been synced to the remote cluster.');
      } catch (err) {
        clearInterval(interval);
        term.writeln(`\x1b[1;31m\r[❌] Cryptographic handshake failure: ${err.message}\x1b[0m`);
      }
    } 
    else if (action === 'disconnect') {
      const metrics = storageService.getStorageMetrics();
      if (!metrics.cloudConnected) {
        term.writeln('\x1b[1;31mStorage matrix already disconnected from cloud networks.\x1b[0m');
        return;
      }
      term.writeln('\x1b[1;33mSevering secure persistent storage sync tunnel...\x1b[0m');
      storageService.disconnectCloud();
      term.writeln('\x1b[1;32m[✔] Storage severed. System now running strictly in Local Sandbox mode.\x1b[0m');
    } 
    else {
      term.writeln('\x1b[1;31mCommand syntax failure. Usage:\x1b[0m');
      term.writeln('  \x1b[1;32mcloud connect <gdrive|dropbox>\x1b[0m');
      term.writeln('  \x1b[1;32mcloud disconnect\x1b[0m');
    }
  };

  /**
   * Secure proxy consultant streaming simulation interface
   */
  const consultJarvisMainframe = async (prompt) => {
    const term = termInstance.current;
    term.writeln('\x1b[1;35mEstablishing secure proxy connection to Jarvis Mainframe...\x1b[0m');
    
    try {
      const response = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Connection severed by mainframe proxy.');
      }

      const resData = await response.json();
      const content = resData.choices?.[0]?.message?.content || 'No return telemetry recorded.';

      term.writeln('\x1b[1;32mMainframe signal synchronized. Receiving secure stream:\x1b[0m');
      term.writeln('');

      // Type out character by character to create that awesome real AI-terminal streaming cyber vibe!
      const typingPromise = new Promise(resolve => {
        let i = 0;
        // Speeds up typing speed for longer replies so developer is not kept waiting
        const charsPerTick = content.length > 500 ? 5 : (content.length > 200 ? 2 : 1);
        
        const tick = () => {
          if (i < content.length) {
            const chunk = content.substring(i, i + charsPerTick);
            // Translate standard newlines to CR+LF for xterm.js
            const formatted = chunk.replace(/\n/g, '\r\n');
            term.write(formatted);
            i += charsPerTick;
            setTimeout(tick, 10);
          } else {
            term.write('\r\n\r\n');
            resolve();
          }
        };
        tick();
      });

      await typingPromise;

    } catch (e) {
      term.writeln(`\x1b[1;31m[❌] Secure Proxy consultations failed: ${e.message}\x1b[0m`);
    }
  };

  // Triggers directory picker directly in a secure gesture-safe React click handler
  const triggerDirectoryPicker = async () => {
    const term = termInstance.current;
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      storageService.mountDirectoryHandle(handle);
      setShowMountOverlay(false);
      
      term.writeln('\x1b[1;32m[✔] Secure Cybernetic Storage Bridge Established!\x1b[0m');
      term.writeln(`    Directory "${handle.name}" successfully mapped to mount namespace: \x1b[1;34m/local\x1b[0m.`);
      term.writeln('    Try navigating using: \x1b[1;33mcd /local\x1b[0m then list files with \x1b[1;33mls\x1b[0m.');
      writePrompt();
    } catch (err) {
      setShowMountOverlay(false);
      term.writeln(`\x1b[1;31m[❌] Security authorization bridge failed: ${err.message}\x1b[0m`);
      writePrompt();
    }
  };

  return (
    <div className="terminal-app-container">
      <div ref={terminalRef} className="terminal-xterm-node" />
      
      {showMountOverlay && (
        <div className="terminal-mount-overlay">
          <div className="mount-overlay-box">
            <h3>[ SECURE STORAGE BRIDGE ]</h3>
            <p>Physical Cyber-Deck Uplink Detected.<br />Please authorize directory access permissions to mount host files.</p>
            <div className="mount-buttons">
              <button className="mount-btn" onClick={triggerDirectoryPicker}>CONNECT LOCAL FILES</button>
              <button className="mount-cancel" onClick={() => setShowMountOverlay(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalApp;
