// ═══════════════════════════════════════════════════════════════
// MODULE: ui/topology-canvas.js
// Canvas-based SDN topology renderer + packet animations
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  accent: '#0077cc', purple: '#7c3aed', green:  '#00a854',
  orange: '#e85d00', yellow: '#c58a00', border: '#d8e0ea',
  text:   '#1a2332', muted:  '#6b7a90', red:    '#dc2626',
};

const PKT_COLORS = ['#0077cc','#7c3aed','#00a854','#e85d00','#c58a00','#dc2626','#0891b2'];

export class TopologyCanvas {
  /**
   * @param {HTMLCanvasElement} canvasEl
   */
  constructor(canvasEl) {
    this.canvas  = canvasEl;
    this.ctx     = canvasEl.getContext('2d');
    this.packets = [];
    this._raf    = null;
    this._servers = null;
    this._mode    = null;
  }

  /** Resize canvas to fill its CSS container */
  resize() {
    this.canvas.width  = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  }

  /** Update which servers / mode to render */
  update(servers, mode) {
    this._servers = servers;
    this._mode    = mode;
  }

  /** Spawn a moving packet from LB → serverIndex */
  spawnPacket(serverIndex, hashLabel = '') {
    if (!this._servers) return;
    const { W, H, gap, lbX, lbY, srvX } = this._layout();
    const n  = this._servers.length;
    const sy = (H / 2) - ((n - 1) * gap / 2) + serverIndex * gap;

    this.packets.push({
      x0: lbX + 44, y0: lbY,
      x1: srvX - 56, y1: sy,
      born: performance.now(),
      life: 550 + Math.random() * 200,
      color: PKT_COLORS[serverIndex % PKT_COLORS.length],
      label: hashLabel,
    });
  }

  /** Start the render loop */
  start() {
    const loop = () => {
      this._draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  /** Stop the render loop */
  stop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  // ── Private ──────────────────────────────────────────────────
  _layout() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const n = this._servers ? this._servers.length : 2;
    return {
      W, H,
      gap:  Math.min((H - 60) / (n + 1), 60),
      lbX:  W * 0.30,
      lbY:  H / 2,
      srvX: W * 0.62,
      hostX: 70,
    };
  }

  _draw() {
    const { W, H, gap, lbX, lbY, srvX, hostX } = this._layout();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    if (!this._servers) {
      ctx.fillStyle = '#f0f3f7';
      ctx.font = '11px IBM Plex Mono';
      ctx.textAlign = 'center';
      ctx.fillText('Configure servers and start simulation to visualise the HDW network topology.', W / 2, H / 2);
      return;
    }

    const servers = this._servers;
    const n       = servers.length;
    const hostY   = H / 2;

    // Host
    this._roundRect(hostX, hostY, 72, 46, 6, '#ffffff', COLORS.accent, 1.5);
    this._label('HOST',        hostX, hostY - 4, COLORS.text,  10, true);
    this._label('h1 · 10.0.0.1', hostX, hostY + 10, COLORS.muted, 8);

    // NLB controller
    this._roundRect(lbX, lbY, 88, 56, 6, '#ffffff', COLORS.purple, 1.5);
    this._label('NLB',              lbX, lbY - 8,  COLORS.text,   11, true);
    this._label('HDW Controller',   lbX, lbY + 6,  COLORS.muted,  8);
    this._label((this._mode || '').toUpperCase(), lbX, lbY + 18, COLORS.purple, 8);

    // Host → LB dashed line
    ctx.beginPath();
    ctx.moveTo(hostX + 36, hostY);
    ctx.lineTo(lbX - 44, lbY);
    ctx.strokeStyle = COLORS.accent + '55';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Servers
    servers.forEach((sv, i) => {
      const sy   = (H / 2) - ((n - 1) * gap / 2) + i * gap;
      const load = sv.queueCapacity > 0 ? sv.queue / sv.queueCapacity : 0;
      const lineColor   = load > 0.85 ? COLORS.red : load > 0.6 ? COLORS.orange : load > 0.3 ? COLORS.yellow : COLORS.green;
      const borderColor = load > 0.85 ? COLORS.red : load > 0.6 ? COLORS.orange : COLORS.accent;

      // LB → server connection line
      ctx.beginPath();
      ctx.moveTo(lbX + 44, lbY);
      ctx.lineTo(srvX - 56, sy);
      ctx.strokeStyle = lineColor + Math.round((0.15 + load * 0.7) * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 0.5 + load * 2.5;
      ctx.stroke();

      // Server box
      this._roundRect(srvX, sy, 110, 52, 6, '#ffffff', borderColor, load > 0.6 ? 1.8 : 1);
      this._label(sv.label,                          srvX, sy - 10, COLORS.text,  10, true);
      this._label(`${sv.maxThroughputMbps} Mbps`,   srvX, sy + 1,  COLORS.accent, 9);
      this._label(`Q:${sv.queue}/${sv.queueCapacity} · ${sv.ip}`, srvX, sy + 13, COLORS.muted, 8);

      // Load mini-bar
      const bw = 90, bh = 3, bx = srvX - 45, by = sy + 20;
      ctx.fillStyle = '#dde4ee';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = lineColor;
      ctx.fillRect(bx, by, bw * load, bh);
    });

    // Packets
    const now = performance.now();
    this.packets = this.packets.filter(p => now - p.born < p.life);
    this.packets.forEach(p => {
      const t = (now - p.born) / p.life;
      const x = p.x0 + (p.x1 - p.x0) * t;
      const y = p.y0 + (p.y1 - p.y0) * t;
      const alpha = Math.sin(t * Math.PI);

      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();

      if (t < 0.45 && p.label) {
        ctx.fillStyle = p.color + Math.round(alpha * 160).toString(16).padStart(2, '0');
        ctx.font = '8px IBM Plex Mono';
        ctx.textAlign = 'left';
        ctx.fillText(p.label, x + 5, y - 3);
      }
    });
  }

  _roundRect(cx, cy, w, h, r, fill, stroke, lw = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  _label(txt, x, y, color, size = 10, bold = false) {
    this.ctx.fillStyle = color;
    this.ctx.font      = `${bold ? 'bold ' : ''}${size}px Space Grotesk, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(txt, x, y);
  }
}
