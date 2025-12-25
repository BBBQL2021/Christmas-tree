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
    bg: 0x000000,
    champagneGold: 0xffd966,
    deepGreen: 0x03180a,
    accentRed: 0x990000,
  },
  particles: {
    count: 1500,
    dustCount: 2500,
    treeHeight: 24,
    treeRadius: 8,
  },
  camera: {
    z: 50,
  },
};

interface Props {
  onPhotosChange: (photos: PhotoData[]) => void;
  onModeChange: (mode: AppMode) => void;
}

const Experience = forwardRef<ExperienceRef, Props>(({ onPhotosChange, onModeChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  
  // Mutable State (to avoid React re-renders in the loop)
  const stateRef = useRef({
    mode: 'TREE' as AppMode,
    focusTarget: null as THREE.Object3D | null,
    hand: { detected: false, x: 0, y: 0 },
    rotation: { x: 0, y: 0 },
    particleSystem: [] as Particle[],
    photoMeshGroup: new THREE.Group(),
    scene: null as THREE.Scene | null,
    mainGroup: new THREE.Group(),
  });

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    addPhoto: (url: string) => {
      const tex = new THREE.TextureLoader().load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        addPhotoToScene(t);
        syncPhotos();
      });
    },
    removePhoto: (index: number) => {
      const sys = stateRef.current.particleSystem;
      const photoParticles = sys.filter(p => p.type === 'PHOTO');
      
      if (index >= 0 && index < photoParticles.length) {
        const targetP = photoParticles[index];
        // Clean up Three.js objects
        stateRef.current.photoMeshGroup.remove(targetP.mesh);
        
        // Remove from main system array
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
    return photos.map((p, idx) => {
      const mesh = p.mesh as THREE.Group;
      // The second child is the photo plane with texture
      const photoMesh = mesh.children[1] as THREE.Mesh;
      const mat = photoMesh.material as THREE.MeshBasicMaterial;
      const tex = mat.map;
      let url = '';
      if (tex && tex.image) {
        url = tex.image.src || tex.image.currentSrc;
      }
      return { id: `photo-${idx}-${Date.now()}`, url };
    });
  };

  const syncPhotos = () => {
    if (onPhotosChange) {
      onPhotosChange(getPhotoDataList());
    }
  };

  const addPhotoToScene = (texture: THREE.Texture) => {
    const frameGeo = new THREE.BoxGeometry(1.4, 1.4, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.champagneGold,
      metalness: 1.0,
      roughness: 0.1,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);

    const photoGeo = new THREE.PlaneGeometry(1.2, 1.2);
    // Darken the photo material to prevent bloom blowout and overexposure
    // 0x999999 is roughly 0.6 intensity, keeping it below bloom threshold of 0.7
    const photoMat = new THREE.MeshBasicMaterial({ 
      map: texture, 
      side: THREE.DoubleSide,
      color: 0x999999 
    });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.04;

    const group = new THREE.Group();
    group.add(frame);
    group.add(photo);

    const s = 0.8;
    group.scale.set(s, s, s);

    stateRef.current.photoMeshGroup.add(group);
    
    const p = new ParticleImpl(group, 'PHOTO', false);
    stateRef.current.particleSystem.push(p);
  };

  // Helper Class for Particle Logic
  class ParticleImpl implements Particle {
    mesh: THREE.Mesh | THREE.Group;
    type: any;
    isDust: boolean;
    posTree = new THREE.Vector3();
    posScatter = new THREE.Vector3();
    baseScale: number;
    spinSpeed: THREE.Vector3;
    
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
      this.calculatePositions();
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
      let rScatter = this.isDust ? 12 + Math.random() * 20 : 8 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this.posScatter.set(
        rScatter * Math.sin(phi) * Math.cos(theta),
        rScatter * Math.sin(phi) * Math.sin(theta),
        rScatter * Math.cos(phi)
      );
    }

    update(dt: number, mode: AppMode, focusTarget: THREE.Object3D | null, cameraPos: THREE.Vector3) {
      let target = this.posTree;

      if (mode === 'SCATTER') target = this.posScatter;
      else if (mode === 'FOCUS') {
        if (this.mesh === focusTarget) {
          // Bring to front
          const desiredWorldPos = new THREE.Vector3(0, 2, 35); // Close to camera z=50
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
      if (this.isDust) {
        // Pulse dust
        s = this.baseScale * (0.8 + 0.4 * Math.sin(Date.now() * 0.004 + this.mesh.id));
        if (mode === 'TREE') s = 0; // Hide dust in tree mode
      } else if (mode === 'SCATTER' && this.type === 'PHOTO') {
        s = this.baseScale * 2.5;
      } else if (mode === 'FOCUS') {
        if (this.mesh === focusTarget) s = 4.5;
        else s = this.baseScale * 0.8;
      }
      this.mesh.scale.lerp(new THREE.Vector3(s, s, s), 4 * dt);
    }
  }

  useEffect(() => {
    if (!containerRef.current || !webcamRef.current) return;

    // --- THREE JS INIT ---
    const scene = new THREE.Scene();
    stateRef.current.scene = scene;
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.01);

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, CONFIG.camera.z);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.7; // Lowered from 2.2 to reduce overexposure
    containerRef.current.appendChild(renderer.domElement);

    const mainGroup = stateRef.current.mainGroup;
    scene.add(mainGroup);

    // Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const innerLight = new THREE.PointLight(0xffaa00, 2, 20);
    innerLight.position.set(0, 5, 0);
    mainGroup.add(innerLight);
    const spotGold = new THREE.SpotLight(0xffcc66, 1200);
    spotGold.position.set(30, 40, 40);
    scene.add(spotGold);
    const spotBlue = new THREE.SpotLight(0x6688ff, 600);
    spotBlue.position.set(-30, 20, -30);
    scene.add(spotBlue);

    // Post Processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.7;
    bloomPass.strength = 0.45;
    bloomPass.radius = 0.4;
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Create Candy Texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#880000';
      ctx.beginPath();
      for (let i = -128; i < 256; i += 32) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 32, 128);
        ctx.lineTo(i + 16, 128);
        ctx.lineTo(i - 16, 0);
      }
      ctx.fill();
    }
    const caneTexture = new THREE.CanvasTexture(canvas);
    caneTexture.wrapS = THREE.RepeatWrapping;
    caneTexture.wrapT = THREE.RepeatWrapping;
    caneTexture.repeat.set(3, 3);

    // Create Particles
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const boxGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.5, 0),
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(0.1, 0.5, 0),
      new THREE.Vector3(0.3, 0.4, 0),
    ]);
    const candyGeo = new THREE.TubeGeometry(curve, 16, 0.08, 8, false);

    const goldMat = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.champagneGold,
      metalness: 1.0, roughness: 0.1, envMapIntensity: 2.0, emissive: 0x443300, emissiveIntensity: 0.3,
    });
    const greenMat = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.deepGreen,
      metalness: 0.2, roughness: 0.8, emissive: 0x002200, emissiveIntensity: 0.2,
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

    // Star
    const starGeo = new THREE.OctahedronGeometry(1.2, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffdd88, emissive: 0xffaa00, emissiveIntensity: 1.0, metalness: 1.0, roughness: 0,
    });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(0, CONFIG.particles.treeHeight / 2 + 1.2, 0);
    mainGroup.add(star);

    // Dust
    const dustGeo = new THREE.TetrahedronGeometry(0.08, 0);
    const dustMat = new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: 0.8 });
    for (let i = 0; i < CONFIG.particles.dustCount; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat);
      mesh.scale.setScalar(0.5 + Math.random());
      mainGroup.add(mesh);
      stateRef.current.particleSystem.push(new ParticleImpl(mesh, 'DUST', true));
    }

    // Photos Group
    mainGroup.add(stateRef.current.photoMeshGroup);
    
    // Default Photo
    const defCanvas = document.createElement('canvas');
    defCanvas.width = 512; defCanvas.height = 512;
    const defCtx = defCanvas.getContext('2d');
    if (defCtx) {
      defCtx.fillStyle = '#050505'; defCtx.fillRect(0, 0, 512, 512);
      defCtx.strokeStyle = '#eebb66'; defCtx.lineWidth = 15; defCtx.strokeRect(20, 20, 472, 472);
      defCtx.font = '500 60px Times New Roman'; defCtx.fillStyle = '#eebb66'; defCtx.textAlign = 'center';
      defCtx.fillText('冰冰冰淇淋', 256, 230);
      defCtx.fillText('Merry Xmas', 256, 300);
    }
    const defTex = new THREE.CanvasTexture(defCanvas);
    defTex.colorSpace = THREE.SRGBColorSpace;
    addPhotoToScene(defTex);
    syncPhotos(); // Initial sync

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
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
          webcamRef.current.srcObject = stream;
          await webcamRef.current.play();
          detectHands();
        } catch (e) {
          console.error("Camera access denied or failed", e);
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
        const wrist = lm[0];
        const palm = lm[9];

        const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
        
        const fingerTips = [lm[8], lm[12], lm[16], lm[20]];
        let fistDistance = 0;
        fingerTips.forEach((tip) => {
          fistDistance += Math.hypot(tip.x - palm.x, tip.y - palm.y);
        });
        fistDistance /= 4;

        const tips = [lm[8], lm[12], lm[16], lm[20]];
        let avgDist = 0;
        tips.forEach(t => (avgDist += Math.hypot(t.x - wrist.x, t.y - wrist.y)));
        avgDist /= 4;

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
        } else if (avgDist > 0.4) {
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

    // --- ANIMATION LOOP ---
    const clock = new THREE.Clock();
    const animate = () => {
      const dt = clock.getDelta();
      const s = stateRef.current;

      // Global Rotation
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
      // Cleanup logic if needed
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  return (
    <>
      <div ref={containerRef} className="absolute top-0 left-0 w-full h-full z-0" />
      <video ref={webcamRef} className="hidden" muted playsInline autoPlay />
    </>
  );
});

export default Experience;