import React, { useState, useRef } from 'react';
import Experience from './components/Experience';
import PhotoManager from './components/PhotoManager';
import { AppMode, PhotoData, ExperienceRef } from './types';

function App() {
  const [loading, setLoading] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [mode, setMode] = useState<AppMode>('TREE');
  const [isPhotoManagerOpen, setPhotoManagerOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  
  const experienceRef = useRef<ExperienceRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial loader timer
  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setUiHidden(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result && experienceRef.current) {
             experienceRef.current.addPhoto(ev.target.result as string);
          }
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const handleDeletePhoto = (index: number) => {
    if (experienceRef.current) {
      experienceRef.current.removePhoto(index);
    }
  };

  const handlePhotosChange = (newPhotos: PhotoData[]) => {
    setPhotos([...newPhotos]); // Force update array reference
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-amber-50">
      
      {/* 3D Scene */}
      <Experience 
        ref={experienceRef} 
        onPhotosChange={handlePhotosChange} 
        onModeChange={setMode}
      />

      {/* Loading Screen */}
      <div className={`absolute inset-0 z-50 bg-black flex flex-col items-center justify-center transition-opacity duration-1000 pointer-events-none ${loading ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-10 h-10 border border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-6"></div>
        <div className="text-amber-400 tracking-[0.3em] uppercase text-sm font-light">Loading Holiday Magic</div>
      </div>

      {/* Main UI Overlay */}
      <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-500 flex flex-col justify-between p-6 md:p-10 ${uiHidden ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Top Bar: Help & Title */}
        <div className="flex flex-col md:flex-row justify-between items-start w-full">
          {/* Left: Help Panel */}
          <div className="bg-black/60 backdrop-blur-sm border border-amber-500/30 p-5 rounded-lg max-w-[280px] pointer-events-auto transform transition-transform hover:scale-105 origin-top-left">
            <h3 className="text-amber-400 border-b border-amber-500/50 pb-2 mb-3 text-lg font-serif">🎄 控制说明</h3>
            <div className="space-y-2 text-sm text-gray-300">
               <p><span className="inline-block bg-amber-500/20 text-amber-400 px-1 rounded mr-2">👊</span><b>握拳</b>：聚合树形</p>
               <p><span className="inline-block bg-amber-500/20 text-amber-400 px-1 rounded mr-2">🖐️</span><b>张开</b>：粒子散开</p>
               <p><span className="inline-block bg-amber-500/20 text-amber-400 px-1 rounded mr-2">🤏</span><b>捏夹</b>：照片聚焦</p>
               <hr className="border-amber-500/30 my-2"/>
               <p className="text-xs text-gray-400">当前模式: <span className="text-amber-300 font-bold">{mode}</span></p>
               <p className="text-xs text-gray-500 mt-2">按 'H' 隐藏界面</p>
            </div>
          </div>

          {/* Center: Title */}
          <div className="absolute top-10 left-0 w-full flex justify-center pointer-events-none">
             <h1 className="text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-amber-400 font-serif tracking-widest text-center drop-shadow-[0_0_15px_rgba(252,238,167,0.5)]" style={{ fontFamily: 'Cinzel, serif' }}>
               冰冰冰淇淋的圣诞树
             </h1>
          </div>

          {/* Right: Upload Actions */}
          <div className="pointer-events-auto flex flex-col items-end gap-3 mt-4 md:mt-0 z-20">
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
               className="px-6 py-2 bg-zinc-900/60 hover:bg-amber-500 hover:text-black border border-amber-500/40 text-amber-400 uppercase tracking-widest text-xs transition-all duration-300 backdrop-blur-sm"
             >
               上传照片
             </button>
             <p className="text-[10px] text-amber-500/50 uppercase tracking-wider">Add Your Memories</p>
          </div>
        </div>

        {/* Bottom Bar: Manager & Status */}
        <div className="flex justify-between items-end w-full">
           <button 
              onClick={() => setPhotoManagerOpen(true)}
              className="pointer-events-auto px-6 py-3 bg-zinc-900/60 hover:bg-amber-500 hover:text-black border border-amber-500/40 text-amber-400 uppercase tracking-widest text-xs transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]"
           >
             管理照片 ({photos.length})
           </button>
           
           <div className="text-[10px] text-gray-500 font-mono">
             v2.1 | Bingbing Edition
           </div>
        </div>
      </div>

      {/* Photo Manager Modal */}
      <PhotoManager 
        isOpen={isPhotoManagerOpen}
        onClose={() => setPhotoManagerOpen(false)}
        photos={photos}
        onDelete={handleDeletePhoto}
      />
    </div>
  );
}

export default App;