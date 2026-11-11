import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import * as CANNON from "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";

// -----------------------------------------------------------------------------
// EXTREME DRIVE: NEXT GEN - browser driving prototype
// Rendering: Three.js | Physics: cannon-es
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const canvas = $("scene");
const loadingBar = $("progress-bar");
const loadingStatus = $("loading-status");

const state = {
  paused: false,
  cameraMode: 0,
  speed: 0,
  rpm: 850,
  gear: 1,
  messageTimer: 0,
  keys: Object.create(null),
  mobile: { gas: false, brake: false, left: false, right: false },
  startedAt: performance.now()
};

function setLoading(progress, label) {
  loadingBar.style.width = `${progress}%`;
  loadingStatus.textContent = label;
}

setLoading(8, "Building renderer");

// Renderer --------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// Scene -----------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91b5c8);
scene.fog = new THREE.Fog(0x91b5c8, 100, 480);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 5, 11);

const hemi = new THREE.HemisphereLight(0xd9efff, 0x59624b, 2.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffedcf, 3.0);
sun.position.set(-80, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
scene.add(sun);

setLoading(22, "Creating physics world");

// Physics ---------------------------------------------------------------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.05;

const groundMaterial = new CANNON.Material("ground");
const tireMaterial = new CANNON.Material("tire");
world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, tireMaterial, {
  friction: 0.9, restitution: 0.0, contactEquationStiffness: 1e7
}));

// Helpers ---------------------------------------------------------------------
const mat = (color, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function addVisualBox(parent, size, position, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addStaticBox(x, y, z, sx, sy, sz, material, options = {}) {
  const body = new CANNON.Body({ mass: 0, material: groundMaterial });
  body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
  body.position.set(x, y, z);
  if (options.rotation) body.quaternion.setFromEuler(...options.rotation);
  world.addBody(body);

  const mesh = new THREE.Mesh(boxGeo, material);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { body, mesh };
}

// Terrain ---------------------------------------------------------------------
setLoading(35, "Generating Test Valley");

const terrainMat = mat(0x687d58);
const terrainGeo = new THREE.PlaneGeometry(1000, 1000, 80, 80);
terrainGeo.rotateX(-Math.PI / 2);
const pos = terrainGeo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const hills = Math.sin(x * 0.018) * 1.6 + Math.cos(z * 0.021) * 1.8;
  const small = Math.sin(x * 0.07 + z * 0.04) * 0.35;
  pos.setY(i, hills + small - 1.5);
}
terrainGeo.computeVertexNormals();
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

// A flat physical driving zone under the main test area.
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
groundBody.position.set(0, -0.55, 0);
world.addBody(groundBody);

// Track surface and markings.
const asphalt = mat(0x343b43, 0.95);
const road = new THREE.Mesh(new THREE.BoxGeometry(24, 0.16, 230), asphalt);
road.position.set(0, -0.35, -52);
road.receiveShadow = true;
scene.add(road);

const lineMat = new THREE.MeshBasicMaterial({ color: 0xe9e3c8 });
for (let z = 55; z > -165; z -= 12) {
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 5.5), lineMat);
  dash.position.set(0, -0.255, z);
  scene.add(dash);
}

// Road shoulders.
const shoulderMat = mat(0xb4a88b);
for (const x of [-13, 13]) {
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(2, 0.18, 230), shoulderMat);
  shoulder.position.set(x, -0.32, -52);
  shoulder.receiveShadow = true;
  scene.add(shoulder);
}

// Physics collision road.
addStaticBox(0, -0.48, -52, 24, 0.25, 230, asphalt);

// Hills and distant mountains.
const mountainMat = mat(0x71818a);
for (let i = 0; i < 28; i++) {
  const angle = (i / 28) * Math.PI * 2;
  const radius = 230 + Math.sin(i * 4.1) * 25;
  const height = 38 + (i % 5) * 10;
  const mountain = new THREE.Mesh(
    new THREE.ConeGeometry(30 + (i % 4) * 8, height, 5),
    mountainMat
  );
  mountain.position.set(Math.cos(angle) * radius, height / 2 - 3, Math.sin(angle) * radius);
  mountain.rotation.y = angle;
  mountain.castShadow = true;
  scene.add(mountain);
}

// Props and obstacles ---------------------------------------------------------
setLoading(48, "Placing test obstacles");
const barrierMat = mat(0xe9e9e5);
const redMat = mat(0xe64c3e);
const rampMat = mat(0x555e6a);
const tireMatVisual = mat(0x111417);

for (let i = 0; i < 12; i++) {
  const z = -12 - i * 13;
  const side = i % 2 === 0 ? -1 : 1;
  addStaticBox(side * (7 + (i % 3)), 0.35, z, 1.1, 0.7, 1.1, i % 2 ? redMat : barrierMat);
}

// Ramp wedges approximated with angled solid blocks.
addStaticBox(-5.5, 0.85, -36, 7, 1.2, 10, rampMat, { rotation: [-0.16, 0, 0] });
addStaticBox(5.5, 1.0, -103, 7, 1.5, 12, rampMat, { rotation: [0.2, 0, 0] });

// Concrete blocks outside the track.
for (let i = 0; i < 18; i++) {
  const x = (i % 2 ? 1 : -1) * (18 + (i % 4) * 3);
  const z = 35 - Math.floor(i / 2) * 20;
  addStaticBox(x, 1.0, z, 3.2, 2, 3.2, i % 3 ? barrierMat : redMat);
}

// Decorative trees.
const trunkMat = mat(0x594332);
const leafMat = mat(0x315b42);
for (let i = 0; i < 95; i++) {
  const x = (Math.random() - 0.5) * 260;
  const z = (Math.random() - 0.5) * 300;
  if (Math.abs(x) < 19 && z < 65 && z > -170) continue;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 3.2, 7), trunkMat);
  trunk.position.set(x, 1.1, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1 + Math.random(), 5.2, 7), leafMat);
  crown.position.set(x, 4.2, z);
  crown.castShadow = true;
  scene.add(crown);
}

// Vehicle ---------------------------------------------------------------------
setLoading(60, "Assembling RAPTOR X");

const chassisShape = new CANNON.Box(new CANNON.Vec3(1.02, 0.42, 2.15));
const chassisBody = new CANNON.Body({
  mass: 1450,
  material: tireMaterial,
  position: new CANNON.Vec3(0, 1.35, 20),
  linearDamping: 0.08,
  angularDamping: 0.42
});
chassisBody.addShape(chassisShape);
chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
chassisBody.updateMassProperties();
world.addBody(chassisBody);

const vehicle = new CANNON.RaycastVehicle({
  chassisBody,
  indexRightAxis: 0,
  indexUpAxis: 1,
  indexForwardAxis: 2
});

const wheelOptions = {
  radius: 0.43,
  directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 34,
  suspensionRestLength: 0.38,
  frictionSlip: 4.2,
  dampingRelaxation: 2.3,
  dampingCompression: 4.5,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  axleLocal: new CANNON.Vec3(-1, 0, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
  maxSuspensionTravel: 0.3,
  customSlidingRotationalSpeed: -30,
  useCustomSlidingRotationalSpeed: true
};

const wheelPositions = [
  [-0.88, 0.0, 1.42],
  [0.88, 0.0, 1.42],
  [-0.88, 0.0, -1.42],
  [0.88, 0.0, -1.42]
];

wheelPositions.forEach((point) => {
  wheelOptions.chassisConnectionPointLocal.set(point[0], point[1], point[2]);
  vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(...point) });
});
vehicle.addToWorld(world);

// Visual car model.
const carRoot = new THREE.Group();
scene.add(carRoot);

const bodyPaint = new THREE.MeshStandardMaterial({
  color: 0xd83e2f, roughness: 0.32, metalness: 0.55
});
const darkPaint = mat(0x151b22, 0.28, 0.5);
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x142b3a, roughness: 0.12, metalness: 0.55,
  transparent: true, opacity: 0.88
});
const lightMat = new THREE.MeshStandardMaterial({
  color: 0xeaf7ff, emissive: 0x9ccfff, emissiveIntensity: 1.7
});
const tailMat = new THREE.MeshStandardMaterial({
  color: 0xff352b, emissive: 0x9c0905, emissiveIntensity: 1.1
});

addVisualBox(carRoot, [2.0, 0.72, 4.1], [0, 0.05, 0], bodyPaint);
addVisualBox(carRoot, [1.65, 0.78, 2.05], [0, 0.72, -0.28], bodyPaint);
addVisualBox(carRoot, [1.53, 0.63, 1.7], [0, 0.82, -0.32], glassMat);
addVisualBox(carRoot, [1.92, 0.18, 0.22], [0, -0.24, 1.9], darkPaint);
addVisualBox(carRoot, [1.92, 0.18, 0.22], [0, -0.24, -1.9], darkPaint);
addVisualBox(carRoot, [0.48, 0.2, 0.12], [-0.62, 0.17, 2.07], lightMat);
addVisualBox(carRoot, [0.48, 0.2, 0.12], [0.62, 0.17, 2.07], lightMat);
addVisualBox(carRoot, [0.45, 0.16, 0.1], [-0.62, 0.12, -2.07], tailMat);
addVisualBox(carRoot, [0.45, 0.16, 0.1], [0.62, 0.12, -2.07], tailMat);

// Front grille and mirrors.
addVisualBox(carRoot, [0.82, 0.32, 0.08], [0, -0.02, 2.09], darkPaint);
for (const side of [-1, 1]) {
  addVisualBox(carRoot, [0.16, 0.16, 0.34], [side * 1.05, 0.55, 0.65], darkPaint);
}

// Wheel visuals.
const wheelMeshes = [];
const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.28, 24);
wheelGeo.rotateZ(Math.PI / 2);
for (let i = 0; i < 4; i++) {
  const wheel = new THREE.Mesh(wheelGeo, tireMatVisual);
  wheel.castShadow = true;
  carRoot.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 16), mat(0x9ba7b2, 0.3, 0.8));
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  wheelMeshes.push(wheel);
}

// Small roof lights.
for (let i = -1; i <= 1; i++) {
  addVisualBox(carRoot, [0.22, 0.12, 0.13], [i * 0.45, 1.23, 0.3], lightMat);
}

// Input -----------------------------------------------------------------------
function isDown(key) { return !!state.keys[key]; }
function gasPressed() { return isDown("w") || isDown("arrowup") || state.mobile.gas; }
function brakePressed() { return isDown("s") || isDown("arrowdown") || state.mobile.brake; }
function leftPressed() { return isDown("a") || isDown("arrowleft") || state.mobile.left; }
function rightPressed() { return isDown("d") || isDown("arrowright") || state.mobile.right; }

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  state.keys[key] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  if (key === " " ) state.keys.space = true;
  if (key === "r") resetVehicle();
  if (key === "f") flipVehicle();
  if (key === "c") cycleCamera();
  if (key === "escape" || key === "p") togglePause();
});
window.addEventListener("keyup", (event) => {
  state.keys[event.key.toLowerCase()] = false;
  if (event.key === " ") state.keys.space = false;
});

document.querySelectorAll("[data-control]").forEach((button) => {
  const name = button.dataset.control;
  const down = (event) => { event.preventDefault(); state.mobile[name] = true; };
  const up = (event) => { event.preventDefault(); state.mobile[name] = false; };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointerleave", up);
  button.addEventListener("pointercancel", up);
});

function cycleCamera() {
  state.cameraMode = (state.cameraMode + 1) % 3;
  showMessage(["CHASE CAMERA", "CLOSE CAMERA", "HOOD CAMERA"][state.cameraMode]);
}
function flipVehicle() {
  chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
  chassisBody.position.y += 1.8;
  chassisBody.velocity.set(0, 0, 0);
  chassisBody.angularVelocity.set(0, 0, 0);
  showMessage("VEHICLE RECOVERED");
}
function resetVehicle() {
  chassisBody.position.set(0, 1.35, 20);
  chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
  chassisBody.velocity.set(0, 0, 0);
  chassisBody.angularVelocity.set(0, 0, 0);
  vehicle.wheelInfos.forEach((wheel) => {
    wheel.suspensionLength = wheel.suspensionRestLength;
  });
  showMessage("VEHICLE RESET");
}
function showMessage(text) {
  const el = $("message");
  el.textContent = text;
  el.classList.add("show");
  state.messageTimer = 1.7;
}

$("pause-btn").addEventListener("click", togglePause);
$("resume-btn").addEventListener("click", togglePause);
$("reset-menu-btn").addEventListener("click", () => { resetVehicle(); togglePause(); });

function togglePause() {
  state.paused = !state.paused;
  $("pause-overlay").classList.toggle("hidden", !state.paused);
}

// Vehicle controls ------------------------------------------------------------
const MAX_ENGINE_FORCE = 5200;
const MAX_BRAKE_FORCE = 90;
let smoothedSteer = 0;

function updateVehicleControls(dt) {
  const gas = gasPressed();
  const brake = brakePressed();
  const handbrake = isDown("space");
  const steerInput = (leftPressed() ? 1 : 0) - (rightPressed() ? 1 : 0);

  const speedKmh = chassisBody.velocity.length() * 3.6;
  const forwardSpeed = chassisBody.velocity.dot(
    new CANNON.Vec3(
      Math.sin(chassisBody.quaternion.toEuler ? 0 : 0), 0, 1
    )
  );

  smoothedSteer += (steerInput - smoothedSteer) * Math.min(1, dt * 5.5);
  const speedFactor = Math.max(0.34, 1 - speedKmh / 190);
  const steering = smoothedSteer * 0.48 * speedFactor;

  vehicle.setSteeringValue(steering, 0);
  vehicle.setSteeringValue(steering, 1);

  const engineForce = gas ? -MAX_ENGINE_FORCE : 0;
  vehicle.applyEngineForce(engineForce, 2);
  vehicle.applyEngineForce(engineForce, 3);

  const brakeForce = brake ? MAX_BRAKE_FORCE : (handbrake ? 65 : 0);
  for (let i = 0; i < 4; i++) vehicle.setBrake(brakeForce, i);

  // Simple speed-based gear and RPM display.
  const speed = Math.abs(speedKmh);
  state.gear = speed < 1 ? 1 : Math.min(6, Math.max(1, Math.floor(speed / 28) + 1));
  state.rpm = Math.round(850 + Math.min(6500, speed * 35 + (gas ? 900 : 0)));
  state.speed = speedKmh;

  if (chassisBody.position.y < -8) resetVehicle();
}

// Synchronize Three.js car with Cannon.js body and wheels.
function syncVehicle() {
  carRoot.position.copy(chassisBody.position);
  carRoot.quaternion.copy(chassisBody.quaternion);

  for (let i = 0; i < vehicle.wheelInfos.length; i++) {
    vehicle.updateWheelTransform(i);
    const transform = vehicle.wheelInfos[i].worldTransform;
    wheelMeshes[i].position.copy(transform.position);
    wheelMeshes[i].quaternion.copy(transform.quaternion);
  }
}

// Camera ----------------------------------------------------------------------
const cameraTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const cameraLook = new THREE.Vector3();

function updateCamera(dt) {
  const carPosition = carRoot.position;
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(carRoot.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(carRoot.quaternion);

  if (state.cameraMode === 0) {
    desiredCamera.copy(carPosition).addScaledVector(forward, -9.5).add(new THREE.Vector3(0, 4.2, 0));
    cameraLook.copy(carPosition).addScaledVector(forward, 3.5).add(new THREE.Vector3(0, 1.1, 0));
  } else if (state.cameraMode === 1) {
    desiredCamera.copy(carPosition).addScaledVector(forward, -5.4).add(new THREE.Vector3(0, 2.2, 0));
    cameraLook.copy(carPosition).addScaledVector(forward, 5).add(new THREE.Vector3(0, 1, 0));
  } else {
    desiredCamera.copy(carPosition).addScaledVector(up, 1.2).addScaledVector(forward, 0.8);
    cameraLook.copy(carPosition).addScaledVector(forward, 18);
  }

  const smoothing = 1 - Math.pow(0.001, dt);
  camera.position.lerp(desiredCamera, smoothing);
  cameraTarget.lerp(cameraLook, smoothing);
  camera.lookAt(cameraTarget);
}

// UI --------------------------------------------------------------------------
function updateUI() {
  const speed = Math.max(0, Math.round(state.speed));
  $("velocity").textContent = speed;
  $("big-speed").textContent = String(speed).padStart(3, "0");
  $("speed-fill").style.width = `${Math.min(100, speed / 220 * 100)}%`;
  $("rpm").textContent = state.rpm.toLocaleString();
  $("rpm-fill").style.width = `${Math.min(100, state.rpm / 7000 * 100)}%`;
  $("gear").textContent = state.gear;
  $("big-gear").textContent = state.gear;
  $("ground-state").textContent = chassisBody.position.y < 0.65 ? "CONTACT" : "AIRBORNE";
  $("engine-status").textContent = state.paused ? "STANDBY" : "RUNNING";
}

// Environment details ---------------------------------------------------------
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
for (let i = 0; i < 20; i++) {
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(5 + Math.random() * 7, 8, 6), cloudMat);
  cloud.scale.set(1.8, 0.55, 1);
  cloud.position.set((Math.random() - 0.5) * 360, 48 + Math.random() * 35, (Math.random() - 0.5) * 360);
  scene.add(cloud);
}

// A few distant structures for scale.
const towerMat = mat(0x87939a, 0.65, 0.2);
for (let i = 0; i < 8; i++) {
  const x = (i % 2 ? 1 : -1) * (45 + i * 5);
  const z = -70 - i * 18;
  addStaticBox(x, 5, z, 3, 10 + (i % 3) * 4, 3, towerMat);
}

// Resize ----------------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Main loop -------------------------------------------------------------------
setLoading(82, "Finalizing vehicle systems");

let previousTime = performance.now();
const fixedTimeStep = 1 / 60;
let accumulator = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;

  if (!state.paused) {
    updateVehicleControls(dt);
    accumulator += dt;
    while (accumulator >= fixedTimeStep) {
      world.step(fixedTimeStep);
      accumulator -= fixedTimeStep;
    }
    syncVehicle();
    updateCamera(dt);
    updateUI();
  }

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) $("message").classList.remove("show");
  }

  renderer.render(scene, camera);
}

setLoading(100, "Ready");
setTimeout(() => $("loading").classList.add("done"), 450);
requestAnimationFrame(animate);

// Helpful startup message.
showMessage("WASD TO DRIVE  /  C TO CHANGE CAMERA");
