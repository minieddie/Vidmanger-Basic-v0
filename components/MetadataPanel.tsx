import React, { useState, useEffect } from 'react';
import { VideoAsset } from '../types';
import { X, Wand2, Save, Download, Plus, Tag as TagIcon, Image as ImageIcon } from 'lucide-react';
import { generateVideoMetadata } from '../services/geminiService';
import { generateNFOContent } from '../services/fileUtils';

interface MetadataPanelProps {
  video: VideoAsset | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<VideoAsset['metadata']>) => void;
}

const MetadataPanel: React.FC<MetadataPanelProps> = ({ video, onClose, onUpdate }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<{title: string, plot: string, tags: string[]}>({
    title: '', plot: '', tags: []
  });
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (video) {
      setFormData({
        title: video.metadata.title || video.fileName,
        plot: video.metadata.plot,
        tags: [...video.metadata.tags]
      });
    }
  }, [video]);

  if (!video) return null;

  const handleAI = async () => {
    setIsGenerating(true);
    try {
      const result = await generateVideoMetadata(video.fileName);
      setFormData({
        title: result.title,
        plot: result.plot,
        tags: result.tags
      });
    } catch (e) {
      alert("Failed to generate metadata. Ensure API Key is set.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    onUpdate(video.id, formData);
  };

  const handleExportNFO = () => {
    const content = generateNFOContent({ ...video.metadata, ...formData });
    const blob = new Blob([content], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.fileName.substring(0, video.fileName.lastIndexOf('.')) || video.fileName}.nfo`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full shrink-0 shadow-2xl z-20">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-bold text-white">Metadata Editor</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        {/* Thumbnail Preview - Adaptive Height */}
        <div className="w-full bg-black rounded-lg overflow-hidden border border-gray-700 shadow-md">
          {video.thumbnailUrl ? (
            <img 
              src={video.thumbnailUrl} 
              alt="Thumbnail" 
              className="w-full h-auto block" 
              loading="lazy"
            />
          ) : (
            <div className="w-full aspect-video flex flex-col items-center justify-center text-gray-700 gap-2">
              <ImageIcon size={32} opacity={0.5} />
              <span className="text-xs">No Preview</span>
            </div>
          )}
        </div>

        {/* AI Action */}
        <button 
          onClick={handleAI}
          disabled={isGenerating}
          className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          <Wand2 size={16} className={isGenerating ? "animate-spin" : ""} />
          {isGenerating ? "Generating..." : "Auto-Generate Info"}
        </button>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Plot</label>
            <textarea 
              rows={4}
              value={formData.plot}
              onChange={e => setFormData({...formData, plot: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map(tag => (
                <span key={tag} className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-xs flex items-center gap-1 group">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-gray-500 hover:text-red-400"><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Add tag..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-primary focus:outline-none"
              />
              <button onClick={addTag} className="p-2 bg-gray-700 hover:bg-gray-600 rounded">
                <Plus size={16} />
              </button>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-800 space-y-3">
             <div className="text-xs text-gray-500 break-all font-mono">
               Path: {video.relativePath}
             </div>
             <div className="text-xs text-gray-500">
               Size: {(video.size / (1024 * 1024)).toFixed(2)} MB
             </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 grid grid-cols-2 gap-3">
        <button 
          onClick={handleExportNFO}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded transition"
        >
          <Download size={16} /> Export NFO
        </button>
        <button 
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded transition"
        >
          <Save size={16} /> Save Changes
        </button>
      </div>
    </div>
  );
};

export default MetadataPanel;