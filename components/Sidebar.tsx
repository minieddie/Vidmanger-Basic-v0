import React, { useState, useRef } from 'react';
import { Collection } from '../types';
import { FolderPlus, FolderOpen, Save, Upload, RefreshCw, Trash2, Box, Database, Video, Tag as TagIcon, Layers } from 'lucide-react';

interface SidebarProps {
  collections: Collection[];
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (id: string) => void;
  onImportFiles: (files: FileList) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  onRelinkFiles: (files: FileList) => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onDeleteCollection,
  onImportFiles,
  onExportData,
  onImportData,
  onRelinkFiles,
  allTags,
  selectedTags,
  onToggleTag
}) => {
  const [newCollectionName, setNewCollectionName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const relinkInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName);
      setNewCollectionName('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFiles(e.target.files);
    }
    // Reset input
    e.target.value = '';
  };

  const handleDataSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportData(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleRelinkSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onRelinkFiles(e.target.files);
    }
    e.target.value = '';
  }

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-gray-800 flex items-center gap-2">
        <Video className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold tracking-tight text-white">VidManager</h1>
      </div>

      {/* Persistence Controls */}
      <div className="p-4 space-y-2 border-b border-gray-800">
        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">System</div>
        <button onClick={onExportData} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition">
          <Save size={16} /> Save Index
        </button>
        <button onClick={() => dataInputRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition">
          <Upload size={16} /> Load Index
        </button>
         <button onClick={() => relinkInputRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-gray-800 rounded-md transition" title="Update paths for moved folders">
          <RefreshCw size={16} /> Update Paths
        </button>
        <input 
          type="file" 
          ref={dataInputRef} 
          accept=".json" 
          className="hidden" 
          onChange={handleDataSelect} 
        />
        {/* Directory picker for Relink */}
        <input 
          type="file" 
          ref={relinkInputRef} 
          className="hidden" 
          onChange={handleRelinkSelect} 
          {...{ webkitdirectory: "", directory: "" } as any} 
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Collection Management */}
        <div className="p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Collections</div>
          
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="New Collection..."
              className="flex-1 bg-gray-800 text-sm px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button onClick={handleCreate} className="bg-gray-800 hover:bg-gray-700 p-1.5 rounded border border-gray-700">
              <FolderPlus size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => onSelectCollection(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition ${selectedCollectionId === null ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            >
              <Database size={16} />
              <span>All Videos</span>
            </button>

            {collections.map(collection => (
              <div key={collection.id} className="group flex items-center gap-1">
                <button
                  onClick={() => onSelectCollection(collection.id)}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm rounded-md transition text-left overflow-hidden ${selectedCollectionId === collection.id ? 'bg-gray-800 text-white border-l-2 border-primary' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                  {collection.thumbnailUrl ? (
                    <img src={collection.thumbnailUrl} alt="" className="w-6 h-6 object-cover rounded bg-black" />
                  ) : (
                    <Layers size={16} />
                  )}
                  <span className="truncate">{collection.name}</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteCollection(collection.id); }}
                  className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tags Section */}
        {allTags.length > 0 && (
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2 flex justify-between items-center">
              <span>Tags</span>
              {selectedTags.length > 0 && (
                 <span className="text-[10px] text-primary">{selectedTags.length} active</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => onToggleTag(tag)}
                    className={`px-2 py-1 text-xs rounded-md border transition flex items-center gap-1 text-left ${
                      isSelected
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' 
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <TagIcon size={10} />
                    <span className="truncate max-w-[120px]">{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Import Button */}
      <div className="p-4 border-t border-gray-800">
        <button 
          onClick={() => {
            if (!selectedCollectionId) {
                alert("Please select or create a collection first.");
                return;
            }
            fileInputRef.current?.click();
          }} 
          disabled={!selectedCollectionId}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition ${selectedCollectionId ? 'bg-primary hover:bg-primary-hover text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
        >
          <FolderOpen size={18} />
          Import Folder
        </button>
        {/* Directory picker */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileSelect} 
          {...{ webkitdirectory: "", directory: "" } as any} 
        />
      </div>
    </div>
  );
};

export default Sidebar;