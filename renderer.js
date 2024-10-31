window.addEventListener('DOMContentLoaded', start);



let vertices = [];
let normals = [];
let faces = [];
let cv, ctx;
let angleX = 0;
let angleY = 0;
let scale = 1000;


let opacity = 1;
let cameraPosition = [0, 0, -5];
let lightPosition = [0, 5, -10];
let fov = 45;
let perspectiveProjection = true;
let zBuffer = [];

class Face {
    constructor(vertexIndices, normal) {
        this.vertexIndices = vertexIndices;
        this.normal = normal;
    }
}

async function start() {
    const objData = await fetchOBJ('cow.obj');
    parseOBJ(objData);

    cv = document.getElementById('canvas');
    fitToWindow(cv);
    initializeZBuffer();

    const rotateXControl = document.getElementById('rotateX');
    const rotateYControl = document.getElementById('rotateY');
    const opacityControl = document.getElementById('opacity');
    const zoomControl = document.getElementById('zoom');
    const fovControl = document.getElementById('fov');

    if (rotateXControl) {
        rotateXControl.addEventListener('input', (e) => {
            angleX = parseFloat(e.target.value);
            render();
        });
    }

    if (rotateYControl) {
        rotateYControl.addEventListener('input', (e) => {
            angleY = parseFloat(e.target.value);
            render();
        });
    }

    if (opacityControl) {
        opacityControl.addEventListener('input', (e) => {
            opacity = parseFloat(e.target.value);
            render();
        });
    }

    if (zoomControl) {
        zoomControl.addEventListener('input', (e) => {
            scale = parseFloat(e.target.value);
            render();
        });
    }

    if (fovControl) {
        fovControl.addEventListener('input', (e) => {
            fov = parseFloat(e.target.value);
            render();
        });
    }

    render();
}


async function fetchOBJ(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to load OBJ file");
    return await response.text();
}

function parseOBJ(data) {
    vertices = [];
    normals = [];
    faces = [];
    const lines = data.split('\n');
    for (let line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v') {
            vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        } else if (parts[0] === 'vn') {
            normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        } else if (parts[0] === 'f') {
            const vertexIndices = parts.slice(1).map(index => parseInt(index.split('/')[0]) - 1);
            faces.push(new Face(vertexIndices, calculateFaceNormal(vertexIndices)));
        }
    }
    console.log("Parsed OBJ data. Vertices:", vertices.length, "Faces:", faces.length);
}

function fitToWindow(cv) {
    const size = Math.min(window.innerWidth, window.innerHeight);
    cv.width = size;
    cv.height = size;
}

function initializeZBuffer() {
    zBuffer = Array.from({ length: cv.width }, () => Array(cv.height).fill(Infinity));
}

function render() {
    ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    initializeZBuffer();

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, cv.width, cv.height);

    ctx.save();
    ctx.translate(cv.width / 2, cv.height / 2);

    const rotationMatrix = matrixMatrixMultiply(rotateX(angleX), rotateY(angleY));
    const transformedVertices = vertices.map(v => matrixVectorMultiply(rotationMatrix, v));
    const cameraMatrix = createCameraMatrix();

    // Calculate center points and sort faces based on distance
    faces.forEach(face => {
        face.centerPoint = calculateCenterPoint(face.vertexIndices);
        face.distance = calculateDistance(face.centerPoint, cameraPosition);
    });

    const sortedFaces = faces.slice().sort((a, b) => b.distance - a.distance);

    for (const face of sortedFaces) {
        const v0 = applyCameraTransform(transformedVertices[face.vertexIndices[0]], cameraMatrix);
        const v1 = applyCameraTransform(transformedVertices[face.vertexIndices[1]], cameraMatrix);
        const v2 = applyCameraTransform(transformedVertices[face.vertexIndices[2]], cameraMatrix);

        // Dynamically calculate the normal for the face
        const normal = calculateNormal(v0, v1, v2);
        
        const viewDirection = normalize([
            cameraPosition[0] - (v0[0] + v1[0] + v2[0]) / 3,
            cameraPosition[1] - (v0[1] + v1[1] + v2[1]) / 3,
            cameraPosition[2] - (v0[2] + v1[2] + v2[2]) / 3
        ]);

        // Backface culling
        if (dot(normal, viewDirection) < -0.1) {
            continue;
        }

        const r = Math.floor((normal[0] + 1) * 127.5);
        const g = Math.floor((normal[1] + 1) * 127.5);
        const b = Math.floor((normal[2] + 1) * 127.5);
        const color = `rgba(${r}, ${g}, ${b}, ${opacity})`;

        drawTriangle(
            projectVertex(v0),
            projectVertex(v1),
            projectVertex(v2),
            color
        );
    }

    ctx.restore();
}




function calculateDistance(point1, point2) {
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    const dz = point1[2] - point2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateCenterPoint(vertexIndices) {
    const centerX = vertexIndices.reduce((sum, idx) => sum + vertices[idx][0], 0) / vertexIndices.length;
    const centerY = vertexIndices.reduce((sum, idx) => sum + vertices[idx][1], 0) / vertexIndices.length;
    const centerZ = vertexIndices.reduce((sum, idx) => sum + vertices[idx][2], 0) / vertexIndices.length;
    return [centerX, centerY, centerZ];
}


function createCameraMatrix() {
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);

    // Rotation around X and Y
    return [
        [cosY, 0, sinY],
        [sinX * sinY, cosX, -sinX * cosY],
        [-cosX * sinY, sinX, cosX * cosY]
    ];
}

function calculateCenterPoint(vertexIndices) {
    const centerX = vertexIndices.reduce((sum, idx) => sum + vertices[idx][0], 0) / vertexIndices.length;
    const centerY = vertexIndices.reduce((sum, idx) => sum + vertices[idx][1], 0) / vertexIndices.length;
    const centerZ = vertexIndices.reduce((sum, idx) => sum + vertices[idx][2], 0) / vertexIndices.length;
    return [centerX, centerY, centerZ];
}

function applyCameraTransform(vertex, cameraMatrix) {
    return matrixVectorMultiply(cameraMatrix, vertex);
}

function isBackface(v0, v1, v2, cameraPosition) {
    const normal = calculateNormal(v0, v1, v2);
    const viewDirection = [cameraPosition[0] - v0[0], cameraPosition[1] - v0[1], cameraPosition[2] - v0[2]];
    return dot(normal, viewDirection) <= 0;
}

function projectVertex([x, y, z]) {
    const aspectRatio = cv.width / cv.height;
    const nearClipping = 10;
    const fovAdjustment = Math.tan((fov / 2) * (Math.PI / 180));

    if (perspectiveProjection) {
        const projectedX = (x / (z + nearClipping)) * fovAdjustment * scale * aspectRatio;
        const projectedY = -(y / (z + nearClipping)) * fovAdjustment * scale;
        return [projectedX, projectedY];
    } else {
        return [x * scale, -y * scale];
    }
}



function calculateFaceNormal(vertexIndices) {
    const v0 = vertices[vertexIndices[0]];
    const v1 = vertices[vertexIndices[1]];
    const v2 = vertices[vertexIndices[2]];
    return calculateNormal(v0, v1, v2);
}

function averageZ(vertexIndices, vertices) {
    return vertexIndices.reduce((sum, index) => sum + vertices[index][2], 0) / vertexIndices.length;
}

function calculateNormal([x0, y0, z0], [x1, y1, z1], [x2, y2, z2]) {
    const U = [x1 - x0, y1 - y0, z1 - z0];
    const V = [x2 - x0, y2 - y0, z2 - z0];
    return normalize([
        U[1] * V[2] - U[2] * V[1],
        U[2] * V[0] - U[0] * V[2],
        U[0] * V[1] - U[1] * V[0]
    ]);
}

function normalize([x, y, z]) {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
}

function drawTriangle([x0, y0], [x1, y1], [x2, y2], color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
}

function calculatePhongShading(v0, v1, v2, normal) {
    const ambientStrength = 0.1;
    const diffuseStrength = 0.7;
    const specularStrength = 0.2;
    const shininess = 32;

    const lightDir = normalize([
        lightPosition[0] - (v0[0] + v1[0] + v2[0]) / 3,
        lightPosition[1] - (v0[1] + v1[1] + v2[1]) / 3,
        lightPosition[2] - (v0[2] + v1[2] + v2[2]) / 3
    ]);

    // Ambient
    const ambient = ambientStrength;

    // Diffuse
    const diffuse = Math.max(dot(normal, lightDir), 0) * diffuseStrength;

    // Specular
    const viewDir = normalize([
        cameraPosition[0] - (v0[0] + v1[0] + v2[0]) / 3,
        cameraPosition[1] - (v0[1] + v1[1] + v2[1]) / 3,
        cameraPosition[2] - (v0[2] + v1[2] + v2[2]) / 3
    ]);
    const reflectDir = reflect(negate(lightDir), normal);
    const specular = Math.pow(Math.max(dot(viewDir, reflectDir), 0), shininess) * specularStrength;

    const intensity = ambient + diffuse + specular;
    const color = Math.floor(intensity * 255);

    return `rgba(${color}, ${color}, ${color}, ${opacity})`;
}

function rotateX(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
        [1, 0, 0],
        [0, cos, -sin],
        [0, sin, cos]
    ];
}

function rotateY(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
        [cos, 0, sin],
        [0, 1, 0],
        [-sin, 0, cos]
    ];
}

function matrixMatrixMultiply(a, b) {
    return a.map(row => b[0].map((_, i) => row.reduce((sum, val, j) => sum + val * b[j][i], 0)));
}

function matrixVectorMultiply(matrix, vector) {
    return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function dot(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function reflect(v, normal) {
    const dotProduct = dot(v, normal);
    return [
        v[0] - 2 * dotProduct * normal[0],
        v[1] - 2 * dotProduct * normal[1],
        v[2] - 2 * dotProduct * normal[2]
    ];
}

function negate(v) {
    return [-v[0], -v[1], -v[2]];
}