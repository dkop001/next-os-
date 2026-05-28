import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Folder, FileText, HardDrive, Cloud, User, LogOut, Users, Plus, Send, Inbox } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { storageService } from '../services/storageService';
import { supabaseStorageService } from '../services/supabaseStorageService';
import './FileExplorerApp.css';

const FileExplorerApp = () => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // login, signup, create_profile
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Explorer State
  const [currentView, setCurrentView] = useState('local'); // local, personal, workspace_<id>, invites
  const [currentPath, setCurrentPath] = useState('/'); // for local only right now, cloud is flat for simplicity
  const [files, setFiles] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [invites, setInvites] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  
  const [viewingFile, setViewingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');

  // Modals
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkProfile = async (userId) => {
    try {
      const prof = await supabaseStorageService.getProfile(userId);
      if (prof) {
        setProfile(prof);
        loadUserData();
      } else {
        setAuthMode('create_profile');
      }
    } catch(e) {
      console.error(e);
      setAuthMode('create_profile');
    }
  };

  const loadUserData = async () => {
    try {
      const wks = await supabaseStorageService.getWorkspaces();
      setWorkspaces(wks);
      const invs = await supabaseStorageService.getInvites();
      setInvites(invs);
    } catch(e) {
      console.error('Error loading user data:', e);
    }
  };

  useEffect(() => {
    if (profile) {
      loadDirectory();
    }
  }, [currentView, currentPath, profile]);

  const loadDirectory = async () => {
    setLoading(true);
    try {
      if (currentView === 'local') {
        const localFiles = await storageService.listDir(currentPath);
        setFiles(localFiles);
      } else if (currentView === 'personal') {
        const pFiles = await supabaseStorageService.listPersonalFiles();
        setFiles(pFiles);
      } else if (currentView?.startsWith('workspace_')) {
        const wid = currentView?.split('_')?.[1];
        const wFiles = await supabaseStorageService.listWorkspaceFiles(wid);
        setFiles(wFiles);
      } else if (currentView === 'invites') {
        setFiles([]); // Invites handled in UI separately
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else if (authMode === 'create_profile') {
        await supabaseStorageService.createProfile(session.user.id, username);
        const prof = await supabaseStorageService.getProfile(session.user.id);
        setProfile(prof);
        loadUserData();
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentView('local');
    setCurrentPath('/');
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    setLoading(true);
    try {
      await supabaseStorageService.createWorkspace(newWorkspaceName);
      await loadUserData();
      setShowNewWorkspace(false);
      setNewWorkspaceName('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openInviteModal = async (wid) => {
    setActiveWorkspaceId(wid);
    setShowInviteModal(true);
    try {
      const profs = await supabaseStorageService.getAllProfiles(session.user.id);
      setAllProfiles(profs);
    } catch (e) {
      console.error(e);
    }
  };

  const sendInvite = async (inviteeId) => {
    try {
      await supabaseStorageService.sendInvite(activeWorkspaceId, inviteeId);
      alert('Invite sent!');
    } catch(e) {
      console.error(e);
      alert('Error sending invite or already invited.');
    }
  };

  const handleInviteResponse = async (inviteId, workspaceId, accept) => {
    setLoading(true);
    try {
      if (accept) {
        await supabaseStorageService.acceptInvite(inviteId, workspaceId);
      } else {
        await supabaseStorageService.declineInvite(inviteId);
      }
      await loadUserData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (file) => {
    if (file.type === 'dir' && currentView === 'local') {
      setCurrentPath(file.path || currentPath + '/' + file.name);
    } else if (file.type === 'file') {
      setLoading(true);
      try {
        let content = '';
        if (currentView === 'local') {
          content = await storageService.readFile(file.path);
        } else if (currentView === 'personal') {
          content = await supabaseStorageService.readPersonalFile(file.name);
        } else if (currentView?.startsWith('workspace_')) {
          const wid = currentView?.split('_')?.[1];
          content = await supabaseStorageService.readWorkspaceFile(wid, file.name);
        }
        setFileContent(content);
        setViewingFile(file);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatSize = (bytes = 0) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderAuthView = () => (
    <div className="fe-auth-view">
      <div className="fe-auth-box">
        <h2 className="fe-auth-title">O.S NEURAL LINK</h2>
        {authError && <div className="fe-error">{authError}</div>}
        
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {authMode === 'create_profile' ? (
            <>
              <div style={{color: '#00f3ff', fontSize: '0.9rem'}}>Set your unique identity handle for Multiplayer Networking:</div>
              <input
                type="text"
                placeholder="Unique Username"
                className="fe-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </>
          ) : (
            <>
              <input
                type="email"
                placeholder="Identity Alias (Email)"
                className="fe-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Security Passkey"
                className="fe-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </>
          )}
          
          <button type="submit" className="fe-btn" disabled={loading}>
            {loading ? 'SYNCING...' : 
              (authMode === 'login' ? 'INITIALIZE LOGIN' : 
               authMode === 'signup' ? 'REGISTER IDENTITY' : 'CREATE ALIAS')}
          </button>
        </form>

        {authMode !== 'create_profile' && (
          <button 
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            style={{ background: 'none', border: 'none', color: 'rgba(0, 243, 255, 0.6)', cursor: 'pointer', fontSize: '0.8rem', marginTop: '10px' }}
          >
            {authMode === 'login' ? 'Create new Neural Identity' : 'Existing Identity Login'}
          </button>
        )}
      </div>
    </div>
  );

  const renderMainView = () => {
    return (
      <div className="fe-main-view">
      <div className="fe-sidebar">
        <div className="fe-sidebar-header">SYSTEM STORAGE</div>
        <div 
          className={`fe-nav-item ${currentView === 'local' ? 'active' : ''}`}
          onClick={() => setCurrentView('local')}
        >
          <HardDrive className="fe-nav-icon" />
          <span>Local Volume</span>
        </div>
        
        <div className="fe-sidebar-header" style={{ marginTop: '10px' }}>CLOUD NETWORKS</div>
        <div 
          className={`fe-nav-item ${currentView === 'personal' ? 'active' : ''}`}
          onClick={() => setCurrentView('personal')}
        >
          <Cloud className="fe-nav-icon" />
          <span>Personal Drive</span>
        </div>

        <div className="fe-sidebar-header" style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          WORKSPACES
          <button className="fe-icon-btn" onClick={() => setShowNewWorkspace(true)} title="Create Workspace"><Plus size={14}/></button>
        </div>
        {workspaces.map(w => (
          <div key={w.id} style={{ display: 'flex', alignItems: 'center' }} className={`fe-nav-item ${currentView === `workspace_${w.id}` ? 'active' : ''}`}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setCurrentView(`workspace_${w.id}`)}>
              <Users className="fe-nav-icon" />
              <span>{w.name}</span>
            </div>
            <button className="fe-icon-btn" onClick={(e) => { e.stopPropagation(); openInviteModal(w.id); }} title="Invite Users">
              <Send size={14}/>
            </button>
          </div>
        ))}

        <div 
          className={`fe-nav-item ${currentView === 'invites' ? 'active' : ''}`}
          onClick={() => setCurrentView('invites')}
          style={{ marginTop: '10px' }}
        >
          <Inbox className="fe-nav-icon" />
          <span>Invites {invites.length > 0 && `(${invites.length})`}</span>
        </div>

        <div className="fe-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: '#00f3ff', fontSize: '0.8rem' }}>
            <User size={16} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.username}</span>
          </div>
          <button className="fe-logout-btn" onClick={handleLogout}>
            <LogOut size={14} style={{ marginRight: '5px' }} /> TERMINATE UPLINK
          </button>
        </div>
      </div>

      <div className="fe-content">
        <div className="fe-path-bar">
          <span className="fe-path-text">
            {currentView === 'local' ? `LOCAL ${currentPath}` : 
             currentView === 'personal' ? 'CLOUD / Personal Drive' : 
             currentView === 'invites' ? 'SYSTEM / Pending Invites' :
             `WORKSPACE / ${workspaces.find(w => w.id === currentView?.split('_')?.[1])?.name || 'Unknown'}`}
          </span>
          {loading && <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#00ffaa', animation: 'pulse-dot 1.5s infinite' }}>SCANNING...</span>}
        </div>
        
        {currentView === 'invites' ? (
          <div className="fe-invites-container">
            {invites.length === 0 ? (
              <div style={{ color: 'rgba(0, 243, 255, 0.4)', textAlign: 'center', marginTop: '40px' }}>NO PENDING INVITES</div>
            ) : (
              invites.map(inv => (
                <div key={inv.id} className="fe-invite-card">
                  <div>
                    <div style={{ color: '#00f3ff', fontWeight: 'bold' }}>{(Array.isArray(inv.workspaces) ? inv.workspaces[0]?.name : inv.workspaces?.name) || 'Unknown Workspace'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(0,243,255,0.6)' }}>Invited to join this workspace</div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="fe-btn" style={{ padding: '5px 15px' }} onClick={() => handleInviteResponse(inv.id, inv.workspace_id, true)}>Accept</button>
                    <button className="fe-logout-btn" style={{ padding: '5px 15px', width: 'auto' }} onClick={() => handleInviteResponse(inv.id, inv.workspace_id, false)}>Decline</button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="fe-file-grid">
            {files.map((file, i) => (
              <motion.div 
                key={i}
                className="fe-file-item"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openFile(file)}
              >
                {file.type === 'dir' ? <Folder className="fe-file-icon" /> : <FileText className="fe-file-icon" />}
                <div className="fe-file-name" title={file.name}>{file.name}</div>
                <div className="fe-file-meta">{file.type === 'dir' ? 'Directory' : formatSize(file.size)}</div>
              </motion.div>
            ))}
            {files.length === 0 && !loading && (
              <div style={{ color: 'rgba(0, 243, 255, 0.4)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '40px' }}>
                NO DATA CLUSTERS DETECTED
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewWorkspace && (
        <div className="fe-viewer-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="fe-auth-box">
            <h3 style={{ margin: 0, color: '#00f3ff' }}>INITIALIZE WORKSPACE</h3>
            <input 
              className="fe-input" 
              placeholder="Workspace Name" 
              value={newWorkspaceName} 
              onChange={e => setNewWorkspaceName(e.target.value)} 
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="fe-logout-btn" onClick={() => setShowNewWorkspace(false)}>CANCEL</button>
              <button className="fe-btn" onClick={createWorkspace}>CREATE</button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fe-viewer-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="fe-auth-box" style={{ maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: 0, color: '#00f3ff' }}>INVITE NEURAL IDENTITIES</h3>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }}>
              {allProfiles.length === 0 ? <div style={{ color: '#fff' }}>No other identities found.</div> : 
                allProfiles.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,243,255,0.05)', padding: '10px', borderRadius: '4px' }}>
                    <span style={{ color: '#00f3ff' }}>@{p.username}</span>
                    <button className="fe-btn" style={{ padding: '5px 15px', width: 'auto' }} onClick={() => sendInvite(p.id)}>Invite</button>
                  </div>
                ))
              }
            </div>
            <button className="fe-logout-btn" onClick={() => setShowInviteModal(false)}>CLOSE</button>
          </div>
        </div>
      )}

      {viewingFile && (
        <motion.div 
          className="fe-viewer-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="fe-viewer-header">
            <div className="fe-viewer-title">{viewingFile.name}</div>
            <button className="fe-viewer-close" onClick={() => { setViewingFile(null); setFileContent(''); }}>×</button>
          </div>
          <div className="fe-viewer-content">
            {fileContent}
          </div>
        </motion.div>
      )}
    </div>
    );
  };

  if (!session) {
    return renderAuthView();
  }

  if (session && !profile && authMode === 'create_profile') {
    return renderAuthView();
  }

  return renderMainView();
};

export default FileExplorerApp;
