import './main.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect';

/**
 * Input & Responsive Logic
 */
class Sizes {
  width = window.innerWidth;
  height = window.innerHeight;
  pixelRatio = Math.min(window.devicePixelRatio, 2);
  gyro = { x: 0, y: 0 };
  mouseLocation = { x: 0, y: 0 };

  constructor() {
    window.addEventListener('mousemove', (event) => {
      this.mouseLocation.x = (event.clientX / this.width) * 2 - 1;
      this.mouseLocation.y = (-event.clientY / this.height) * 2 + 1;
    });

    if (this.isMobile()) {
      this.initGyro();
    }
  }

  private initGyro() {
    // iOS still requires a gesture for permission
    if (
      typeof (window.DeviceOrientationEvent as any)?.requestPermission ===
      'function'
    ) {
      const permissionButton = () => {
        (window.DeviceOrientationEvent as any)
          .requestPermission()
          .then((response: string) => {
            if (response === 'granted') this.addGyroListeners();
          })
          .catch(console.error);
        window.removeEventListener('pointerup', permissionButton);
      };
      window.addEventListener('pointerup', permissionButton);
    } else {
      // Android/HTTPS: Just start listening
      this.addGyroListeners();
    }
  }

  private addGyroListeners() {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        // Amplified sensitivity (divisor reduced from 45 to 20)
        this.gyro.x = e.gamma / 30;
        this.gyro.y = (e.beta - 45) / 30;
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('deviceorientationabsolute', handleOrientation);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
  }

  isMobile() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }
}

/**
 * Time Logic
 */
class Interval {
  start = Date.now();
  current = this.start;
  delta = 16;
  elapse = 0;

  update() {
    const currentTime = Date.now();
    this.delta = currentTime - this.current;
    this.current = currentTime;
    this.elapse = this.current - this.start;
  }
}

/**
 * Camera & Parallax
 */
class Camera {
  app = new App();
  scene = this.app.scene;
  sizes = this.app.sizes;
  canvas = this.app.canvas;

  instanceGroup = new THREE.Group();
  instance = new THREE.PerspectiveCamera(
    45,
    this.sizes.width / this.sizes.height,
    0.1,
    100
  );
  controls = new OrbitControls(this.instance, this.canvas);

  constructor() {
    this.instance.position.set(0, 0, 3.3);
    this.instanceGroup.add(this.instance);
    this.scene.add(this.instanceGroup);
    this.controls.enableDamping = true;
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height;
    this.instance.updateProjectionMatrix();
  }

  update() {
    const targetX = this.sizes.isMobile()
      ? this.sizes.gyro.x
      : this.sizes.mouseLocation.x * 0.5;
    const targetY = this.sizes.isMobile()
      ? this.sizes.gyro.y
      : this.sizes.mouseLocation.y * 0.5;

    // Parallax Lerp
    this.instanceGroup.position.x +=
      (targetX - this.instanceGroup.position.x) * 0.05;
    this.instanceGroup.position.y +=
      (targetY - this.instanceGroup.position.y) * 0.05;

    this.controls.update();
  }
}

/**
 * Patch for 2D context willReadFrequently warning
 */
const originalGetContext = HTMLCanvasElement.prototype.getContext;
(HTMLCanvasElement.prototype as any).getContext = function (
  type: string,
  attributes?: any
) {
  if (type === '2d') {
    attributes = { ...attributes, willReadFrequently: true };
  }
  return (originalGetContext as any).call(this, type, attributes);
};

/**
 * Rendering Logic (Ascii)
 */
class Renderer {
  app = new App();
  sizes = this.app.sizes;
  camera = this.app.camera;
  canvas = this.app.canvas;
  scene = this.app.scene;

  params = {
    clearColor: '#030712',
    mainColor: '#d1d5db',
    chars: ' .:-+*=%@#',
  };

  instance = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
  effect: AsciiEffect;

  constructor() {
    this.effect = new AsciiEffect(this.instance, this.params.chars, {
      invert: true,
    });
    this.setInstance();
    this.setEffect();
  }

  setInstance() {
    this.instance.setClearColor(this.params.clearColor);
    this.instance.setSize(
      Math.floor(this.sizes.width),
      Math.floor(this.sizes.height)
    );
    this.instance.setPixelRatio(this.sizes.pixelRatio);
  }

  setEffect() {
    const w = Math.floor(this.sizes.width);
    const h = Math.floor(this.sizes.height);

    this.effect.setSize(w, h);
    this.effect.domElement.style.color = this.params.mainColor;
    this.effect.domElement.style.backgroundColor = this.params.clearColor;
    this.effect.domElement.className = 'ascii-div';

    document.body.appendChild(this.effect.domElement);
  }

  resize() {
    const w = Math.floor(this.sizes.width);
    const h = Math.floor(this.sizes.height);
    this.instance.setSize(w, h);
    this.effect.setSize(w, h);
  }

  update() {
    if (this.sizes.width > 0) {
      this.effect.render(this.scene, this.camera.instance);
    }
  }
}

/**
 * Logo Model & Animation
 */
class Logo {
  app = new App();
  scene = this.app.scene;

  loader = new GLTFLoader();
  model: THREE.Group | null = null;
  starMesh: THREE.Mesh | null = null;

  // Animation State
  targetRotationY = 0;
  currentRotationY = 0;

  constructor() {
    this.loader.load('logo.glb', (data) => {
      this.model = data.scene;
      this.resize();

      this.model.traverse((mesh) => {
        if (mesh instanceof THREE.Mesh) {
          mesh.material.side = THREE.DoubleSide;
          if (mesh.name === 'star') {
            mesh.geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            mesh.geometry.boundingBox?.getCenter(center);
            mesh.geometry.translate(-center.x, -center.y, -center.z);
            mesh.position.add(center);

            this.starMesh = mesh;
          }
        }
      });
      this.scene.add(this.model);
    });

    window.addEventListener('pointerup', (e) => {
      if ((e.target as HTMLElement).closest('.ascii-div') && this.starMesh) {
        this.targetRotationY += Math.PI;
      }
    });

    // lighting
    const lightA = new THREE.PointLight(0xffffff, 50);
    lightA.position.set(2, 2, 1);
    const lightB = new THREE.PointLight(0xffffff, 50);
    lightB.position.set(-2, 2, -1);
    this.scene.add(lightA, lightB);
  }

  update() {
    if (this.starMesh) {
      const friction = 0.08;
      const delta = this.targetRotationY - this.currentRotationY;

      this.currentRotationY += delta * friction;
      this.starMesh.rotation.y = this.currentRotationY;
    }
  }

  resize() {
    if (this.model) {
      const isSmallScreen = window.innerWidth < 700;
      this.model.scale.setScalar(isSmallScreen ? 1.1 : 1.5);
      this.model.position.y = isSmallScreen ? -0.35 : -0.7;
    }
  }
}

/**
 * Application Entry
 */
let instance: App | null = null;

export default class App {
  canvas: HTMLCanvasElement = document.createElement('canvas');
  sizes!: Sizes;
  interval!: Interval;
  scene!: THREE.Scene;
  camera!: Camera;
  renderer!: Renderer;
  logo!: Logo;

  constructor(canvas?: HTMLCanvasElement) {
    if (instance) return instance;
    instance = this;

    if (canvas) this.canvas = canvas;

    this.sizes = new Sizes();
    this.interval = new Interval();
    this.scene = new THREE.Scene();
    this.camera = new Camera();
    this.renderer = new Renderer();

    // OrbitControls rebind
    this.camera.controls.dispose();
    this.camera.controls = new OrbitControls(
      this.camera.instance,
      this.renderer.effect.domElement
    );
    this.camera.controls.enableDamping = true;
    // this.camera.controls.enabled = false;

    this.logo = new Logo();

    window.addEventListener('resize', () => this.resize());
    this.renderer.instance.setAnimationLoop(() => this.update());
  }

  resize() {
    this.sizes.resize();
    this.camera.resize();
    this.renderer.resize();
    this.logo.resize();
  }

  update() {
    this.interval.update();
    this.camera.update();
    this.logo.update();
    this.renderer.update();
  }
}
