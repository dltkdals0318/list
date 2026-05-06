const W = window.innerWidth;
const H = window.innerHeight;
const CX = W / 2;
const CY = H / 2;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const dpr = window.devicePixelRatio || 1;

canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = W + "px";
canvas.style.height = H + "px";
canvas.style.cursor = "grab";
ctx.scale(dpr, dpr);

// config

const maxR = Math.min(W, H) * 0.48;
const centerR = maxR * 0.11;
const ringW = (maxR - centerR) / 5;

const RINGS = [
  {
    color: "#cade38",
    text: "li:St  li/st  [li]st  ",
    speed: 0.00016,
    dir: 1,
    reps: 3,
  },
  {
    color: "#b2aa94",
    text: "proto spring exhibition:  ",
    speed: 0.00022,
    dir: -1,
    reps: 1,
  },
  {
    color: "#3b5e6c",
    text: "11(mon) - 16(fri) May 2026  R7F central & west gallery  ",
    speed: 0.00028,
    dir: 1,
    reps: 1,
  },
  {
    color: "#4e7880",
    text: "목록은 단순한 정보의 나열이 아닌,  ",
    speed: 0.00036,
    dir: -1,
    reps: 1,
  },
  {
    color: "#cade38",
    text: "세계를 이해하는 방식이다.",
    speed: 0.00044,
    dir: 1,
    reps: 1,
  },
];

RINGS.forEach((ring, i) => {
  ring.outerR = maxR - i * ringW;
  ring.innerR = maxR - (i + 1) * ringW;
  ring.midR = maxR - (i + 0.5) * ringW;
  ring.userOffset = 0;
  ring.angularVel = 0;
  ring.velSamples = [];

  ring.fullText = ring.text.repeat(ring.reps);
});

// interaction — drag each ring independently

let activeRing = null;
let prevAngle = 0;
let prevMoveTime = 0;

function pointerAngle(x, y) {
  return Math.atan2(y - CY, x - CX);
}

function getRingAt(x, y) {
  const dist = Math.hypot(x - CX, y - CY);
  return RINGS.find((r) => dist >= r.innerR && dist <= r.outerR) || null;
}

function onDown(x, y) {
  activeRing = getRingAt(x, y);
  if (!activeRing) return;
  prevAngle = pointerAngle(x, y);
  prevMoveTime = performance.now();
  activeRing.angularVel = 0;
  activeRing.velSamples.length = 0;
  canvas.style.cursor = "grabbing";
}

function onMove(x, y) {
  if (!activeRing) {
    canvas.style.cursor = getRingAt(x, y) ? "grab" : "default";
    return;
  }
  const now = performance.now();
  const curr = pointerAngle(x, y);

  let delta = curr - prevAngle;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  const dt = now - prevMoveTime;
  if (dt > 0 && dt < 80) {
    activeRing.velSamples.push({ delta, dt });
    if (activeRing.velSamples.length > 5) activeRing.velSamples.shift();
  }

  activeRing.userOffset += delta;
  prevAngle = curr;
  prevMoveTime = now;
}

function onUp() {
  if (!activeRing) return;
  canvas.style.cursor = "grab";

  if (activeRing.velSamples.length > 0) {
    const d = activeRing.velSamples.reduce((s, v) => s + v.delta, 0);
    const t = activeRing.velSamples.reduce((s, v) => s + v.dt, 0);
    activeRing.angularVel = t > 0 ? d / t : 0;
  }
  activeRing = null;
}

canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
window.addEventListener("mouseup", () => onUp());

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    onDown(e.touches[0].clientX, e.touches[0].clientY);
  },
  { passive: false },
);
window.addEventListener(
  "touchmove",
  (e) => onMove(e.touches[0].clientX, e.touches[0].clientY),
  { passive: true },
);
window.addEventListener("touchend", () => onUp());

// render

function drawArcText(ring, startAngle) {
  const fontSize = Math.max(12, ringW * 0.58);
  ctx.font = `900 ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";

  let angle = startAngle;
  for (const char of ring.fullText) {
    const step = ctx.measureText(char).width / ring.midR;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(angle + (ring.dir * step) / 2);
    ctx.translate(0, -ring.midR);
    ctx.fillText(char, 0, 0);
    ctx.restore();
    angle += ring.dir * step;
  }
}

let t0 = null,
  lastTs = 0;

function render(ts) {
  if (!t0) {
    t0 = ts;
    lastTs = ts;
  }
  const elapsed = ts - t0;
  const dt = ts - lastTs;
  lastTs = ts;

  for (const ring of RINGS) {
    if (ring === activeRing) continue;
    ring.userOffset += ring.angularVel * dt;
    ring.angularVel *= Math.exp(-dt * 0.003);
    if (Math.abs(ring.angularVel) < 0.000001) ring.angularVel = 0;
  }

  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(0, 0, W, H);

  for (const ring of RINGS) {
    ctx.beginPath();
    ctx.arc(CX, CY, ring.outerR, 0, Math.PI * 2);
    ctx.arc(CX, CY, ring.innerR, 0, Math.PI * 2);
    ctx.fillStyle = ring.color;
    ctx.fill("evenodd");

    drawArcText(ring, ring.dir * elapsed * ring.speed + ring.userOffset);
  }

  ctx.beginPath();
  ctx.arc(CX, CY, centerR, 0, Math.PI * 2);
  ctx.fillStyle = "#0d0d1a";
  ctx.fill();

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
