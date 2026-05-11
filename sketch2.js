const W = window.innerWidth;
const H = window.innerHeight;
const CX = W / 2 + 100;
const CY = H / 2 + 220;

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

const maxR = Math.min(W, H) * 0.576;
const centerR = maxR * 0.11;
const ringW = (maxR - centerR) / 5;

const RINGS = [
  { color: "#dfe43b", text: "li:st  li/st  [li]st  ", speed: 0.00016, dir: 1 },
  {
    color: "#c7c4ba",
    text: "proto spring exhibition:  ",
    speed: 0.00022,
    dir: -1,
  },
  {
    color: "#2e77a8",
    text: "11(mon) - 15(fri) May 2026  R7F central & west gallery  ",
    speed: 0.00028,
    dir: 1,
  },
  {
    color: "#1db4a5",
    text: "목록은 단순한 정보의 나열이 아닌, 세계를 이해하는 하나의 방식이다.  ",
    speed: 0.00036,
    dir: -1,
  },
  {
    color: "#dfe43b",
    text: "각각의 항목은 보이지 않는 지배 논리 속에서...  ",
    speed: 0.00044,
    dir: 1,
  },
];

RINGS.forEach((ring, i) => {
  ring.outerR = maxR - i * ringW;
  ring.innerR = maxR - (i + 1) * ringW;
  ring.midR = maxR - (i + 0.5) * ringW;
  ring.userOffset = 0;
  ring.angularVel = 0;
  ring.velSamples = [];
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
  hintActive = false;
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

// hint

let hintAlpha = 1;
let hintActive = true;
let _hintCache = null;

function drawHintArc() {
  if (hintAlpha <= 0) return;
  const hintR = maxR + ringW * 0.55;
  const text = "Scroll me!";
  const fontSize = Math.max(12, ringW * 0.37);
  ctx.font = `900 ${fontSize}px MinBuri`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!_hintCache) {
    const chars = Array.from(text);
    const steps = chars.map((ch) => ctx.measureText(ch).width / hintR);
    const totalAngle = steps.reduce((s, v) => s + v, 0);
    const startAngle = Math.PI / 4 - totalAngle / 2;
    _hintCache = { chars, steps, startAngle };
  }

  const { chars, steps, startAngle } = _hintCache;
  ctx.globalAlpha = hintAlpha;
  ctx.fillStyle = "#e8e8e0";

  let angle = startAngle;
  for (let i = 0; i < chars.length; i++) {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(angle + steps[i] / 2);
    ctx.translate(0, -hintR);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle += steps[i];
  }
  ctx.globalAlpha = 1;
}

// render

function drawArcText(ring, startAngle) {
  const fontSize = Math.max(12, ringW * 0.52);
  ctx.font = `900 ${fontSize}px MinBuri`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";

  const TWO_PI = 2 * Math.PI;

  if (!ring._ready) {
    const chars = Array.from(ring.text);
    ring._chars = chars;
    ring._charSteps = chars.map((ch) => ctx.measureText(ch).width / ring.midR);
    const textAngle = ring._charSteps.reduce((s, v) => s + v, 0);
    ring._numCopies =
      textAngle >= TWO_PI
        ? 1
        : Math.min(3, Math.max(1, Math.floor(TWO_PI / textAngle)));
    ring._slotAngle = TWO_PI / ring._numCopies;
    ring._ready = true;
  }

  const maxAngle = ring._numCopies === 1 ? TWO_PI : ring._slotAngle;

  for (let c = 0; c < ring._numCopies; c++) {
    let angle = startAngle + c * ring._slotAngle;
    let drawn = 0;

    for (let i = 0; i < ring._chars.length; i++) {
      const step = ring._charSteps[i];
      if (drawn + step > maxAngle + 1e-6) break;

      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(angle + step / 2);
      ctx.translate(0, -ring.midR);
      ctx.fillText(ring._chars[i], 0, 0);
      ctx.restore();

      angle += step;
      drawn += step;
    }
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

  if (!hintActive && hintAlpha > 0) {
    hintAlpha = Math.max(0, hintAlpha - dt / 600);
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  for (const ring of RINGS) {
    ctx.beginPath();
    ctx.arc(CX, CY, ring.outerR, 0, Math.PI * 2);
    ctx.arc(CX, CY, ring.innerR, 0, Math.PI * 2);
    ctx.fillStyle = ring.color;
    ctx.fill("evenodd");

    drawArcText(ring, ring.dir * elapsed * ring.speed + ring.userOffset);
  }

  drawHintArc();

  ctx.beginPath();
  ctx.arc(CX, CY, centerR, 0, Math.PI * 2);
  ctx.fillStyle = "#000000";
  ctx.fill();

  requestAnimationFrame(render);
}

document.fonts.ready.then(() => requestAnimationFrame(render));
