// ═══════════════════════════════════════════════════════════════
// MODULE: ui/renderer.js
// DOM rendering helpers — server cards, log, stats, distribution
// ═══════════════════════════════════════════════════════════════

const PKT_COLORS = ['#0077cc','#7c3aed','#00a854','#e85d00','#c58a00','#dc2626','#0891b2'];

const LOG_TAG_MAP = {
  hash:     'HASH-IP',
  weight:   'WS-EQ1-4',
  route:    'DSP',
  security: 'SEC',
  info:     'INFO',
};

export const Renderer = {

  // ── Server metric cards ───────────────────────────────────────
  renderServers(containerEl, servers, allocations) {
    containerEl.innerHTML = servers.map(sv => {
      const load      = sv.queueCapacity > 0 ? sv.queue / sv.queueCapacity : 0;
      const a         = allocations.find(x => x.id === sv.id) ?? { bw: 0, wi: 0, li: 0 };
      const loadClass = load > 0.85 ? 'crit' : load > 0.6 ? 'high' : '';
      const rowClass  = load > 0.85 ? 'congested' : load > 0.4 ? 'active' : '';
      const tputPct   = Math.min(sv.throughputMbps / sv.maxThroughputMbps * 100, 100);

      return `
      <div class="server-row ${rowClass}">
        <div class="server-header">
          <span class="server-name">${sv.label}</span>
          <span class="server-cap-badge">${sv.maxThroughputMbps} Mbps · Q${sv.queueCapacity}</span>
        </div>

        <div class="bar-row">
          <div class="bar-label">
            <span>Effective Throughput</span>
            <span class="bval">${sv.throughputMbps.toFixed(2)} / ${sv.maxThroughputMbps} Mbps</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill throughput" style="width:${tputPct.toFixed(1)}%"></div>
          </div>
        </div>

        <div class="bar-row">
          <div class="bar-label">
            <span>Queue Load</span>
            <span class="bval">${sv.queue} / ${sv.queueCapacity} reqs (${(load * 100).toFixed(0)}%)</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill load ${loadClass}" style="width:${(load * 100).toFixed(1)}%"></div>
          </div>
        </div>

        <div class="bar-row">
          <div class="bar-label">
            <span>Jitter |RT_i − RT_{i−1}|</span>
            <span class="bval">${sv.jitter.toFixed(5)}s</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill jitter-bar" style="width:${Math.min(sv.jitter * 2000, 100).toFixed(1)}%"></div>
          </div>
        </div>

        <div class="server-stats">
          <div class="stat-box">
            <div class="stat-val accent">${sv.processed}</div>
            <div class="stat-lbl">Processed</div>
          </div>
          <div class="stat-box">
            <div class="stat-val">${sv.throughputMB.toFixed(3)}</div>
            <div class="stat-lbl">MB Total</div>
          </div>
          <div class="stat-box">
            <div class="stat-val">${sv.meanPacketSizeKB.toFixed(0)}</div>
            <div class="stat-lbl">Mean Pkt KB</div>
          </div>
          <div class="stat-box">
            <div class="stat-val green">${(a.bw * 100).toFixed(1)}%</div>
            <div class="stat-lbl">BW Share</div>
          </div>
        </div>

        <div style="margin-top:7px;font-size:9px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap">
          <span>w<sub>i</sub> = ${a.wi.toFixed(6)}</span>
          <span>l<sub>i</sub> = ${a.li.toFixed(4)}</span>
          <span>RT = ${sv.lastResponseTime.toFixed(5)}s</span>
          <span>IP: ${sv.ip}</span>
        </div>
      </div>`;
    }).join('');
  },

  // ── Event log ─────────────────────────────────────────────────
  renderLog(containerEl, logEntries) {
    containerEl.innerHTML = logEntries.slice(0, 50).map(e =>
      `<div class="log-entry ${e.type}">
        <span class="log-time">${e.ts}</span>
        <span class="log-tag">[${LOG_TAG_MAP[e.type] ?? e.type}]</span>
        <span>${e.msg}</span>
      </div>`
    ).join('');
  },

  // ── Global network stats ──────────────────────────────────────
  renderStats(els, stats) {
    els.requests.textContent   = stats.requests;
    els.collisions.textContent = stats.collisions;
    els.jitter.textContent     = stats.jitter;
    els.throughput.textContent = stats.throughput;
    els.reroutes.textContent   = stats.reroutes;
    els.security.textContent   = stats.secured ? '✓ Hash' : '—';
  },

  // ── Traffic distribution bars ─────────────────────────────────
  renderDistribution(containerEl, servers) {
    const total    = servers.reduce((s, sv) => s + sv.processed, 0);
    const totalCap = servers.reduce((s, sv) => s + sv.maxThroughputMbps, 0);

    if (total === 0) {
      containerEl.innerHTML = '<div style="color:var(--muted);font-size:10px">No requests yet</div>';
      return;
    }

    containerEl.innerHTML = servers.map((sv, i) => {
      const pct    = (sv.processed / total * 100);
      const expPct = (sv.maxThroughputMbps / totalCap * 100);
      const color  = PKT_COLORS[i % PKT_COLORS.length];

      return `
      <div class="dist-row">
        <div class="dist-header">
          <span style="color:${color};font-weight:700">${sv.label} (${sv.maxThroughputMbps}Mbps)</span>
          <span style="color:var(--muted)">
            ${sv.processed} · <span style="color:${color}">${pct.toFixed(1)}%</span>
            <span style="color:var(--dim)">(exp ${expPct.toFixed(0)}%)</span>
          </span>
        </div>
        <div style="height:5px;background:var(--dim);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:3px;transition:width .5s"></div>
        </div>
      </div>`;
    }).join('');
  },
};
