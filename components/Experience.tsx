import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { AppMode, Particle, PhotoData, ExperienceRef } from '../types';

// --- Configuration Constants ---
const CONFIG = {
  colors: {
    bg: 0x001020, // Deep Frozen Blue Background
    vividGreen: 0x00d94b, // Electric Green
    champagneGold: 0xffeebb,
    accentRed: 0xff0033,
    iceWhite: 0xe0ffff, // Snow color
  },
  particles: {
    count: 1500,
    dustCount: 3000, 
    treeHeight: 24,
    treeRadius: 8,
  },
  camera: {
    z: 50,
  },
};

// Firework Particle Class
class FireworkParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;

  constructor(position: THREE.Vector3, color: THREE.Color) {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: 1 
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5
    );
    
    this.life = 0;
    this.maxLife = 1.0 + Math.random() * 0.5; 
  }

  update(dt: number): boolean {
    this.life += dt;
    this.velocity.y -= 2.0 * dt; 
    this.velocity.multiplyScalar(0.98);
    
    this.mesh.position.addScaledVector(this.velocity, 25 * dt);
    
    const material = this.mesh.material as THREE.MeshBasicMaterial;
    material.opacity = 1 - (this.life / this.maxLife);
    this.mesh.scale.setScalar(1 - (this.life / this.maxLife));

    return this.life < this.maxLife;
  }
}

interface Props {
  onPhotosChange: (photos: PhotoData[]) => void;
  onModeChange: (mode: AppMode) => void;
}

const Experience = forwardRef<ExperienceRef, Props>(({ onPhotosChange, onModeChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  
  // Mutable State
  const stateRef = useRef({
    mode: 'TREE' as AppMode,
    focusTarget: null as THREE.Object3D | null,
    hand: { detected: false, x: 0, y: 0 },
    rotation: { x: 0, y: 0 },
    particleSystem: [] as Particle[],
    fireworkSystem: [] as FireworkParticle[],
    photoMeshGroup: new THREE.Group(),
    scene: null as THREE.Scene | null,
    mainGroup: new THREE.Group(),
    lastFireworkTime: 0,
    frameFrontTexture: null as THREE.Texture | null, // Store the static frame texture
  });

  useImperativeHandle(ref, () => ({
    addPhoto: (url: string, existingId?: string) => {
      loadAndAddPhoto(url, existingId);
    },
    restorePhotos: (photos: PhotoData[]) => {
      photos.forEach(p => {
        loadAndAddPhoto(p.url, p.id);
      });
    },
    removePhoto: (index: number) => {
      const sys = stateRef.current.particleSystem;
      const photoParticles = sys.filter(p => p.type === 'PHOTO');
      
      if (index >= 0 && index < photoParticles.length) {
        const targetP = photoParticles[index];
        stateRef.current.photoMeshGroup.remove(targetP.mesh);
        
        const mainIndex = sys.indexOf(targetP);
        if (mainIndex > -1) sys.splice(mainIndex, 1);
        
        syncPhotos();
      }
    },
    getPhotos: () => {
      return getPhotoDataList();
    }
  }));

  const getPhotoDataList = (): PhotoData[] => {
    const photos = stateRef.current.particleSystem.filter(p => p.type === 'PHOTO');
    return photos.map((p) => {
      const mesh = p.mesh as THREE.Group;
      const photoMesh = mesh.children[1] as THREE.Mesh;
      const mat = photoMesh.material as THREE.MeshBasicMaterial;
      const tex = mat.map;
      let url = '';
      if (tex && tex.image) {
        url = tex.image.src || tex.image.currentSrc;
      }
      return { id: mesh.name, url };
    });
  };

  const syncPhotos = () => {
    if (onPhotosChange) {
      onPhotosChange(getPhotoDataList());
    }
  };

  const loadAndAddPhoto = (url: string, id?: string) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      addPhotoToScene(t, id);
      syncPhotos();
    });
  };

  const addPhotoToScene = (texture: THREE.Texture, id?: string) => {
    // --- Polaroid Geometry ---
    const frameW = 1.3;
    const frameH = 1.6; 
    const frameGeo = new THREE.BoxGeometry(frameW, frameH, 0.04);
    
    // --- Material Setup ---
    // Use a solid grey color (not full white) to prevent bloom blowout
    // when lit by bright scene lights.
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xa0a0a0, // Medium grey (appears white in bright light)
      roughness: 1.0,  // Fully rough paper
      metalness: 0.0,
      emissive: 0x000000, 
    });

    // Front Face Material (White + "Sweet Memory" Text)
    const frontMat = new THREE.MeshStandardMaterial({
      map: stateRef.current.frameFrontTexture,
      roughness: 1.0,
      metalness: 0.0, // Canvas map handles the "metallic" look via gradient
      emissive: 0x000000,
      color: 0xffffff // Map controls the color mainly
    });

    // 0:right, 1:left, 2:top, 3:bottom, 4:front, 5:back
    const materials = [
      whiteMat, // Right
      whiteMat, // Left
      whiteMat, // Top
      whiteMat, // Bottom
      frontMat, // Front (With Text)
      whiteMat  // Back
    ];

    const frame = new THREE.Mesh(frameGeo, materials);

    // Photo Area
    const photoSize = 1.1; 
    const photoGeo = new THREE.PlaneGeometry(photoSize, photoSize);
    
    const photoMat = new THREE.MeshBasicMaterial({ 
      map: texture, 
      side: THREE.DoubleSide,
      color: 0xffffff 
    });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    
    // Position: Just slightly above the frame face
    photo.position.set(0, 0.15, 0.021);

    const group = new THREE.Group();
    group.add(frame);
    group.add(photo);
    
    group.name = id || `photo-${Date.now()}-${Math.random()}`;

    const s = 1.0;
    group.scale.set(s, s, s);

    stateRef.current.photoMeshGroup.add(group);
    
    const p = new ParticleImpl(group, 'PHOTO', false);
    stateRef.current.particleSystem.push(p);
  };

  const spawnFirework = (x: number, y: number, z: number) => {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffaa00];
    const colorHex = colors[Math.floor(Math.random() * colors.length)];
    const color = new THREE.Color(colorHex);
    
    const count = 30 + Math.random() * 20;
    const center = new THREE.Vector3(x, y, z);
    
    for (let i = 0; i < count; i++) {
       const p = new FireworkParticle(center, color);
       stateRef.current.scene?.add(p.mesh);
       stateRef.current.fireworkSystem.push(p);
    }
  };

  class ParticleImpl implements Particle {
    mesh: THREE.Mesh | THREE.Group;
    type: any;
    isDust: boolean;
    posTree = new THREE.Vector3();
    posScatter = new THREE.Vector3();
    baseScale: number;
    spinSpeed: THREE.Vector3;
    fallSpeed: number;
    wobbleSpeed: number;
    wobbleDist: number;
    
    constructor(mesh: THREE.Mesh | THREE.Group, type: any, isDust = false) {
      this.mesh = mesh;
      this.type = type;
      this.isDust = isDust;
      this.baseScale = mesh.scale.x;

      const speedMult = type === 'PHOTO' ? 0.3 : 2.0;
      this.spinSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * speedMult,
        (Math.random() - 0.5) * speedMult,
        (Math.random() - 0.5) * speedMult
      );

      this.fallSpeed = 1.5 + Math.random() * 2.5;
      this.wobbleSpeed = 1.0 + Math.random();
      this.wobbleDist = 0.5 + Math.random() * 0.5;

      this.calculatePositions();

      if (this.isDust) {
        this.mesh.position.set(
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40
        );
      }
    }

    calculatePositions() {
      // Tree Shape
      const h = CONFIG.particles.treeHeight;
      const halfH = h / 2;
      let t = Math.random();
      t = Math.pow(t, 0.8);
      const y = t * h - halfH;
      let rMax = CONFIG.particles.treeRadius * (1.0 - t);
      if (rMax < 0.5) rMax = 0.5;
      const angle = t * 50 * Math.PI + Math.random() * Math.PI;
      const r = rMax * (0.8 + Math.random() * 0.4);
      this.posTree.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

      // Scatter Shape
      let rScatter = this.isDust ? 20 + Math.random() * 20 : 8 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this.posScatter.set(
        rScatter * Math.sin(phi) * Math.cos(theta),
        rScatter * Math.sin(phi) * Math.sin(theta),
        rScatter * Math.cos(phi)
      );
    }

    update(dt: number, mode: AppMode, focusTarget: THREE.Object3D | null, cameraPos: THREE.Vector3) {
      if (this.isDust) {
        if (mode === 'TREE') {
          // Falling Snow
          this.mesh.position.y -= this.fallSpeed * dt;
          
          const time = Date.now() * 0.001;
          this.mesh.position.x += Math.sin(time * this.wobbleSpeed + this.mesh.id) * dt * this.wobbleDist;
          this.mesh.position.z += Math.cos(time * this.wobbleSpeed + this.mesh.id) * dt * this.wobbleDist;

          if (this.mesh.position.y < -20) {
            this.mesh.position.y = 20;
            this.mesh.position.x = (Math.random() - 0.5) * 40;
            this.mesh.position.z = (Math.random() - 0.5) * 40;
          }

          const s = this.baseScale * (0.8 + 0.5 * Math.sin(Date.now() * 0.005 + this.mesh.id));
          this.mesh.scale.setScalar(s);
        } else {
          const s = this.baseScale;
          this.mesh.position.lerp(this.posScatter, dt * 0.5);
          this.mesh.scale.lerp(new THREE.Vector3(s, s, s), dt);
        }
        return;
      }

      let target = this.posTree;

      if (mode === 'SCATTER') target = this.posScatter;
      else if (mode === 'FOCUS') {
        if (this.mesh === focusTarget) {
          const desiredWorldPos = new THREE.Vector3(0, 2, 35); 
          const invMatrix = new THREE.Matrix4().copy(stateRef.current.mainGroup.matrixWorld).invert();
          target = desiredWorldPos.applyMatrix4(invMatrix);
        } else {
          target = this.posScatter;
        }
      }

      const lerpSpeed = (mode === 'FOCUS' && this.mesh === focusTarget) ? 5.0 : 2.0;
      this.mesh.position.lerp(target, lerpSpeed * dt);

      if (mode === 'SCATTER') {
        this.mesh.rotation.x += this.spinSpeed.x * dt;
        this.mesh.rotation.y += this.spinSpeed.y * dt;
        this.mesh.rotation.z += this.spinSpeed.z * dt;
      } else if (mode === 'TREE') {
        this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt);
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt);
        this.mesh.rotation.y += 0.5 * dt;
      }

      if (mode === 'FOCUS' && this.mesh === focusTarget) {
        this.mesh.lookAt(cameraPos);
      }

      let s = this.baseScale;
      if (mode === 'SCATTER' && this.type === 'PHOTO') {
        s = this.baseScale * 2.0;
      } else if (mode === 'FOCUS') {
        if (this.mesh === focusTarget) s = 4.0;
        else s = this.baseScale * 0.8;
      }
      this.mesh.scale.lerp(new THREE.Vector3(s, s, s), 4 * dt);
    }
  }

  useEffect(() => {
    if (!containerRef.current || !webcamRef.current) return;

    // --- Generate Static Assets ---
    // Create the "Sweet Memory" texture with HOT STAMPING GOLD effect
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = 512; 
    frameCanvas.height = 640; 
    const fCtx = frameCanvas.getContext('2d');
    
    // We wrap this in a document.fonts.ready check to ensure Great Vibes is loaded
    // However, inside useEffect, it might be async. We'll do a best effort immediate draw
    // and rely on the fact that if it loads later, it might not update unless we redraw.
    // For this demo, we'll assume it loads fast enough or fall back to cursive.
    
    const drawFrameTexture = () => {
        if (!fCtx) return;
        
        // 1. Background: Matte Grey/White (prevents bloom)
        fCtx.fillStyle = '#a0a0a0'; 
        fCtx.fillRect(0, 0, 512, 640);
        
        // 2. Text Setup: "Hot Stamping Gold"
        fCtx.font = '60px "Great Vibes", cursive'; // Use the new font
        fCtx.textAlign = 'center';
        
        // Create Gold Gradient
        // Simulates the reflection of light on gold foil
        const gradient = fCtx.createLinearGradient(150, 580, 350, 620);
        gradient.addColorStop(0, '#bf953f'); // Dark Gold
        gradient.addColorStop(0.2, '#fcf6ba'); // Light Gold (Reflection)
        gradient.addColorStop(0.5, '#b38728'); // Medium Gold
        gradient.addColorStop(0.8, '#fbf5b7'); // Light Gold
        gradient.addColorStop(1, '#aa771c'); // Dark Gold
        
        fCtx.fillStyle = gradient;
        
        // Add subtle shadow to create the "pressed" or "raised" look of hot stamping
        fCtx.shadowColor = 'rgba(0,0,0,0.3)';
        fCtx.shadowBlur = 1;
        fCtx.shadowOffsetX = 1;
        fCtx.shadowOffsetY = 1;

        fCtx.fillText('Sweet Memory', 256, 600); 
        
        // Reset shadow for anything else (not used here but good practice)
        fCtx.shadowColor = 'transparent';
    };

    // Attempt to wait for fonts, but fallback immediately to avoid empty texture
    document.fonts.ready.then(() => {
       drawFrameTexture();
       if (stateRef.current.frameFrontTexture) {
         stateRef.current.frameFrontTexture.needsUpdate = true;
       }
    });
    // Draw immediately in case fonts are already cached
    drawFrameTexture();

    const frameTex = new THREE.CanvasTexture(frameCanvas);
    frameTex.colorSpace = THREE.SRGBColorSpace;
    stateRef.current.frameFrontTexture = frameTex;

    // --- THREE JS INIT ---
    const scene = new THREE.Scene();
    stateRef.current.scene = scene;
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.015);

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, CONFIG.camera.z);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Switch to ACESFilmic for better color handling and contrast
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; 
    
    containerRef.current.appendChild(renderer.domElement);

    const mainGroup = stateRef.current.mainGroup;
    scene.add(mainGroup);

    // Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    // Lights
    const ambient = new THREE.AmbientLight(0x445566, 0.8);
    scene.add(ambient);
    
    const innerLight = new THREE.PointLight(0xffaa00, 2, 20);
    innerLight.position.set(0, 5, 0);
    mainGroup.add(innerLight);
    
    // Reduced spotlight intensity to prevent over-exposure
    const spotCyan = new THREE.SpotLight(0x00ffff, 600);
    spotCyan.position.set(30, 40, 40);
    spotCyan.penumbra = 0.5;
    scene.add(spotCyan);
    
    const spotBlue = new THREE.SpotLight(0x0044ff, 400);
    spotBlue.position.set(-30, 20, -30);
    scene.add(spotBlue);

    // Post Processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    // Adjusted threshold higher to prevent white frame from blooming
    bloomPass.threshold = 0.95; 
    bloomPass.strength = 0.4; 
    bloomPass.radius = 0.5;
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Textures & Geometry setup
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#cc0000';
      ctx.beginPath();
      for (let i = -128; i < 256; i += 32) {
        ctx.moveTo(i, 0); ctx.lineTo(i + 32, 128); ctx.lineTo(i + 16, 128); ctx.lineTo(i - 16, 0);
      }
      ctx.fill();
    }
    const caneTexture = new THREE.CanvasTexture(canvas);
    caneTexture.wrapS = THREE.RepeatWrapping; caneTexture.wrapT = THREE.RepeatWrapping;
    caneTexture.repeat.set(3, 3);

    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const boxGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(0.3, 0.4, 0),
    ]);
    const candyGeo = new THREE.TubeGeometry(curve, 16, 0.08, 8, false);

    const goldMat = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.champagneGold,
      metalness: 1.0, roughness: 0.1, envMapIntensity: 2.0, emissive: 0x443300, emissiveIntensity: 0.3,
    });
    const greenMat = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.vividGreen,
      metalness: 0.3, roughness: 0.5, emissive: 0x004411, emissiveIntensity: 0.4,
    });
    const redMat = new THREE.MeshPhysicalMaterial({
      color: CONFIG.colors.accentRed,
      metalness: 0.3, roughness: 0.2, clearcoat: 1.0, emissive: 0x330000,
    });
    const candyMat = new THREE.MeshStandardMaterial({ map: caneTexture, roughness: 0.4 });

    for (let i = 0; i < CONFIG.particles.count; i++) {
      const rand = Math.random();
      let mesh, type;

      if (rand < 0.4) { mesh = new THREE.Mesh(boxGeo, greenMat); type = 'BOX'; }
      else if (rand < 0.7) { mesh = new THREE.Mesh(boxGeo, goldMat); type = 'GOLD_BOX'; }
      else if (rand < 0.92) { mesh = new THREE.Mesh(sphereGeo, goldMat); type = 'GOLD_SPHERE'; }
      else if (rand < 0.97) { mesh = new THREE.Mesh(sphereGeo, redMat); type = 'RED'; }
      else { mesh = new THREE.Mesh(candyGeo, candyMat); type = 'CANE'; }

      const s = 0.4 + Math.random() * 0.5;
      mesh.scale.set(s, s, s);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      mainGroup.add(mesh);
      stateRef.current.particleSystem.push(new ParticleImpl(mesh, type, false));
    }

    const starGeo = new THREE.OctahedronGeometry(1.2, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffdd88, emissive: 0xffaa00, emissiveIntensity: 1.0, metalness: 1.0, roughness: 0,
    });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(0, CONFIG.particles.treeHeight / 2 + 1.2, 0);
    mainGroup.add(star);

    const dustGeo = new THREE.TetrahedronGeometry(0.12, 0); 
    const dustMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.iceWhite, transparent: true, opacity: 0.8 });
    for (let i = 0; i < CONFIG.particles.dustCount; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat);
      mesh.scale.setScalar(0.5 + Math.random());
      mainGroup.add(mesh);
      stateRef.current.particleSystem.push(new ParticleImpl(mesh, 'DUST', true));
    }

    mainGroup.add(stateRef.current.photoMeshGroup);
    
    // Default Photo
    const defCanvas = document.createElement('canvas');
    defCanvas.width = 512; defCanvas.height = 512;
    const defCtx = defCanvas.getContext('2d');
    if (defCtx) {
      defCtx.fillStyle = '#051020'; 
      defCtx.fillRect(0, 0, 512, 512); 
      
      defCtx.shadowColor = '#00ffff';
      defCtx.shadowBlur = 10;
      defCtx.font = '500 60px Times New Roman'; 
      defCtx.fillStyle = '#ccffff'; 
      defCtx.textAlign = 'center';
      
      defCtx.fillText('冰冰冰淇淋', 256, 230);
      defCtx.fillText('Merry Xmas', 256, 300);
    }
    const defTex = new THREE.CanvasTexture(defCanvas);
    defTex.colorSpace = THREE.SRGBColorSpace;
    addPhotoToScene(defTex, 'default-photo');
    syncPhotos(); 

    // --- MEDIAPIPE ---
    let handLandmarker: HandLandmarker | null = null;
    const initMediaPipe = async () => {
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });

      if (navigator.mediaDevices?.getUserMedia && webcamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { 
            facingMode: "user", 
            width: { ideal: 640 }, 
            height: { ideal: 480 } 
          } });
          webcamRef.current.srcObject = stream;
          await webcamRef.current.play();
          detectHands();
        } catch (e) {
          console.warn("Camera access denied or failed", e);
        }
      }
    };

    let lastVideoTime = -1;
    const detectHands = () => {
      if (!webcamRef.current || !handLandmarker) return;
      
      const video = webcamRef.current;
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const result = handLandmarker.detectForVideo(video, performance.now());
        processGestures(result);
      }
      requestAnimationFrame(detectHands);
    };

    const processGestures = (result: HandLandmarkerResult) => {
      const s = stateRef.current;
      if (result.landmarks && result.landmarks.length > 0) {
        s.hand.detected = true;
        const lm = result.landmarks[0];
        s.hand.x = (lm[9].x - 0.5) * 2;
        s.hand.y = (lm[9].y - 0.5) * 2;

        const thumb = lm[4];
        const index = lm[8];
        const middle = lm[12];
        const ring = lm[16];
        const pinky = lm[20];
        const wrist = lm[0];
        const palm = lm[9];

        const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
        const tips = [index, middle, ring, pinky];
        let avgDist = 0;
        tips.forEach(t => (avgDist += Math.hypot(t.x - wrist.x, t.y - wrist.y)));
        avgDist /= 4;

        let fistDistance = 0;
        tips.forEach((tip) => {
          fistDistance += Math.hypot(tip.x - palm.x, tip.y - palm.y);
        });
        fistDistance /= 4;

        const dIndex = Math.hypot(index.x - wrist.x, index.y - wrist.y);
        const dMiddle = Math.hypot(middle.x - wrist.x, middle.y - wrist.y);
        const dRing = Math.hypot(ring.x - wrist.x, ring.y - wrist.y);
        const dPinky = Math.hypot(pinky.x - wrist.x, pinky.y - wrist.y);

        const isPeace = (dIndex > 0.25 && dMiddle > 0.25) && 
                        (dRing < dIndex * 0.7 && dPinky < dMiddle * 0.7) &&
                        Math.abs(dIndex - dMiddle) < 0.15; 

        const now = Date.now();
        if (isPeace && (now - s.lastFireworkTime > 500)) { 
           s.lastFireworkTime = now;
           const fx = s.hand.x * -25;
           const fy = s.hand.y * -20 + 10;
           spawnFirework(fx, fy, 0);
        }

        let newMode: AppMode = s.mode;
        
        if (fistDistance < 0.18) {
          newMode = 'TREE';
          s.focusTarget = null;
        } else if (pinchDist < 0.045 && avgDist > 0.28) {
           if (s.mode !== 'FOCUS') {
             newMode = 'FOCUS';
             const photos = s.particleSystem.filter((p) => p.type === 'PHOTO');
             if (photos.length) {
               s.focusTarget = photos[Math.floor(Math.random() * photos.length)].mesh;
             }
           }
        } else if (avgDist > 0.4 && !isPeace) {
          newMode = 'SCATTER';
          s.focusTarget = null;
        }

        if (newMode !== s.mode) {
           s.mode = newMode;
           onModeChange(newMode);
        }

      } else {
        s.hand.detected = false;
      }
    };

    initMediaPipe();

    const clock = new THREE.Clock();
    const animate = () => {
      const dt = clock.getDelta();
      const s = stateRef.current;

      if (s.mode === 'SCATTER' && s.hand.detected) {
        const targetRotY = s.hand.x * Math.PI * 0.9;
        const targetRotX = s.hand.y * Math.PI * 0.25;
        s.rotation.y += (targetRotY - s.rotation.y) * 3.0 * dt;
        s.rotation.x += (targetRotX - s.rotation.x) * 3.0 * dt;
      } else {
        if (s.mode === 'TREE') {
          s.rotation.y += 0.3 * dt;
          s.rotation.x += (0 - s.rotation.x) * 2.0 * dt;
        } else {
          s.rotation.y += 0.1 * dt;
        }
      }

      mainGroup.rotation.y = s.rotation.y;
      mainGroup.rotation.x = s.rotation.x;

      s.particleSystem.forEach(p => p.update(dt, s.mode, s.focusTarget, camera.position));

      for (let i = s.fireworkSystem.length - 1; i >= 0; i--) {
        const p = s.fireworkSystem[i];
        const alive = p.update(dt);
        if (!alive) {
          if (s.scene) s.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          s.fireworkSystem.splice(i, 1);
        }
      }

      composer.render();
      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []); // Run once on mount

  return (
    <>
      <div ref={containerRef} className="absolute top-0 left-0 w-full h-full z-0" />
      <video ref={webcamRef} className="hidden" muted playsInline autoPlay />
    </>
  );
});

export default Experience;