import React, { useState, useRef, useEffect } from 'react';
import Experience from './components/Experience';
import PhotoManager from './components/PhotoManager';
import { AppMode, PhotoData, ExperienceRef } from './types';
import { savePhotoToDB, getAllPhotosFromDB, deletePhotoFromDB, saveAudioToDB, getAudioFromDB } from './utils/storage';

function App() {
  const [loading, setLoading] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [mode, setMode] = useState<AppMode>('TREE');
  const [isPhotoManagerOpen, setPhotoManagerOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  
  // Audio State
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const experienceRef = useRef<ExperienceRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initial loader timer & Restore data
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setUiHidden(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);

    // Load persisted photos
    getAllPhotosFromDB().then(savedPhotos => {
      if (savedPhotos.length > 0 && experienceRef.current) {
        experienceRef.current.restorePhotos(savedPhotos);
      }
    }).catch(err => console.error("Failed to load photos", err));

    // Load persisted audio
    getAudioFromDB().then(savedAudio => {
      if (savedAudio) {
        const url = URL.createObjectURL(savedAudio.blob);
        setAudioSrc(url);
      }
    }).catch(err => console.error("Failed to load audio", err));

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Handle Audio Playback Side Effects
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Audio playback interrupted or blocked:", error);
          if (error.name === "NotAllowedError") {
             setIsPlaying(false);
          }
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, audioSrc]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          if (ev.target?.result && experienceRef.current) {
             const url = ev.target.result as string;
             const id = `photo-${Date.now()}-${Math.random()}`;
             
             // Add to Scene
             experienceRef.current.addPhoto(url, id);
             
             // Save to DB
             try {
                await savePhotoToDB({ id, url, timestamp: Date.now() });
             } catch(err) {
               console.error("Failed to save photo", err);
             }
          }
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      
      setAudioSrc(url);
      setIsPlaying(true);
      
      // Save to DB
      try {
        await saveAudioToDB(file, file.name);
      } catch (err) {
        console.error("Failed to save audio", err);
      }
    }
  };

  const toggleAudio = () => {
    setIsPlaying(!isPlaying);
  };

  const handleDeletePhoto = async (index: number) => {
    const photoToDelete = photos[index];
    
    if (experienceRef.current) {
      experienceRef.current.removePhoto(index);
    }

    if (photoToDelete && photoToDelete.id) {
      try {
        await deletePhotoFromDB(photoToDelete.id);
      } catch (err) {
        console.error("Failed to delete photo from DB", err);
      }
    }
  };

  const handleClearAllPhotos = async () => {
    if (!window.confirm("确定要删除所有照片吗？此操作无法撤销。")) return;
    
    // Remove one by one to ensure scene and DB sync (simplified approach)
    // A better way would be a batch delete function, but looping works for small sets
    const photosCopy = [...photos];
    for (let i = photosCopy.length - 1; i >= 0; i--) {
      await handleDeletePhoto(i);
    }
  };

  const handlePhotosChange = (newPhotos: PhotoData[]) => {
    setPhotos([...newPhotos]); 
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-cyan-50">
      
      {/* 3D Scene */}
      <Experience 
        ref={experienceRef} 
        onPhotosChange={handlePhotosChange} 
        onModeChange={setMode}
      />
      
      {/* Hidden Audio Element */}
      <audio ref={audioRef} src={audioSrc || undefined} loop />

      {/* Loading Screen */}
      <div className={`absolute inset-0 z-50 bg-black flex flex-col items-center justify-center transition-opacity duration-1000 pointer-events-none ${loading ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-10 h-10 border border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
        <div className="text-cyan-400 tracking-[0.3em] uppercase text-sm font-light drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">冰冰冰淇淋 Loading...</div>
      </div>

      {/* Main UI Overlay */}
      <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-500 flex flex-col justify-between p-4 md:p-10 ${uiHidden ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Top Section */}
        <div className="flex flex-col w-full relative">
          
          {/* Title */}
          <div className="w-full flex justify-center pointer-events-none mt-2 md:mt-4 mb-4 md:mb-0">
             <h1 className="text-2xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-300 font-serif tracking-widest text-center drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]" style={{ fontFamily: 'Cinzel, serif' }}>
               冰冰冰淇淋的圣诞树
             </h1>
          </div>

          {/* Help Panel */}
          <div className="pointer-events-auto bg-black/60 backdrop-blur-md border border-cyan-500/30 p-3 md:p-5 rounded-lg max-w-[280px] self-start md:absolute md:top-0 md:left-0 text-xs md:text-sm transition-all opacity-80 hover:opacity-100 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <h3 className="text-cyan-300 border-b border-cyan-500/50 pb-1 mb-2 font-serif">❄️ 魔法指令</h3>
            <div className="space-y-1 text-gray-300 hidden md:block">
               <p><span className="inline-block bg-cyan-500/20 text-cyan-300 px-1 rounded mr-2">✌️</span>比耶放烟花</p>
               <p><span className="inline-block bg-cyan-500/20 text-cyan-300 px-1 rounded mr-2">👊</span>握拳聚合</p>
               <p><span className="inline-block bg-cyan-500/20 text-cyan-300 px-1 rounded mr-2">🖐️</span>张开散开</p>
               <p><span className="inline-block bg-cyan-500/20 text-cyan-300 px-1 rounded mr-2">🤏</span>捏夹聚焦</p>
               <hr className="border-cyan-500/30 my-2"/>
            </div>
            {/* Mobile abbreviated help */}
            <div className="md:hidden text-gray-400 space-x-2 flex flex-wrap">
              <span>✌️烟花</span>
              <span>👊聚合</span>
              <span>🖐️散开</span>
              <span>🤏聚焦</span>
            </div>
            <p className="text-cyan-100/70 mt-2">当前: <span className="text-cyan-300 font-bold">{mode}</span></p>
          </div>
          
          {/* Audio Controls */}
          <div className="pointer-events-auto absolute top-14 right-0 md:top-0 md:right-0 flex flex-col items-end gap-2">
            <input 
               type="file" 
               ref={audioInputRef} 
               className="hidden" 
               accept="audio/*" 
               onChange={handleAudioUpload}
            />
            <div className="flex gap-2">
              {audioSrc && (
                <button 
                  onClick={toggleAudio}
                  className="w-10 h-10 rounded-full bg-black/60 border border-cyan-500/50 text-cyan-400 flex items-center justify-center hover:bg-cyan-500/20 hover:text-white transition-all shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
              )}
              <button 
                onClick={() => audioInputRef.current?.click()}
                className="w-10 h-10 rounded-full bg-black/60 border border-cyan-500/50 text-cyan-400 flex items-center justify-center hover:bg-cyan-500/20 hover:text-white transition-all shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                title="上传背景音乐"
              >
                🎵
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-end w-full gap-4 pb-4 md:pb-0">
           
           {/* Manager Button */}
           <button 
              onClick={() => setPhotoManagerOpen(true)}
              className="pointer-events-auto w-full md:w-auto px-6 py-3 bg-cyan-950/60 hover:bg-cyan-500 hover:text-black border border-cyan-500/40 text-cyan-400 uppercase tracking-widest text-xs font-bold transition-all duration-300 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-md"
           >
             冰冰的相册 ({photos.length})
           </button>

           {/* Upload Actions */}
           <div className="pointer-events-auto flex flex-col items-end gap-2 w-full md:w-auto">
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               multiple 
               accept="image/*" 
               onChange={handleFileUpload}
             />
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-cyan-900/80 to-blue-900/80 hover:from-cyan-500 hover:to-blue-500 hover:text-white border border-cyan-500/50 text-cyan-300 uppercase tracking-widest text-xs font-bold transition-all duration-300 backdrop-blur-md rounded-md shadow-[0_0_20px_rgba(34,211,238,0.3)]"
             >
               + 上传回忆
             </button>
           </div>
        </div>

        {/* Version Tag */}
        <div className="absolute bottom-1 right-2 md:bottom-2 md:left-2 text-[8px] md:text-[10px] text-cyan-600/60 font-mono text-center md:text-left w-full md:w-auto pointer-events-none">
             Bingbing Edition
        </div>
      </div>

      {/* Photo Manager Modal */}
      <PhotoManager 
        isOpen={isPhotoManagerOpen}
        onClose={() => setPhotoManagerOpen(false)}
        photos={photos}
        onDelete={handleDeletePhoto}
        onUpload={() => fileInputRef.current?.click()}
        onClearAll={handleClearAllPhotos}
      />
    </div>
  );
}

export default App;