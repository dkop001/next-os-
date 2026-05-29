import { supabase } from './supabaseClient';

export const supabaseStorageService = {
  // --- Profiles & Workspaces ---
  getProfile: async (userId) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  createProfile: async (userId, username) => {
    const { error } = await supabase.from('profiles').insert([{ id: userId, username }]);
    if (error) throw error;
  },
  
  getAllProfiles: async (currentUserId) => {
    const { data, error } = await supabase.from('profiles').select('*').neq('id', currentUserId);
    if (error) throw error;
    return data || [];
  },

  getWorkspaces: async () => {
    const { data, error } = await supabase.from('workspaces').select('*');
    if (error) throw error;
    return data || [];
  },

  createWorkspace: async (name) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('workspaces').insert([{ name, owner_id: user.id }]).select().single();
    if (error) throw error;
    
    // add owner as member
    await supabase.from('workspace_members').insert([{ workspace_id: data.id, user_id: user.id }]);
    return data;
  },

  // --- Invites ---
  getInvites: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('workspace_invites').select('id, workspace_id, workspaces(name), inviter_id').eq('invitee_id', user.id);
    if (error) throw error;
    return data || [];
  },
  
  sendInvite: async (workspaceId, inviteeId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('workspace_invites').insert([{
      workspace_id: workspaceId,
      inviter_id: user.id,
      invitee_id: inviteeId
    }]);
    if (error) throw error;
  },
  
  acceptInvite: async (inviteId, workspaceId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: joinError } = await supabase.from('workspace_members').insert([{ workspace_id: workspaceId, user_id: user.id }]);
    if (joinError) throw joinError;
    
    await supabase.from('workspace_invites').delete().eq('id', inviteId);
  },
  
  declineInvite: async (inviteId) => {
    await supabase.from('workspace_invites').delete().eq('id', inviteId);
  },

  // --- Storage Buckets ---
  listPersonalFiles: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.storage.from('personal-drives').list(user.id);
    if (error) throw error;
    return (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({
      name: f.name,
      path: `personal/${user.id}/${f.name}`,
      type: 'file',
      size: f.metadata?.size || 0,
      updatedAt: f.created_at,
      provider: 'supabase'
    }));
  },

  listWorkspaceFiles: async (workspaceId) => {
    const { data, error } = await supabase.storage.from('workspace-drives').list(workspaceId);
    if (error) throw error;
    return (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({
      name: f.name,
      path: `workspace/${workspaceId}/${f.name}`,
      type: 'file',
      size: f.metadata?.size || 0,
      updatedAt: f.created_at,
      provider: 'supabase'
    }));
  },

  readPersonalFile: async (fileName) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.storage.from('personal-drives').download(`${user.id}/${fileName}`);
    if (error) throw error;
    return await data.text();
  },

  readWorkspaceFile: async (workspaceId, fileName) => {
    const { data, error } = await supabase.storage.from('workspace-drives').download(`${workspaceId}/${fileName}`);
    if (error) throw error;
    return await data.text();
  },

  uploadPersonalFile: async (fileName, content) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.storage.from('personal-drives').upload(`${user.id}/${fileName}`, content, { upsert: true });
    if (error) throw error;
  },

  uploadWorkspaceFile: async (workspaceId, fileName, content) => {
    const { error } = await supabase.storage.from('workspace-drives').upload(`${workspaceId}/${fileName}`, content, { upsert: true });
    if (error) throw error;
  },

  deletePersonalFile: async (fileName) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.storage.from('personal-drives').remove([`${user.id}/${fileName}`]);
    if (error) throw error;
  },

  deleteWorkspaceFile: async (workspaceId, fileName) => {
    const { error } = await supabase.storage.from('workspace-drives').remove([`${workspaceId}/${fileName}`]);
    if (error) throw error;
  }
};
