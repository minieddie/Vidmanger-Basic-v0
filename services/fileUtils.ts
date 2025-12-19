import { VideoAsset, VideoMetadata, SUPPORTED_EXTENSIONS, SUBTITLE_EXTENSIONS } from "../types";

export const generateUUID = () => crypto.randomUUID();

export const isVideoFile = (file: File) => {
  return SUPPORTED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
};

export const isSubtitleFile = (file: File) => {
  return SUBTITLE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
};

export const srtToVtt = (srtContent: string): string => {
  // Simple SRT to WebVTT converter
  let vtt = "WEBVTT\n\n";
  
  // Normalize line endings
  let text = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Regex to match timestamp lines: 00:00:00,000 --> 00:00:00,000
  // VTT uses dots instead of commas for milliseconds
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  
  vtt += text;
  return vtt;
};

export const assToVtt = (assContent: string): string => {
  let vtt = "WEBVTT\n\n";
  const lines = assContent.split(/\r?\n/);
  
  // Helper to find Nth comma
  const findNthOccurrence = (str: string, char: string, n: number) => {
      let index = -1;
      for (let i = 0; i < n; i++) {
          index = str.indexOf(char, index + 1);
          if (index === -1) break;
      }
      return index;
  };

  for (const line of lines) {
    if (line.startsWith('Dialogue:')) {
       // Format usually: Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
       // Start=1, End=2. Text is everything after 9th comma.
       
       const firstComma = line.indexOf(',');
       if (firstComma === -1) continue;

       const rest = line.substring(firstComma + 1);
       const parts = rest.split(',');
       
       if (parts.length >= 9) {
          const start = parts[1]; // 0:00:05.00
          const end = parts[2];   // 0:00:07.00
          
          // Reconstruct text (handle commas in dialogue)
          const textStartIdx = findNthOccurrence(rest, ',', 9); 
          let text = "";
          if (textStartIdx !== -1) {
             text = rest.substring(textStartIdx + 1);
          } else {
             text = parts.slice(9).join(',');
          }
          
          // Cleanup ASS text formatting like {\an8} or \N
          text = text.replace(/{[^}]+}/g, ''); // remove tags
          text = text.replace(/\\N/g, '\n');   // replace newlines
          text = text.replace(/\\n/g, '\n'); 
          
          // Convert Time: H:MM:SS.cc -> HH:MM:SS.mmm
          const formatTime = (t: string) => {
             const parts = t.split('.');
             const hms = parts[0];
             const cs = parts[1] || '00';
             // WebVTT requires 3 digit ms, ASS usually has 2 (centiseconds)
             return `${hms}.${cs.padEnd(3, '0')}`;
          }

          vtt += `${formatTime(start)} --> ${formatTime(end)}\n${text}\n\n`;
       }
    }
  }
  return vtt;
};

export const parseNFO = async (file: File): Promise<Partial<VideoMetadata>> => {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  
  const title = xmlDoc.querySelector("title")?.textContent || "";
  const plot = xmlDoc.querySelector("plot")?.textContent || xmlDoc.querySelector("outline")?.textContent || "";
  const tags = Array.from(xmlDoc.querySelectorAll("genre")).map(el => el.textContent || "").filter(Boolean);
  
  // Also check for 'tag' element
  xmlDoc.querySelectorAll("tag").forEach(el => {
      if(el.textContent) tags.push(el.textContent);
  });

  return { title, plot, tags };
};

// Generates a thumbnail from a video file at a random position (10%-90%)
export const generateVideoThumbnail = async (videoFile: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    
    // Safety timeout
    const timeout = setTimeout(() => {
       resolve(""); // Fail silently/empty
    }, 5000);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    
    // Create a temporary URL
    const url = URL.createObjectURL(videoFile);
    video.src = url;

    video.onloadedmetadata = () => {
      // Seek to random position between 10% and 90%
      const duration = video.duration;
      const randomTime = duration * 0.1 + (Math.random() * (duration * 0.8));
      video.currentTime = randomTime;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } else {
        resolve("");
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve("");
    };
  });
};

export const generateNFOContent = (metadata: VideoMetadata): string => {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<movie>
  <title>${metadata.title}</title>
  <plot>${metadata.plot}</plot>
  ${metadata.tags.map(tag => `<genre>${tag}</genre>`).join('\n  ')}
</movie>`;
};