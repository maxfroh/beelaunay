import * as THREE from 'three';
import { randInt } from 'three/src/math/MathUtils.js';
import { BEE_COLLECTION_TIME, MIN_PER_DAY, RECOUP_TIME, BEE_COLLECTION_RATE } from './parameters';


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
        const y = 3;
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
    static label = 0;

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

        const y = 3;

        var z;
        if (provided_z === null) {
            z = centerMargin - randInt(this.lowerBound, this.upperBound);
        } else {
            z = provided_z;
        }
        this.radius = randInt(1, 3);
        const segments = 6;

        this.position = new THREE.Vector3(x, y, z);
        this.geometry = new THREE.CircleGeometry(this.radius, segments);
        this.color = new THREE.Color(
            `hsl(${randInt(270, 320)}, ${randInt(50, 80)}%, ${randInt(50, 80)}%)`
        )
        this.material = new THREE.MeshPhongMaterial({ color: this.color, side: THREE.DoubleSide });
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.position.copy(this.position);
        this.mesh.rotation.x = -Math.PI / 2

        this.nectarBaseLevel = randInt(6, 8) * this.radius;
        this.nectarLevel = this.nectarBaseLevel;
        this.recoupTimer = 0;
        this.averageAttractiveness = randInt(1, 100) / 100;
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
    getWeight(hive, time) {
        return this.#f(hive.position, this.position, this.nectarBaseLevel, this.nectarLevel, this.beesPresent, time, this.averageAttractiveness);
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
    #f(p_h, p_t, size, n, b, t, a) {
        const distanceFactor = this.#q(p_h, p_t, t);
        return (
            distanceFactor
        );
    }

    /**
     * @param {THREE.Vector3} p_h 
     * @param {THREE.Vector3} p_t 
     * @param {number} t
     */
    #q(p_h, p_t, t) {
        // const squeezeFactor = 1;
        // const squeezed_p_h = p_h.clone().multiplyScalar(squeezeFactor);
        // const squeezed_p_t = p_t.clone().multiplyScalar(squeezeFactor);
        // const m = squeezeFactor * Math.abs(this.upperBound - this.lowerBound) / 2; // maximum distance possible from hive along x/z-axis
        // const d_max = Math.sqrt(2 * Math.pow(m, 2)); // maximum distance (sqrt[m^2 + m^2])
        // const d = squeezed_p_h.distanceTo(squeezed_p_t) / d_max; // normalize distance
        const daylightFactor = -10 * Math.pow(2 * t - 1.15, 4) + 1;
        const v = 1 - Math.max(0, daylightFactor);
        // const distanceDaylightFactor = d / Math.pow(0.3 * Patch.#z(t), -1 * d);
        // const maxDDF = 10 / 3;
        // const normalizedDDF = distanceDaylightFactor / maxDDF;
        return 2000 * v / (p_h.distanceTo(p_t) / 200 + 1);
        // return 1;
    }
}
