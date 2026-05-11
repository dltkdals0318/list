const { Engine, Bodies, Body, Events, Composite, Runner } = Matter;

// config

const LEVELS = [
  { radius: 40 },
  { radius: 56 },
  { radius: 80 },
  { radius: 112 },
  { radius: 156 },
  { radius: 216 },
  { radius: 300 },
];
const MAX_LEVEL = LEVELS.length - 1;
const RING_COLORS = ["#2e77a8", "#1db4a5", "#dfe43b"];
const MERGE_COOLDOWN = 10;
const SPAWN_INTERVAL = 200;
const SPAWN_LEVEL = 0;
const PHYS_SCALE = 0.85;

function physR(level) {
  return LEVELS[level].radius * PHYS_SCALE;
}

const SPAWN_R = physR(SPAWN_LEVEL);

const W = window.innerWidth;
const H = window.innerHeight;
const WALL_T = 20;

const RING_WIDTH = 10;

// canvas

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const dpr = window.devicePixelRatio || 1;

canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = W + "px";
canvas.style.height = H + "px";
ctx.scale(dpr, dpr);

// physics

const engine = Engine.create({ gravity: { y: 1.8 } });
Runner.run(Runner.create(), engine);

Composite.add(engine.world, [
  Bodies.rectangle(W / 2, H + WALL_T / 2, W + WALL_T * 2, WALL_T, {
    isStatic: true,
    label: "wall",
  }),
  Bodies.rectangle(-WALL_T / 2, H / 2, WALL_T, H * 2, {
    isStatic: true,
    label: "wall",
  }),
  Bodies.rectangle(W + WALL_T / 2, H / 2, WALL_T, H * 2, {
    isStatic: true,
    label: "wall",
  }),
]);

// circles

function createCircle(x, y, level) {
  const body = Bodies.circle(x, y, physR(level), {
    restitution: 0.2,
    friction: 0.5,
    density: 0.003,
    label: "circle",
  });
  body.gameLevel = level;
  body.spawnTime = Date.now();
  Composite.add(engine.world, body);
  return body;
}

// merge

const mergingIds = new Set();
const pendingMerges = [];
const birthBodies = new Map();

function easeOutBack(t) {
  const c1 = 0.8,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

Events.on(engine, "collisionStart", (event) => {
  const now = Date.now();
  for (const pair of event.pairs) {
    const { bodyA, bodyB } = pair;
    if (
      bodyA.label !== "circle" ||
      bodyB.label !== "circle" ||
      bodyA.gameLevel !== bodyB.gameLevel ||
      bodyA.gameLevel >= MAX_LEVEL ||
      mergingIds.has(bodyA.id) ||
      mergingIds.has(bodyB.id) ||
      now - bodyA.spawnTime < MERGE_COOLDOWN ||
      now - bodyB.spawnTime < MERGE_COOLDOWN
    )
      continue;
    mergingIds.add(bodyA.id);
    mergingIds.add(bodyB.id);
    pendingMerges.push({ a: bodyA, b: bodyB });
  }
});

Events.on(engine, "afterUpdate", () => {
  if (!pendingMerges.length) return;
  for (const { a, b } of pendingMerges.splice(0)) {
    const mx = (a.position.x + b.position.x) / 2;
    const my = (a.position.y + b.position.y) / 2;
    const vx = (a.velocity.x + b.velocity.x) * 0.35;
    const vy = (a.velocity.y + b.velocity.y) * 0.35;
    const next = a.gameLevel + 1;
    const fromR = LEVELS[a.gameLevel].radius;
    const nPR = physR(next);

    Composite.remove(engine.world, a);
    Composite.remove(engine.world, b);
    mergingIds.delete(a.id);
    mergingIds.delete(b.id);

    const cx = Math.max(nPR, Math.min(W - nPR, mx));
    const cy = Math.max(nPR, Math.min(H - nPR, my));
    const merged = createCircle(cx, cy, next);
    Body.setVelocity(merged, { x: vx, y: vy });
    birthBodies.set(merged.id, { startTime: Date.now(), duration: 220, fromR });
  }
});

// input

let isHolding = false;
let mouseX = 0;
let mouseY = 0;
let spawnTimer = null;

let hintAlpha = 1;
let hintFadeStart = null;

function toCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function spawnAtMouse() {
  createCircle(
    Math.max(SPAWN_R, Math.min(W - SPAWN_R, mouseX)),
    Math.max(SPAWN_R, Math.min(H - SPAWN_R, mouseY)),
    SPAWN_LEVEL,
  );
}

function startSpawn(clientX, clientY) {
  if (!hintFadeStart && hintAlpha > 0) hintFadeStart = Date.now();
  ({ x: mouseX, y: mouseY } = toCanvasCoords(clientX, clientY));
  isHolding = true;
  spawnAtMouse();
  spawnTimer = setInterval(spawnAtMouse, SPAWN_INTERVAL);
}

function moveSpawn(clientX, clientY) {
  if (!isHolding) return;
  ({ x: mouseX, y: mouseY } = toCanvasCoords(clientX, clientY));
}

function stopSpawn() {
  isHolding = false;
  clearInterval(spawnTimer);
  spawnTimer = null;
}

canvas.addEventListener("mousedown", (e) => startSpawn(e.clientX, e.clientY));
window.addEventListener("mousemove", (e) => moveSpawn(e.clientX, e.clientY));
window.addEventListener("mouseup", () => stopSpawn());

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    startSpawn(e.touches[0].clientX, e.touches[0].clientY);
  },
  { passive: false },
);
window.addEventListener(
  "touchmove",
  (e) => moveSpawn(e.touches[0].clientX, e.touches[0].clientY),
  { passive: true },
);
window.addEventListener("touchend", () => stopSpawn());

// render

function render() {
  const now = Date.now();

  const circles = [];
  for (const body of Composite.allBodies(engine.world)) {
    if (body.isStatic || body.label !== "circle") continue;
    const { radius } = LEVELS[body.gameLevel];
    let drawR = radius;
    const birth = birthBodies.get(body.id);
    if (birth) {
      const t = Math.min(1, (now - birth.startTime) / birth.duration);
      t >= 1
        ? birthBodies.delete(body.id)
        : (drawR = birth.fromR + (radius - birth.fromR) * easeOutBack(t));
    }
    circles.push({ x: body.position.x, y: body.position.y, drawR });
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  const passes = [
    { offset: 4, color: RING_COLORS[2] },
    { offset: 3, color: "#c8c2b6" },
    { offset: 2, color: RING_COLORS[1] },
    { offset: 1, color: RING_COLORS[0] },
    { offset: 0, color: "#ffffff" },
  ];

  for (const { offset, color } of passes) {
    ctx.fillStyle = color;
    for (const { x, y, drawR } of circles) {
      ctx.beginPath();
      ctx.arc(x, y, drawR + offset * RING_WIDTH, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (hintAlpha > 0) {
    if (hintFadeStart) hintAlpha = Math.max(0, 1 - (Date.now() - hintFadeStart) / 600);
    ctx.globalAlpha = hintAlpha;
    ctx.fillStyle = "#e8e8e0";
    ctx.font = `900 ${Math.max(16, W * 0.018)}px MinBuri`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Drag the Ball!", W / 2, H / 2);
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(render);
}

render();
