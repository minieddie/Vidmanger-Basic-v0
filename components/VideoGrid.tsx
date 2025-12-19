import React, { useState, useMemo } from 'react';
import { VideoAsset } from '../types';
import { Play, Search, Shuffle, FileVideo } from 'lucide-react';

interface VideoGridProps {
  videos: VideoAsset[];
  collectionName: string;
  onPlay: (video: VideoAsset) => void;
  onSelect: (video: VideoAsset) => void;
  onShuffle: () => void;
  selectedTags: string[]; // passed for filtering logic
}

const VideoGrid: React.FC<VideoGridProps> = ({ videos, collectionName, onPlay, onSelect, onShuffle, selectedTags }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [columnCount, setColumnCount] = useState(4);

  // Filter videos (Search + Tags)
  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchesSearch = v.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            v.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      // Logic: AND relationship for tags
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => v.metadata.tags.includes(tag));
      
      return matchesSearch && matchesTags;
    });
  }, [videos, searchQuery, selectedTags]);

  const getColumnClass = () => {
      // Mapping slider 1-6 to tailwind column classes
      switch(columnCount) {
          case 1: return 'columns-1';
          case 2: return 'columns-2';
          case 3: return 'columns-3';
          case 4: return 'columns-2 md:columns-3 lg:columns-4';
          case 5: return 'columns-2 md:columns-4 lg:columns-5';
          case 6: return 'columns-3 md:columns-5 lg:columns-6';
          default: return 'columns-2 md:columns-3 lg:columns-4';
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 overflow-hidden">
      {/* Header / Toolbar */}
      <div className="p-6 pb-2 shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
             {collectionName} <span className="text-sm font-normal text-gray-500">({filteredVideos.length} videos)</span>
          </h2>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1 border border-gray-800">
               <span className="text-xs text-gray-500 pl-2">Columns</span>
               <input 
                 type="range" 
                 min="1" 
                 max="6" 
                 step="1" 
                 value={columnCount} 
                 onChange={(e) => setColumnCount(parseInt(e.target.value))}
                 className="w-24 accent-primary"
               />
            </div>
            
            <button 
              onClick={onShuffle}
              disabled={filteredVideos.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shuffle size={18} />
              <span>Shuffle Play</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-200 focus:outline-none focus:border-primary placeholder-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Grid / Masonry */}
      <div className="flex-1 overflow-y-auto p-6 pt-2">
        {filteredVideos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <FileVideo size={64} className="mb-4 opacity-20" />
            <p>No videos found matching your criteria.</p>
          </div>
        ) : (
          <div className={`${getColumnClass()} gap-4 space-y-4 pb-20`}>
            {filteredVideos.map(video => (
              <div 
                key={video.id} 
                className="group relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 hover:-translate-y-1 cursor-pointer break-inside-avoid"
                onClick={() => onSelect(video)}
              >
                {/* Thumbnail Container - Let image dictate height */}
                <div className="w-full relative bg-gray-950">
                   {video.thumbnailUrl ? (
                     <img 
                       src={video.thumbnailUrl} 
                       alt={video.metadata.title} 
                       className="w-full h-auto block"
                       loading="lazy"
                     />
                   ) : (
                     <div className="w-full aspect-video flex items-center justify-center text-gray-700">
                       <FileVideo size={40} />
                     </div>
                   )}
                   
                   {/* Overlay Play Button */}
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onPlay(video); }}
                        className="bg-primary hover:bg-primary-hover text-white p-3 rounded-full shadow-lg transform transition hover:scale-110"
                      >
                        <Play size={24} fill="white" />
                      </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoGrid;