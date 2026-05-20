export const googleDriveService = {
  getFiles: async (token) => {
    if (!token) return [];
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,size,modifiedTime)&q=trashed=false', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch Drive files');
      const data = await response.json();
      return data.files.map(f => ({
        id: f.id,
        name: f.name,
        path: `/cloud/${f.name}`,
        type: f.mimeType === 'application/vnd.google-apps.folder' ? 'dir' : 'file',
        size: parseInt(f.size || '0'),
        updatedAt: f.modifiedTime,
        provider: 'cloud'
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  
  getFileContent: async (token, fileId) => {
    if (!token) return '';
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch file content');
      return await response.text();
    } catch(e) {
      console.error(e);
      return 'Error loading file content from Google Drive.';
    }
  }
};
