import * as THREE from 'three';
import PoissonDiskSampling from 'poisson-disk-sampling';

import { Hive, Patch } from './location.js';
import { Bee } from './bee.js';
import { MAX_NUM_BEES, NUM_PATCHES, MIN_PER_DAY, WORLD_SIZE } from './parameters.js';
import { drawVoronoi, processVoronoi } from './voronoi.js'

const scene = new THREE.Scene();

// orthographic camera setup
const aspect = 1;
const frustumSize = WORLD_SIZE;
const left = -frustumSize * aspect / 2;
const right = frustumSize * aspect / 2;
const top = frustumSize / 2;
const bottom = -frustumSize / 2;
const near = 0.1;
const far = 1000;
const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);

camera.position.set(0, 50, 0);
camera.lookAt(0, 0, 0);
camera.up.set(0, 0, -1);

// light setup
const light = new THREE.AmbientLight(0x5060a0, 3); // dark bluish ambient light
light.position.set(0, 30, 0);
scene.add(light);
const sunIntensity = 5;
const directionalLight = new THREE.DirectionalLight(0xffffff, sunIntensity); // bright white sunlight
directionalLight.position.set(0, 30, 0);
scene.add(directionalLight);

// add canvas to document
const container = document.getElementById('canvas-container');

// renderer
function getWindowSize() {
    let size = Math.min(container.clientWidth, container.clientHeight);
    if (window.innerHeight * 0.96 > 0) {
        size = Math.min(size, window.innerHeight * 0.96);
    }
    return Math.floor(size);
}
// console.log(window.innerWidth, window.innerHeight, container.clientWidth, container.clientHeight);

const renderer = new THREE.WebGLRenderer();
const windowSize = getWindowSize();
container.setAttribute("style", `width: ${windowSize}px`);
renderer.setSize(windowSize, windowSize);
renderer.setPixelRatio(window.devicePixelRatio);
// renderer.shadowMap.enabled = true;
// renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// document.body.appendChild(renderer.domElement);
window.addEventListener('resize', () => {
    const updatedSize = getWindowSize();
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(updatedSize, updatedSize);
    container.setAttribute("style", `width: ${updatedSize}px`);
});


// overlay text
const clockTime = document.getElementById('current-time');
const clockDay = document.getElementById('current-day');
container.prepend(renderer.domElement);

// ground
const geometry = new THREE.PlaneGeometry(frustumSize, frustumSize);
const material = new THREE.MeshPhongMaterial({ color: 0x11cc44, side: THREE.DoubleSide });
const ground = new THREE.Mesh(geometry, material);
ground.receiveShadow = true;
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const hive = new Hive(scene, renderer, frustumSize);

// Poisson disk sampling for more evenly spaced flower patches
var p = new PoissonDiskSampling({
    shape: [frustumSize - 20, frustumSize - 20],
    minDistance: frustumSize * (1 / 20),
    maxDistance: frustumSize,
    tries: 30
});
p.addPoint([frustumSize / 2, frustumSize / 2])

const patches = []
var point;
while ((point = p.next()) && patches.length < NUM_PATCHES) {
    let [x, z] = point;
    const patch = new Patch(frustumSize, x - frustumSize / 2 + 10, z - frustumSize / 2 + 10);
    scene.add(patch.mesh);
    patches.push(patch);
}

const bees = []
for (let i = 0; i < MAX_NUM_BEES; i++) {
    const bee = new Bee(scene, renderer, frustumSize, hive, patches);
    bees.push(bee);
}
bees[0].active_bee = true;

let lastTime = 0;
let currTime = 0.5;
let currDay = 0;
let frame = 0;


// var cells = processVoronoi(hive, patches, currTime, oldCell);
// drawVoronoi(cells, scene);

function animate(time) {
    const delta = time - lastTime;
    lastTime = time;

    if (!delta || isNaN(delta)) {
        renderer.render(scene, camera);
        return;
    }

    const deltaDay = delta / 1000 * 1 / (MIN_PER_DAY * 60); // convert real ms unit to simulation day unit
    currTime += deltaDay;
    if (currTime >= 1) {
        currTime = 0;
        currDay += 1;
    }

    bees.forEach((bee) => { bee.update(deltaDay, currTime) });
    patches.forEach((patch) => { patch.update(deltaDay) });


    const hour = Math.floor(currTime * 24);
    const minute = Math.floor(60 * (24 * currTime - hour));
    const d = 23.5 * Math.PI / 180;
    const lightLevel = Math.max(0, Math.min(1, Math.cos(d) * Math.cos((currTime - 0.5) * Math.PI * 1.3)))

    directionalLight.intensity = lightLevel * sunIntensity;

    clockTime.innerText = `${String(hour).padStart(2, 0)}:${String(minute).padStart(2, 0)}`;
    clockDay.innerText = currDay;

    frame += 1;
    if (frame > 11) {
        frame = 0;
    }

    // cells = processVoronoi(hive, patches, currTime, oldCell);
    // drawVoronoi(cells, scene);

    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

