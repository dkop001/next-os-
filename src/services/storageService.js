/**
 * Unified Virtual Storage Service (VFS) for J.K.C O.S
 * Unifies local client storage (LocalStorage/IndexedDB) and cloud syncing (simulated OAuth endpoints)
 * with dynamic Physical Host Disk mounting capabilities (/local namespace).
 */

const LOCAL_STORAGE_KEY = 'jkc_os_vfs';

// Default system file tree structure
const DEFAULT_VFS = {
  '/': {
    type: 'dir',
    name: 'root',
    children: ['documents', 'downloads', 'system']
  },
  '/documents': {
    type: 'dir',
    name: 'documents',
    children: ['welcome.txt', 'todo.txt']
  },
  '/documents/welcome.txt': {
    type: 'file',
    name: 'welcome.txt',
    provider: 'local',
    content: 'Welcome to D.K O.S!\n\nThis is a high-fidelity WebOS interface equipped with advanced developer tools. You are currently reading from the Virtual File System (VFS). Try editing this file or creating new ones in the Terminal!',
    updatedAt: new Date().toISOString()
  },
  '/documents/todo.txt': {
    type: 'file',
    name: 'todo.txt',
    provider: 'local',
    content: '- Connect real OAuth cloud APIs\n- Write more AI-powered tools\n- Rule the digital frontier\n- Clean up code scene crimes',
    updatedAt: new Date().toISOString()
  },
  '/downloads': {
    type: 'dir',
    name: 'downloads',
    children: []
  },
  '/system': {
    type: 'dir',
    name: 'system',
    children: ['version.log', 'telemetry.json']
  },
  '/system/version.log': {
    type: 'file',
    name: 'version.log',
    provider: 'local',
    content: 'D.K O.S v1.0.0 [BUILD 2026.05.20]\nKernel: CyberneticWebKernel-v1.0\nStatus: ONLINE',
    updatedAt: new Date().toISOString()
  },
  '/system/telemetry.json': {
    type: 'file',
    name: 'telemetry.json',
    provider: 'local',
    content: JSON.stringify({
      cpu: '16x Cyber-Thread Virtual Core',
      ram: '64 GB Virtual HBM3',
      storage: '2 TB Cyber-SSD NVMe',
      securityLevel: 'MAXIMUM'
    }, null, 2),
    updatedAt: new Date().toISOString()
  }
};

class StorageService {
  constructor() {
    this.vfs = null;
    this.cloudConnected = false;
    this.cloudProvider = null;
    this.syncListeners = new Set();
    this.localDirectoryHandle = null; // Session in-memory handle for physical mounting
  }

  /**
   * Initializes the Virtual File System
   */
  init() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        this.vfs = JSON.parse(stored);
      } else {
        this.vfs = { ...DEFAULT_VFS };
        this.saveToDisk();
      }
      
      // Load cloud state
      this.cloudConnected = localStorage.getItem('D.K_os_cloud_connected') === 'true';
      this.cloudProvider = localStorage.getItem('D.K_os_cloud_provider') || null;

      // Ensure /cloud is correctly reflected if connected
      if (this.cloudConnected) {
        if (!this.vfs['/cloud']) {
          this.vfs['/cloud'] = {
            type: 'dir',
            name: 'cloud',
            children: ['cloud_backup.txt', 'notes_from_mainframe.txt'],
            updatedAt: new Date().toISOString()
          };
          this.vfs['/cloud/cloud_backup.txt'] = {
            type: 'file',
            name: 'cloud_backup.txt',
            provider: 'cloud',
            content: 'Cloud Backup System Active.\n\nAll modifications under this folder sync directly to your secure cloud cluster in real-time.',
            updatedAt: new Date().toISOString()
          };
          this.vfs['/cloud/notes_from_mainframe.txt'] = {
            type: 'file',
            name: 'notes_from_mainframe.txt',
            provider: 'cloud',
            content: 'MEMORANDUM:\nTo: Detective\nFrom: Mainframe Security Command\nSubject: Code Scene Investigations\n\nEnsure that you perform static code scans on all repositories. The neon golden lights are watching.',
            updatedAt: new Date().toISOString()
          };
        }
        if (this.vfs['/'] && !this.vfs['/'].children.includes('cloud')) {
          this.vfs['/'].children.push('cloud');
        }
      } else {
        if (this.vfs['/'] && this.vfs['/'].children) {
          this.vfs['/'].children = this.vfs['/'].children.filter(name => name !== 'cloud');
        }
        Object.keys(this.vfs).forEach(key => {
          if (key === '/cloud' || key.startsWith('/cloud/')) {
            delete this.vfs[key];
          }
        });
      }
    } catch (e) {
      console.error('Failed to initialize VFS, falling back to defaults:', e);
      this.vfs = { ...DEFAULT_VFS };
    }
  }

  /**
   * Save VFS state to LocalStorage
   */
  saveToDisk() {
    if (this.vfs) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.vfs));
    }
  }

  /**
   * Add a synchronization change listener
   */
  onSync(callback) {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  notifySync(event, path) {
    this.syncListeners.forEach(cb => cb({ event, path, timestamp: new Date().toISOString() }));
  }

  /**
   * Normalize path strings
   */
  normalizePath(path) {
    let clean = path.trim().replace(/\/+/g, '/');
    if (clean.endsWith('/') && clean.length > 1) {
      clean = clean.slice(0, -1);
    }
    if (!clean.startsWith('/')) {
      clean = '/' + clean;
    }
    return clean;
  }

  /**
   * Mount a native FileSystemDirectoryHandle to /local
   */
  mountDirectoryHandle(handle) {
    this.localDirectoryHandle = handle;
    this.notifySync('MOUNT_LOCAL', '/local');
  }

  /**
   * List directory contents (Asynchronous)
   */
  async listDir(path) {
    const norm = this.normalizePath(path);
    
    // Support physical folder mounting intercept
    if (norm === '/local' || norm.startsWith('/local/')) {
      if (!this.localDirectoryHandle) {
        throw new Error('Physical directory is not mounted at /local. Type "mount" to connect storage.');
      }
      
      const parts = norm.split('/').filter(Boolean).slice(1);
      let currentHandle = this.localDirectoryHandle;
      
      for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }
      
      const children = [];
      for await (const entry of currentHandle.values()) {
        let size = 0;
        let updatedAt = new Date().toISOString();
        
        if (entry.kind === 'file') {
          try {
            const file = await entry.getFile();
            size = file.size;
            updatedAt = new Date(file.lastModified).toISOString();
          } catch (e) {
            // Access permission or system restricted file error fallback
          }
        }
        
        children.push({
          name: entry.name,
          path: norm === '/' ? `/${entry.name}` : `${norm}/${entry.name}`,
          type: entry.kind === 'directory' ? 'dir' : 'file',
          provider: 'physical',
          size: size,
          updatedAt: updatedAt
        });
      }
      
      return children;
    }
    
    const item = this.vfs[norm];
    
    if (!item) {
      throw new Error(`Directory not found: ${path}`);
    }
    if (item.type !== 'dir') {
      throw new Error(`Not a directory: ${path}`);
    }

    let childrenNames = [...item.children];
    
    // Dynamically insert '/local' into root path children listing if mounted
    if (norm === '/' && this.localDirectoryHandle && !childrenNames.includes('local')) {
      childrenNames.push('local');
    }

    return childrenNames.map(name => {
      const childPath = norm === '/' ? `/${name}` : `${norm}/${name}`;
      
      if (childPath === '/local') {
        return {
          name: 'local',
          path: '/local',
          type: 'dir',
          provider: 'physical',
          size: 0,
          updatedAt: new Date().toISOString()
        };
      }
      
      const child = this.vfs[childPath];
      return {
        name,
        path: childPath,
        type: child ? child.type : 'unknown',
        provider: child ? child.provider : 'local',
        size: child && child.content ? child.content.length : 0,
        updatedAt: child ? child.updatedAt : null
      };
    });
  }

  /**
   * Read file contents (Asynchronous)
   */
  async readFile(path) {
    const norm = this.normalizePath(path);

    // Support physical folder mounting intercept
    if (norm.startsWith('/local/')) {
      if (!this.localDirectoryHandle) {
        throw new Error('Physical directory is not mounted at /local. Type "mount" to connect storage.');
      }
      
      const parts = norm.split('/').filter(Boolean).slice(1);
      const fileName = parts.pop();
      let currentHandle = this.localDirectoryHandle;
      
      for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }
      
      const fileHandle = await currentHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return await file.text();
    }

    const item = this.vfs[norm];

    if (!item) {
      throw new Error(`File not found: ${path}`);
    }
    if (item.type !== 'file') {
      throw new Error(`Not a file: ${path}`);
    }

    return item.content;
  }

  /**
   * Create or update a file in VFS or physical folder (Asynchronous)
   */
  async writeFile(path, content, provider = 'local') {
    const norm = this.normalizePath(path);

    // Support physical folder mounting intercept
    if (norm.startsWith('/local/')) {
      if (!this.localDirectoryHandle) {
        throw new Error('Physical directory is not mounted at /local. Type "mount" to connect storage.');
      }
      
      const parts = norm.split('/').filter(Boolean).slice(1);
      const fileName = parts.pop();
      let currentHandle = this.localDirectoryHandle;
      
      for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
      }
      
      const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      
      return {
        type: 'file',
        name: fileName,
        provider: 'physical',
        content: content,
        updatedAt: new Date().toISOString()
      };
    }

    const lastSlashIdx = norm.lastIndexOf('/');
    const parentPath = lastSlashIdx === 0 ? '/' : norm.substring(0, lastSlashIdx);
    const fileName = norm.substring(lastSlashIdx + 1);

    const parent = this.vfs[parentPath];
    if (!parent || parent.type !== 'dir') {
      throw new Error(`Parent directory does not exist: ${parentPath}`);
    }

    // Create file
    this.vfs[norm] = {
      type: 'file',
      name: fileName,
      provider: this.cloudConnected ? (norm.startsWith('/cloud/') ? 'cloud' : 'hybrid') : provider,
      content: content,
      updatedAt: new Date().toISOString()
    };

    // Add to parent children list if not already there
    if (!parent.children.includes(fileName)) {
      parent.children.push(fileName);
    }

    this.saveToDisk();
    
    if (this.cloudConnected) {
      this.simulateCloudSync(norm, 'WRITE');
    } else {
      this.notifySync('WRITE_LOCAL', norm);
    }

    return this.vfs[norm];
  }

  /**
   * Create a directory in VFS or physical folder (Asynchronous)
   */
  async mkdir(path) {
    const norm = this.normalizePath(path);

    // Support physical folder mounting intercept
    if (norm.startsWith('/local/')) {
      if (!this.localDirectoryHandle) {
        throw new Error('Physical directory is not mounted at /local. Type "mount" to connect storage.');
      }
      
      const parts = norm.split('/').filter(Boolean).slice(1);
      let currentHandle = this.localDirectoryHandle;
      
      for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
      }
      
      return {
        type: 'dir',
        name: parts[parts.length - 1],
        provider: 'physical',
        updatedAt: new Date().toISOString()
      };
    }

    const lastSlashIdx = norm.lastIndexOf('/');
    const parentPath = lastSlashIdx === 0 ? '/' : norm.substring(0, lastSlashIdx);
    const dirName = norm.substring(lastSlashIdx + 1);

    const parent = this.vfs[parentPath];
    if (!parent || parent.type !== 'dir') {
      throw new Error(`Parent directory does not exist: ${parentPath}`);
    }

    if (this.vfs[norm]) {
      throw new Error(`Directory/File already exists: ${path}`);
    }

    this.vfs[norm] = {
      type: 'dir',
      name: dirName,
      children: [],
      updatedAt: new Date().toISOString()
    };

    if (!parent.children.includes(dirName)) {
      parent.children.push(dirName);
    }

    this.saveToDisk();
    this.notifySync('MKDIR_LOCAL', norm);
    
    return this.vfs[norm];
  }

  /**
   * Delete a file or empty directory from VFS or physical folder (Asynchronous)
   */
  async deleteFile(path) {
    const norm = this.normalizePath(path);

    // Support physical folder mounting intercept
    if (norm.startsWith('/local/')) {
      if (!this.localDirectoryHandle) {
        throw new Error('Physical directory is not mounted at /local. Type "mount" to connect storage.');
      }
      
      const parts = norm.split('/').filter(Boolean).slice(1);
      const nameToDelete = parts.pop();
      let currentHandle = this.localDirectoryHandle;
      
      for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }
      
      await currentHandle.removeEntry(nameToDelete, { recursive: true });
      return true;
    }

    const item = this.vfs[norm];

    if (!item) {
      throw new Error(`File/Directory not found: ${path}`);
    }

    if (item.type === 'dir' && item.children.length > 0) {
      throw new Error(`Directory not empty: ${path}`);
    }

    const lastSlashIdx = norm.lastIndexOf('/');
    const parentPath = lastSlashIdx === 0 ? '/' : norm.substring(0, lastSlashIdx);
    const fileName = norm.substring(lastSlashIdx + 1);

    const parent = this.vfs[parentPath];
    if (parent) {
      parent.children = parent.children.filter(name => name !== fileName);
    }

    delete this.vfs[norm];
    this.saveToDisk();

    if (this.cloudConnected) {
      this.simulateCloudSync(norm, 'DELETE');
    } else {
      this.notifySync('DELETE_LOCAL', norm);
    }

    return true;
  }

  /**
   * Connect cloud storage provider
   */
  async connectCloud(providerName) {
    // Simulate API connection latency
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    this.cloudConnected = true;
    this.cloudProvider = providerName;
    
    localStorage.setItem('D.K_os_cloud_connected', 'true');
    localStorage.setItem('D.K_os_cloud_provider', providerName);

    // Ensure '/cloud' directory and its default files exist
    if (!this.vfs['/cloud']) {
      this.vfs['/cloud'] = {
        type: 'dir',
        name: 'cloud',
        children: ['cloud_backup.txt', 'notes_from_mainframe.txt'],
        updatedAt: new Date().toISOString()
      };
      this.vfs['/cloud/cloud_backup.txt'] = {
        type: 'file',
        name: 'cloud_backup.txt',
        provider: 'cloud',
        content: 'Cloud Backup System Active.\n\nAll modifications under this folder sync directly to your secure cloud cluster in real-time.',
        updatedAt: new Date().toISOString()
      };
      this.vfs['/cloud/notes_from_mainframe.txt'] = {
        type: 'file',
        name: 'notes_from_mainframe.txt',
        provider: 'cloud',
        content: 'MEMORANDUM:\nTo: Detective\nFrom: Mainframe Security Command\nSubject: Code Scene Investigations\n\nEnsure that you perform static code scans on all repositories. The neon golden lights are watching.',
        updatedAt: new Date().toISOString()
      };
    }
    
    if (this.vfs['/'] && !this.vfs['/'].children.includes('cloud')) {
      this.vfs['/'].children.push('cloud');
    }

    // Sync all files (upgrade provider tag to hybrid)
    Object.keys(this.vfs).forEach(key => {
      if (this.vfs[key].type === 'file') {
        if (key.startsWith('/cloud/')) {
          this.vfs[key].provider = 'cloud';
        } else {
          this.vfs[key].provider = 'hybrid';
        }
      }
    });

    this.saveToDisk();
    this.notifySync('CLOUD_CONNECTED', providerName);
  }

  /**
   * Disconnect cloud storage provider
   */
  disconnectCloud() {
    this.cloudConnected = false;
    this.cloudProvider = null;

    localStorage.setItem('D.K_os_cloud_connected', 'false');
    localStorage.removeItem('D.K_os_cloud_provider');

    // Remove '/cloud' from '/' children
    if (this.vfs['/'] && this.vfs['/'].children) {
      this.vfs['/'].children = this.vfs['/'].children.filter(name => name !== 'cloud');
    }

    // Delete '/cloud' and all files inside it
    Object.keys(this.vfs).forEach(key => {
      if (key === '/cloud' || key.startsWith('/cloud/')) {
        delete this.vfs[key];
      }
    });

    // Revert all files back to local
    Object.keys(this.vfs).forEach(key => {
      if (this.vfs[key].type === 'file') {
        this.vfs[key].provider = 'local';
      }
    });

    this.saveToDisk();
    this.notifySync('CLOUD_DISCONNECTED', null);
  }

  /**
   * Simulates asynchronous background cloud synchronization
   */
  simulateCloudSync(path, operation) {
    this.notifySync('SYNCING', path);
    
    setTimeout(() => {
      if (this.cloudConnected) {
        this.notifySync(`SYNC_COMPLETE_${operation}`, path);
      }
    }, 2000);
  }

  /**
   * Get Storage Metrics
   */
  getStorageMetrics() {
    const fileKeys = Object.keys(this.vfs).filter(key => this.vfs[key].type === 'file');
    let totalBytes = 0;
    let localCount = 0;
    let cloudCount = 0;

    fileKeys.forEach(key => {
      const file = this.vfs[key];
      totalBytes += file.content.length;
      if (file.provider === 'local') localCount++;
      if (file.provider === 'cloud') cloudCount++;
      if (file.provider === 'hybrid') {
        localCount++;
        cloudCount++;
      }
    });

    return {
      totalBytes,
      fileCount: fileKeys.length,
      localCount,
      cloudCount,
      cloudConnected: this.cloudConnected,
      cloudProvider: this.cloudProvider,
      localCapacityBytes: 5 * 1024 * 1024, // 5MB LocalStorage limit
      cloudCapacityBytes: 15 * 1024 * 1024 * 1024 // 15GB Dropbox/Drive limit
    };
  }
}

export const storageService = new StorageService();
