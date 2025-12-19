import React, { useEffect, useRef, useState } from 'react';
import { VideoAsset } from '../types';
import { X, SkipForward, Play, Pause, Volume2, VolumeX, Settings, Subtitles, Mic, Maximize, Minimize, Info } from 'lucide-react';
import { srtToVtt, assToVtt } from '../services/fileUtils';

interface PlayerOverlayProps {
  video: VideoAsset | null;
  onClose: () => void;
  onNextRandom: () => void;
  hasQueue: boolean;
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const PlayerOverlay: React.FC<PlayerOverlayProps> = ({ video, onClose, onNextRandom, hasQueue }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Tracks State
  const [subtitles, setSubtitles] = useState<{label: string, url: string, lang: string}[]>([]);
  const [audioTracks, setAudioTracks] = useState<{id: string, label: string}[]>([]);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(-1); // -1 is off
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Reset state on video change
    setSubtitles([]);
    setAudioTracks([]);
    setActiveSubtitleIndex(-1);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setShowSettings(false);

    if (video && videoRef.current) {
      // 1. Load Video
      let objectUrl = '';
      if (video.fileHandle) {
        objectUrl = URL.createObjectURL(video.fileHandle);
        videoRef.current.src = objectUrl;
        videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      } else {
        alert("Video file not accessible. Please use 'Update Paths' to re-link files.");
        onClose();
        return;
      }

      // 2. Load Subtitles
      const loadSubs = async () => {
         const subs: {label: string, url: string, lang: string}[] = [];
         
         for (const subFile of video.subtitles) {
            let url = '';
            const fileName = subFile.fileHandle.name.toLowerCase();
            const text = await subFile.fileHandle.text();
            let vttText = "";

            // Convert formats
            if (fileName.endsWith('.srt')) {
               vttText = srtToVtt(text);
            } else if (fileName.endsWith('.ass') || fileName.endsWith('.ssa')) {
               vttText = assToVtt(text);
            } else {
               // Assume VTT
               url = URL.createObjectURL(subFile.fileHandle);
            }

            if (vttText) {
               const blob = new Blob([vttText], { type: 'text/vtt' });
               url = URL.createObjectURL(blob);
            } else if (!url) {
               // Fallback if assumption matched nothing but should have been VTT
               url = URL.createObjectURL(subFile.fileHandle);
            }
            
            subs.push({
               label: subFile.label,
               lang: subFile.language,
               url
            });
         }
         setSubtitles(subs);
      };
      loadSubs();

      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        // Revoke subtitle URLs
        subtitles.forEach(s => URL.revokeObjectURL(s.url));
      };
    }
  }, [video]);

  // Audio Tracks Detection (Browser Support Dependent)
  useEffect(() => {
     if(videoRef.current) {
        // @ts-ignore - audioTracks is not in standard TS lib for HTMLVideoElement
        const tracks = videoRef.current.audioTracks;
        if(tracks) {
           const arr = [];
           for(let i=0; i<tracks.length; i++) {
              arr.push({ id: i.toString(), label: tracks[i].label || `Audio Track ${i+1} (${tracks[i].language})` });
           }
           if (arr.length > 0) setAudioTracks(arr);
        }
     }
  }, [videoRef.current?.src]); 

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if specific inputs are focused (future proofing)
      
      switch(e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (videoRef.current) {
             videoRef.current.currentTime += 10;
             showControls();
          }
          break;
        case 'ArrowLeft':
          if (videoRef.current) {
            videoRef.current.currentTime -= 10;
            showControls();
          }
          break;
        case 'Escape':
          if (document.fullscreenElement) {
             document.exitFullscreen();
          } else {
             onClose();
          }
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fullscreen event listener
  useEffect(() => {
    const handleFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
          try {
              await containerRef.current.requestFullscreen();
          } catch(e) { console.error(e); }
      } else {
          if (document.exitFullscreen) await document.exitFullscreen();
      }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setCurrentTime(curr);
      setDuration(dur);
      if (dur > 0) {
        setProgress((curr / dur) * 100);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      setProgress(parseFloat(e.target.value));
      setCurrentTime(time);
    }
  };

  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      // Keep controls visible in fullscreen if paused or settings open, otherwise hide
      if (isPlaying && !showSettings && document.fullscreenElement) {
          // Implementing fade out for cursor/controls in fullscreen could go here
      }
    }, 3000);
  };

  const handleMouseMove = () => {
    showControls();
  };

  const toggleSubtitle = (index: number) => {
      setActiveSubtitleIndex(index);
  };

  const toggleAudio = (index: number) => {
     if(videoRef.current) {
        // @ts-ignore
        const tracks = videoRef.current.audioTracks;
        if(tracks) {
           for(let i=0; i<tracks.length; i++) {
              tracks[i].enabled = (i === index);
           }
        }
     }
  };

  if (!video) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between group"
      onMouseMove={handleMouseMove}
    >
      {/* Main Video Area */}
      <div className="flex-1 relative min-h-0 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            className="max-w-full max-h-full w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={hasQueue ? onNextRandom : undefined}
            onClick={togglePlay}
            crossOrigin="anonymous" 
          >
              {subtitles.map((sub, idx) => (
                  <track 
                    key={sub.url} 
                    kind="subtitles" 
                    label={sub.label} 
                    src={sub.url} 
                    srcLang={sub.lang} 
                    default={idx === activeSubtitleIndex}
                    ref={el => {
                        if(el && el.track) {
                            el.track.mode = (idx === activeSubtitleIndex) ? 'showing' : 'hidden';
                        }
                    }}
                  />
              ))}
          </video>

          {/* Top Bar - Header (Keep as overlay for cleaner look, fades out) */}
          <div className={`absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 pointer-events-none ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className="text-white drop-shadow-md pointer-events-auto">
              <h2 className="text-lg font-bold">{video.metadata.title || video.fileName}</h2>
            </div>
            <button onClick={onClose} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition pointer-events-auto">
              <X size={24} />
            </button>
          </div>

          {/* Settings Modal (Anchored to bottom right of video area) */}
          {showSettings && (
              <div className="absolute bottom-4 right-4 bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl w-72 text-sm text-gray-200 z-50">
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2 font-semibold text-white border-b border-gray-700 pb-1">
                      <Subtitles size={16} /> Subtitles
                    </div>
                    {/* Warning for MKV without external subs */}
                    {video.fileName.toLowerCase().endsWith('.mkv') && subtitles.length === 0 && (
                      <div className="flex items-start gap-2 p-2 mb-2 bg-yellow-900/30 text-yellow-500 rounded text-xs border border-yellow-900/50">
                        <Info size={14} className="mt-0.5 shrink-0" />
                        <span>Browser limitation: Cannot read internal MKV subtitles. Please add external .srt/.ass files.</span>
                      </div>
                    )}
                    
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      <button 
                        onClick={() => toggleSubtitle(-1)} 
                        className={`w-full text-left px-2 py-1 rounded hover:bg-gray-800 ${activeSubtitleIndex === -1 ? 'text-primary' : ''}`}
                      >
                        Off
                      </button>
                      {subtitles.length === 0 && <div className="text-gray-500 px-2 italic">No external subtitles found</div>}
                      {subtitles.map((sub, idx) => (
                          <button 
                            key={idx}
                            onClick={() => toggleSubtitle(idx)} 
                            className={`w-full text-left px-2 py-1 rounded hover:bg-gray-800 ${activeSubtitleIndex === idx ? 'text-primary' : ''}`}
                          >
                            {sub.label}
                          </button>
                      ))}
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-2 font-semibold text-white border-b border-gray-700 pb-1">
                      <Mic size={16} /> Audio
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {audioTracks.length === 0 && <div className="text-gray-500 px-2 italic">Default Track (Switching not supported)</div>}
                      {audioTracks.map((track, idx) => (
                          <button 
                            key={track.id}
                            onClick={() => toggleAudio(idx)}
                            className="w-full text-left px-2 py-1 rounded hover:bg-gray-800"
                          >
                            {track.label}
                          </button>
                      ))}
                    </div>
                </div>
              </div>
          )}
      </div>

      {/* Controls Bar (Footer) - Dedicated space, never covers video */}
      <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-6 py-4 flex flex-col gap-2 z-40">
        
        {/* Progress Bar & Time */}
        <div className="flex items-center gap-4">
           <span className="text-xs font-mono text-gray-400 w-20 text-right shrink-0">
              {formatTime(currentTime)}
           </span>
           <input 
             type="range" 
             min="0" 
             max="100" 
             value={progress} 
             onChange={handleSeek}
             className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary hover:h-2 transition-all"
           />
           <span className="text-xs font-mono text-gray-400 w-20 shrink-0">
              {formatTime(duration)}
           </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-6">
            <button onClick={togglePlay} className="text-white hover:text-primary transition p-1">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            
            <div className="flex items-center gap-3 group/vol">
              <button 
                onClick={() => {
                  const newMuted = !isMuted;
                  setIsMuted(newMuted);
                  if (videoRef.current) videoRef.current.muted = newMuted;
                }} 
                className="text-gray-400 hover:text-white transition"
              >
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = (val === 0);
                  }
                }}
                className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {hasQueue && (
              <button 
                onClick={onNextRandom} 
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-200 text-sm font-medium transition"
              >
                <span>Next Random</span>
                <SkipForward size={16} />
              </button>
            )}

            <button 
               onClick={() => setShowSettings(!showSettings)}
               className={`p-2 rounded-full transition ${showSettings ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
               title="Subtitle & Audio Settings"
            >
               <Settings size={20} />
            </button>
            
            <div className="w-px h-6 bg-gray-700 mx-2"></div>

            <button 
               onClick={toggleFullscreen}
               className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition"
               title="Toggle Fullscreen"
            >
               {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerOverlay;