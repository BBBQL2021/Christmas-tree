import React from 'react';
import { PhotoData } from '../types';

interface PhotoManagerProps {
  isOpen: boolean;
  onClose: () => void;
  photos: PhotoData[];
  onDelete: (index: number) => void;
}

const PhotoManager: React.FC<PhotoManagerProps> = ({ isOpen, onClose, photos, onDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md transition-opacity duration-300">
      <div className="w-full max-w-4xl h-[80vh] flex flex-col p-6 bg-zinc-900/50 border border-amber-500/30 rounded-lg shadow-2xl relative">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl text-amber-400 font-serif tracking-widest uppercase" style={{ fontFamily: 'Cinzel, serif' }}>
            照片回忆管理
          </h2>
          <p className="text-amber-200/50 text-xs mt-2 uppercase tracking-wider">
            Manage Your Memories
          </p>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 border border-white/5 rounded-md bg-black/40">
          {photos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-amber-200/30">
              <span className="text-5xl mb-4">🖼️</span>
              <p>暂无照片，请上传</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative group aspect-square">
                  <div className="absolute inset-0 border-2 border-amber-600/60 transform rotate-2 transition-transform group-hover:rotate-0 bg-black"></div>
                  <img 
                    src={photo.url} 
                    alt={`Memory ${index}`} 
                    className="absolute inset-0 w-full h-full object-cover p-1 transition-transform group-hover:scale-105"
                  />
                  <button
                    onClick={() => onDelete(index)}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-800 text-white rounded-full flex items-center justify-center border border-black hover:bg-red-600 transition-colors z-10 shadow-lg"
                    title="Delete"
                  >
                    ×
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-amber-100 text-[10px] py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-2 bg-transparent border border-amber-500/50 text-amber-400 hover:bg-amber-500 hover:text-black transition-all duration-300 uppercase tracking-widest text-sm font-bold"
          >
            关闭管理
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoManager;
