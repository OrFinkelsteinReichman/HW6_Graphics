import {OrbitControls} from './OrbitControls.js'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Set background color
scene.background = new THREE.Color(0x000000);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
scene.add(directionalLight);

// Enable shadows
renderer.shadowMap.enabled = true;
directionalLight.castShadow = true;

function degrees_to_radians(degrees) {
  var pi = Math.PI;
  return degrees * (pi/180);
}

const courtLength = 30;
const courtWidth = 15;
const courtHeight = 0.11;
const ballRadius = 0.22;
const airHeight = 2.5;
// Rim height must be significantly higher than the court level (representing 10 feet height)
const rimHeight = 3.05;        // 10 feet = 3.05 meters
const rimRadius = 0.4;
const backboardWidth = 1.8;
const backboardHeight = 1.05;
const rimThickness = 0.03;
const backboardThickness = 0.05;
const supportPoleHeight = rimHeight + 0.7;
const supportPoleRadius = 0.08;
const supportArmLength = 1.2;
const rimBackboardOffset = 0.04

const leftRimX = (-courtLength / 2) + 1.1 - (rimRadius + rimBackboardOffset);
const rightRimX = (courtLength / 2) - 1.1 + (rimRadius + rimBackboardOffset);

const leftRimCenter = new THREE.Vector3(leftRimX, rimHeight, 0);
const rightRimCenter = new THREE.Vector3(rightRimX, rimHeight, 0);
// const leftRimCenter = new THREE.Vector3(-courtLength/2 + rimRadius + rimBackboardOffset, rimHeight, 0);
// const rightRimCenter = new THREE.Vector3(courtLength/2 - rimRadius - rimBackboardOffset, rimHeight, 0);


const clock = new THREE.Clock();

let basketball;

let moveDirection = {
  left: false,
  right: false,
  forward: false,
  backward: false
};

let shotPower = 50; // percentage: 0–100
const minPower = 0;
const maxPower = 100;
const powerStep = 2;

const moveSpeed = 0.15;

const courtBoundary = {
  minX: -courtLength / 2 + 1.5,
  maxX: courtLength / 2 - 1.5,
  minZ: -courtWidth / 2 + 1.5,
  maxZ: courtWidth / 2 - 1.5
};

let isBallInMotion = false;
let ballVelocity = new THREE.Vector3();

let lastBallY = null;
let lastShotResult = null; // "made" | "miss" | null
let score = 0;
let shotAttempts = 0;
let shotsMade = 0;
let shotJustScored = false;
let lastTargetHoop = null;

const gravity = -9.8 // scaled gravity
const energyLoss = 0.7; // energy loss factor
const groundY = ballRadius + courtHeight;

// Create basketball court
function createBasketballCourt() {
  const textureLoader = new THREE.TextureLoader();
  const blueTexture = textureLoader.load('src/blue_floor.jpeg');
  const frameGeometry = new THREE.BoxGeometry(36, 0.18, 18);
  const frameMaterial = new THREE.MeshPhongMaterial({
    map: blueTexture,
    shininess: 50
  });
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.set(0, 0, 0);
  frame.receiveShadow = true;
  scene.add(frame);


  const woodTexture = textureLoader.load('src/basketball_court_texture.jpeg');

  // Court floor - just a simple brown surface
  const courtGeometry = new THREE.BoxGeometry(30, 0.2, 15);
  const courtMaterial = new THREE.MeshPhongMaterial({
    map: woodTexture,
    shininess: 50
  });
  const court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.receiveShadow = true;

  scene.add(court);
  // Note: All court lines, hoops, and other elements have been removed
  // Students will need to implement these features
}

function addCourtLines() {
  // White material for all lines
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const lineHeight = 0.11;

  // Border
  const borderPoints = [
    new THREE.Vector3(-courtLength / 2, lineHeight, -courtWidth / 2),
    new THREE.Vector3( courtLength / 2, lineHeight, -courtWidth / 2),
    new THREE.Vector3( courtLength / 2, lineHeight,  courtWidth / 2),
    new THREE.Vector3(-courtLength / 2, lineHeight,  courtWidth / 2),
    new THREE.Vector3(-courtLength / 2, lineHeight, -courtWidth / 2)
  ];
  const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
  const borderLine = new THREE.Line(borderGeometry, lineMaterial);
  scene.add(borderLine);

  // Center line
  const centerLineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, lineHeight, -courtWidth/2),
    new THREE.Vector3(0, lineHeight, courtWidth/2)
  ]);
  const centerLine = new THREE.Line(centerLineGeometry, lineMaterial);
  scene.add(centerLine);

  // Center circle in the center of the court
  const circleRadius = 2.4;
  const circlePoints = [];
  // Circle from 100 points
  for (let i = 0; i <= 100; i++) {
    const theta = (i / 100) * 2 * Math.PI;
    circlePoints.push(new THREE.Vector3(
        circleRadius * Math.cos(theta),
        lineHeight,
        circleRadius * Math.sin(theta)
    ));
  }
  const circleGeometry = new THREE.BufferGeometry().setFromPoints(circlePoints);
  const centerCircle = new THREE.Line(circleGeometry, lineMaterial);
  scene.add(centerCircle);

  //Three-point arcs
  const threePointRadius = 6.75;
  const basketOffset = 1.575;

  for (let side of [-1, 1]) {
    // basket
    const arcCenterX = side * (courtLength/2 - basketOffset);

    // Angle where the arc meets the court edge
    const edgeZ = courtWidth / 2 - 0.9;

    const theta = Math.asin(edgeZ / threePointRadius);

    // Generate points for the arc from -theta to +theta
    const arcPoints = [];
    for (let i = 0; i <= 100; i++) {
      const t = -theta + (i / 100) * (2 * theta);
      arcPoints.push(new THREE.Vector3(
          arcCenterX - threePointRadius * Math.cos(t) * side,
          lineHeight,
          threePointRadius * Math.sin(t)
      ));
    }
    const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arc = new THREE.Line(arcGeometry, lineMaterial);
    scene.add(arc);

    const keyWidth = 5;
    const keyHeight = 5.8;

    const baseX = side * (courtLength / 2);
    const keySign = -side;

    // Key rectangle
    const keyRectPoints = [
      new THREE.Vector3(baseX, lineHeight, -keyWidth/2),
      new THREE.Vector3(baseX + keySign * keyHeight, lineHeight, -keyWidth/2),
      new THREE.Vector3(baseX + keySign * keyHeight, lineHeight, keyWidth/2),
      new THREE.Vector3(baseX, lineHeight, keyWidth/2),
      new THREE.Vector3(baseX, lineHeight, -keyWidth/2),
    ];
    const keyRectGeometry = new THREE.BufferGeometry().setFromPoints(keyRectPoints);
    const keyRect = new THREE.Line(keyRectGeometry, lineMaterial);
    scene.add(keyRect);
  }
}

function addHoop(side = 1) {
  // side: 1 - right, -1 - left

  const baselineX = side * (courtLength / 2);
  const backboardFaceX = baselineX - 1.1 * side;
  const backboardCenterX = backboardFaceX - side * (backboardThickness / 2);

  // Backboard
  // Backboard must be rectangular, white, and partially transparent
  const backboard = new THREE.Mesh(
      new THREE.BoxGeometry(backboardThickness, backboardHeight, backboardWidth),
      new THREE.MeshPhongMaterial({ color: 0xffffff, opacity: 0.85, transparent: true })
  );
  backboard.position.set(backboardCenterX, rimHeight + backboardHeight/2 - 0.15, 0);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  scene.add(backboard);

  // Rim
  const rimX = backboardFaceX - side * (rimRadius + rimBackboardOffset);
  const rim = new THREE.Mesh(
      new THREE.TorusGeometry(rimRadius, rimThickness, 16, 32),
      new THREE.MeshPhongMaterial({ color: 0xff6500 })
  );
  rim.position.set(rimX, rimHeight, 0);
  // Hoops must face toward center court
  rim.rotation.x = Math.PI / 2; // lay flat horizontally
  rim.rotation.y = side === -1 ? Math.PI : 0; // mirror if needed
  rim.castShadow = true;
  rim.receiveShadow = true;
  scene.add(rim);

  // Nets must be created using at least 8 line segments
  const netSegments = 12, netHeight = 0.45;
  for (let i = 0; i < netSegments; i++) {
    const angle = (i / netSegments) * 2 * Math.PI;
    // Rim top circle
    const netStart = new THREE.Vector3(
        rimX + rimRadius * Math.sin(angle),
        rimHeight,
        rimRadius * Math.cos(angle)
    );
    // Net bottom circle
    const netEnd = new THREE.Vector3(
        rimX + 0.5 * rimRadius * Math.sin(angle),
        rimHeight - netHeight,
        0.5 * rimRadius * Math.cos(angle)
    );
    scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([netStart, netEnd]),
        new THREE.LineBasicMaterial({ color: 0xffffff })
    ));
  }

  // Pole
  // Support structures must be positioned BEHIND the backboard, not on the court
  const poleX = backboardFaceX + side * (supportArmLength + supportPoleRadius + 0.2);
  const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(supportPoleRadius, supportPoleRadius, supportPoleHeight, 16),
      new THREE.MeshPhongMaterial({ color: 0x888888 })
  );
  pole.position.set(poleX, supportPoleHeight / 2, 0);
  pole.castShadow = true;
  pole.receiveShadow = true;
  scene.add(pole);

  // Support Arm
  const armStart = new THREE.Vector3(poleX, rimHeight + 0.4, 0);
  const armEnd = new THREE.Vector3(
      backboardCenterX + side * (backboardThickness/2),
      rimHeight + backboardHeight/2, 0
  );
  // Each hoop must include at least one support arm connecting the pole to the backboard
  scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([armStart, armEnd]),
      new THREE.LineBasicMaterial({ color: 0x888888 })
  ));
}

function addBasketball() {
  const ballGeometry = new THREE.SphereGeometry(ballRadius, 64, 64);
  const textureLoader = new THREE.TextureLoader();
  const ballTexture = textureLoader.load('src/basketball_texture.jpeg');
  const ballMaterial = new THREE.MeshPhongMaterial({ map: ballTexture, shininess: 50 });
  basketball = new THREE.Mesh(ballGeometry, ballMaterial);
  basketball.position.set(0, groundY + airHeight, 0);
  basketball.castShadow = true;
  basketball.receiveShadow = true;
  scene.add(basketball);

  const seamMaterial = new THREE.LineBasicMaterial({ color: 0x222222 });

  // seam parallel to XZ plane
  const equatorPoints = [];
  for (let i = 0; i <= 200; i++) {
    const theta = (i / 200) * 2 * Math.PI;
    equatorPoints.push(new THREE.Vector3(
        ballRadius * Math.cos(theta),
        0,
        ballRadius * Math.sin(theta)
    ));
  }
  const equator = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(equatorPoints), seamMaterial
  );
  basketball.add(equator);

  // 6 diagonal seams
  const numberOfDiagonalSeams = 6;
  const angle = Math.PI / 4;
  for (let seam = 0; seam < numberOfDiagonalSeams; seam++) {
    const phi = (seam / numberOfDiagonalSeams) * 2 * Math.PI;
    const points = [];
    for (let i = 0; i <= 200; i++) {
      const theta = (i / 200) * 2 * Math.PI;
      // Circle in YZ plane
      let x = 0;
      let y = ballRadius * Math.cos(theta);
      let z = ballRadius * Math.sin(theta);
      // Rotated circle
      let y2 = y * Math.cos(angle) - z * Math.sin(angle);
      let z2 = y * Math.sin(angle) + z * Math.cos(angle);
      // Rotate around Y by phi
      let x3 = x * Math.cos(phi) + z2 * Math.sin(phi);
      let z3 = -x * Math.sin(phi) + z2 * Math.cos(phi);
      points.push(new THREE.Vector3(x3, y2, z3));
    }
    const diagSeam = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points), seamMaterial
    );
    basketball.add(diagSeam);
  }
}


// Create all elements
createBasketballCourt();

addCourtLines();

addHoop(-1);
addHoop(1);

addBasketball()

// Set camera position for better view
const cameraTranslate = new THREE.Matrix4();
cameraTranslate.makeTranslation(0, 15, 30);
camera.applyMatrix4(cameraTranslate);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
let isOrbitEnabled = true;

// Instructions display
const instructionsElement = document.createElement('div');
instructionsElement.style.position = 'absolute';
instructionsElement.style.bottom = '20px';
instructionsElement.style.left = '20px';
instructionsElement.style.color = 'white';
instructionsElement.style.fontSize = '16px';
instructionsElement.style.fontFamily = 'Arial, sans-serif';
instructionsElement.style.textAlign = 'left';
instructionsElement.innerHTML = `
    <h3>Controls:</h3>
    <p>Arrow Keys - Move Ball</p>
    <p>W/S - Adjust Power</p>
    <p>Space - Shoot</p>
    <p>R - Reset</p>
    <p>O - Toggle Camera</p>
`;
document.body.appendChild(instructionsElement);

const powerContainer = document.createElement('div');
powerContainer.id = 'power-container';
powerContainer.innerText = `Shot Power: ${shotPower}%`;
document.body.appendChild(powerContainer);

function updatePowerUI() {
  // Update the power UI
  const powerDisplay = document.getElementById('power-container');
  if (powerDisplay) {
    powerDisplay.innerText = `Shot Power: ${shotPower}%`;
  }
}

function updateScoreUI() {
  document.getElementById('score').innerText = score;
  document.getElementById('attempts').innerText = shotAttempts;
  document.getElementById('made').innerText = shotsMade;
  const pct = shotAttempts > 0 ? ((shotsMade / shotAttempts) * 100).toFixed(1) : "0";
  document.getElementById('pct').innerText = pct;
}

function showShotResultDisplay(text, color) {
  const shotResultElem = document.getElementById('shot-result');
  if (!shotResultElem) return;
  shotResultElem.innerText = text;
  shotResultElem.style.color = color;
  shotResultElem.style.display = 'block';
  setTimeout(() => { shotResultElem.style.display = 'none'; }, 1200);
}


function getShotVelocityFromPower(distance) {
  // Base velocity that scales with distance and power
  const baseVelocity = 8.0 + (distance * 0.3);
  const powerMultiplier = 0.8 + (shotPower / 100) * 0.6;
  return baseVelocity * powerMultiplier;
}

function shootBall() {
  if (!basketball || isBallInMotion) return;

  shotAttempts += 1;
  updateScoreUI();

  // Determine target hoop
  const distToLeft = basketball.position.distanceTo(leftRimCenter);
  const distToRight = basketball.position.distanceTo(rightRimCenter);
  const targetHoop = distToLeft < distToRight ? leftRimCenter : rightRimCenter;
  lastTargetHoop = targetHoop;

  // Calculate trajectory
  const dx = targetHoop.x - basketball.position.x;
  const dy = targetHoop.y - basketball.position.y;
  const dz = targetHoop.z - basketball.position.z;
  const distanceXZ = Math.sqrt(dx * dx + dz * dz);

  const vxz = getShotVelocityFromPower(distanceXZ);
  const t = distanceXZ / vxz;

  // Using physics: y = y0 + v0y*t + 0.5*g*t^2
  const v0y = (dy - 0.5 * gravity * t * t) / t;

  // Set velocity components
  const vx = (dx / distanceXZ) * vxz;
  const vz = (dz / distanceXZ) * vxz;

  ballVelocity.set(vx, v0y, vz);
  isBallInMotion = true;
  shotJustScored = false;
  lastBallY = basketball.position.y;
}

function checkForScore() {
  if (!lastTargetHoop || shotJustScored) return;

  const ballXZ = new THREE.Vector2(basketball.position.x, basketball.position.z);
  const rimXZ = new THREE.Vector2(lastTargetHoop.x, lastTargetHoop.z);
  const distXZ = ballXZ.distanceTo(rimXZ);

  const ballCenterY = basketball.position.y;
  const ballBottomY = ballCenterY - ballRadius;

  const passedThroughRim = ballBottomY < lastTargetHoop.y; // ball base passed rim height
  const wasAboveRim = lastBallY !== null && lastBallY > lastTargetHoop.y;
  const movingDown = ballVelocity.y < 0;
  const centeredXZ = distXZ < 1.3 * rimRadius

  if (wasAboveRim && passedThroughRim && movingDown && centeredXZ) {
    score += 2;
    shotsMade += 1;
    shotJustScored = true;
    showShotResultDisplay("SHOT MADE!", "lime");
    updateScoreUI();
  }
}


// Handle key events
function handleKeyDown(e) {
  switch (e.key.toLowerCase()) {
    case 'arrowleft':
      moveDirection.left = true;
      break;
    case 'arrowright':
      moveDirection.right = true;
      break;
    case 'arrowup':
      moveDirection.forward = true;
      break;
    case 'arrowdown':
      moveDirection.backward = true;
      break;
    case 'w':
      shotPower = Math.min(maxPower, shotPower + powerStep);
      updatePowerUI();
      break;
    case 's':
      shotPower = Math.max(minPower, shotPower - powerStep);
      updatePowerUI();
      break;
    case ' ':
      shootBall();
      break;
    case 'r':
      basketball.position.set(0, groundY + airHeight, 0);
      basketball.rotation.set(0, 0, 0);
      isBallInMotion = false;
      ballVelocity.set(0, 0, 0);
      shotPower = 50;
      updatePowerUI();
      break;
    case 'o':
      isOrbitEnabled = !isOrbitEnabled;
      break;
  }
}

function handleKeyUp(e) {
  switch (e.key.toLowerCase()) {
    case 'arrowleft':
      moveDirection.left = false;
      break;
    case 'arrowright':
      moveDirection.right = false;
      break;
    case 'arrowup':
      moveDirection.forward = false;
      break;
    case 'arrowdown':
      moveDirection.backward = false;
      break;
  }
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// Animation function
function animate() {
  requestAnimationFrame(animate);

  // time since last frame, in seconds
  const dt = clock.getDelta();

  if (basketball) {
    if (isBallInMotion) {
      // Apply gravity with time
      ballVelocity.y += gravity * dt;

      // Update position using velocity and time
      basketball.position.x += ballVelocity.x * dt;
      basketball.position.y += ballVelocity.y * dt;
      basketball.position.z += ballVelocity.z * dt;

      // Rotation
      const minSpinVelocity = 0.01;
      let v = ballVelocity.clone();

      if (isBallInMotion && v.length() > minSpinVelocity) {
        // Rotation in flight
        const axis = new THREE.Vector3().crossVectors(v, new THREE.Vector3(0, 1, 0)).normalize();
        const angularSpeed = v.length() / ballRadius;
        basketball.rotateOnAxis(axis, angularSpeed * dt);
      } else if (!isBallInMotion) {
        // Not on the air, moving on the ground after bouncing
        let horizontalVelocity = v.clone(); horizontalVelocity.y = 0;
        if (horizontalVelocity.length() > minSpinVelocity) {
          const axis = new THREE.Vector3(0, 0, 0).crossVectors(horizontalVelocity, new THREE.Vector3(0, 1, 0)).normalize();
          const angularSpeed = horizontalVelocity.length() / ballRadius;
          basketball.rotateOnAxis(axis, angularSpeed * dt);
        }
      }

      checkForScore();

      // Update lastBallY for next frame
      lastBallY = basketball.position.y;

      [leftRimCenter, rightRimCenter].forEach(rimCenter => {
        const ballXZ = new THREE.Vector2(basketball.position.x, basketball.position.z);
        const rimXZ = new THREE.Vector2(rimCenter.x, rimCenter.z);
        const distXZ = ballXZ.distanceTo(rimXZ);

        if (distXZ < rimRadius + ballRadius) {

          const isCleanShot = basketball.position.y > rimCenter.y + 0.05 &&
              ballVelocity.y < 0 &&
              distXZ < rimRadius * 0.8;

          if (!isCleanShot) {
            // Collision with rim
            const overlap = (rimRadius + ballRadius) - distXZ;
            const direction = ballXZ.clone().sub(rimXZ).normalize();
            basketball.position.x += direction.x * overlap;
            basketball.position.z += direction.y * overlap;

            // Reflect velocity
            const vDotN = ballVelocity.x * direction.x + ballVelocity.z * direction.y;
            ballVelocity.x -= 2 * vDotN * direction.x;
            ballVelocity.z -= 2 * vDotN * direction.y;
            ballVelocity.multiplyScalar(energyLoss);
          }
        }
      });


      // Ground collision
      if (basketball.position.y <= groundY) {
        basketball.position.y = groundY;
        if (Math.abs(ballVelocity.y) > 0.8) {
          ballVelocity.y *= -energyLoss;
          ballVelocity.x *= energyLoss;
          ballVelocity.z *= energyLoss;
        } else {
          ballVelocity.set(0, 0, 0);
          isBallInMotion = false;

          if (!shotJustScored) {
            showShotResultDisplay("MISSED SHOT", "orangered");
            updateScoreUI();
          }
          lastBallY = null;
        }
      }
    } else {
      // Ball control when not in flight
      const moveVec = new THREE.Vector3();
      if (moveDirection.left) moveVec.x -= moveSpeed;
      if (moveDirection.right) moveVec.x += moveSpeed;
      if (moveDirection.forward) moveVec.z -= moveSpeed;
      if (moveDirection.backward) moveVec.z += moveSpeed;

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();

        const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

        const worldMove = new THREE.Vector3()
            .addScaledVector(camDir, -moveVec.z)
            .addScaledVector(camRight, moveVec.x);

        worldMove.multiplyScalar(moveSpeed);
        basketball.position.add(worldMove);
      }

      basketball.position.x = Math.max(courtBoundary.minX, Math.min(courtBoundary.maxX, basketball.position.x));
      basketball.position.z = Math.max(courtBoundary.minZ, Math.min(courtBoundary.maxZ, basketball.position.z));
    }
  }

  // Update controls
  controls.enabled = isOrbitEnabled;
  controls.update();

  renderer.render(scene, camera);
}

animate();