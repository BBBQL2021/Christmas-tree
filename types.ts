import * as THREE from 'three';

export type AppMode = 'TREE' | 'SCATTER' | 'FOCUS';

export interface Particle {
  mesh: THREE.Mesh | THREE.Group;
  type: 'BOX' | 'GOLD_BOX' | 'GOLD_SPHERE' | 'RED' | 'CANE' | 'DUST' | 'PHOTO';
  isDust: boolean;
  posTree: THREE.Vector3;
  posScatter: THREE.Vector3;
  baseScale: number;
  spinSpeed: THREE.Vector3;
  update: (dt: number, mode: AppMode, focusTarget: THREE.Object3D | null, cameraPos: THREE.Vector3) => void;
}

export interface PhotoData {
  id: string; // Unique ID for React key
  url: string;
}

export interface ExperienceRef {
  addPhoto: (url: string) => void;
  removePhoto: (index: number) => void;
  getPhotos: () => PhotoData[];
}
