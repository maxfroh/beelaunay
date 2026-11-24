import * as THREE from 'three';
import { randInt } from 'three/src/math/MathUtils.js';
import { BEE_COLLECTION_TIME, MIN_PER_DAY, MIN_SIZE, MAX_SIZE, RECOUP_TIME, BEE_COLLECTION_RATE, WORLD_SIZE, Y } from './parameters';


export class Location {
    constructor() {
        this.beesPresent = 0;
    }
}


export class Hive extends Location {
    constructor(scene, renderer, frustumSize) {
        super();
        this.scene = scene;
        const x = 0;
        const y = Y;
        const z = 0;
        this.radius = 4;
        this.segments = 6;
        this.position = new THREE.Vector3(x, y, z);
        this.geometry = new THREE.CircleGeometry(this.radius, this.segments);
        this.material = new THREE.MeshPhongMaterial({ color: 0xa36700, side: THREE.DoubleSide });
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.position.copy(this.position);
        this.mesh.rotation.x = -Math.PI / 2
        this.scene.add(this.mesh);
    }
}


export class Patch extends Location {
    static BLACK = new THREE.Color().setHSL(0, 0, 0);
    static NECTAR = new THREE.Color().setRGB(0.039, 0.165, 0.361);
    static POLLEN = new THREE.Color().setRGB(0.878, 0.741, 0.043);
    static label = 0;

    static reset() {
        Patch.label = 0;
    }

    constructor(frustumSize, provided_x, provided_z) {
        super();
        this.name = Patch.label;
        Patch.label += 1;

        this.lowerBound = Math.min(frustumSize * .1, 10);
        this.upperBound = Math.max(frustumSize * .9, frustumSize - 10);
        const centerMargin = frustumSize / 2;

        var x;
        if (provided_x === null) {
            x = centerMargin - randInt(this.lowerBound, this.upperBound);
        } else {
            x = provided_x;
        }

        const y = Y;

        var z;
        if (provided_z === null) {
            z = centerMargin - randInt(this.lowerBound, this.upperBound);
        } else {
            z = provided_z;
        }
        this.radius = randInt(MIN_SIZE, MAX_SIZE);
        const segments = 6;

        this.position = new THREE.Vector3(x, y, z);
        this.geometry = new THREE.CircleGeometry(this.radius, segments);
        this.color = new THREE.Color(
            `hsl(${randInt(270, 320)}, ${randInt(50, 80)}%, ${randInt(50, 80)}%)`
        )
        this.material = new THREE.MeshPhongMaterial({ color: this.color, side: THREE.DoubleSide });
        this.mesh = new THREE.Mesh(this.geometry, this.material);

        this.nectarBaseLevel = 2 * this.radius;
        this.nectarLevel = this.nectarBaseLevel;
        this.recoupTimer = 0;
        this.averageAttractiveness = randInt(1, 100) / 100;

        this.circleSegments = 64;
        this.nectarCircleGeometry = new THREE.CircleGeometry(this.radius + 1, this.circleSegments, 0, Math.PI * 2);
        this.nectarCircleMaterial = new THREE.MeshPhongMaterial({ color: Patch.NECTAR, side: THREE.DoubleSide });
        this.nectarCircleMesh = new THREE.Mesh(this.nectarCircleGeometry, this.nectarCircleMaterial);
        this.nectarCircleMesh.position.copy(new THREE.Vector3(0, 0, -1));

        this.object = new THREE.Group();
        this.object.add(this.mesh);
        this.object.add(this.nectarCircleMesh);
        this.object.position.copy(this.position);
        this.object.rotation.x = -Math.PI / 2;
    }


    update(delta) {
        const currentColor = new THREE.Color().lerpColors(Patch.BLACK, this.color, this.nectarLevel / this.nectarBaseLevel);
        this.material.color.set(currentColor);
        if (this.name == 2) {
            // console.log(`n: ${this.nectarLevel} r: ${this.recoupTimer}`);
        }
        if (this.nectarLevel == 0 && this.recoupTimer < RECOUP_TIME) {
            this.recoupTimer += delta;
        } else {
            this.recoupTimer = 0;
            this.nectarLevel = Math.min(
                this.nectarBaseLevel,
                this.nectarLevel + delta
            );
        }
        const numSegments = Math.floor(this.circleSegments * this.nectarLevel / this.nectarBaseLevel);
        this.nectarCircleGeometry.setDrawRange(0, numSegments * 3);
    }

    collectNectar(delta) {
        // console.log(delta * BEE_COLLECTION_RATE);
        const nectar = Math.min(this.nectarLevel, delta * BEE_COLLECTION_RATE);
        this.nectarLevel = Math.max(
            0,
            this.nectarLevel - nectar
        );
        if (this.name == 2) {
            // console.log(`returning ${nectar} | n: ${this.nectarLevel}`);
        }
        return nectar;
    }


    /**
     * @param {Hive} hive
     * @param {number} time 
     */
    getWeight(hive, time, numPatches) {
        const maxWeight = 0.5 * WORLD_SIZE / Math.sqrt(numPatches);
        const halfMaxWeight = maxWeight / 2;

        const maxDistance = Math.sqrt(2 * Math.pow(WORLD_SIZE - 20, 2))

        const p_h = hive.position;
        const p_t = this.position;
        const size = this.nectarBaseLevel;
        const n = this.nectarLevel;
        const b = this.beesPresent;

        const daylightFactor = this.#getDaylightFactor(p_h, p_t, time);
        const weightFactor = (
            90 * (n * n / size) * 10 * 1 / (b / 2 + 1)
        ) / 100;

        return daylightFactor * (halfMaxWeight * weightFactor + halfMaxWeight);
    }


    /**
     * @param {Vector3} p_h The location of the hive.
     * @param {Vector3} p_t The location of the target patch.
     * @param {number} size The total nectar capacity of the target.
     * @param {number} n The current nectar capacity of the target.
     * @param {number} b The current number of bees at the target.
     * @param {number} t The time of day (any number in [0, 24)).
     * @param {number} a The average attractiveness of flowers in the target patch.
     * @returns {number} The weight of the patch. 
    */

    /**
     * @param {THREE.Vector3} p_h 
     * @param {THREE.Vector3} p_t 
     * @param {number} t
     */
    #getDaylightFactor(p_h, p_t, t) {
        const a = 1;
        const k1 = 0.3227;
        const s1 = 0.0227;
        const k2 = 0.73402801;
        const s2 = 0.02548398;
        const c = 0;
        const r = 1.0 / (1 + Math.exp(-1 * (t - k1) / s1));
        const f = 1.0 / (1 + Math.exp((t - k2) / s2));
        return a * r * f + c
    }
}
