// Lumen Drift — the renderer. One canvas, one palette, everything drawn
// with vector shapes and glows: a deep indigo sky, three parallax star
// layers, a neon cyan/magenta/gold palette, particle bursts, and big
// readable text. The same draw() paints live play and the staged
// screenshot scenes; only the screen label changes what overlays appear.
import { FIELD, HEARTS, SHIP, WIN_SCORE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CYAN = '#22d3ee';
const MAGENTA = '#f472b6';
const GOLD = '#fbbf24';
const GREEN = '#34d399';
const INK = '#0b1026';

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowBlur = 0;
}

function drawStars(ctx, state, width, height) {
  const scaleX = width / FIELD.width;
  const scaleY = height / FIELD.height;
  for (const star of state.stars) {
    const depth = 0.25 + star.layer * 0.35;
    const x = ((star.x - state.time * 8 * depth) % FIELD.width + FIELD.width) % FIELD.width;
    const y = star.y;
    const alpha = 0.35 + 0.65 * Math.abs(Math.sin(state.time * 1.5 + star.twinkle));
    ctx.globalAlpha = alpha * (0.5 + star.layer * 0.25);
    ctx.fillStyle = star.layer === 2 ? '#e0f2fe' : '#a5f3fc';
    ctx.beginPath();
    ctx.arc(x * scaleX, y * scaleY, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawNebula(ctx, width, height) {
  const blobs = [
    { x: 0.18, y: 0.22, r: 0.34, color: 'rgba(124, 58, 237, 0.20)' },
    { x: 0.85, y: 0.75, r: 0.38, color: 'rgba(219, 39, 119, 0.14)' },
    { x: 0.72, y: 0.12, r: 0.28, color: 'rgba(34, 211, 238, 0.10)' },
  ];
  for (const blob of blobs) {
    const gradient = ctx.createRadialGradient(
      blob.x * width, blob.y * height, 0,
      blob.x * width, blob.y * height, blob.r * width,
    );
    gradient.addColorStop(0, blob.color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawShard(ctx, x, y, spin, pulse, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const twinkle = 0.75 + 0.25 * Math.sin(pulse * 3);
  glow(ctx, GOLD, 14);
  ctx.fillStyle = GOLD;
  ctx.globalAlpha = twinkle;
  ctx.beginPath();
  ctx.moveTo(0, -11 * scale);
  ctx.lineTo(4 * scale, -4 * scale);
  ctx.lineTo(11 * scale, 0);
  ctx.lineTo(4 * scale, 4 * scale);
  ctx.lineTo(0, 11 * scale);
  ctx.lineTo(-4 * scale, 4 * scale);
  ctx.lineTo(-11 * scale, 0);
  ctx.lineTo(-4 * scale, -4 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.arc(0, 0, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMine(ctx, x, y, radius, spin, pulse) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const throb = 1 + 0.08 * Math.sin(pulse * 4);
  glow(ctx, MAGENTA, 16);
  ctx.fillStyle = '#3b0764';
  ctx.strokeStyle = MAGENTA;
  ctx.lineWidth = 2;
  // Eight spikes around a dark core.
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const outer = radius * 1.35 * throb;
    const inner = radius * 0.7;
    const tipX = Math.cos(angle) * outer;
    const tipY = Math.sin(angle) * outer;
    const baseAngle = angle + Math.PI / 8;
    const baseX = Math.cos(baseAngle) * inner;
    const baseY = Math.sin(baseAngle) * inner;
    if (i === 0) ctx.moveTo(tipX, tipY);
    else ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseX, baseY);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStorm(ctx, x, y, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  glow(ctx, '#a78bfa', 14);
  ctx.fillStyle = '#c4b5fd';
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(5, -2);
  ctx.lineTo(13, 0);
  ctx.lineTo(5, 3);
  ctx.lineTo(0, 13);
  ctx.lineTo(-5, 3);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-5, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ede9fe';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShieldCell(ctx, x, y, pulse) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(pulse * 2) * 3;
  ctx.translate(0, bob);
  glow(ctx, GREEN, 16);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
  ctx.fill();
  ctx.fillStyle = GREEN;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', 0, 1);
  ctx.restore();
}

function drawShip(ctx, state, scale) {
  const ship = state.ship;
  const blink = ship.invulnerable > 0 && Math.floor(state.time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(ship.x * scale, ship.y * scale);
  ctx.rotate(ship.angle);
  if (blink) ctx.globalAlpha = 0.35;
  // Engine flame.
  const flame = 14 + Math.sin(state.time * 30) * 5 + Math.hypot(ship.vx, ship.vy) * 0.02;
  glow(ctx, '#fb923c', 12);
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(-12, -5);
  ctx.lineTo(-12 - flame, 0);
  ctx.lineTo(-12, 5);
  ctx.closePath();
  ctx.fill();
  // Hull: a swept light-skiff.
  glow(ctx, CYAN, 18);
  ctx.fillStyle = '#0891b2';
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-10, -13);
  ctx.lineTo(-16, -5);
  ctx.lineTo(-16, 5);
  ctx.lineTo(-10, 13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cockpit.
  ctx.fillStyle = '#ecfeff';
  ctx.beginPath();
  ctx.arc(6, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Shield ring when a shield is held.
  if (state.shield) {
    ctx.save();
    ctx.translate(ship.x * scale, ship.y * scale);
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(state.time * 5);
    glow(ctx, GREEN, 14);
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, (SHIP.radius + 9) * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGate(ctx, state, width, height) {
  // The Aurora Gate: a glowing ring that opens as the score approaches
  // 1,200, then shines wide open on the win screen. It sits high on the
  // screen (centre at 20% of the height) so it never covers the title
  // text below it.
  const cx = width / 2;
  const cy = height * 0.20;
  const progress = state.gateOpen ? 1 : state.gateProgress;
  const radius = 36 + progress * 44;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.6);
  gradient.addColorStop(0, `rgba(52, 211, 153, ${0.10 + progress * 0.35})`);
  gradient.addColorStop(0.6, `rgba(34, 211, 238, ${0.08 + progress * 0.22})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - radius * 1.8, cy - radius * 1.8, radius * 3.6, radius * 3.6);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.time * 0.4);
  glow(ctx, progress >= 1 ? GREEN : CYAN, 22);
  ctx.strokeStyle = progress >= 1 ? GREEN : CYAN;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = progress >= 1 ? GREEN : '#a5f3fc';
  ctx.font = `bold ${progress >= 1 ? 20 : 15}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(progress >= 1 ? 'GATE OPEN' : `GATE ${Math.round(progress * 100)}%`, cx, cy);
}

function drawHud(ctx, state, best, width) {
  const pad = 18;
  ctx.textBaseline = 'alphabetic';
  // Score, big and gold.
  ctx.textAlign = 'left';
  glow(ctx, GOLD, 10);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(String(state.score), pad, 44);
  noGlow(ctx);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px sans-serif';
  ctx.fillText(`BEST ${Math.max(best, state.score)}`, pad, 66);
  // Combo badge.
  if (state.combo > 1) {
    ctx.textAlign = 'left';
    glow(ctx, MAGENTA, 12);
    ctx.fillStyle = MAGENTA;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`COMBO x${state.combo}`, pad, 96);
    noGlow(ctx);
  }
  // Hearts, top right.
  ctx.textAlign = 'right';
  for (let i = 0; i < HEARTS; i += 1) {
    const x = width - pad - i * 34;
    const y = 32;
    ctx.save();
    ctx.translate(x, y);
    if (i < state.hearts) {
      glow(ctx, '#fb7185', 12);
      ctx.fillStyle = '#fb7185';
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    }
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-12, -4, -6, -12, 0, -5);
    ctx.bezierCurveTo(6, -12, 12, -4, 0, 8);
    ctx.fill();
    ctx.restore();
  }
  // Level and dash, top centre-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`LEVEL ${state.level}`, width - pad, 66);
  const dashReady = state.ship.dashCooldown <= 0;
  const dashFrac = dashReady ? 1 : 1 - state.ship.dashCooldown / SHIP.dashCooldown;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.fillRect(width - pad - 110, 76, 110, 8);
  ctx.fillStyle = dashReady ? CYAN : '#64748b';
  ctx.fillRect(width - pad - 110, 76, 110 * dashFrac, 8);
  ctx.fillStyle = dashReady ? CYAN : '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText(dashReady ? 'DASH READY [SPACE]' : 'DASH…', width - pad, 100);
  if (state.shield) {
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('SHIELD UP', width - pad, 120);
  }
  // Progress bar to the Aurora Gate, bottom centre.
  const barWidth = 420;
  const barX = (width - barWidth) / 2;
  const barY = 688;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`AURORA GATE  ${state.score} / ${WIN_SCORE}`, width / 2, barY - 8);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.fillRect(barX, barY, barWidth, 10);
  const gateGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
  gateGradient.addColorStop(0, CYAN);
  gateGradient.addColorStop(1, GREEN);
  ctx.fillStyle = gateGradient;
  ctx.fillRect(barX, barY, barWidth * state.gateProgress, 10);
}

function panel(ctx, width, height) {
  ctx.fillStyle = 'rgba(11, 16, 38, 0.72)';
  ctx.fillRect(0, 0, width, height);
}

function bigTitle(ctx, text, y, width, color, size) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  glow(ctx, color, 26);
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px sans-serif`;
  ctx.fillText(text, width / 2, y);
  noGlow(ctx);
}

function drawTitle(ctx, state, best, width, height) {
  panel(ctx, width, height);
  drawGate(ctx, state, width, height);
  bigTitle(ctx, 'LUMEN DRIFT', 250, width, CYAN, 72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Ride the solar storm. Gather the light.', width / 2, 305);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '19px sans-serif';
  ctx.fillText('Arrows / WASD or mouse to steer  •  SPACE or click to dash', width / 2, 360);
  ctx.fillText('Collect star shards to reach 1,200 and open the Aurora Gate.', width / 2, 390);
  ctx.fillText('Dodge void mines and storm shards — 3 hull hearts. P pauses.', width / 2, 420);
  ctx.fillStyle = '#a5f3fc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(Math.floor(state.time * 2) % 2 === 0 ? '▶  PRESS ENTER OR CLICK TO LAUNCH' : 'PRESS ENTER OR CLICK TO LAUNCH', width / 2, 490);
  if (best > 0) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`BEST SCORE  ${best}`, width / 2, 540);
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px sans-serif';
  ctx.fillText('A neon arcade game — no downloads, no sign-up, just drift.', width / 2, 640);
}

function drawPaused(ctx, width, height) {
  panel(ctx, width, height);
  bigTitle(ctx, 'PAUSED', 300, width, CYAN, 56);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '20px sans-serif';
  ctx.fillText('Press P to keep drifting, or R to restart.', width / 2, 370);
}

function drawOver(ctx, state, best, width, height) {
  panel(ctx, width, height);
  bigTitle(ctx, 'THE STORM TOOK YOU', 250, width, MAGENTA, 54);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`SCORE  ${state.score}    •    BEST COMBO  x${Math.max(1, state.bestCombo)}`, width / 2, 330);
  if (state.score >= best && state.score > 0) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('★ NEW BEST SCORE ★', width / 2, 375);
  }
  ctx.fillStyle = '#a5f3fc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press R or click to drift again', width / 2, 450);
}

function drawWin(ctx, state, best, width, height) {
  panel(ctx, width, height);
  drawGate(ctx, state, width, height);
  bigTitle(ctx, 'AURORA GATE OPEN!', 250, width, GREEN, 56);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef9c3';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`You gathered ${WIN_SCORE} light and rode the storm home.`, width / 2, 320);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`SCORE  ${state.score}    •    BEST COMBO  x${Math.max(1, state.bestCombo)}`, width / 2, 370);
  ctx.fillStyle = '#a5f3fc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press R or click to drift again', width / 2, 450);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(240, Math.floor(rect.height));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height };
  }

  function draw(state, screen, best) {
    const { width, height } = resize();
    const scale = width / FIELD.width;
    const scaleY = height / FIELD.height;
    // Deep indigo sky.
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0b1026');
    sky.addColorStop(0.55, '#141b3d');
    sky.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    drawNebula(ctx, width, height);
    drawStars(ctx, state, width, height);

    if (screen === SCREEN_TITLE) {
      drawGate(ctx, state, width, height);
    }

    // Particles, under the entities.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scaleY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Trail ribbon.
    for (let i = 0; i < state.trail.length; i += 1) {
      const dot = state.trail[i];
      ctx.globalAlpha = (dot.life / dot.maxLife) * 0.5 * (i / state.trail.length);
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.arc(dot.x * scale, dot.y * scaleY, 3 + 3 * (i / state.trail.length), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      for (const s of state.shards) drawShard(ctx, s.x * scale, s.y * scaleY, s.spin, s.pulse, scale);
      for (const s of state.shields) drawShieldCell(ctx, s.x * scale, s.y * scaleY, s.pulse);
      for (const m of state.mines) drawMine(ctx, m.x * scale, m.y * scaleY, m.radius * scale, m.spin, m.pulse);
      for (const s of state.storms) drawStorm(ctx, s.x * scale, s.y * scaleY, s.spin);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawShip(ctx, state, scale);
    }

    // Hit flash.
    if (state.flashes > 0) {
      ctx.fillStyle = `rgba(244, 114, 182, ${state.flashes * 0.25})`;
      ctx.fillRect(0, 0, width, height);
    }

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(ctx, state, best, width);
    if (screen === SCREEN_TITLE) drawTitle(ctx, state, best, width, height);
    if (screen === SCREEN_PAUSED) drawPaused(ctx, width, height);
    if (screen === SCREEN_OVER) drawOver(ctx, state, best, width, height);
    if (screen === SCREEN_WIN) drawWin(ctx, state, best, width, height);
    noGlow(ctx);
  }

  return { draw };
}
