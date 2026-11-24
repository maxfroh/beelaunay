import * as THREE from 'three';
import PoissonDiskSampling from 'poisson-disk-sampling';

import { Hive, Patch } from './location.js';
import { Bee } from './bee.js';
import { MAX_NUM_BEES, NUM_PATCHES, MIN_PER_DAY, WORLD_SIZE } from './parameters.js';


// persistent DOM queries
const container = document.getElementById('canvas-container');
const clockTime = document.getElementById('current-time');
const clockDay = document.getElementById('current-day');

const patchesInput = document.getElementById("num-patches-number");
const beesInput = document.getElementById("num-bees-number");
const restartButton = document.getElementById("restart-btn");

// renderer
function getWindowSize() {
    let size = Math.min(container.clientWidth, container.clientHeight);
    if (window.innerHeight * 0.96 > 0) {
        size = Math.min(size, window.innerHeight * 0.96);
    }
    return Math.floor(size);
}

const renderer = new THREE.WebGLRenderer();
const windowSize = getWindowSize();
container.setAttribute("style", `width: ${windowSize}px`);
renderer.setSize(windowSize, windowSize);
renderer.setPixelRatio(window.devicePixelRatio);
container.prepend(renderer.domElement);

let scene;
let camera;
let bees = [];
let patches = [];
const aspect = 1;
const frustumSize = WORLD_SIZE;

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


function startSimulation() {
    // reset animation
    renderer.setAnimationLoop(null);

    // reset bees and patches
    bees.forEach((bee) => {
        bee.destroy();
    });
    bees = [];
    Patch.reset();
    patches = [];

    // clean up old stuff
    if (scene) {
        scene.traverse((object) => {
            if (object.isMesh && object.geometry) {
                object.geometry.dispose();
            }
            if (object.isMesh && object.material & !object.material.map) {
                if (Array.isArray(object.material)) {
                    object.material.forEach((material) => {
                        material.dispose();
                    });
                } else {
                    object.material.dispose();
                }
            }
        });
    }

    const numPatches = parseInt(patchesInput.value, 10) || NUM_PATCHES;
    const numBees = parseInt(beesInput.value, 10) || MAX_NUM_BEES;

    scene = new THREE.Scene();

    // orthographic camera setup
    const left = -frustumSize * aspect / 2;
    const right = frustumSize * aspect / 2;
    const top = frustumSize / 2;
    const bottom = -frustumSize / 2;
    const near = 0.1;
    const far = 1000;
    camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);
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

    // ground
    const geometry = new THREE.PlaneGeometry(frustumSize, frustumSize);
    // 0x11cc44
    const material = new THREE.MeshPhongMaterial({ color: 0x20ab46, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(geometry, material);
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // time
    let lastTime = 0;
    let currTime = 0.5;
    let currDay = 0;
    let frame = 0;

    // hive
    const hive = new Hive(scene, renderer, frustumSize);

    // Poisson disk sampling for more evenly spaced flower patches
    var p = new PoissonDiskSampling({
        shape: [frustumSize - 20, frustumSize - 20],
        minDistance: frustumSize * (1 / 20),
        maxDistance: frustumSize,
        tries: 30
    });
    p.addPoint([frustumSize / 2, frustumSize / 2])

    var point;
    while ((point = p.next()) && patches.length < numPatches) {
        let [x, z] = point;
        const patch = new Patch(frustumSize, x - frustumSize / 2 + 10, z - frustumSize / 2 + 10);
        scene.add(patch.object);
        patches.push(patch);
    }

    for (let i = 0; i < numBees; i++) {
        const bee = new Bee(scene, renderer, frustumSize, hive, patches, currTime);
        bees.push(bee);
    }
    bees[0].active_bee = true;


    function animate(time) {
        if (lastTime === 0) {
            lastTime = time;
            renderer.render(scene, camera);
            return;
        }

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

        renderer.render(scene, camera);
    }

    renderer.setAnimationLoop(animate);
}

restartButton.addEventListener('click', startSimulation);
startSimulation();
