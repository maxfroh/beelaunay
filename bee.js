import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { randFloat } from "three/src/math/MathUtils.js";
import { Patch } from "./location";
import { BEE_COLLECTION_TIME, BEE_NECTAR_CAPACITY, EMPTY_BEE_SPEED, MIN_PER_DAY, MILES_TO_UNIT, WAKE_UP_TIME, SLEEP_TIME, BEE_ALIVE_TIME_OFFSET } from "./parameters";
import { getVoronoiCells, drawVoronoi } from "./voronoi";

import hobbiesFile from "/hobbies.txt?raw";
import namesFile from "/names.txt?raw";

export class Bee {
    // Variables for the shared static template model
    static loader = new GLTFLoader();
    static beeTemplate = null;
    static isModelLoaded = false;
    static modelPromise = null;
    static hobbies = hobbiesFile.split(",").map(str => str.trim()).filter(Boolean);
    static names = namesFile.split(",").map(str => str.trim()).filter(Boolean);;
    // static isTextLoaded = false;
    // static textPromise = null;

    static loadBeeModel(renderer) {
        if (Bee.modelPromise) {
            return Bee.modelPromise;
        }

        Bee.modelPromise = new Promise((resolve, reject) => {
            Bee.loader.load("bee.glb", (gltf) => {
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
                Bee.isModelLoaded = true;
                resolve(gltf.scene);
            }, undefined, (error) => {
                console.error(error);
                reject(error);
            });
        });

        return Bee.modelPromise;
    }
    /*
        static loadBeeText() {
            if (Bee.textPromise) {
                return Bee.textPromise;
            } 
            
            Bee.textPromise = Promise.all([
                Bee.loadTxt("hobbies.txt", ","),
                Bee.loadTxt("names.txt", ","),
            ]).then(([hobbies, names]) => {
                Bee.hobbies = hobbies;
                Bee.names = names;
            });
    
            return Bee.textPromise;
        }
    
        /**
        * @param {string} file The text file to read
        * @param {string} delimeter The delimeter to use
        * /
        static async loadTxt(file, delimeter) {
            try {
                console.log(`loading ${file}`);
                const response = await fetch(file);
                console.log(`fetched ${file}`);
                if (!response.ok) {
                    throw new Error(`${response.status}`);
                }
                const text = await response.text();
                console.log(`retrieved ${file} text`);
                const list = text.split(delimeter).map(item => item.trim()).filter(Boolean);
                return list;
            } catch (error) {
                console.error(`Failed to load ${file}:`, error);
                return ["Fail"];
            }
        }
    */

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

        if (Bee.isModelLoaded) {
            this.initMesh();
            this.ready = Promise.resolve();
        } else {
            this.ready = Bee.loadBeeModel(renderer).then(() => {
                this.initMesh();
            });
        }

        this.goingHome = false;
        this.gatheringNectar = false;
        this.nectarCollected = 0;
        this.nectarTimer = 0;
        this.speed = EMPTY_BEE_SPEED;
        this.asleep = false;
        this.wakeUpTime = WAKE_UP_TIME + randFloat(-BEE_ALIVE_TIME_OFFSET, BEE_ALIVE_TIME_OFFSET);
        this.sleepTime = SLEEP_TIME + randFloat(-BEE_ALIVE_TIME_OFFSET, BEE_ALIVE_TIME_OFFSET);

        this.name = Bee.names[Math.floor(Math.random() * Bee.names.length)];
        this.hobbies = new Set();
        while (this.hobbies.size < 3) {
            this.hobbies.add(Bee.hobbies[Math.floor(Math.random() * Bee.hobbies.length)]);
        }

        this.lowerBound = Math.min(frustumSize * 0.1, 10);
        this.upperBound = Math.max(frustumSize * 0.9, frustumSize - 10);
        this.centerMargin = frustumSize / 2;
        this.target = this.getNewTarget(currTime);

        this.voronoi = null;
        this.active_bee = false;
        this.position = new THREE.Vector3().copy(this.hive.position);
    }

    initMesh() {
        this.group = new THREE.Group();
        this.mesh = Bee.beeTemplate.clone(true);
        this.mesh.position.copy(new THREE.Vector3(0, 1, 0));

        this.circleGeometry = new THREE.CircleGeometry(3, 64, 0, Math.PI * 2);
        this.circleMaterial = new THREE.MeshPhongMaterial({ color: 0xf5b85d, transparent: true, opacity: 0, side: THREE.DoubleSide });
        this.circleMesh = new THREE.Mesh(this.circleGeometry, this.circleMaterial);
        this.circleMesh.position.copy(new THREE.Vector3(0, 0.5, -0.5));
        this.circleMesh.rotation.x = -Math.PI / 2

        this.hive.bees_present += 1;

        this.group.add(this.mesh);
        this.group.add(this.circleMesh);

        this.group.position.copy(this.hive.position);

        this.scene.add(this.group);
    }

    destroy() {
        if (this.group) {
            this.group.traverse((child) => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                }

                if (Array.isArray(child.material)) {
                    child.material.forEach((material) => material.dispose());
                } else {
                    child.material?.dispose();
                }
            });
            this.scene.remove(this.group);
            this.group = null;
        }
        this.target = null;
        this.voronoi = null;
        this.patches = null;
        this.hive = null;
    }

    setActive() {
        this.active_bee = true;
        this.ready.then(() => {
            if (this.circleMesh) {
                this.circleMesh.material.opacity = 1;
            }
        });
    }

    setInactive() {
        this.active_bee = false;
        if (this.circleMesh) {
            this.circleMesh.material.opacity = 0;
        }
    }

    /**
     * @param {number} delta 
     */
    update(delta, currTime, activeBeeData) {
        if (this.gatheringNectar) {
            this.nectarTimer += delta;

            const nectar = this.target.collectNectar ? this.target.collectNectar(delta) : 1;
            this.nectarCollected += (isNaN(nectar) ? 0 : nectar);

            if (this.nectarTimer > BEE_COLLECTION_TIME || this.nectarCollected >= BEE_NECTAR_CAPACITY || nectar == 0) {
                this.target.beesPresent = Math.max(0, this.target.beesPresent - 1);
                this.nectarTimer = 0;
                this.gatheringNectar = false;

                if (this.nectarCollected >= BEE_NECTAR_CAPACITY) {
                    this.goingHome = true;
                    this.target = this.hive;
                } else {
                    this.target = this.getNewTarget(currTime);
                    if (this.target === this.hive) {
                        this.goingHome = true;
                    }
                }
            }
        }

        if (this.active_bee) {
            this.voronoi = getVoronoiCells(this.position, this.target, this.patches, currTime);
            drawVoronoi(this.voronoi.cells, this.voronoi.adjacencyMap, this.scene, this.target);

            activeBeeData.name.textContent = this.name;

            const ul = document.createElement("ul");
            this.hobbies.forEach((hobby) => {
                const li = document.createElement("li");
                li.textContent = hobby;
                ul.appendChild(li);
            });
            activeBeeData.hobbies.replaceChildren(ul);

            if (this.asleep) {
                activeBeeData.target.textContent = "Hive";
                activeBeeData.nectar.textContent = `${(0).toFixed(2)}%`
                activeBeeData.nectarProgress.style.setProperty("--percent", 0);

            } else {
                activeBeeData.target.textContent = this.target === this.hive ? "Hive" : `Flower Patch #${this.target.name}`;
                const nectarPercent = Math.round(10000 * Math.max(0, Math.min(this.nectarCollected / BEE_NECTAR_CAPACITY, 1))) / 100;
                activeBeeData.nectar.textContent = `${nectarPercent.toFixed(2)}%`
                activeBeeData.nectarProgress.style.setProperty("--percent", nectarPercent);

            }


        }

        this.move(delta, currTime);

    }

    /**
     * @param {number} delta 
     */
    move(delta, currTime) {
        // do not move if the mesh is not loaded
        if (!this.group || !this.target) {
            return;
        } 

        if (this.asleep) {
            return;
        }

        this.group.lookAt(this.target.position);
        const distance = this.group.position.distanceTo(this.target.position);
        const step = this.speed * delta * 24 * MILES_TO_UNIT; // X mi/hr * 1/day * 24hr/day * y units/mi ==> speed in units/day

        if (distance < step) {
            this.group.position.copy(this.target.position);
            this.target.beesPresent += 1;

            if (!this.goingHome) {
                this.gatheringNectar = true;
            } else {
                this.nectarCollected = 0;
                this.goingHome = false;
                this.target = this.getNewTarget(currTime);
            }
        } else {
            const direction = new THREE.Vector3().subVectors(this.target.position, this.group.position).normalize();
            this.group.position.addScaledVector(direction, step);
            this.position.addScaledVector(direction, step);
        }

    }

    /**
     * @returns {Patch}
     */
    getNewTarget(currTime) {
        if (this.sleepTime < currTime || currTime < this.wakeUpTime) {
            this.asleep = true;
            return this.hive;
        } else {
            this.asleep = false;
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
                    console.log("Could not find a good patch... going home!");
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