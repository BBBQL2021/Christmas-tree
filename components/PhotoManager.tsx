import React from 'react';
import { PhotoData } from '../types';

interface PhotoManagerProps {
  isOpen: boolean;
  onClose: () => void;
  photos: PhotoData[];
  onDelete: (index: number) => void;
  onUpload: () => void;
  onClearAll: () => void;
}

const PhotoManager: React.FC<PhotoManagerProps> = ({ isOpen, onClose, photos, onDelete, onUpload, onClearAll }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 md:bg-black/90 backdrop-blur-md transition-opacity duration-300">
      <div className="w-full h-full md:h-[80vh] md:max-w-4xl flex flex-col p-4 md:p-6 bg-zinc-900/50 border-none md:border md:border-cyan-500/30 md:rounded-lg shadow-[0_0_50px_rgba(6,182,212,0.15)] relative">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 md:mb-6 mt-4 md:mt-0 px-2">
          <div className="text-left">
            <h2 className="text-2xl md:text-3xl text-cyan-400 font-serif tracking-widest uppercase drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ fontFamily: 'Cinzel, serif' }}>
              冰冰的相册
            </h2>
            <p className="text-cyan-200/50 text-xs mt-1 uppercase tracking-wider">
              Bingbing's Sweet Memories
            </p>
          </div>
          <div className="flex gap-2">
            {photos.length > 0 && (
              <button 
                onClick={onClearAll}
                className="px-3 py-1 text-xs text-red-400 hover:text-red-200 border border-red-900/50 hover:bg-red-900/30 rounded transition-colors"
              >
                清空全部
              </button>
            )}
            <button 
              onClick={onUpload}
              className="px-4 py-1 text-xs text-cyan-900 bg-cyan-500 hover:bg-cyan-400 font-bold rounded shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-colors"
            >
              + 上传
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 border border-cyan-500/10 rounded-md bg-black/40 custom-scrollbar">
          {photos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-cyan-200/30">
              <span className="text-4xl md:text-5xl mb-4 opacity-50">📷</span>
              <p>暂无照片</p>
              <button onClick={onUpload} className="mt-4 px-6 py-2 border border-cyan-500/30 rounded hover:bg-cyan-500/10 text-cyan-400 transition-colors">
                点击上传第一张回忆
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative group animate-fade-in-up">
                  {/* Polaroid Style Container */}
                  <div className="bg-[#f0f0f0] p-2 pb-6 shadow-lg transform transition-transform group-hover:scale-105 group-hover:rotate-1 rotate-0 duration-300 rounded-[2px]">
                     <div className="relative aspect-square bg-gray-200 overflow-hidden">
                        <img 
                          src={photo.url} 
                          alt={`Memory ${index}`} 
                          className="w-full h-full object-cover"
                        />
                     </div>
                     <div className="text-center pt-2">
                        <p className="text-[10px] text-gray-500 font-serif" style={{ fontFamily: '"Great Vibes", cursive', fontSize: '14px' }}>
                          Sweet Memory
                        </p>
                     </div>
                  </div>

                  <button
                    onClick={() => onDelete(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10 shadow-md opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 md:mt-6 flex justify-center pb-4 md:pb-0">
          <button
            onClick={onClose}
            className="w-full md:w-auto px-8 py-3 md:py-2 bg-transparent border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all duration-300 uppercase tracking-widest text-sm font-bold rounded shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
          >
            返回圣诞树
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoManager;