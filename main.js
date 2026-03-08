import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const PERFORMANCE = {
  maxBgDpr: 1.25,
  maxFishDpr: 1.35,
  maxOverlayDpr: 1.0,
  overlayOpacityStep: 0.02,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const bgCanvas        = document.getElementById("bg-canvas");
const fishCanvas      = document.getElementById("fish-canvas");

const warpInput       = document.getElementById("warp-input");
const warpTrigger     = document.getElementById("warp-trigger");

const blackOverlay    = document.getElementById("black-overlay");
const returnBtn       = document.getElementById("return-btn");
const githubPanel     = document.getElementById("github-panel");
const githubName      = document.getElementById("github-name");
const githubUsername  = document.getElementById("github-username");
const githubRepos     = document.getElementById("github-repos");
const githubCommits   = document.getElementById("github-commits");
const githubFish      = document.getElementById("github-fish");
const githubStatus    = document.getElementById("github-status");
const githubCommitBand = document.getElementById("github-commit-band");
const githubRepoBand   = document.getElementById("github-repo-band");
const githubFishLore   = document.getElementById("github-fish-lore");
const overlayFishCanvas = document.getElementById("overlay-fish-canvas");
const overlayFishNameEl = document.getElementById("overlay-fish-name");

const tierGridWrap    = document.getElementById("tier-grid-wrap");
const tierGridEl      = document.getElementById("tier-grid");

const fishViz         = document.getElementById("fish-viz");
const fishVizCommits  = document.getElementById("fish-viz-commits");
const fishVizRepos    = document.getElementById("fish-viz-repos");

const soundBtn        = document.getElementById("sound-btn");
const soundIcon       = document.getElementById("sound-icon");

const overlayVideoA   = document.getElementById("overlay-video-a");
const overlayVideoB   = document.getElementById("overlay-video-b");
const overlayVideos   = [overlayVideoA, overlayVideoB];

// ── Video setup ───────────────────────────────────────────────────────────────
for (const video of overlayVideos) {
  video.muted = true;
  video.loop = false;
  video.playsInline = true;
  video.preload = "auto";
  video.disablePictureInPicture = true;
  video.setAttribute("webkit-playsinline", "");
  video.load();
}

let activeOverlayVideo  = overlayVideoA;
let standbyOverlayVideo = overlayVideoB;
let overlaySwapCooldown = 0;
const overlayVideoReadyPromise = Promise.all(
  overlayVideos.map(
    (video) =>
      new Promise((resolve) => {
        if (video.readyState >= 3) { resolve(); return; }
        const onReady = () => resolve();
        video.addEventListener("loadeddata", onReady, { once: true });
        video.addEventListener("canplaythrough", onReady, { once: true });
      })
  )
);

// ── BG renderer ───────────────────────────────────────────────────────────────
const bgRenderer = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: true, alpha: true, powerPreference: "high-performance" });
bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE.maxBgDpr));
bgRenderer.setSize(window.innerWidth, window.innerHeight);

const bgScene  = new THREE.Scene();
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ── Fish renderer ─────────────────────────────────────────────────────────────
const fishRenderer = new THREE.WebGLRenderer({ canvas: fishCanvas, antialias: true, alpha: true, powerPreference: "high-performance" });
fishRenderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE.maxFishDpr));
fishRenderer.setSize(window.innerWidth, window.innerHeight);
fishRenderer.setClearColor(0x000000, 0);
fishRenderer.outputColorSpace = THREE.SRGBColorSpace;
fishRenderer.toneMapping = THREE.ACESFilmicToneMapping;
fishRenderer.toneMappingExposure = 0.9;

const fishScene  = new THREE.Scene();
const fishCamera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
fishCamera.position.set(0, 0.2, 5);

const pmremGenerator = new THREE.PMREMGenerator(fishRenderer);
fishScene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.05).texture;

fishScene.add(new THREE.HemisphereLight(0xe7f7ff, 0x11283a, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(4, 3, 5);
fishScene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x9ddcff, 0.45);
rimLight.position.set(-3, 1.5, -4);
fishScene.add(rimLight);

// ── Overlay fish renderer ─────────────────────────────────────────────────────
const overlayFishRenderer = new THREE.WebGLRenderer({
  canvas: overlayFishCanvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
overlayFishRenderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE.maxOverlayDpr));
overlayFishRenderer.setClearColor(0x000000, 0);

const overlayFishScene  = new THREE.Scene();
overlayFishScene.environment = fishScene.environment;
const overlayFishCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
overlayFishCamera.position.set(0, 0.1, 5.0);
overlayFishScene.add(new THREE.HemisphereLight(0xdcf5ff, 0x0b2234, 0.9));
const overlayFishKeyLight = new THREE.DirectionalLight(0xffffff, 1.05);
overlayFishKeyLight.position.set(3, 2.5, 4);
overlayFishScene.add(overlayFishKeyLight);
const overlayFishRimLight = new THREE.DirectionalLight(0x95daff, 0.6);
overlayFishRimLight.position.set(-3, 1.2, -3);
overlayFishScene.add(overlayFishRimLight);

// ── Shader / seascape ─────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const shaderSource = await fetch("./shaders/seascape.glsl").then((r) => r.text());
const patchedShaderSource = shaderSource.replace(
  /vec3\s+ori\s*=\s*vec3\(\s*0\.0\s*,\s*3\.5\s*,\s*time\*2\.2\s*\)\s*;/,
  "vec3 ori = vec3(0.0, 3.5 + uCameraYOffset, time*2.2);"
);

const fragmentShader = /* glsl */ `
uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iChannel1;
uniform float uCameraYOffset;

${patchedShaderSource}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const keyTextureData = new Uint8Array(256 * 3 * 4);
const keyTexture = new THREE.DataTexture(keyTextureData, 256, 3, THREE.RGBAFormat);
keyTexture.needsUpdate = true;

const uniforms = {
  iTime:           { value: 0 },
  iResolution:     { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1) },
  iMouse:          { value: new THREE.Vector4(0, 0, 0, 0) },
  iChannel1:       { value: keyTexture },
  uCameraYOffset:  { value: 0 },
};

const bgMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial));

// Mouse tracking for shader + camera parallax
let mouseNormX = 0; // -1..1
let mouseNormY = 0; // -1..1
let targetCameraParallaxX = 0;
let targetCameraParallaxY = 0;
let cameraPrlxX = 0;
let cameraPrlxY = 0;

window.addEventListener("pointermove", (event) => {
  uniforms.iMouse.value.x = event.clientX;
  uniforms.iMouse.value.y = window.innerHeight - event.clientY;
  mouseNormX = (event.clientX / window.innerWidth) * 2 - 1;
  mouseNormY = -((event.clientY / window.innerHeight) * 2 - 1);
});

// ── Fish data ─────────────────────────────────────────────────────────────────
const fishProgression = [
  "./fish_assets/guppy_fish.glb",
  "./fish_assets/guppie_animated.glb",
  "./fish_assets/small_fish.glb",
  "./fish_assets/redcap_oranda_goldfish.glb",
  "./fish_assets/feather_fish.glb",
  "./fish_assets/bream_fish__dorade_royale.glb",
  "./fish_assets/emperor_angelfish_update_v2.glb",
  "./fish_assets/model_47a_-_loggerhead_sea_turtle.glb",
  "./fish_assets/model_65a_-_longnose_gar.glb",
  "./fish_assets/model_66a_-_atlantic_sturgeon.glb",
  "./fish_assets/tuna_fish.glb",
  "./fish_assets/manta_ray_birostris_animated.glb",
  "./fish_assets/liriope_jellyfish_trachymedusae.glb",
  "./fish_assets/shark.glb",
  "./fish_assets/nile_crocodile_swimming.glb",
  "./fish_assets/cryptosuchus.glb",
  "./fish_assets/pistosaur_animated.glb",
  "./fish_assets/f161272aebe34682bb0ff09ce7b76cc9.glb",
  "./fish_assets/chelicerate.glb",
  "./fish_assets/model_99a_-_whale_shark.glb",
  "./fish_assets/whale.glb",
  "./fish_assets/glow_whale.glb",
  "./fish_assets/shadow_leviathan.glb",
  "./fish_assets/mega_whale.glb",
  "./fish_assets/tinkle_the_blue_ring_octopus.glb",
  "./fish_assets/reefback.glb",
  "./fish_assets/tulkun_swimming_loop.glb",
  "./fish_assets/sea_monster_animated.glb",
  "./fish_assets/ghost_leviathan.glb",
  "./fish_assets/kraken_v2.glb",
  "./fish_assets/moon_harvest_-_leviathan.glb",
  "./fish_assets/the_leviathan.glb",
];

const fishPaths = [...fishProgression];

const COMMIT_BUCKET_LIMITS = [120, 320, 700, 1500, 3200, 7000, 14000];
const REPO_BUCKET_LIMITS = [4, 10, 21];
const REPO_BUCKETS = REPO_BUCKET_LIMITS.length + 1;

// Per-model size tuning.
// Change any value (example: 1.25 = 25% larger, 0.85 = 15% smaller).
const MODEL_SIZE_OVERRIDES = {
  "./fish_assets/guppy_fish.glb": 1.0,
  "./fish_assets/guppie_animated.glb": 1.0,
  "./fish_assets/small_fish.glb": 1.0,
  "./fish_assets/redcap_oranda_goldfish.glb": 1.0,
  "./fish_assets/feather_fish.glb": 1.0,
  "./fish_assets/bream_fish__dorade_royale.glb": 1.0,
  "./fish_assets/emperor_angelfish_update_v2.glb": 1.0,
  "./fish_assets/model_47a_-_loggerhead_sea_turtle.glb": 1.0,
  "./fish_assets/model_65a_-_longnose_gar.glb": 1.0,
  "./fish_assets/model_66a_-_atlantic_sturgeon.glb": 1.0,
  "./fish_assets/tuna_fish.glb": 1.0,
  "./fish_assets/manta_ray_birostris_animated.glb": 1.0,
  "./fish_assets/liriope_jellyfish_trachymedusae.glb": 1.0,
  "./fish_assets/shark.glb": 1.3,
  "./fish_assets/nile_crocodile_swimming.glb": 1.5,
  "./fish_assets/cryptosuchus.glb": 1.0,
  "./fish_assets/pistosaur_animated.glb": 1.0,
  "./fish_assets/f161272aebe34682bb0ff09ce7b76cc9.glb": 1.0,
  "./fish_assets/chelicerate.glb": 1.0,
  "./fish_assets/model_99a_-_whale_shark.glb": 1.0,
  "./fish_assets/whale.glb": 1.0,
  "./fish_assets/glow_whale.glb": 1.0,
  "./fish_assets/shadow_leviathan.glb": 1.0,
  "./fish_assets/mega_whale.glb": 1.4,
  "./fish_assets/tinkle_the_blue_ring_octopus.glb": 3.0,
  "./fish_assets/reefback.glb": 5.0,
  "./fish_assets/tulkun_swimming_loop.glb": 1.4,
  "./fish_assets/sea_monster_animated.glb": 1.0,
  "./fish_assets/ghost_leviathan.glb": 1.0,
  "./fish_assets/kraken_v2.glb": 0.7,
  "./fish_assets/moon_harvest_-_leviathan.glb": 1.3,
  "./fish_assets/the_leviathan.glb": 1.0,
};

// Per-model placement/rotation tuning.
// Axes:
// x = left/right, y = up/down, z = forward/back
// yaw = turn left/right, pitch = tilt up/down, roll = tilt sideways (radians)
// Works in both main scene and overlay scene.
const MODEL_VIEW_TUNING = {
  "./fish_assets/guppy_fish.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/guppie_animated.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/small_fish.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/redcap_oranda_goldfish.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/feather_fish.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/bream_fish__dorade_royale.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/emperor_angelfish_update_v2.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/model_47a_-_loggerhead_sea_turtle.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/model_65a_-_longnose_gar.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/model_66a_-_atlantic_sturgeon.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/tuna_fish.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/manta_ray_birostris_animated.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/liriope_jellyfish_trachymedusae.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/shark.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/nile_crocodile_swimming.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/cryptosuchus.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/pistosaur_animated.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/f161272aebe34682bb0ff09ce7b76cc9.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/chelicerate.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/model_99a_-_whale_shark.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/whale.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/glow_whale.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/shadow_leviathan.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/mega_whale.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/tinkle_the_blue_ring_octopus.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/reefback.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/kraken_v2.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/sea_monster_animated.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/tulkun_swimming_loop.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/ghost_leviathan.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/moon_harvest_-_leviathan.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
  "./fish_assets/the_leviathan.glb": {
    main:    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    overlay: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  },
};

// Returns a size multiplier for the overlay fish based on its tier progression.
function tierScaleForPath(path) {
  const idx = fishProgression.indexOf(path);
  if (idx < 0) return 1.0;
  const t = idx / (fishProgression.length - 1); // 0..1
  let scale = 1.0 + t * 1.0; // Base: 1.0 → 2.0

  // Apply custom size bumps requested by user
  if (path.includes("small_fish")) scale *= 3.95;
  if (path.includes("longnose_gar")) scale *= 1.35;
  if (path.includes("atlantic_sturgeon")) scale *= 1.40;
  if (path.includes("manta_ray")) scale *= 1.50;
  if (path.includes("loggerhead")) scale *= 1.35;
  if (path.includes("glow_whale")) scale *= 1.35;
  if (path.includes("shadow_leviathan")) scale *= 1.45;
  
  if (idx >= 15) scale *= 1.35;

  return scale;
}

// ── Three.js fish state ───────────────────────────────────────────────────────
const loader = new GLTFLoader();
let activeFish       = null;
let activeFishRig    = null;
let activeFishIndex  = -1;
let activeMixer      = null;
let activeFishHasClips = false;
let activeBaseYaw    = -Math.PI * 0.5;
let activeMainTune   = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };

let fishSpawn        = 1;
let fishSpawnTarget  = 1;
const fishBaseYOffset = -0.45;

let assignedFishPathForDive  = "";
let overlayFishRig           = null;
let overlayFishMixer         = null;
let overlayFishBaseYaw       = -Math.PI * 0.5;
let overlayFishSpawn         = 0;
let overlayFishSpawnTarget   = 0;
let overlayFishPreparedForPath = "";
let activeOverlayTune = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
let lastOverlayMeshOpacity = -1;

let diveDataReady  = false;
let diveDataMessage = "";
let diveDataOk     = false;
let diveCommitCount = 0;
let divePublicRepos = 0;
let diveTierIndex   = 0;
let assignedTierFishPath = "";

const fishYawOverrides = {
  "./fish_assets/bream_fish__dorade_royale.glb":     Math.PI * 0.5,
  "./fish_assets/guppie_animated.glb":               0,
  "./fish_assets/manta_ray_birostris_animated.glb":  Math.PI * 0.5,
  "./fish_assets/model_65a_-_longnose_gar.glb":      Math.PI * 0.5,
  "./fish_assets/model_99a_-_whale_shark.glb":       Math.PI * 0.5,
  "./fish_assets/redcap_oranda_goldfish.glb":        Math.PI * 0.5,
  "./fish_assets/tuna_fish.glb":                     Math.PI * 0.5,
  "./fish_assets/nile_crocodile_swimming.glb":       Math.PI * 0.5,
  "./fish_assets/pistosaur_animated.glb":            Math.PI * 0.5,
  "./fish_assets/f161272aebe34682bb0ff09ce7b76cc9.glb": Math.PI,
};

// ── Ocean sound (Web Audio API, procedural) ───────────────────────────────────
let audioCtx   = null;
let oceanNodes = null;
let soundOn    = false;

function buildOceanSound(ctx) {
  // Layer 1: pink-ish noise via filtered white noise
  const bufSize  = ctx.sampleRate * 4;
  const buffer   = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data     = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const noise    = ctx.createBufferSource();
  noise.buffer   = buffer;
  noise.loop     = true;

  const lowpass  = ctx.createBiquadFilter();
  lowpass.type   = "lowpass";
  lowpass.frequency.value = 420;
  lowpass.Q.value = 0.7;

  const highpass = ctx.createBiquadFilter();
  highpass.type  = "highpass";
  highpass.frequency.value = 55;

  // Layer 2: slow LFO amplitude modulation (wave rhythm)
  const lfo      = ctx.createOscillator();
  lfo.type       = "sine";
  lfo.frequency.value = 0.11; // ~9 sec per wave cycle
  const lfoGain  = ctx.createGain();
  lfoGain.gain.value = 0.25;
  lfo.connect(lfoGain);

  // Layer 3: very low rumble
  const rumbleBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const rumbleData = rumbleBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) rumbleData[i] = Math.random() * 2 - 1;
  const rumble = ctx.createBufferSource();
  rumble.buffer = rumbleBuf;
  rumble.loop = true;
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type  = "lowpass";
  rumbleLp.frequency.value = 60;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.18;

  // Master gain
  const master = ctx.createGain();
  master.gain.value = 0.0; // start silent, fade in

  noise.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(master);
  lfoGain.connect(master.gain); // LFO modulates master gain
  rumble.connect(rumbleLp);
  rumbleLp.connect(rumbleGain);
  rumbleGain.connect(master);
  master.connect(ctx.destination);

  noise.start();
  lfo.start();
  rumble.start();

  return { master, noise, lfo, rumble };
}

function startOcean() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    oceanNodes = buildOceanSound(audioCtx);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  oceanNodes.master.gain.cancelScheduledValues(audioCtx.currentTime);
  oceanNodes.master.gain.setTargetAtTime(0.55, audioCtx.currentTime, 1.5);
  soundIcon.textContent = "🔊";
  soundOn = true;
}

function stopOcean() {
  if (!audioCtx || !oceanNodes) return;
  oceanNodes.master.gain.cancelScheduledValues(audioCtx.currentTime);
  oceanNodes.master.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.8);
  soundIcon.textContent = "🔇";
  soundOn = false;
}

soundBtn.addEventListener("click", () => {
  if (soundOn) stopOcean();
  else startOcean();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp01(v) { return Math.min(1, Math.max(0, v)); }

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function modelSizeScale(path) {
  return MODEL_SIZE_OVERRIDES[path] ?? 1.0;
}

function modelViewTune(path, view) {
  const tuning = MODEL_VIEW_TUNING[path]?.[view];
  if (!tuning) return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  return {
    x: tuning.x ?? 0,
    y: tuning.y ?? 0,
    z: tuning.z ?? 0,
    yaw: tuning.yaw ?? 0,
    pitch: tuning.pitch ?? 0,
    roll: tuning.roll ?? 0,
  };
}

function fitFishToView(object3d, path) {
  const box    = new THREE.Box3().setFromObject(object3d);
  const size   = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const scale   = (2.2 / maxSize) * modelSizeScale(path);
  object3d.scale.setScalar(scale);
  object3d.position.sub(center.multiplyScalar(scale));
}

function fitFishToOverlay(object3d, path, tierScale = 1.0) {
  const box    = new THREE.Box3().setFromObject(object3d);
  const size   = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  // Base bounds for max dimension
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  let scale = (1.75 * tierScale) / maxSize;

  // Prevent horizontal clipping for extremely long/large fish using current camera framing.
  if (overlayFishCamera && overlayFishCamera.aspect) {
    const fovRad = THREE.MathUtils.degToRad(overlayFishCamera.fov);
    const visibleHeight = 2 * Math.tan(fovRad * 0.5) * overlayFishCamera.position.z * 0.92;
    const visibleWidth = visibleHeight * overlayFishCamera.aspect;
    const renderedWidth = maxSize * scale;
    if (renderedWidth > visibleWidth) {
      scale *= (visibleWidth / renderedWidth);
    }
  }

  // Apply user tuning last so MODEL_SIZE_OVERRIDES always has visible effect.
  scale *= modelSizeScale(path);

  object3d.scale.setScalar(scale);
  object3d.position.sub(center.multiplyScalar(scale));
}

function setObjectOpacity(object3d, alpha) {
  object3d.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material.userData.baseOpacity === undefined) {
        material.userData.baseOpacity = material.opacity ?? 1;
      }
      material.transparent = true;
      material.opacity = material.userData.baseOpacity * alpha;
      material.needsUpdate = true;
    }
  });
}

function computeRightFacingYaw(object3d) {
  const points      = [];
  const rootInverse = new THREE.Matrix4();
  const worldPos    = new THREE.Vector3();
  const center      = new THREE.Vector3();
  const box         = new THREE.Box3();

  object3d.updateWorldMatrix(true, true);
  rootInverse.copy(object3d.matrixWorld).invert();

  object3d.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
    const attr = obj.geometry.attributes.position;
    const step = Math.max(1, Math.floor(attr.count / 2500));
    for (let i = 0; i < attr.count; i += step) {
      worldPos.fromBufferAttribute(attr, i).applyMatrix4(obj.matrixWorld).applyMatrix4(rootInverse);
      points.push(worldPos.clone());
    }
  });

  if (points.length === 0) return -Math.PI * 0.5;

  box.setFromPoints(points);
  box.getCenter(center);
  const size = box.getSize(new THREE.Vector3());
  let primaryAxis = "x";
  if (size.z > size.x && size.z >= size.y) primaryAxis = "z";
  else if (size.y > size.x && size.y > size.z) primaryAxis = "y";

  const axisValue = (v) => primaryAxis === "x" ? v.x : primaryAxis === "y" ? v.y : v.z;
  const axisMin   = primaryAxis === "x" ? box.min.x : primaryAxis === "y" ? box.min.y : box.min.z;
  const axisMax   = primaryAxis === "x" ? box.max.x : primaryAxis === "y" ? box.max.y : box.max.z;
  const axisRange = Math.max(1e-5, axisMax - axisMin);

  let minSpreadSum = 0, maxSpreadSum = 0, minCount = 0, maxCount = 0;
  for (const p of points) {
    const t      = (axisValue(p) - axisMin) / axisRange;
    const spread = Math.abs(p.x - center.x) + Math.abs(p.y - center.y) + Math.abs(p.z - center.z);
    if (t <= 0.2)      { minSpreadSum += spread; minCount += 1; }
    else if (t >= 0.8) { maxSpreadSum += spread; maxCount += 1; }
  }

  const minSpread  = minCount > 0 ? minSpreadSum / minCount : 0;
  const maxSpread  = maxCount > 0 ? maxSpreadSum / maxCount : 0;
  const headAtMax  = maxSpread >= minSpread;

  if (primaryAxis === "x") return headAtMax ? 0 : Math.PI;
  if (primaryAxis === "z") return headAtMax ? -Math.PI * 0.5 : Math.PI * 0.5;
  return -Math.PI * 0.5;
}

// ── Fish display names (cool names instead of raw filenames) ─────────────────
const FISH_DISPLAY_NAMES = {
  "./fish_assets/guppy_fish.glb":                    "Guppy",
  "./fish_assets/guppie_animated.glb":               "Sapphire Guppie",
  "./fish_assets/small_fish.glb":                    "Silver Dart",
  "./fish_assets/redcap_oranda_goldfish.glb":        "Crimson Oranda",
  "./fish_assets/feather_fish.glb":                  "Featherback",
  "./fish_assets/bream_fish__dorade_royale.glb":     "Dorade Royale",
  "./fish_assets/emperor_angelfish_update_v2.glb":   "Emperor Angelfish",
  "./fish_assets/model_47a_-_loggerhead_sea_turtle.glb": "Loggerhead Titan",
  "./fish_assets/model_65a_-_longnose_gar.glb":      "Longnose Gar",
  "./fish_assets/model_66a_-_atlantic_sturgeon.glb": "Atlantic Sturgeon",
  "./fish_assets/tuna_fish.glb":                     "Bluefin Tuna",
  "./fish_assets/manta_ray_birostris_animated.glb":  "Giant Manta Ray",
  "./fish_assets/liriope_jellyfish_trachymedusae.glb": "Liriope Jelly",
  "./fish_assets/shark.glb":                         "Great White Shark",
  "./fish_assets/nile_crocodile_swimming.glb":       "Nile Crocodile",
  "./fish_assets/cryptosuchus.glb":                  "Cryptosuchus",
  "./fish_assets/pistosaur_animated.glb":            "Pistosaur",
  "./fish_assets/f161272aebe34682bb0ff09ce7b76cc9.glb": "Abyss Sentinel",
  "./fish_assets/chelicerate.glb":                   "Deep-Sea Chelicerate",
  "./fish_assets/model_99a_-_whale_shark.glb":       "Whale Shark",
  "./fish_assets/whale.glb":                         "Orca",
  "./fish_assets/glow_whale.glb":                    "Lumen Whale",
  "./fish_assets/shadow_leviathan.glb":              "Shadow Leviathan",
  "./fish_assets/mega_whale.glb":                    "The Leviathan",
  "./fish_assets/tinkle_the_blue_ring_octopus.glb":  "Blue Ring Octopus",
  "./fish_assets/reefback.glb":                      "Reefback",
  "./fish_assets/tulkun_swimming_loop.glb":          "Tulkun",
  "./fish_assets/sea_monster_animated.glb":          "Sea Monster",
  "./fish_assets/ghost_leviathan.glb":               "Ghost Leviathan",
  "./fish_assets/kraken_v2.glb":                     "Kraken",
  "./fish_assets/moon_harvest_-_leviathan.glb":      "Moon Harvest Leviathan",
  "./fish_assets/the_leviathan.glb":                 "Apex Leviathan",
};

const FISH_SPECIAL_LORE = {
  "./fish_assets/guppy_fish.glb": "Fast learner of the shallows, small but fearless in open current.",
  "./fish_assets/guppie_animated.glb": "A spark-tail drifter that bends light like polished sapphire.",
  "./fish_assets/small_fish.glb": "A silver streak built for burst speed and clean escapes.",
  "./fish_assets/redcap_oranda_goldfish.glb": "Elegant and flashy, this one turns every reef into a stage.",
  "./fish_assets/feather_fish.glb": "A ribbon-swimmer that glides in silence before a sudden strike.",
  "./fish_assets/bream_fish__dorade_royale.glb": "Royal plated and calm under pressure, steady in heavy tide.",
  "./fish_assets/emperor_angelfish_update_v2.glb": "Color-rich ruler of reef lanes, precise and territorial.",
  "./fish_assets/model_47a_-_loggerhead_sea_turtle.glb": "Ancient navigator with armor and patient power.",
  "./fish_assets/model_65a_-_longnose_gar.glb": "Needle-jawed ambusher with razor timing.",
  "./fish_assets/model_66a_-_atlantic_sturgeon.glb": "River legend with old-school endurance.",
  "./fish_assets/tuna_fish.glb": "Open-water engine, relentless pace over impossible distance.",
  "./fish_assets/manta_ray_birostris_animated.glb": "Winged giant of blue voids, graceful and unreadable.",
  "./fish_assets/liriope_jellyfish_trachymedusae.glb": "Ghost-bell pulse with hypnotic drift patterns.",
  "./fish_assets/shark.glb": "Pure apex intent, no wasted movement.",
  "./fish_assets/nile_crocodile_swimming.glb": "Ancient hunter with brutal patience and explosive launch.",
  "./fish_assets/cryptosuchus.glb": "Prehistoric menace armored for deep conflict.",
  "./fish_assets/pistosaur_animated.glb": "Fossil-era cruiser that owns the mid-depth battlefield.",
  "./fish_assets/f161272aebe34682bb0ff09ce7b76cc9.glb": "Unknown abyss class, observed but never fully understood.",
  "./fish_assets/chelicerate.glb": "Alien frame from the trench, built to survive impossible pressure.",
  "./fish_assets/model_99a_-_whale_shark.glb": "Mountain of the sea, massive but composed.",
  "./fish_assets/whale.glb": "Black-and-white tactician, social, precise, and dominant.",
  "./fish_assets/glow_whale.glb": "Bioluminescent colossus lighting the midnight ocean.",
  "./fish_assets/shadow_leviathan.glb": "A myth in motion, seen only when the water goes silent.",
  "./fish_assets/mega_whale.glb": "Final form of ocean force, the deep answers when it moves.",
  "./fish_assets/tinkle_the_blue_ring_octopus.glb": "Small body, lethal signal; elegance with venomous precision.",
  "./fish_assets/reefback.glb": "Living island of the reef, calm giant with tectonic presence.",
  "./fish_assets/tulkun_swimming_loop.glb": "Ancient singer of blue canyons, gentle but unshakable.",
  "./fish_assets/sea_monster_animated.glb": "Old-chart nightmare that tears through storm water.",
  "./fish_assets/ghost_leviathan.glb": "Pale predator from blackout depths, felt before seen.",
  "./fish_assets/kraken_v2.glb": "Tentacled catastrophe, chaos wrapped in intelligence.",
  "./fish_assets/moon_harvest_-_leviathan.glb": "A lunar titan that rises when the current goes silver.",
  "./fish_assets/the_leviathan.glb": "Crown beast of the abyss, absolute endgame energy.",
};

function fishNameFromPath(path) {
  return FISH_DISPLAY_NAMES[path]
    ?? path.split("/").pop().replace(".glb", "").replaceAll("_", " ");
}

function fishLoreFromPath(path) {
  return FISH_SPECIAL_LORE[path]
    ?? "A rare creature from the deep, still waiting for its legend.";
}

function bucketIndex(value, limits) {
  const safeValue = Math.max(0, value);
  const idx = limits.findIndex((limit) => safeValue < limit);
  return idx === -1 ? limits.length : idx;
}

function bucketLabel(index, limits, noun) {
  if (index <= 0) return `< ${limits[0]} ${noun}`;
  if (index >= limits.length) return `>= ${limits[limits.length - 1]} ${noun}`;
  return `${limits[index - 1]} - ${limits[index] - 1} ${noun}`;
}

function chooseFishByGitHubStats(publicRepos, commitCount) {
  const commitTier = bucketIndex(commitCount, COMMIT_BUCKET_LIMITS);
  const repoTier   = bucketIndex(publicRepos, REPO_BUCKET_LIMITS);

  let tierIndex = commitTier * REPO_BUCKETS + repoTier;
  if (tierIndex >= fishProgression.length) tierIndex = fishProgression.length - 1;

  return {
    path: fishProgression[tierIndex],
    tierIndex,
    commitTier,
    repoTier,
    commitBand: bucketLabel(commitTier, COMMIT_BUCKET_LIMITS, "commits"),
    repoBand: bucketLabel(repoTier, REPO_BUCKET_LIMITS, "repos"),
  };
}

// ── Animated number counter ───────────────────────────────────────────────────
function animateCounter(el, targetValue, duration = 900) {
  const start     = performance.now();
  const startVal  = 0;
  const isNum     = Number.isFinite(targetValue);
  if (!isNum) { el.textContent = String(targetValue); return; }

  function tick(now) {
    const elapsed = now - start;
    const t       = Math.min(1, elapsed / duration);
    const ease    = easeOutCubic(t);
    const current = Math.round(startVal + (targetValue - startVal) * ease);
    el.textContent = current.toLocaleString();
    el.classList.toggle("pop", t < 0.3);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = targetValue.toLocaleString();
  }
  requestAnimationFrame(tick);
}

// ── Fish Size Visualization ───────────────────────────────────────────────────
function showFishViz(commits, repos) {
  fishVizCommits.textContent = `${commits.toLocaleString()} commits`;
  fishVizRepos.textContent   = String(repos);
  fishViz.hidden = false;
  // small delay so it fades in after the fish canvas is visible
  setTimeout(() => fishViz.classList.add("visible"), 200);
}

function hideFishViz() {
  fishViz.classList.remove("visible");
  setTimeout(() => { fishViz.hidden = true; }, 520);
}

// ── Overlay fish name label ───────────────────────────────────────────────
let overlayFishNameShown = "";

function showOverlayFishName(path) {
  const name = fishNameFromPath(path);
  if (overlayFishNameShown === name && !overlayFishNameEl.hidden) return;
  overlayFishNameShown = name;
  overlayFishNameEl.textContent = name;
  overlayFishNameEl.hidden = false;
  // Trigger transition: briefly remove then re-add to restart animation
  overlayFishNameEl.classList.remove("visible");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => overlayFishNameEl.classList.add("visible"))
  );
}

function hideOverlayFishName() {
  overlayFishNameEl.classList.remove("visible");
  setTimeout(() => {
    overlayFishNameEl.hidden = true;
    overlayFishNameShown = "";
  }, 450);
}

function setFishLore(path, mode = "assigned") {
  const prefix = mode === "preview" ? "Preview" : "Assigned";
  githubFishLore.textContent = `${prefix}: ${fishLoreFromPath(path)}`;
}


const TIER_COLORS = fishProgression.map((_, i) => {
  const t = fishProgression.length <= 1 ? 0 : i / (fishProgression.length - 1);
  const hue = Math.round(196 - t * 168);
  return `hsl(${hue} 82% 56%)`;
});

let previewingTierIndex = -1; // which tier cell the user is currently peeking at

let previewFishPath     = ""; // set by tier click; empty = show assigned fish

const tierCells = [];
(function buildTierGrid() {
  TIER_COLORS.forEach((color, i) => {
    const cell = document.createElement("div");
    cell.className = "tier-cell";
    cell.style.setProperty("--cell-color", color);
    const fishName = fishNameFromPath(fishProgression[i]);
    cell.title    = `Tier ${i + 1}: ${fishName}`;
    cell.setAttribute("data-fish", fishName);
    const num = document.createElement("span");
    num.className = "tier-num";
    num.textContent = String(i + 1);
    cell.appendChild(num);
    tierGridEl.appendChild(cell);
    tierCells.push(cell);

    // Click: preview that tier's fish in the overlay canvas
    cell.addEventListener("click", () => {
      if (transitionState !== "black") return;
      if (previewingTierIndex === i) {
        previewingTierIndex = -1;
        previewFishPath = "";
        overlayFishPreparedForPath = "";
        overlayFishSpawn       = 0;
        overlayFishSpawnTarget = 0;
        overlayFishCanvas.style.opacity = "0";
        hideOverlayFishName();
        setFishLore(assignedTierFishPath || assignedFishPathForDive, "assigned");
        tierCells.forEach((c, ci) => {
          c.classList.remove("previewing");
          c.classList.toggle("active", ci === diveTierIndex);
          c.classList.toggle("below-active", ci < diveTierIndex);
        });
        return;
      }

      // Update visual state of all cells
      tierCells.forEach((c, ci) => {
        c.classList.remove("previewing");
        c.classList.toggle("active", ci === diveTierIndex);
        c.classList.toggle("below-active", ci < diveTierIndex);
      });
      cell.classList.add("previewing");
      previewingTierIndex = i;

      // Set previewFishPath — the animate loop's black-state block picks this up
      // on the very next frame and calls prepareOverlayFish with the right path.
      const newPath = fishProgression[i];
      if (previewFishPath !== newPath) {
        previewFishPath = newPath;
        setFishLore(newPath, "preview");
        // Reset path guard so the animate loop triggers a fresh load
        overlayFishPreparedForPath = "";
        // Fade out current fish immediately
        overlayFishSpawn       = 0;
        overlayFishSpawnTarget = 0;
        overlayFishCanvas.style.opacity = "0";
        hideOverlayFishName();
      }
    });
  });
})();

function activateTierGrid(tierIndex) {
  tierGridWrap.hidden = false;
  previewingTierIndex = -1;
  previewFishPath     = ""; // reset preview on new dive data
  tierCells.forEach((cell, i) => {
    cell.classList.remove("active", "below-active", "previewing");
    setTimeout(() => {
      if (i < tierIndex)  cell.classList.add("below-active");
      if (i === tierIndex) cell.classList.add("active");
    }, i * 28);
  });
}

function resetTierGrid() {
  tierGridWrap.hidden = true;
  previewingTierIndex = -1;
  previewFishPath     = "";
  tierCells.forEach((cell) => cell.classList.remove("active", "below-active", "previewing"));
}

// ── GitHub panel ──────────────────────────────────────────────────────────────
function setGithubPanelLoading(username) {
  assignedTierFishPath = "";
  githubPanel.hidden = false;
  githubName.textContent      = "Loading GitHub profile...";
  githubUsername.textContent  = username || "-";
  githubRepos.textContent     = "-";
  githubCommits.textContent   = "-";
  githubFish.textContent      = "-";
  githubCommitBand.textContent = "Commit band: -";
  githubRepoBand.textContent = "Repo band: -";
  githubFishLore.textContent = "Dive to unlock creature lore.";
  githubStatus.textContent    = "Fetching data...";
  resetTierGrid();
}

function setGithubPanelData(data, tierIndex) {
  githubPanel.hidden = false;
  githubName.textContent     = data.displayName;
  githubUsername.textContent = data.username;
  animateCounter(githubRepos,   data.publicRepos,  700);
  animateCounter(githubCommits, data.commitCount,  1100);
  githubFish.textContent    = data.assignedFish;
  githubCommitBand.textContent = `Commit band: ${data.commitBand}`;
  githubRepoBand.textContent = `Repo band: ${data.repoBand}`;
  assignedTierFishPath = data.assignedFishPath || "";
  setFishLore(assignedTierFishPath, "assigned");
  githubStatus.textContent  = data.note || "";
  activateTierGrid(tierIndex);
}

function setGithubPanelError(username, message) {
  assignedTierFishPath = "";
  githubPanel.hidden = false;
  githubName.textContent      = "GitHub profile unavailable";
  githubUsername.textContent  = username || "-";
  githubRepos.textContent     = "-";
  githubCommits.textContent   = "-";
  githubFish.textContent      = "-";
  githubCommitBand.textContent = "Commit band: -";
  githubRepoBand.textContent = "Repo band: -";
  githubFishLore.textContent = "No creature assigned yet.";
  githubStatus.textContent    = message;
  resetTierGrid();
}

// ── GitHub fetch ──────────────────────────────────────────────────────────────
async function fetchJson(url, timeoutMs = 8000, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...extraHeaders,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGithubStats(usernameRaw) {
  const username   = usernameRaw.trim();
  const userUrl    = `https://api.github.com/users/${encodeURIComponent(username)}`;
  const commitsUrl = `https://api.github.com/search/commits?q=author:${encodeURIComponent(username)}`;

  const user = await fetchJson(userUrl);
  let commitCount = 0;
  let note = "";

  try {
    const commits = await fetchJson(commitsUrl);
    commitCount   = Number.isFinite(commits.total_count) ? commits.total_count : 0;
    if (commitCount >= 1000) note = "Commit count may be truncated by GitHub search indexing.";
  } catch {
    note = "Commit count unavailable due to GitHub API limits.";
  }

  return {
    displayName: user.name || username,
    username:    user.login || username,
    publicRepos: user.public_repos ?? 0,
    commitCount,
    note,
  };
}

// ── GLTF helpers ──────────────────────────────────────────────────────────────
async function patchLegacySpecGloss(gltf) {
  const parser        = gltf.parser;
  const materialsJson = parser.json?.materials || [];
  const textureCache  = new Map();
  const tasks         = [];

  const getTexture = (index) => {
    if (!textureCache.has(index)) {
      textureCache.set(index, parser.getDependency("texture", index));
    }
    return textureCache.get(index);
  };

  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      const association = parser.associations.get(material);
      if (!association || association.materials === undefined) continue;

      const srcMat   = materialsJson[association.materials];
      const specGloss = srcMat?.extensions?.KHR_materials_pbrSpecularGlossiness;
      if (!specGloss) continue;

      tasks.push((async () => {
        if (specGloss.diffuseTexture?.index !== undefined) {
          const tex = await getTexture(specGloss.diffuseTexture.index);
          tex.colorSpace = THREE.SRGBColorSpace;
          material.map   = tex;
        }
        if (srcMat.normalTexture?.index !== undefined) {
          material.normalMap = await getTexture(srcMat.normalTexture.index);
        }
        if (srcMat.emissiveTexture?.index !== undefined) {
          const emissiveTex = await getTexture(srcMat.emissiveTexture.index);
          emissiveTex.colorSpace  = THREE.SRGBColorSpace;
          material.emissiveMap    = emissiveTex;
          if (material.emissive) material.emissive.setRGB(1, 1, 1);
          material.emissiveIntensity = 1.0;
        }
        if ("metalness" in material) material.metalness = 0.08;
        if ("roughness" in material) material.roughness = 0.62;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      })());
    }
  });

  await Promise.all(tasks);
}

// ── showFish (browse mode) ────────────────────────────────────────────────────
async function showFish(index) {
  const path = fishPaths[index];
  lookFishBtn.disabled = true;
  nextFishBtn.disabled = true;
  fishLabel.textContent = "Loading...";

  const gltf = await loader.loadAsync(path);
  await patchLegacySpecGloss(gltf);

  if (activeMixer)   { activeMixer.stopAllAction(); activeMixer  = null; }
  if (activeFishRig) fishScene.remove(activeFishRig);

  activeFish    = gltf.scene;
  fitFishToView(activeFish, path);
  activeBaseYaw = fishYawOverrides[path] ?? computeRightFacingYaw(activeFish);
  activeMainTune = modelViewTune(path, "main");

  activeFishRig = new THREE.Group();
  activeFishRig.rotation.set(
    activeMainTune.pitch,
    activeBaseYaw + activeMainTune.yaw,
    activeMainTune.roll
  );
  activeFishRig.add(activeFish);
  fishScene.add(activeFishRig);

  fishSpawn       = 0;
  fishSpawnTarget = 1;
  activeFishIndex = index;
  setFishLabel(path);
  activeFishHasClips = Array.isArray(gltf.animations) && gltf.animations.length > 0;

  if (activeFishHasClips) {
    activeMixer = new THREE.AnimationMixer(activeFish);
    for (const clip of gltf.animations) {
      const action = activeMixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }
  }

}

// ── resizeOverlayFishRenderer ──────────────────────────────────────────────────
function resizeOverlayFishRenderer() {
  const rect   = overlayFishCanvas.getBoundingClientRect();
  const width  = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  overlayFishRenderer.setSize(width, height, false);
  overlayFishCamera.aspect = width / height;
  overlayFishCamera.updateProjectionMatrix();
}

// ── prepareOverlayFish ────────────────────────────────────────────────────────
// Uses a load-token to discard stale async results from rapid clicks.
let overlayFishLoadToken = 0;

async function prepareOverlayFish(path) {
  if (!path) return;

  // PATH GUARD — prevents the frame-loop from triggering a new load every frame.
  // The tier-click handler resets overlayFishPreparedForPath to "" before calling
  // this, so new paths always get through exactly once.
  if (overlayFishPreparedForPath === path) return;

  // Claim a unique token for this load.
  // Any previous in-flight load that completes after us will see a mismatch and bail out.
  const token = ++overlayFishLoadToken;

  // Lock the path guard immediately so the frame-loop doesn't also queue a load.
  overlayFishPreparedForPath = path;

  // Tear down whatever is currently in the scene synchronously,
  // BEFORE the async GLTF load begins.
  if (overlayFishRig) {
    overlayFishScene.remove(overlayFishRig);
    overlayFishRig = null;
  }
  lastOverlayMeshOpacity = -1;
  if (overlayFishMixer) {
    overlayFishMixer.stopAllAction();
    overlayFishMixer = null;
  }

  const gltf = await loader.loadAsync(path);
  await patchLegacySpecGloss(gltf);

  // If a newer load has started since, discard this result — don't add to scene.
  if (token !== overlayFishLoadToken) return;

  // Also clear any rig a concurrent load may have sneaked in.
  if (overlayFishRig) {
    overlayFishScene.remove(overlayFishRig);
    overlayFishRig = null;
  }
  lastOverlayMeshOpacity = -1;
  if (overlayFishMixer) {
    overlayFishMixer.stopAllAction();
    overlayFishMixer = null;
  }

  const model = gltf.scene;
  fitFishToOverlay(model, path, tierScaleForPath(path));
  overlayFishBaseYaw = fishYawOverrides[path] ?? computeRightFacingYaw(model);
  activeOverlayTune = modelViewTune(path, "overlay");
  overlayFishRig     = new THREE.Group();
  overlayFishRig.rotation.set(
    activeOverlayTune.pitch,
    overlayFishBaseYaw + activeOverlayTune.yaw,
    activeOverlayTune.roll
  );
  overlayFishRig.add(model);
  setObjectOpacity(overlayFishRig, 0);
  lastOverlayMeshOpacity = 0;
  overlayFishScene.add(overlayFishRig);

  if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
    overlayFishMixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const action = overlayFishMixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }
  }

  resizeOverlayFishRenderer();
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setMainUiDisabled(disabled) {
  warpInput.disabled   = disabled;
  warpTrigger.disabled = disabled;
}

function resetOverlayVideos() {
  for (const video of overlayVideos) {
    video.pause();
    video.currentTime = 0;
    video.classList.remove("is-active");
  }
  activeOverlayVideo  = overlayVideoA;
  standbyOverlayVideo = overlayVideoB;
  activeOverlayVideo.classList.add("is-active");
  overlaySwapCooldown = 0;
}

function startOverlayPlayback() {
  resetOverlayVideos();
  activeOverlayVideo.play().catch(() => {});
}

function updateOverlayLoop(delta) {
  if (!activeOverlayVideo || transitionState === "returning" || transitionState === "idle") return;

  overlaySwapCooldown = Math.max(0, overlaySwapCooldown - delta);
  const duration = activeOverlayVideo.duration;
  if (!duration || !Number.isFinite(duration) || overlaySwapCooldown > 0) return;

  const remaining = duration - activeOverlayVideo.currentTime;
  if (remaining > 0.18) return;

  const next = standbyOverlayVideo;
  next.currentTime = 0.02;
  next.classList.add("is-active");
  activeOverlayVideo.classList.remove("is-active");
  next.play().catch(() => {});

  const old = activeOverlayVideo;
  old.pause();
  old.currentTime = 0;

  activeOverlayVideo  = next;
  standbyOverlayVideo = old;
  overlaySwapCooldown = 0.25;
}

// ── GitHub fetch flow ─────────────────────────────────────────────────────────
function startGitHubFetchFlow(username) {
  diveDataReady   = false;
  diveDataOk      = false;
  diveDataMessage = "Loading GitHub data...";

  fetchGithubStats(username)
    .then(async (githubData) => {
      const fishAssignment = chooseFishByGitHubStats(githubData.publicRepos, githubData.commitCount);
      assignedFishPathForDive = fishAssignment.path;
      diveCommitCount         = githubData.commitCount;
      divePublicRepos         = githubData.publicRepos;
      diveTierIndex           = fishAssignment.tierIndex;

      const assignedFish = fishNameFromPath(fishAssignment.path);
      githubData.assignedFish = assignedFish;
      githubData.assignedFishPath = fishAssignment.path;
      githubData.commitBand = fishAssignment.commitBand;
      githubData.repoBand = fishAssignment.repoBand;

      const mappingNote = `Tier ${fishAssignment.tierIndex + 1}: commit bucket ${fishAssignment.commitTier + 1} + repo bucket ${fishAssignment.repoTier + 1}.`;
      githubData.note = githubData.note ? `${githubData.note} ${mappingNote}` : mappingNote;

      setGithubPanelData(githubData, fishAssignment.tierIndex);
      diveDataOk      = true;
      diveDataMessage = "GitHub data ready.";
      diveDataReady   = true;
    })
    .catch((error) => {
      const errorCode = error?.message || "";
      if (errorCode === "404") {
        setGithubPanelError(username, "Username not found on GitHub.");
      } else if (errorCode === "403") {
        setGithubPanelError(username, "GitHub API rate limit reached. Try again shortly.");
      } else {
        setGithubPanelError(username, "Failed to fetch GitHub profile.");
      }
      diveDataOk      = false;
      diveDataMessage = "GitHub data failed.";
      diveDataReady   = true;
    });
}

// ── Event listeners ───────────────────────────────────────────────────────────
const clock   = new THREE.Clock();
let elapsedTime = 0;
let shaderTime  = 0;
let shaderSpeed = 1.0;
let targetShaderSpeed = 1.0;
let transitionState   = "idle";
let transitionTimer   = 0;
let overlayOpacity    = 0;
let cameraYOffset     = 0;
let targetCameraYOffset = 0;

const transitionDurations = {
  accelerating: 1.1,
  fading:       2.2,
  returning:    1.5,
};

async function startDiveTransition() {
  if (transitionState !== "idle") return;

  const username = warpInput.value.trim();
  if (!username) return;

  setMainUiDisabled(true);
  setGithubPanelLoading(username);

  transitionState = "accelerating";
  transitionTimer = 0;
  targetShaderSpeed = 1.0;
  overlayFishSpawn       = 0;
  overlayFishSpawnTarget = 0;
  overlayFishPreparedForPath = "";
  blackOverlay.classList.add("active");
  returnBtn.hidden = true;
  hideFishViz();

  startGitHubFetchFlow(username);

  await Promise.race([overlayVideoReadyPromise, new Promise((resolve) => setTimeout(resolve, 900))]);
  startOverlayPlayback();
}

warpTrigger.addEventListener("click", startDiveTransition);
warpInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") startDiveTransition();
});

returnBtn.addEventListener("click", () => {
  if (transitionState !== "black") return;

  transitionState = "returning";
  transitionTimer = 0;
  targetShaderSpeed = 1.0;
  returnBtn.hidden  = true;
  hideFishViz();

  if (activeFishRig) {
    fishScene.remove(activeFishRig);
    activeFishRig = null;
    activeFish    = null;
  }
  activeMainTune = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  if (activeMixer) {
    activeMixer.stopAllAction();
    activeMixer = null;
  }
  fishSpawn              = 0;
  fishSpawnTarget        = 0;
  overlayFishSpawn       = 0;
  overlayFishSpawnTarget = 0;
  overlayFishCanvas.style.opacity = "0";
});

window.addEventListener("resize", () => {
  bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE.maxBgDpr));
  fishRenderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE.maxFishDpr));
  overlayFishRenderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE.maxOverlayDpr));
  bgRenderer.setSize(window.innerWidth, window.innerHeight);
  fishRenderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1);
  fishCamera.aspect = window.innerWidth / window.innerHeight;
  fishCamera.updateProjectionMatrix();
  resizeOverlayFishRenderer();
});

// ── Render loop ───────────────────────────────────────────────────────────────
let vizShown = false; // track whether we've shown fish viz this dive

function animate() {
  const delta = clock.getDelta();
  elapsedTime   += delta;
  transitionTimer += delta;

  // ── Transition state machine ──
  if (transitionState === "accelerating") {
    const t = clamp01(transitionTimer / transitionDurations.accelerating);
    const e = easeOutCubic(t);
    targetShaderSpeed    = 1.0 + e * 9.0;
    targetCameraYOffset  = -1.2 * easeInOutCubic(t);
    targetCameraParallaxX = 0;
    targetCameraParallaxY = 0;
    if (t >= 1) {
      transitionState = "fading";
      transitionTimer = 0;
    }
  } else if (transitionState === "fading") {
    const t = clamp01(transitionTimer / transitionDurations.fading);
    const e = easeInOutCubic(t);
    targetShaderSpeed   = 8.0 - e * 7.4;
    targetCameraYOffset = -1.2 - e * 1.6;
    overlayOpacity      = e;
    targetCameraParallaxX = 0;
    targetCameraParallaxY = 0;
    if (t >= 1) {
      transitionState = "black";
      transitionTimer = 0;
      targetShaderSpeed   = 0.3;
      targetCameraYOffset = -2.8;
      vizShown = false;
    }
  } else if (transitionState === "black") {
    targetShaderSpeed   = 0.3;
    targetCameraYOffset = -2.8;
    overlayOpacity      = 1;
    // Subtle underwater camera drift
    targetCameraParallaxX = mouseNormX * 0.08;
    targetCameraParallaxY = mouseNormY * 0.04;

    returnBtn.hidden = !diveDataReady;
    if (!diveDataReady) {
      githubStatus.textContent = "Fetching GitHub data...";
    } else if (diveDataMessage) {
      githubStatus.textContent = diveDataMessage;
    }
    if (diveDataReady && diveDataOk && assignedFishPathForDive) {
      // Use previewFishPath (tier click) if set, otherwise show assigned fish
      const fishToShow = previewFishPath || assignedFishPathForDive;
      if (overlayFishPreparedForPath !== fishToShow) {
        prepareOverlayFish(fishToShow).catch((error) => console.error(error));
      }
      overlayFishSpawnTarget = 1;
      // Show name label once fish starts fading in
      if (overlayFishSpawn > 0.05) showOverlayFishName(fishToShow);
      // Show fish viz once when assigned data is ready (not on tier previews)
      if (!vizShown && !previewFishPath) {
        vizShown = true;
        showFishViz(diveCommitCount, divePublicRepos);
      }
    }
  } else if (transitionState === "returning") {
    const t = clamp01(transitionTimer / transitionDurations.returning);
    const e = easeInOutCubic(t);
    overlayOpacity      = 1 - e;
    targetCameraYOffset = -2.8 * (1 - e);
    targetShaderSpeed   = 0.3 + 0.7 * e;
    targetCameraParallaxX = 0;
    targetCameraParallaxY = 0;
    if (t >= 1) {
      transitionState = "idle";
      transitionTimer = 0;
      vizShown        = false;
      blackOverlay.classList.remove("active");
      setMainUiDisabled(false);
      targetShaderSpeed = 1.0;
      warpInput.value   = "";
      githubPanel.hidden = true;
      assignedFishPathForDive = "";
      assignedTierFishPath = "";
      resetOverlayVideos();
      overlayFishPreparedForPath = "";
      if (overlayFishRig) {
        overlayFishScene.remove(overlayFishRig);
        overlayFishRig = null;
      }
      lastOverlayMeshOpacity = -1;
      activeOverlayTune = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
      if (overlayFishMixer) {
        overlayFishMixer.stopAllAction();
        overlayFishMixer = null;
      }
      overlayFishCanvas.style.opacity = "0";
      resetTierGrid();
      hideOverlayFishName();
    }
  } else {
    // idle — active camera parallax from mouse
    targetShaderSpeed     = 1.0;
    targetCameraYOffset   = 0;
    overlayFishSpawnTarget = 0;
    targetCameraParallaxX = mouseNormX * 0.18;
    targetCameraParallaxY = mouseNormY * 0.10;
  }

  blackOverlay.style.opacity = String(overlayOpacity);
  updateOverlayLoop(delta);

  // Lerp camera parallax (smooth mouse follow)
  cameraPrlxX += (targetCameraParallaxX - cameraPrlxX) * Math.min(1, delta * 2.0);
  cameraPrlxY += (targetCameraParallaxY - cameraPrlxY) * Math.min(1, delta * 2.0);

  shaderSpeed    += (targetShaderSpeed    - shaderSpeed)    * Math.min(1, delta * 2.6);
  cameraYOffset  += (targetCameraYOffset  - cameraYOffset)  * Math.min(1, delta * 2.2);
  fishSpawn      += (fishSpawnTarget      - fishSpawn)      * Math.min(1, delta * 2.8);
  overlayFishSpawn += (overlayFishSpawnTarget - overlayFishSpawn) * Math.min(1, delta * 8.0);

  shaderTime += delta * shaderSpeed;
  uniforms.iTime.value = shaderTime;
  uniforms.uCameraYOffset.value = cameraYOffset;

  // Apply camera parallax to fish camera
  fishCamera.position.x = cameraPrlxX;
  fishCamera.position.y = 0.2 + cameraPrlxY;
  fishCamera.position.z = 5;
  fishCamera.lookAt(0, fishBaseYOffset + cameraPrlxY * 0.4, 0);

  if (activeMixer)      activeMixer.update(delta);
  if (overlayFishMixer) overlayFishMixer.update(delta);

  if (activeFishRig) {
    const spawn = easeOutCubic(clamp01(fishSpawn));
    activeFishRig.position.x = -8.0 + spawn * 8.0 + activeMainTune.x;
    activeFishRig.position.y = fishBaseYOffset + 0.3 + Math.sin(elapsedTime * 1.6) * 0.12 + activeMainTune.y;
    activeFishRig.position.z = activeMainTune.z;
    activeFishRig.rotation.set(
      activeMainTune.pitch,
      activeBaseYaw + activeMainTune.yaw,
      activeMainTune.roll
    );
  }

  if (overlayFishRig) {
    const spawn = easeOutCubic(clamp01(overlayFishSpawn));
    overlayFishCanvas.style.opacity = String(spawn);
    overlayFishRig.scale.setScalar(0.62 + spawn * 0.38);
    // Centre fish horizontally in the canvas; gentle Y float around true centre
    overlayFishRig.position.x = -0.3 + easeInOutCubic(spawn) * 0.3 + activeOverlayTune.x;
    overlayFishRig.position.y = 0.0 + Math.sin(elapsedTime * 1.2) * 0.08 + activeOverlayTune.y;
    overlayFishRig.position.z = activeOverlayTune.z;
    overlayFishRig.rotation.set(
      activeOverlayTune.pitch,
      overlayFishBaseYaw + (1 - spawn) * 0.35 + activeOverlayTune.yaw,
      activeOverlayTune.roll
    );
    if (Math.abs(spawn - lastOverlayMeshOpacity) >= PERFORMANCE.overlayOpacityStep) {
      setObjectOpacity(overlayFishRig, spawn);
      lastOverlayMeshOpacity = spawn;
    }
    overlayFishRenderer.render(overlayFishScene, overlayFishCamera);
  }

  bgRenderer.render(bgScene, bgCamera);
  fishRenderer.render(fishScene, fishCamera);
  requestAnimationFrame(animate);
}

resizeOverlayFishRenderer();
animate();
