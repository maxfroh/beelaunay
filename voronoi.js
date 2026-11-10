import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2, LineGeometry } from 'three/examples/jsm/Addons.js';

import { weightedVoronoi } from 'd3-weighted-voronoi';

import { WORLD_SIZE } from './parameters.js';


const Y_HEIGHT = 2;

function edge(v0, v1, p) {
    const [v0_x, v0_y, v0_z] = v0;
    const [v1_x, v1_y, v1_z] = v1;
    const [p_x, p_y, p_z] = p;
    const crossProduct = (p_x - v0_x) * (v1_z - v0_z) - (p_z - v0_z) * (v1_x - v0_x);
    return crossProduct > 0;
}

const trackedOutlines = [];
var currentShape = null;
const neighborShapes = [];
/**
 * @param {Array<Array<Array<number>} cells
 * @param {} scene
 * @param {Location} target
 */
export function drawVoronoi(cells, scene, target) {
    trackedOutlines.forEach((outline) => {
        scene.remove(outline);
        outline.geometry.dispose();
        outline.material.dispose();
    });
    if (currentShape != null) {
        scene.remove(currentShape);
        currentShape.geometry.dispose();
        currentShape.material.dispose();
    }
    neighborShapes.forEach((shape) => {
        scene.remove(shape);
        shape.geometry.dispose();
        shape.material.dispose();
    });

    trackedOutlines.length = 0;
    neighborShapes.length = 0;

    const total = cells.length;

    cells.forEach((cell, i) => {
        const points = cell.map((point) => new THREE.Vector3(point[0], Y_HEIGHT, point[1]));
        // close the loop
        points.push(points[0]);

        var inside = true;
        for (let j = 0; j < points.length - 1; j++) {
            // if inside is still true, check that target is to the "right" of the next edge
            // if not, inside is false and the checks don't need to continue
            if (inside) {
                inside = edge(points[j], points[j + 1], target.position)
            } else {
                break;
            }
        }

        if (inside) {
            console.log(`Cell ${i}`);
            const shape = new THREE.Shape();
            shape.moveTo(cell[0][0], cell[0][1]);
            for (let k = 1; k < cell.length; k++) {
                shape.lineTo(cell[k][0], cell[k][1]);
            }
            shape.closePath();
            const currShapeGeometry = new THREE.ShapeGeometry(shape);
            currShapeGeometry.rotateX(Math.PI / 2);
            const currShapeMaterial = new THREE.MeshBasicMaterial({ color: 0xffee11, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
            currentShape = new THREE.Mesh(currShapeGeometry, currShapeMaterial);
            currentShape.position.y = Y_HEIGHT - 0.5;
            scene.add(currentShape);
        }

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