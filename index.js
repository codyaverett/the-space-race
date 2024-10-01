let mousePos = { x: 0, y: 0 };
let HEIGHT = window.innerHeight;
let WIDTH = window.innerWidth;
let flag = true;

let cameraRotationSpeed = 0.02; // Adjust speed of camera rotation
let cameraAngleX = 0; // Horizontal rotation angle
let cameraAngleY = Math.PI / 4; // Vertical rotation angle (starting at a slight incline)

// Track key states for smooth camera movement
const keyState = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
};

// Orbital parameters for satellite
const satelliteOrbit = {
    semiMajorAxis: 1200, // Semi-major axis in units
    eccentricity: 0, // Orbit eccentricity (0 is circular, closer to 1 is more elliptical)
    inclination: Math.PI / 4, // Inclination angle
    orbitalPeriod: 10, // Time it takes to complete an orbit in seconds
};

// Orbital parameters for moon
const moonOrbit = {
    semiMajorAxis: 1600,
    eccentricity: 0,
    inclination: Math.PI / 4,
    orbitalPeriod: 30,
};

let satellite, moon;
let satelliteOrbitAngle = 0; // Initial orbital angle
let moonOrbitAngle = 40; // Initial orbital angle

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 1, 10000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
const container = document.getElementById('space');

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(0, 0, 500);
scene.add(ambientLight, pointLight);

// Parameters
const params = {
  speed: 1,
  density: 1,
  frequency: 1,
};

// Scene boundaries
const sceneRadius = 2000;

// Objects
let rocket;
let planet;
let asteroids = [];
let comets = [];
const asteroidCount = 100;
const cometCount = 200;

// Particle system for thrusters
let thrusterParticles;

// Explosions
let explosions = [];

// Time uniform for shaders
let clock = new THREE.Clock();

// Texture loader
const textureLoader = new THREE.TextureLoader();

// Load water texture
const waterTexture = textureLoader.load('https://www.manytextures.com/thumbnail/44/512/clear+sea+water.jpg'); // Replace with your texture URL
waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;

// Initialize the scene
function init() {
  // Renderer and container setup
  renderer.setSize(WIDTH, HEIGHT);
  container.appendChild(renderer.domElement);

  // Camera position
  camera.position.set(0, 0, 1000);

  // Event listeners
  window.addEventListener('resize', onWindowResize, false);
  document.addEventListener('mousemove', onMouseMove, false);
  document.addEventListener('keydown', onKeyDown, false);
  document.getElementById('button').addEventListener('click', onResume, false);

  // Create objects
  createStars();
  createPlanet();
  createSatellite();
  createMoon();
  createRocket();
  createAsteroids();
  createComets();
  createThrusterParticles();

  // Start animation
  animate();
}

// Handle window resize
function onWindowResize() {
  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;
  renderer.setSize(WIDTH, HEIGHT);
  camera.aspect = WIDTH / HEIGHT;
  camera.updateProjectionMatrix();
}

// Handle mouse move
function onMouseMove(event) {
  mousePos.x = (event.clientX / WIDTH) * 2 - 1;
  mousePos.y = -(event.clientY / HEIGHT) * 2 + 1;
}

// Handle key down (toggle overlay)
function onKeyDown(event) {
  if (event.key === 'Escape') {
    const overlay = document.getElementById('overlay');
    overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
    flag = !flag;
  }
}

// Handle resume button
function onResume() {
  document.getElementById('overlay').style.display = 'none';
  flag = true;
}

function createSatellite() {
    const geometry = new THREE.SphereGeometry(20, 128, 128); // Small sphere
    const material = new THREE.MeshPhongMaterial({ color: 0xAA4A44 });
    satellite = new THREE.Mesh(geometry, material);
    scene.add(satellite);
}

function createMoon() {
    const geometry = new THREE.SphereGeometry(100, 30, 30); // Slightly larger sphere
    const material = new THREE.MeshPhongMaterial({ color: 0xBADA55 });
    moon = new THREE.Mesh(geometry, material);
    scene.add(moon);
}

// Create the planet with Perlin noise deformation and water texture
function createPlanet() {
  const geometry = new THREE.SphereGeometry(650, 128, 128);

  // Custom shader material
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      texture1: { value: waterTexture },
    },
    vertexShader: `
      precision mediump float;
      uniform float time;
      varying vec2 vUv;

      // Simplex noise implementation in GLSL
      // Source: https://github.com/ashima/webgl-noise

      vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }

      vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }

      vec4 permute(vec4 x) {
        return mod289(((x*34.0)+1.0)*x);
      }

      vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }

      float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        // First corner
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 =   v - i + dot(i, C.xxx) ;

        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        // x0 = x0 - 0.0 + 0.0 * C
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

        // Permutations
        i = mod289(i);
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        // Gradients
        float n_ = 1.0 / 7.0; // N=7
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  // mod(p,N*N)

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        // Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      void main() {
        vUv = uv;

        // Calculate displacement with noise
        float noise = snoise(normal * 2.0 + time * 0.2);
        float displacement = noise * 10.0;

        // Update position
        vec3 newPosition = position + normal * displacement;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      uniform sampler2D texture1;
      varying vec2 vUv;

      void main() {
        // Sample the texture
        vec4 textureColor = texture2D(texture1, vUv * 5.0); // Adjust tiling with * 5.0

        // Output the final color
        gl_FragColor = textureColor;
      }
    `,
    side: THREE.DoubleSide,
  });

  planet = new THREE.Mesh(geometry, material);
  planet.position.set(0, -500, -1500);
  scene.add(planet);
}

// Create the rocketship with white and red design
function createRocket() {
  rocket = new THREE.Object3D();

  // Rocket body (white cylinder)
  const bodyGeometry = new THREE.CylinderGeometry(5, 5, 30, 16);
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0;
  rocket.add(body);

  // Rocket nose cone (red cone)
  const noseGeometry = new THREE.ConeGeometry(5, 10, 16);
  const noseMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
  const nose = new THREE.Mesh(noseGeometry, noseMaterial);
  nose.position.y = 20;
  rocket.add(nose);

  // Rocket fins (red)
  const finGeometry = new THREE.BoxGeometry(2, 5, 0.5);
  const finMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
  const fin1 = new THREE.Mesh(finGeometry, finMaterial);
  fin1.position.set(-4, -15, 0);
  fin1.rotation.z = 0.5;
  rocket.add(fin1);

  const fin2 = fin1.clone();
  fin2.position.set(4, -15, 0);
  fin2.rotation.z = -0.5;
  rocket.add(fin2);

  const fin3 = fin1.clone();
  fin3.position.set(0, -15, -4);
  fin3.rotation.x = 0.5;
  rocket.add(fin3);

  const fin4 = fin1.clone();
  fin4.position.set(0, -15, 4);
  fin4.rotation.x = -0.5;
  rocket.add(fin4);

  // Initial orientation
  rocket.rotation.z = Math.PI / 2;

  // Set initial position
  rocket.position.z = 500; // Adjust this value as needed

  scene.add(rocket);
}

// Create stars
function createStars() {
  const starGeometry = new THREE.Geometry();
  for (let i = 0; i < 200; i++) {
    const star = new THREE.Vector3(
      THREE.Math.randFloatSpread(4000),
      THREE.Math.randFloatSpread(4000),
      THREE.Math.randFloatSpread(4000)
    );
    starGeometry.vertices.push(star);
  }
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff });
  const starField = new THREE.Points(starGeometry, starMaterial);
  scene.add(starField);
}

// Create asteroids with varying size and shape
function createAsteroids() {
  for (let i = 0; i < asteroidCount; i++) {
    // Randomly choose geometry
    let geometry;
    const randomShape = Math.random();
    const size = 10 + Math.random() * 20;
    if (randomShape < 0.33) {
      geometry = new THREE.DodecahedronGeometry(size, 0);
    } else if (randomShape < 0.66) {
      geometry = new THREE.OctahedronGeometry(size, 0);
    } else {
      geometry = new THREE.TetrahedronGeometry(size, 0);
    }

    // Add noise to the asteroid geometry
    geometry.vertices.forEach((vertex) => {
      vertex.x += (Math.random() - 0.5) * 5;
      vertex.y += (Math.random() - 0.5) * 5;
      vertex.z += (Math.random() - 0.5) * 5;
    });

    const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const asteroid = new THREE.Mesh(geometry, material);

    resetAsteroid(asteroid);
    asteroids.push(asteroid);
    scene.add(asteroid);
  }
}

// Reset asteroid position and velocity
function resetAsteroid(asteroid) {
  // Random position within a sphere
  const phi = Math.acos(2 * Math.random() - 1);
  const theta = 2 * Math.PI * Math.random();
  const radius = sceneRadius * Math.cbrt(Math.random()); // Cube root for uniform distribution

  asteroid.position.set(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi)
  );

  // Random velocity vector
  const speed = 50 + Math.random() * 50; // Adjust speed range as needed
  const velocityPhi = Math.acos(2 * Math.random() - 1);
  const velocityTheta = 2 * Math.PI * Math.random();

  asteroid.userData.velocity = new THREE.Vector3(
    speed * Math.sin(velocityPhi) * Math.cos(velocityTheta),
    speed * Math.sin(velocityPhi) * Math.sin(velocityTheta),
    speed * Math.cos(velocityPhi)
  );

  asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  asteroid.userData.rotationSpeed = new THREE.Vector3(
    Math.random() * 0.02 - 0.01,
    Math.random() * 0.02 - 0.01,
    Math.random() * 0.02 - 0.01
  );
}

// Create comets
function createComets() {
  const geometry = new THREE.ConeGeometry(5, 20, 8);
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
  for (let i = 0; i < cometCount; i++) {
    const comet = new THREE.Mesh(geometry, material);
    resetComet(comet);
    comets.push(comet);
    scene.add(comet);
  }
}

// Reset comet position and velocity
function resetComet(comet) {
  // Random position within a sphere
  const phi = Math.acos(2 * Math.random() - 1);
  const theta = 2 * Math.PI * Math.random();
  const radius = sceneRadius * Math.cbrt(Math.random()); // Cube root for uniform distribution

  comet.position.set(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi)
  );

  // Random velocity vector
  const speed = 100 + Math.random() * 100; // Adjust speed range as needed
  const velocityPhi = Math.acos(2 * Math.random() - 1);
  const velocityTheta = 2 * Math.PI * Math.random();

  comet.userData.velocity = new THREE.Vector3(
    speed * Math.sin(velocityPhi) * Math.cos(velocityTheta),
    speed * Math.sin(velocityPhi) * Math.sin(velocityTheta),
    speed * Math.cos(velocityPhi)
  );

  comet.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
}

// Create thruster particles
function createThrusterParticles() {
  const particleCount = 100;
  const particlesGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    velocities[i * 3] = (Math.random() - 0.5) * 0.2;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
    velocities[i * 3 + 2] = -Math.random() * 0.5 - 0.1; // Move particles backward
  }

  // Use addAttribute for older Three.js versions
  particlesGeometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeometry.addAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

  const particlesMaterial = new THREE.PointsMaterial({
    color: 0xffaa00,
    size: 4,
    transparent: true,
    opacity: 0.8,
  });

  thrusterParticles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(thrusterParticles);
}

// Explosion class (same as before)
class Explosion {
  constructor(position) {
    this.particleCount = 100;
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 3);
    this.lifetimes = new Float32Array(this.particleCount);
    this.age = 0;
    this.maxAge = 5; // Explosion duration in seconds

    for (let i = 0; i < this.particleCount; i++) {
      // Initial positions
      this.positions[i * 3] = position.x;
      this.positions[i * 3 + 1] = position.y;
      this.positions[i * 3 + 2] = position.z;

      // Random velocities
      const speed = Math.random() * 50 + 50;
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI * 2;
      this.velocities[i * 3] = Math.cos(angle1) * Math.sin(angle2) * speed;
      this.velocities[i * 3 + 1] = Math.sin(angle1) * Math.sin(angle2) * speed;
      this.velocities[i * 3 + 2] = Math.cos(angle2) * speed;

      // Lifetimes
      this.lifetimes[i] = Math.random() * this.maxAge;
    }

    this.geometry.addAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.addAttribute('velocity', new THREE.BufferAttribute(this.velocities, 3));
    this.geometry.addAttribute('lifetime', new THREE.BufferAttribute(this.lifetimes, 1));

    const material = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 15,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(this.geometry, material);
    scene.add(this.particles);
  }

  update(delta) {
    this.age += delta;
    const positions = this.geometry.attributes.position.array;
    const velocities = this.geometry.attributes.velocity.array;

    for (let i = 0; i < this.particleCount; i++) {
      if (this.age < this.lifetimes[i]) {
        // Update positions based on velocities
        positions[i * 3] += velocities[i * 3] * delta;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;

    // Fade out particles over time
    this.particles.material.opacity = 1.0 - (this.age / this.maxAge);

    if (this.age >= this.maxAge) {
      // Remove particles from the scene
      scene.remove(this.particles);
      return false; // Indicate that the explosion is finished
    }

    return true; // Explosion is still active
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  if (flag) {
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // Update planet time uniform
    planet.material.uniforms.time.value = elapsedTime;

    // Update rocket position
    const targetX = mousePos.x * 500;
    const targetY = mousePos.y * 500;

    const dx = targetX - rocket.position.x;
    const dy = targetY - rocket.position.y;
    const angle = Math.atan2(dy, dx);

    // Point the rocket towards the cursor
    rocket.rotation.z = angle - Math.PI / 2;

    // Move the rocket towards the cursor
    rocket.position.x += dx * 0.05 * params.speed;
    rocket.position.y += dy * 0.05 * params.speed;

    // Update satellite orbit
    satelliteOrbitAngle += (2 * Math.PI / satelliteOrbit.orbitalPeriod) * delta; // Increment angle based on orbital period
    updateOrbit(satellite, satelliteOrbit, satelliteOrbitAngle);

    // Update moon orbit
    moonOrbitAngle += (2 * Math.PI / moonOrbit.orbitalPeriod) * delta; // Increment angle based on orbital period
    updateOrbit(moon, moonOrbit, moonOrbitAngle);

    // Update thruster particles
    updateThrusterParticles();

    // Rotate planet (adjust rotation speed and axes)
    planet.rotation.y += 0.001 * params.speed; // Faster rotation along Y-axis
    planet.rotation.x += 0.0005 * params.speed; // Optional: rotation along X-axis

    // Update asteroids
    asteroids.forEach((asteroid) => {
    // Apply gravitational force
    applyGravitationalForce(asteroid);

    // Move asteroid based on its velocity
    asteroid.position.add(asteroid.userData.velocity.clone().multiplyScalar(delta));

    asteroid.rotation.x += asteroid.userData.rotationSpeed.x;
    asteroid.rotation.y += asteroid.userData.rotationSpeed.y;
    asteroid.rotation.z += asteroid.userData.rotationSpeed.z;

    // Check if asteroid is outside the scene radius
    if (asteroid.position.length() > sceneRadius * 1.5) {
        resetAsteroid(asteroid);
    }

    // Collision detection with rocket
    if (rocket.position.distanceTo(asteroid.position) < 20) {
        createExplosion(asteroid.position.clone());
        resetAsteroid(asteroid);
    }

    // Collision detection with planet
    if (planet.position.distanceTo(asteroid.position) < 420) {
        createExplosion(asteroid.position.clone());
        resetAsteroid(asteroid);
    }
    });

    // Update comets
    comets.forEach((comet) => {
        // Apply gravitational force
        applyGravitationalForce(comet);

        // Move comet based on its velocity
        comet.position.add(comet.userData.velocity.clone().multiplyScalar(delta));

        comet.rotation.x += 0.02;
        comet.rotation.y += 0.02;

        // Check if comet is outside the scene radius
        if (comet.position.length() > sceneRadius * 1.5) {
            resetComet(comet);
        }

        // Collision detection with rocket
        if (rocket.position.distanceTo(comet.position) < 20) {
            createExplosion(comet.position.clone());
            resetComet(comet);
        }

        // Collision detection with planet
        if (planet.position.distanceTo(comet.position) < 420) {
            createExplosion(comet.position.clone());
            resetComet(comet);
        }
    });

    // Update explosions
    updateExplosions(delta);

    // Update parameters from sliders
    updateParameters();
  }
  
  renderer.render(scene, camera);
}

// Create explosion at position
function createExplosion(position) {
  const explosion = new Explosion(position);
  explosions.push(explosion);
}

// Update all active explosions
function updateExplosions(delta) {
  explosions = explosions.filter((explosion) => explosion.update(delta));
}

// Update thruster particles
function updateThrusterParticles() {
  const positions = thrusterParticles.geometry.attributes.position.array;
  const velocities = thrusterParticles.geometry.attributes.velocity.array;

  for (let i = 0; i < positions.length; i += 3) {
    // Update positions based on velocities
    positions[i] += velocities[i];
    positions[i + 1] += velocities[i + 1];
    positions[i + 2] += velocities[i + 2];

    // Reset particles when they are too far from the rocket
    const distance = Math.sqrt(
      (positions[i] - rocket.position.x) ** 2 +
      (positions[i + 1] - rocket.position.y) ** 2 +
      (positions[i + 2] - rocket.position.z) ** 2
    );
    if (distance > 50) {
      resetParticle(i);
    }
  }

  thrusterParticles.geometry.attributes.position.needsUpdate = true;
}

// Reset individual particle
function resetParticle(index) {
  const positions = thrusterParticles.geometry.attributes.position.array;
  const velocities = thrusterParticles.geometry.attributes.velocity.array;

  // Position the particle at the back of the rocket
  const direction = new THREE.Vector3(
    -Math.cos(rocket.rotation.z + Math.PI / 2),
    -Math.sin(rocket.rotation.z + Math.PI / 2),
    0
  );

  positions[index] = rocket.position.x + direction.x * 15;
  positions[index + 1] = rocket.position.y + direction.y * 15;
  positions[index + 2] = rocket.position.z;

  // Random velocity in the opposite direction of the rocket's facing
  velocities[index] = direction.x * (Math.random() * 2 + 1);
  velocities[index + 1] = direction.y * (Math.random() * 2 + 1);
  velocities[index + 2] = -Math.random() * 0.5;
}

// Update parameters based on sliders
function updateParameters() {
  const speedSlider = document.getElementById('speed').value;
  params.speed = speedSlider / 50;

  const densitySlider = document.getElementById('density').value;
  params.density = densitySlider / 50;

  const frequencySlider = document.getElementById('frequency').value;
  params.frequency = frequencySlider / 50;
}

function applyGravitationalForce(object) {
    const G = 100000; // Gravitational constant, adjust this value for strength of gravity
    const distance = planet.position.distanceTo(object.position);

    if (distance < 1500) { // Apply gravitational pull within 1000 units
        const direction = new THREE.Vector3().subVectors(planet.position, object.position).normalize();
        const forceMagnitude = G / (distance * distance); // Inverse square law
        const gravitationalForce = direction.multiplyScalar(forceMagnitude);

        // Add gravitational force to object's velocity
        object.userData.velocity.add(gravitationalForce);

        // Introduce angular momentum for orbit
        const perpendicularDirection = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
        object.userData.velocity.add(perpendicularDirection.multiplyScalar(10)); // Adjust this value for circular orbit effect
    }
}

function updateCameraPosition() {
    if (keyState.ArrowLeft) {
        cameraAngleX -= cameraRotationSpeed;
    }
    if (keyState.ArrowRight) {
        cameraAngleX += cameraRotationSpeed;
    }
    if (keyState.ArrowUp) {
        cameraAngleY = Math.max(0.1, cameraAngleY - cameraRotationSpeed); // Limit vertical rotation
    }
    if (keyState.ArrowDown) {
        cameraAngleY = Math.min(Math.PI - 0.1, cameraAngleY + cameraRotationSpeed); // Limit vertical rotation
    }

    // Calculate new camera position using spherical coordinates
    const radius = 1000; // Distance from the scene's center
    camera.position.x = radius * Math.sin(cameraAngleY) * Math.sin(cameraAngleX);
    camera.position.y = radius * Math.cos(cameraAngleY);
    camera.position.z = radius * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);

    // Always look at the center of the scene
    camera.lookAt(scene.position);
}

function updateOrbit(object, orbitParams, orbitalAngle) {
    // Orbital parameters
    const a = orbitParams.semiMajorAxis; // Semi-major axis
    const e = orbitParams.eccentricity; // Eccentricity of the ellipse
    const i = orbitParams.inclination; // Inclination angle

    // Calculate the distance (r) from the focus (planet) to the object using the elliptical orbit formula
    const r = a * (1 - e * e) / (1 + e * Math.cos(orbitalAngle));

    // Calculate the object's position in the orbital plane
    let x = r * Math.cos(orbitalAngle);
    let y = r * Math.sin(orbitalAngle);

    // Apply inclination to the orbital plane (rotate around the x-axis)
    let z = y * Math.sin(i);
    y = y * Math.cos(i);

    // Set the object's position relative to the planet's position
    object.position.set(
        planet.position.x + x,
        planet.position.y + y,
        planet.position.z + z
    );
}

document.addEventListener('keydown', (event) => {
    if (event.key in keyState) {
        keyState[event.key] = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key in keyState) {
        keyState[event.key] = false;
    }
});

// Start the application
window.addEventListener('load', init, false);

