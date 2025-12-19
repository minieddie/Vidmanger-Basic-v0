import React, { useState, useEffect, useReducer, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import MetadataPanel from './components/MetadataPanel';
import PlayerOverlay from './components/PlayerOverlay';
import { Collection, VideoAsset, VideoMetadata } from './types';
import { generateUUID, isVideoFile, isSubtitleFile, parseNFO, generateVideoThumbnail } from './services/fileUtils';

// --- Reducer for complex state ---
type Action =
  | { type: 'ADD_COLLECTION'; payload: Collection }
  | { type: 'DELETE_COLLECTION'; payload: string }
  | { type: 'ADD_VIDEOS'; payload: VideoAsset[] }
  | { type: 'UPDATE_VIDEO'; payload: { id: string; metadata: Partial<VideoMetadata> } }
  | { type: 'LOAD_STATE'; payload: { collections: Collection[]; videos: VideoAsset[] } }
  | { type: 'UPDATE_PATHS'; payload: { files: FileList } };

const initialState = {
  collections: [] as Collection[], // Renamed from containers
  videos: [] as VideoAsset[],
};

function reducer(state: typeof initialState, action: Action) {
  switch (action.type) {
    case 'ADD_COLLECTION':
      return { ...state, collections: [...state.collections, action.payload] };
    case 'DELETE_COLLECTION':
      return {
        ...state,
        collections: state.collections.filter(c => c.id !== action.payload),
        videos: state.videos.filter(v => v.collectionId !== action.payload)
      };
    case 'ADD_VIDEOS':
      // Update collection thumbnail if needed
      const newState = { ...state, videos: [...state.videos, ...action.payload] };
      const collectionIds = Array.from(new Set(action.payload.map(v => v.collectionId)));
      const updatedCollections = state.collections.map(c => {
        if (collectionIds.includes(c.id) && !c.thumbnailUrl) {
          const video = action.payload.find(v => v.collectionId === c.id && v.thumbnailUrl);
          if (video) return { ...c, thumbnailUrl: video.thumbnailUrl };
        }
        return c;
      });
      return { ...newState, collections: updatedCollections };
    case 'UPDATE_VIDEO':
      return {
        ...state,
        videos: state.videos.map(v => 
          v.id === action.payload.id ? { ...v, metadata: { ...v.metadata, ...action.payload.metadata } } : v
        )
      };
    case 'LOAD_STATE':
      return action.payload;
    case 'UPDATE_PATHS': {
      // Re-linking logic: Match existing videos by relativePath to new Files
      // Note: Browsers using webkitdirectory give relativePath in file.webkitRelativePath
      const fileMap = new Map<string, File>();
      Array.from(action.payload.files).forEach(f => {
         // Normalized key: try to match end of path or full relative path
         fileMap.set(f.webkitRelativePath || f.name, f);
      });
      
      const relinkedVideos = state.videos.map(v => {
        // Try exact match
        let handle = fileMap.get(v.relativePath);
        // Loose match if exact fail (e.g. if root folder name changed)
        if (!handle) {
           const fileName = v.relativePath.split('/').pop();
           for(const [path, file] of fileMap.entries()) {
             if (path.endsWith(fileName || '')) {
               handle = file;
               break;
             }
           }
        }
        
        // Also re-link subtitles if possible (VideoAsset structure implies internal file storage, but we store File objects which are lost on refresh)
        // For simple re-linking, we might miss new subtitles unless we re-scan. 
        // Current implementation just re-links the main video file handle.
        // To properly re-link subtitles, we'd need to store their relative paths too.
        // For this version, let's assume relink main video is priority.
        
        return handle ? { ...v, fileHandle: handle } : v;
      });

      return { ...state, videos: relinkedVideos };
    }
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoAsset | null>(null);
  const [playerVideo, setPlayerVideo] = useState<VideoAsset | null>(null);
  const [playQueue, setPlayQueue] = useState<VideoAsset[]>([]);
  
  // Tag Filter State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Derived state: Visible Videos (Unfiltered by search/tags, but filtered by collection)
  const visibleVideos = useMemo(() => {
     return selectedCollectionId 
      ? state.videos.filter(v => v.collectionId === selectedCollectionId)
      : state.videos;
  }, [state.videos, selectedCollectionId]);

  // Derived state: All available tags in the current view
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    visibleVideos.forEach(v => v.metadata.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [visibleVideos]);

  const currentCollection = state.collections.find(c => c.id === selectedCollectionId);

  // --- Handlers ---

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCreateCollection = (name: string) => {
    dispatch({
      type: 'ADD_COLLECTION',
      payload: { id: generateUUID(), name, thumbnailUrl: null }
    });
  };

  const handleImportFiles = async (fileList: FileList) => {
    if (!selectedCollectionId) return;

    const files = Array.from(fileList);
    
    // Maps for sidecar files
    const folderImages = new Map<string, Array<{name: string, url: string}>>();
    const folderSubtitles = new Map<string, Array<File>>();

    // 1. Index images and subtitles
    for (const file of files) {
      const pathParts = file.webkitRelativePath.split('/');
      const dir = pathParts.slice(0, -1).join('/');
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')).toLowerCase();

      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        if (!folderImages.has(dir)) folderImages.set(dir, []);
        folderImages.get(dir)?.push({ name: nameWithoutExt, url });
      } else if (isSubtitleFile(file)) {
        if (!folderSubtitles.has(dir)) folderSubtitles.set(dir, []);
        folderSubtitles.get(dir)?.push(file);
      }
    }

    // 2. Process Videos
    const newVideos: VideoAsset[] = [];
    
    for (const file of files) {
      if (isVideoFile(file)) {
        const pathParts = file.webkitRelativePath.split('/');
        const dir = pathParts.slice(0, -1).join('/');
        const videoNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')).toLowerCase();

        // Determine Thumbnail
        let thumbUrl: string | undefined = undefined;
        const assetsInFolder = folderImages.get(dir) || [];

        // Priority 1: Specific filenames
        const priorityNames = ['poster', 'cover', 'folder', 'default'];
        const priorityMatch = assetsInFolder.find(asset => priorityNames.includes(asset.name));
        if (priorityMatch) thumbUrl = priorityMatch.url;

        // Priority 2: "poster" in name
        if (!thumbUrl) {
          const posterMatch = assetsInFolder.find(asset => asset.name.includes('poster'));
          if (posterMatch) thumbUrl = posterMatch.url;
        }

        // Priority 3: Exact name match
        if (!thumbUrl) {
          const exactMatch = assetsInFolder.find(asset => asset.name === videoNameWithoutExt);
          if (exactMatch) thumbUrl = exactMatch.url;
        }

        // Fallback: Generate
        if (!thumbUrl) {
          thumbUrl = await generateVideoThumbnail(file);
        }

        // Determine Subtitles
        const subsInFolder = folderSubtitles.get(dir) || [];
        const matchedSubs = subsInFolder.filter(sub => {
           const subName = sub.name.toLowerCase();
           // Exact match base name OR contains base name (e.g. movie.en.srt)
           return subName.startsWith(videoNameWithoutExt);
        });

        const subtitleTracks = matchedSubs.map(sub => {
           // Guess language from filename
           const parts = sub.name.toLowerCase().split('.');
           let lang = 'en'; // default
           if (parts.length > 2) {
               const possibleLang = parts[parts.length - 2];
               if (possibleLang.length === 2) lang = possibleLang;
           }
           return {
               label: sub.name,
               language: lang,
               fileHandle: sub
           };
        });

        // Try to find NFO
        const nfoFile = files.find(f => {
            const fName = f.name.toLowerCase();
            return f.webkitRelativePath.toLowerCase().startsWith(`${dir.toLowerCase()}/${videoNameWithoutExt}`) && fName.endsWith('.nfo');
        });

        let metadata: VideoMetadata = {
          title: file.name.substring(0, file.name.lastIndexOf('.')),
          plot: '',
          tags: []
        };

        if (nfoFile) {
          const nfoData = await parseNFO(nfoFile);
          metadata = { ...metadata, ...nfoData };
        }

        newVideos.push({
          id: generateUUID(),
          collectionId: selectedCollectionId,
          fileName: file.name,
          relativePath: file.webkitRelativePath,
          fileHandle: file,
          thumbnailUrl: thumbUrl || null,
          metadata,
          size: file.size,
          subtitles: subtitleTracks
        });
      }
    }

    dispatch({ type: 'ADD_VIDEOS', payload: newVideos });
  };

  const handleUpdatePaths = (files: FileList) => {
    dispatch({ type: 'UPDATE_PATHS', payload: { files } });
    alert("Paths updated. Please verify playback.");
  };

  const handleExportData = () => {
    // Strip fileHandles
    const dataToSave = {
      collections: state.collections,
      videos: state.videos.map(v => ({ ...v, fileHandle: null }))
    };
    const blob = new Blob([JSON.stringify(dataToSave)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vidmanager_index.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.collections && data.videos) { // Check for legacy 'containers' if strictly renaming? 
        // Support loading legacy files if needed, but assuming fresh start based on prompt "Change current app"
        dispatch({ type: 'LOAD_STATE', payload: data });
        alert("Index loaded. Please use 'Update Paths' to re-link video files.");
      } else if (data.containers) {
         // Migration for legacy saves if user has old file
         const migrated = {
             collections: data.containers.map((c: any) => ({...c, id: c.id})),
             videos: data.videos.map((v: any) => ({...v, collectionId: v.containerId, subtitles: []}))
         };
         dispatch({ type: 'LOAD_STATE', payload: migrated });
         alert("Legacy Index loaded & migrated. Please use 'Update Paths' to re-link video files.");
      } else {
        alert("Invalid file format.");
      }
    } catch (e) {
      alert("Error parsing file.");
    }
  };

  // --- Playback Logic ---

  const shuffleArray = <T,>(array: T[]): T[] => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  const startPlayback = (startVideo: VideoAsset) => {
    let scope = selectedCollectionId 
      ? state.videos.filter(v => v.collectionId === selectedCollectionId)
      : state.videos;
    
    if (selectedTags.length > 0) {
      scope = scope.filter(v => selectedTags.every(t => v.metadata.tags.includes(t)));
    }

    const others = scope.filter(v => v.id !== startVideo.id);
    const shuffled = shuffleArray(others);
    
    setPlayQueue(shuffled);
    setPlayerVideo(startVideo);
  };

  const startShuffle = () => {
    let scope = selectedCollectionId 
      ? state.videos.filter(v => v.collectionId === selectedCollectionId)
      : state.videos;
    
    if (selectedTags.length > 0) {
      scope = scope.filter(v => selectedTags.every(t => v.metadata.tags.includes(t)));
    }

    if (scope.length === 0) return;

    const shuffled = shuffleArray(scope);
    const first = shuffled[0];
    const rest = shuffled.slice(1);

    setPlayerVideo(first);
    setPlayQueue(rest);
  };

  const handleNextRandom = () => {
    if (playQueue.length === 0) {
       let scope = selectedCollectionId 
          ? state.videos.filter(v => v.collectionId === selectedCollectionId)
          : state.videos;
       if (selectedTags.length > 0) {
          scope = scope.filter(v => selectedTags.every(t => v.metadata.tags.includes(t)));
       }

       if (scope.length > 0) {
         const shuffled = shuffleArray(scope);
         setPlayerVideo(shuffled[0]);
         setPlayQueue(shuffled.slice(1));
       } else {
         setPlayerVideo(null);
       }
       return;
    }

    const next = playQueue[0];
    setPlayQueue(prev => prev.slice(1));
    setPlayerVideo(next);
  };

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden relative">
      <Sidebar 
        collections={state.collections}
        selectedCollectionId={selectedCollectionId}
        onSelectCollection={(id) => { setSelectedCollectionId(id); setSelectedTags([]); }}
        onCreateCollection={handleCreateCollection}
        onDeleteCollection={(id) => dispatch({ type: 'DELETE_COLLECTION', payload: id })}
        onImportFiles={handleImportFiles}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onRelinkFiles={handleUpdatePaths}
        allTags={allTags}
        selectedTags={selectedTags}
        onToggleTag={handleToggleTag}
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        <VideoGrid 
          videos={visibleVideos}
          collectionName={currentCollection?.name || "All Videos"}
          onPlay={startPlayback}
          onSelect={setSelectedVideo}
          onShuffle={startShuffle}
          selectedTags={selectedTags}
        />
      </div>

      {selectedVideo && (
        <MetadataPanel 
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onUpdate={(id, meta) => dispatch({ type: 'UPDATE_VIDEO', payload: { id, metadata: meta } })}
        />
      )}

      {playerVideo && (
        <PlayerOverlay 
          video={playerVideo} 
          onClose={() => setPlayerVideo(null)} 
          onNextRandom={handleNextRandom}
          hasQueue={true}
        />
      )}
    </div>
  );
}