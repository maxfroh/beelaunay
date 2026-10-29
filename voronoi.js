import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2, LineGeometry } from 'three/examples/jsm/Addons.js';

import { weightedVoronoi } from 'd3-weighted-voronoi';

import { WORLD_SIZE } from './parameters.js';

const trackedOutlines = [];
/**
 * @param {Array<Array<Array<number>} cells
 */
export function drawVoronoi(cells, scene) {
    trackedOutlines.forEach((outline) => {
        scene.remove(outline);
        outline.geometry.dispose();
        outline.material.dispose();
    });
    trackedOutlines.length = 0;

    const total = cells.length;
    cells.forEach((cell, i) => {
        const points = cell.map((point) => new THREE.Vector3(point[0], 2, point[1]));
        // close the loop
        points.push(points[0]);
        const geometry = new LineGeometry().setFromPoints(points);
        
        const material = new LineMaterial({
            color: 0xffeeee,
            // color: new THREE.Color(`hsl(${180 + 360 * Math.cos(i) * Math.sin(i)}, ${80 + 15 * Math.cos(i)}%, ${60 + 10 * Math.sin(i)}%)`),
            linewidth: 4,
        });
        material.resolution.set(window.innerWidth, window.innerHeight);
        const outline = new Line2(geometry, material);
        trackedOutlines.push(outline);
        scene.add(outline);
    })
}


/**
 * @param {Location} center
 * @param {number} currTime 
 */
export function processVoronoi(center, patches, currTime) {
    const calcVoronoi = weightedVoronoi()
        .x(function (patch) { return patch.position.x; }) // x = patch x-coord
        .y(function (patch) { return patch.position.z; }) // y is actually patch z-coord!
        .weight(function (patch) { return patch.getWeight(center, currTime); }) // use patch's weight function
        .clip([[-WORLD_SIZE / 2, -WORLD_SIZE / 2], [-WORLD_SIZE / 2, WORLD_SIZE / 2], [WORLD_SIZE / 2, WORLD_SIZE / 2], [WORLD_SIZE / 2, -WORLD_SIZE / 2]]);  // set the clipping polygon
    const cells = calcVoronoi(patches);
    return cells;
}