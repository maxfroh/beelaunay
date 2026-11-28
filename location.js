import * as THREE from 'three';
import { randInt } from 'three/src/math/MathUtils.js';
import { BEE_COLLECTION_TIME, MIN_PER_DAY, MIN_SIZE, MAX_SIZE, RECOUP_TIME, BEE_COLLECTION_RATE, WORLD_SIZE, MIN_PATCH_DISTANCE, Y } from './parameters';


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
    static minDistance = WORLD_SIZE;
    static maxDistance = 0;

    static reset() {
        Patch.label = 0;
    }

    /**
     * @param {Array<Patch>} patches
     */
    static updateMinMaxDistances(patches) {
        for (let i = 0; i < patches.length - 1; i++) {
            for (let j = i + 1; j < patches.length; j++) {
                Patch.minDistance = Math.min(Patch.minDistance, patches[i].position.distanceTo(patches[j].position));
                patches[i].minDistance = Math.min(patches[i].minDistance, patches[i].position.distanceTo(patches[j].position));
                patches[j].minDistance = Math.min(patches[j].minDistance, patches[i].position.distanceTo(patches[j].position));
                Patch.maxDistance = Math.max(Patch.maxDistance, patches[i].position.distanceTo(patches[j].position));
                patches[i].maxDistance = Math.max(patches[i].maxDistance, patches[i].position.distanceTo(patches[j].position));
                patches[j].maxDistance = Math.max(patches[j].maxDistance, patches[i].position.distanceTo(patches[j].position));
            }
        }
    }

    constructor(frustumSize, providedX, providedZ, maxNectar) {
        super();
        this.name = Patch.label;
        Patch.label += 1;

        this.lowerBound = Math.min(frustumSize * .1, 10);
        this.upperBound = Math.max(frustumSize * .9, frustumSize - 10);
        const centerMargin = frustumSize / 2;

        var x;
        if (providedX === null) {
            x = centerMargin - randInt(this.lowerBound, this.upperBound);
        } else {
            x = providedX;
        }

        const y = Y;

        var z;
        if (providedZ === null) {
            z = centerMargin - randInt(this.lowerBound, this.upperBound);
        } else {
            z = providedZ;
        }
        this.radius = randInt(MIN_SIZE, maxNectar / 2);
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
        this.sugarContent = randInt(3, 80) / 100;
        this.minDistance = WORLD_SIZE;
        this.maxDistance = 0;

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
                this.nectarLevel + delta / RECOUP_TIME
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
     * @param {THREE.Vector3} beePosition
     * @param {Hive} hive
     * @param {number} time 
     * @param {number} numPatches
     */
    getWeight(beePosition, hive, time, numPatches) {
        /*
            want some points s.t. p_i.distanceTo(p_i)^2 - w_i < p_i.distanceTo(p_j)^2 - w_j
            (the area around p_i has a smaller cost than if it belonged to p_j)
            p_i.distanceTo(p_i) = 0
            p_i.distanceTo(p_j) >= the minimum distance in the Poisson disk sampling d_min
            Therefore:
            0 - w_i < d_min^2 - w_j
            w_j - w_i < d_min^2
            If p_j has the largest possible weight and p_i the smallest (0),
            w_j < d_min^2 should always be true
            d_min is known :D
            Some constant in [0, 1) can ensure the inequality holds
        */
        const maxWeight = 0.85 * (this.minDistance ** 2);

        const p_h = hive.position;
        const p_t = this.position;
        const a = this.sugarContent;
        const size = this.nectarBaseLevel;
        const n = this.nectarLevel;
        const b = this.beesPresent;

        const daylightFactor = this.#getDaylightFactor(p_h, p_t, time);
        const distanceFromBee = beePosition.distanceTo(this.position);
        const normalizedDistanceFromBee = Math.min(1, distanceFromBee / this.maxDistance);
        const distanceFactor = 1 / (1 + Math.pow(4 * normalizedDistanceFromBee, 2));

        const nectarFactor = Math.pow(n / size, 2) * Math.min(1, a / 0.5);
        const flowerFactor = size / MAX_SIZE;
        const beesFactor = 1 / (1 + (b / size));
        const rawFactor = Math.max(
            0,
            Math.min(
                0.75 * nectarFactor + 0.10 * flowerFactor + 0.05 * beesFactor + 0.10 * distanceFactor, 
                1
            )
        );
        // scaling nonlinearly to make things more interesting
        const weightFactor = rawFactor ** 3;

        // console.log(weightFactor, maxWeight, daylightFactor * weightFactor * maxWeight);

        return daylightFactor * weightFactor * maxWeight;
    }


    /**
     * @param {Vector3} p_h The location of the hive.
     * @param {Vector3} p_t The location of the target patch.
     * @param {number} size The total nectar capacity of the target.
     * @param {number} n The current nectar capacity of the target.
     * @param {number} b The current number of bees at the target.
     * @param {number} t The time of day (any number in [0, 1)).
     * @param {number} a The average attractiveness of flowers in the target patch.
     * @returns {number} The weight of the patch. 
    */

    /**
     * @param {THREE.Vector3} p_h The location of the hive.
     * @param {THREE.Vector3} p_t The location of the target patch.
     * @param {number} t The time of day (any number in [0, 1)).
     */
    #getDaylightFactor(p_h, p_t, t) {
        const a = 1;
        const k1 = 0.3227;
        const s1 = 0.0227;
        const k2 = 0.73402801;
        const s2 = 0.02548398;
        const c = 0;

        const normalizedDistance = Math.min(1, p_h.distanceTo(p_t) / this.maxDistance);
        const maxNightShift = 0.005; // add bee speed
        const shiftedK1 = k1 - (normalizedDistance * maxNightShift);
        const shiftedK2 = k2 - (normalizedDistance * maxNightShift);

        const r = 1.0 / (1 + Math.exp(-1 * (t - k1) / s1));
        const f = 1.0 / (1 + Math.exp((t - shiftedK2) / s2));
        return a * r * f + c
    }
}
