import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2, LineGeometry } from 'three/examples/jsm/Addons.js';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';

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
let targetFillMesh = null;
const neighborShapes = [];
/**
 * @param {Array<Array<Array<number>} cells
 * @param {} scene
 * @param {Location} target
 */
export function drawVoronoi(cells, adjacencyMap, scene, target) {
    const targetSiteId = target.name

    trackedOutlines.forEach((outline) => {
        scene.remove(outline);
        outline.geometry.dispose();
        outline.material.dispose();
    });
    trackedOutlines.length = 0;

    if (targetFillMesh != null) {
        scene.remove(targetFillMesh);
        targetFillMesh.geometry.dispose();
        targetFillMesh.material.dispose();
    }

    neighborShapes.forEach((shape) => {
        scene.remove(shape);
        shape.geometry.dispose();
        shape.material.dispose();
    });
    neighborShapes.length = 0;

    const targetCell = cells.find(c => c.id === targetSiteId);
    const neighbordIds = adjacencyMap[targetSiteId] || [];
    const neighborCells = cells.filter(c => neighbordIds.includes(c.id));

    function createColoredCellMesh(cellData, color, opacity) {
        const shape = new THREE.Shape();
        if (!cellData.vertices || cellData.vertices.length === 0) {
            return null;
        }

        shape.moveTo(cellData.vertices[0].x, cellData.vertices[0].y);
        for (let k = 1; k < cellData.vertices.length; k++) {
            shape.lineTo(cellData.vertices[k].x, cellData.vertices[k].y);
        }
        shape.closePath();
        const geometry = new THREE.ShapeGeometry(shape);
        geometry.rotateX(Math.PI / 2);
        const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = Y_HEIGHT - 0.5;
        return mesh;
    }

    neighborCells.forEach(neighborCell => {
        const neighborMesh = createColoredCellMesh(neighborCell, 0xccee99, 0.85);
        if (neighborMesh) {
            neighborShapes.push(neighborMesh);
            scene.add(neighborMesh);
        }
    });

    if (targetCell) {
        targetFillMesh = createColoredCellMesh(targetCell, 0xffee11, 0.85);
        if (targetFillMesh) {
            scene.add(targetFillMesh);
        }
    }

    cells.forEach((cell, i) => {
        if (!cell.vertices || cell.vertices.length === 0) {
            return;
        }

        const points = cell.vertices.map((vertex) => new THREE.Vector3(vertex.x, Y_HEIGHT, vertex.y));
        // close the loop
        points.push(points[0]);

        const geometry = new LineGeometry().setFromPoints(points);

        const material = new LineMaterial({
            color: 0xffeeee,
            // color: new THREE.Color(`hsl(${180 + 360 * Math.cos(i) * Math.sin(i)}, ${80 + 15 * Math.cos(i)}%, ${60 + 10 * Math.sin(i)}%)`),
            linewidth: 3,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
        });
        // material.resolution.set(window.innerWidth, window.innerHeight);
        const outline = new Line2(geometry, material);
        trackedOutlines.push(outline);
        scene.add(outline);
    })
}


/**
 * @param {Array<Patch>} patches
 */
export function getVoronoiCells(center, patches, currTime) {
    let maxPatchName = 0;
    const sites = patches.map((patch, index) => {
        const [x, y, z] = patch.position;
        const weight = patch.getWeight(center, currTime, patches.length);
        const W = (x * x) + (z * z) - weight;
        const v = new THREE.Vector3(x, z, W);
        v.siteIndex = index;
        v.patchName = patch.name;
        v.isVirtual = false;
        maxPatchName = Math.max(maxPatchName, patch.name);
        return v;
    });

    const bound = 4 * WORLD_SIZE;
    const corners = [
        { x: -bound, z: -bound, id: `${maxPatchName}_c1` },
        { x: bound, z: -bound, id: `${maxPatchName}_c2` },
        { x: bound, z: bound, id: `${maxPatchName}_c3` },
        { x: -bound, z: bound, id: `${maxPatchName}_c4` },
    ];
    corners.forEach(c => {
        const W = (c.x * c.x) + (c.z * c.z);
        const v = new THREE.Vector3(c.x, c.z, W);
        v.siteIndex = sites.length;
        v.patchName = c.id;
        v.isVirtual = true;
        sites.push(v);
    })

    const hull = new ConvexHull().setFromPoints(sites);

    const lowerFaces = hull.faces.filter(face => face.normal.z < -1e-8);

    const siteToFaces = Array.from({ length: sites.length }, () => []);

    const adjacencySets = {};
    patches.forEach(patch => { adjacencySets[patch.name] = new Set(); });

    lowerFaces.forEach((face) => {
        const dualX = -face.normal.x / (2 * face.normal.z);
        const dualY = -face.normal.y / (2 * face.normal.z);
        const dualVertex = { x: dualX, y: dualY };

        const faceSites = [];
        let edge = face.edge;
        do {
            faceSites.push(edge.head().point);
            edge = edge.next;
        } while (edge !== face.edge);

        for (let i = 0; i < faceSites.length; i++) {
            const siteA = faceSites[i];
            siteToFaces[siteA.siteIndex].push(dualVertex);

            if (!siteA.isVirtual) {
                for (let j = i + 1; j < faceSites.length; j++) {
                    const siteB = faceSites[j];
                    if (!siteB.isVirtual) {
                        adjacencySets[siteA.patchName].add(siteB.patchName);
                        adjacencySets[siteB.patchName].add(siteA.patchName);
                    }
                }
            }
        }
    });

    const halfBound = WORLD_SIZE / 2;
    const cells = [];

    sites.forEach((site, siteIndex) => {
        if (site.isVirtual) {
            return;
        }

        const rawVertices = siteToFaces[siteIndex];
        // if <3 vertices, cell is covered by another cell
        if (rawVertices.length < 3) {
            cells.push({ id: site.patchName, vertices: [] });
            return;
        }

        const sortedVertices = [...rawVertices].sort((a, b) => {
            return Math.atan2(a.y - site.y, a.x - site.x) - Math.atan2(b.y - site.y, b.x - site.x)
        });

        const clippedVertices = clipPolygon(sortedVertices, -halfBound, halfBound, -halfBound, halfBound);

        const cleanVertices = clippedVertices.filter((v, i, arr) => {
            const prev = arr[(i - 1 + arr.length) % arr.length];
            return Math.abs(v.x - prev.x) > 1e-4 || Math.abs(v.y - prev.y) > 1e-4;
        });

        cells.push({
            id: site.patchName,
            vertices: cleanVertices
        });
    });

    const adjacencyMap = {};
    for (const [id, neighborSet] of Object.entries(adjacencySets)) {
        adjacencyMap[id] = Array.from(neighborSet);
    }

    return { cells, adjacencyMap };
}

function clipPolygon(polygon, minX, maxX, minY, maxY) {
    const clipEdges = [
        { inside: p => p.x >= minX, intersect: (a, b) => ({ x: minX, y: a.y + (b.y - a.y) * (minX - a.x) / (b.x - a.x) }) },
        { inside: p => p.x >= minX, intersect: (a, b) => ({ x: maxX, y: a.y + (b.y - a.y) * (maxX - a.x) / (b.x - a.x) }) },
        { inside: p => p.x >= minX, intersect: (a, b) => ({ x: a.x + (b.x - a.x) * (minY - a.y) / (b.y - a.y), y: minY }) },
        { inside: p => p.x >= minX, intersect: (a, b) => ({ x: a.x + (b.x - a.x) * (maxY - a.y) / (b.y - a.y), y: maxY }) }
    ];

    let output = polygon;
    for (const edge of clipEdges) {
        const input = output;
        output = [];
        if (input.length === 0) {
            break;
        }

        for (let i = 0; i < input.length; i++) {
            const curr = input[i];
            const prev = input[(i - 1 + input.length) % input.length];
            const currIn = edge.inside(curr);
            const prevIn = edge.inside(prev);
            if (currIn) {
                if (!prevIn) {
                    output.push(edge.intersect(prev, curr));
                }
                output.push(curr);
            } else if (prevIn) {
                output.push(edge.intersect(prev, curr));
            }
        }
    }

    return output
}