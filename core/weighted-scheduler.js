// ═══════════════════════════════════════════════════════════════
// MODULE: core/weighted-scheduler.js
// Weighted Scheduler — Equations 1–4
//
// Eq.1: proportion_i = w_i / Σ w_k
// Eq.2: bandwidth_i  = (m_i × w_i) / Σ(m_k × w_k)
// Eq.3: Σ l_i = 1  →  l_i = maxThroughput_i / Σ maxThroughput_k
// Eq.4: w_i = l_i / m_i   (link-capacity / mean-packet-size)
//
// Paper: Osei Kofi & Ahene, PLOS ONE 18(4) 2023
// ═══════════════════════════════════════════════════════════════

export class WeightedScheduler {
  // ── Internal state ──────────────────────────────────────────
  static _deficit   = null;   // Deficit Round-Robin credits
  static _dwrrSlots = null;   // DWRR slot array
  static _dwrrIdx   = 0;
  static _dwrrKey   = null;

  // ── Eq.3 + Eq.4: compute per-server link-capacity and weight ─
  /**
   * @param {Server[]} servers
   * @returns {{ id, li, wi }[]}
   *   li = link-capacity share  (Eq.3)
   *   wi = scheduling weight    (Eq.4)
   */
  static computeWeights(servers) {
    const totalThroughput = servers.reduce((s, sv) => s + sv.maxThroughputMbps, 0);

    return servers.map(sv => {
      const li = sv.maxThroughputMbps / totalThroughput;   // Eq.3
      const wi = li / sv.meanPacketSizeKB;                  // Eq.4
      return { id: sv.id, li, wi };
    });
  }

  // ── Eq.2: bandwidth allocation share per server ──────────────
  /**
   * @param {Server[]} servers
   * @returns {{ id, wi, li, bw }[]}
   *   bw = proportional bandwidth share  (Eq.2)
   */
  static computeBandwidthAllocations(servers) {
    const ws    = this.computeWeights(servers);
    const denom = ws.reduce((s, w) => {
      const sv = servers.find(x => x.id === w.id);
      return s + sv.meanPacketSizeKB * w.wi;
    }, 0);

    return ws.map(w => {
      const sv = servers.find(x => x.id === w.id);
      const bw = denom > 0
        ? (sv.meanPacketSizeKB * w.wi) / denom   // Eq.2
        : 0;
      return { id: sv.id, wi: w.wi, li: w.li, bw };
    });
  }

  // ── HDW: Deficit Round-Robin (Eq.1 proportional credit) ─────
  /**
   * Each server accumulates credit = wi / Σwk per tick.
   * Server with highest credit wins; its credit decreases by 1.0.
   * Queue-full servers are excluded from eligibility.
   *
   * @param {Server[]} servers
   * @returns {Server}
   */
  static selectServerHDW(servers) {
    if (!this._deficit) this._resetDeficit(servers);

    const allocs = this.computeBandwidthAllocations(servers);
    const totalW = allocs.reduce((s, a) => s + a.wi, 0);

    // Accrue credits (Eq.1 proportional)
    servers.forEach(sv => {
      const a             = allocs.find(x => x.id === sv.id);
      this._deficit[sv.id] = (this._deficit[sv.id] || 0) +
        (totalW > 0 ? a.wi / totalW : 1 / servers.length);
    });

    // Pick highest-credit server that still has queue space
    const available = servers.filter(sv => sv.queue < sv.queueCapacity);
    const pool      = available.length ? available : servers;

    const chosen = pool.reduce(
      (best, sv) => this._deficit[sv.id] > this._deficit[best.id] ? sv : best,
      pool[0]
    );

    this._deficit[chosen.id] -= 1.0;
    return chosen;
  }

  // ── DWRR: Deficit Weighted Round-Robin ───────────────────────
  static _dwrr(servers) {
    this._ensureDWRRSlots(servers);

    for (let tries = 0; tries < this._dwrrSlots.length; tries++) {
      const sid = this._dwrrSlots[this._dwrrIdx % this._dwrrSlots.length];
      this._dwrrIdx++;
      const sv = servers.find(s => s.id === sid);
      if (sv && sv.queue < sv.queueCapacity) return sv;
    }
    // fallback: least loaded
    return servers.reduce((a, b) => a.queue < b.queue ? a : b);
  }

  static _ensureDWRRSlots(servers) {
    const key = servers.map(s => `${s.id}:${s.maxThroughputMbps}`).join(',');
    if (this._dwrrKey === key) return;

    const slots = [];
    const min   = Math.min(...servers.map(s => s.maxThroughputMbps));
    servers.forEach(sv => {
      const turns = Math.max(1, Math.round(sv.maxThroughputMbps / min));
      for (let t = 0; t < turns; t++) slots.push(sv.id);
    });

    this._dwrrSlots = slots;
    this._dwrrIdx   = 0;
    this._dwrrKey   = key;
  }

  // ── Public: unified server selector by mode ──────────────────
  /**
   * @param {Server[]} servers
   * @param {'hdw'|'dwrr'|'wlb'|'dwrs'} mode
   * @returns {Server}
   */
  static selectServer(servers, mode) {
    switch (mode) {
      case 'hdw':  return this.selectServerHDW(servers);
      case 'dwrr': return this._dwrr(servers);
      case 'wlb':  return servers.reduce((a, b) => a.queue < b.queue ? a : b);
      case 'dwrs': return servers[Math.floor(Math.random() * servers.length)];
      default:     return servers[0];
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────
  static _resetDeficit(servers) {
    this._deficit = {};
    servers.forEach(sv => { this._deficit[sv.id] = 0; });
  }

  static reset(servers) {
    this._deficit   = null;
    this._dwrrSlots = null;
    this._dwrrIdx   = 0;
    this._dwrrKey   = null;
    if (servers) this._resetDeficit(servers);
  }
}
