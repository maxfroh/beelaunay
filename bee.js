import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { randFloat, randInt } from 'three/src/math/MathUtils.js';
import { Patch } from './location';
import { BEE_COLLECTION_TIME, BEE_NECTAR_CAPACITY, EMPTY_BEE_SPEED, MIN_PER_DAY, MILES_TO_UNIT, WAKE_UP_TIME, SLEEP_TIME } from './parameters';
import { getVoronoiCells, drawVoronoi } from './voronoi';


export class Bee {
    // Variables for the shared static template model
    static loader = new GLTFLoader();
    static beeTemplate = null;
    static isLoaded = false;
    static loadPromise = null;

    static loadBeeModel(renderer) {
        if (Bee.loadPromise) {
            return Bee.loadPromise;
        }

        Bee.loadPromise = new Promise((resolve, reject) => {
            Bee.loader.load('bee.glb', (gltf) => {
                gltf.scene.children.forEach((child) => {
                    child.rotation.y += -Math.PI / 2;
                });

                gltf.scene.traverse((child) => {
                    if (child.isMesh && child.material.map) {
                        child.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        child.material.map.minFilter = THREE.LinearMipmapLinearFilter;
                        child.material.needsUpdate = true;
                    }
                });
                gltf.scene.scale.set(2, 2, 2);
                Bee.beeTemplate = gltf.scene;
                Bee.isLoaded = true;
                resolve(gltf.scene);
            }, undefined, (error) => {
                console.error(error);
                reject(error);
            });
        });

        return Bee.loadPromise;
    }

    /**
     * @param {THREE.Scene} scene 
     * @param {THREE.WebGLRenderer} renderer
     * @param {number} frustumSize
     * @param {Hive} hive  
     * @param {Array<Patch>} patches 
     */
    constructor(scene, renderer, frustumSize, hive, patches, currTime) {
        this.scene = scene;
        this.hive = hive;
        this.patches = patches;

        if (Bee.isLoaded) {
            this.initMesh();
        } else {
            Bee.loadBeeModel(renderer).then(() => {
                this.initMesh();
            });
        }

        this.goingHome = false;
        this.gatheringNectar = false;
        this.nectarCollected = 0;
        this.nectarTimer = 0;
        this.wakeUpTime = WAKE_UP_TIME + randFloat(-0.04, 0.04);
        this.sleepTime = SLEEP_TIME + randFloat(-0.04, 0.04)

        this.lowerBound = Math.min(frustumSize * .1, 10);
        this.upperBound = Math.max(frustumSize * .9, frustumSize - 10);
        this.centerMargin = frustumSize / 2;
        this.target = this.getNewTarget(currTime);

        this.voronoi = null;
        this.active_bee = false;
        this.position = new THREE.Vector3().copy(this.hive.position);
    }

    initMesh() {
        this.mesh = Bee.beeTemplate.clone(true);
        this.mesh.position.copy(this.hive.position);
        // this.originalColor = this.mesh.material.color.clone();
        this.hive.bees_present += 1;
        this.scene.add(this.mesh);
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }
        this.target = null;
        this.voronoi = null;
        this.patches = null;
        this.hive = null;
    }

    setActive() {
        this.active_bee = false;
        // this.mesh.material.color.set("rgb(255, 0, 0)");
    }

    setInactive() {
        this.active_bee = false;
        // this.mesh.material.color.set(this.originalColor);
    }


    /**
     * @param {number} delta 
     */
    update(delta, currTime) {
        if (this.gatheringNectar) {
            this.nectarTimer += delta;

            const nectar = this.target.collectNectar ? this.target.collectNectar(delta) : 1;
            this.nectarCollected += (isNaN(nectar) ? 0 : nectar);

            if (this.nectarTimer > BEE_COLLECTION_TIME || this.nectarCollected >= BEE_NECTAR_CAPACITY || nectar == 0) {
                this.target.beesPresent = Math.max(0, this.target.beesPresent - 1);
                this.nectarTimer = 0;
                this.gatheringNectar = false;

                if (this.nectarCollected >= BEE_NECTAR_CAPACITY) {
                    console.log("I'm full!");
                    this.goingHome = true;
                    this.target = this.hive;
                } else {
                    this.target = this.getNewTarget(currTime);
                    // this.currPatches = this.patches.filter(patch => patch.position != this.target.position);
                    // this.voronoi_cells = processVoronoi(this.target, this.patches, currTime);
                    // if (this.active_bee) {
                    //     drawVoronoi(this.voronoi_cells, this.scene);
                    // }
                    if (this.target === this.hive) {
                        this.goingHome = true;
                    }
                }
            }
        }

        if (this.active_bee) {
            this.voronoi = getVoronoiCells(this.position, this.target, this.patches, currTime);
            drawVoronoi(this.voronoi.cells, this.voronoi.adjacencyMap, this.scene, this.target);
        }

        this.move(delta, currTime);

    }

    /**
     * @param {number} delta 
     */
    move(delta, currTime) {
        // don't move if the mesh is not loaded
        if (!this.mesh || !this.target) {
            return;
        }

        this.mesh.lookAt(this.target.position);
        const distance = this.mesh.position.distanceTo(this.target.position);
        const step = EMPTY_BEE_SPEED * delta * 24 * MILES_TO_UNIT; // X mi/hr * 1/day * 24hr/day * y units/mi ==> speed in units/day

        if (distance < step) {
            this.mesh.position.copy(this.target.position);
            this.target.beesPresent += 1;

            if (!this.goingHome) {
                this.gatheringNectar = true;
            } else {
                this.nectarCollected = 0;
                this.goingHome = false;
                this.target = this.getNewTarget(currTime);
            }
        } else {
            const direction = new THREE.Vector3().subVectors(this.target.position, this.mesh.position).normalize();
            this.mesh.position.addScaledVector(direction, step);
            this.position.addScaledVector(direction, step);
        }

    }

    /**
     * @returns {Patch}
     */
    getNewTarget(currTime) {
        if (this.sleepTime < currTime || currTime < this.wakeUpTime) {
            return this.hive;
        }

        if (this.target != null) {
            this.voronoi = getVoronoiCells(this.position, this.target, this.patches, currTime);
        }

        const getPatch = () => {
            const adjMap = this.voronoi?.adjacencyMap?.[this.target?.name];
            if (Array.isArray(adjMap) && adjMap.length > 0) {
                const randomIndex = adjMap[Math.floor(Math.random() * adjMap.length)]
                return this.patches[randomIndex];
            }
            return this.patches[Math.floor(Math.random() * this.patches.length)];
        }

        let newTarget = getPatch();
        let tries = 10;

        // if (this.voronoi == null || this.target?.name == null) {
        //     newTarget = this.patches[Math.floor(Math.random() * this.patches.length)];
        // } else {
        //     let adjMap = this.voronoi.adjacencyMap[this.target.name];
        //     newTarget = this.patches[adjMap[Math.floor(Math.random() * adjMap.length)]];
        // }

        if (this.target && this.target !== this.hive) {
            while (
                !newTarget ||
                newTarget === this.target ||
                (newTarget.nectarLevel !== undefined && newTarget.nectarLevel <= 0)
            ) {
                // let adjMap = this.voronoi.adjacencyMap[this.target.name];
                // newTarget = this.patches[adjMap[Math.floor(Math.random() * adjMap.length)]];
                tries -= 1;
                if (tries <= 0) {
                    console.log("Couldn't find anyone... going home!");
                    this.goingHome = true;
                    this.gatheringNectar = false;
                    return this.hive;
                }
                newTarget = getPatch();
            }
        }
        return newTarget;
    }
}