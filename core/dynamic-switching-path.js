// ═══════════════════════════════════════════════════════════════
// MODULE: core/dynamic-switching-path.js
// DSP — Dynamic Switching of Routing Path
// Hybrid IGRP (inner zone) + EGRP (outer zone) rerouting
// Paper: Osei Kofi & Ahene, PLOS ONE 18(4) 2023
// ═══════════════════════════════════════════════════════════════

export class DynamicSwitchingPath {
  /**
   * @param {Server[]} servers - All servers in the pool
   */
  constructor(servers) {
    this.reroutes = 0;
    this.zones    = this._buildZones(servers);
  }

  // ── Zone construction ────────────────────────────────────────
  /**
   * Split servers into inner (IGRP) and outer (EGRP) zones.
   * Inner = first half, Outer = second half.
   * @param {Server[]} servers
   * @returns {{ inner: Server[], outer: Server[] }}
   */
  _buildZones(servers) {
    const half = Math.ceil(servers.length / 2);
    return {
      inner: servers.slice(0, half),
      outer: servers.slice(half),
    };
  }

  /** Re-partition after server pool changes */
  updateZones(servers) {
    this.zones = this._buildZones(servers);
  }

  // ── Routing logic ────────────────────────────────────────────
  /**
   * Check if target server is congested; if so, attempt reroute.
   *
   * Decision tree:
   *  1. loadRatio ≤ 0.85  → use target as-is
   *  2. loadRatio > 0.85  → try inner zone (IGRP) if load < 0.70
   *  3. Inner also busy   → try outer zone (EGRP) if load < 0.90
   *  4. All saturated     → return target with reason 'SATURATED'
   *
   * @param {Server}   target     - Originally selected server
   * @param {Server[]} allServers - Full server pool (unused, kept for API symmetry)
   * @returns {{ server: Server, rerouted: boolean, reason: string|null }}
   */
  route(target, allServers) {
    const loadRatio = target.queue / target.queueCapacity;

    // ── Not congested: proceed normally ──
    if (loadRatio <= 0.85) {
      return { server: target, rerouted: false, reason: null };
    }

    // ── IGRP: try least-loaded inner-zone server ──
    const innerAlt = this.zones.inner
      .filter(s => s.id !== target.id)
      .sort((a, b) =>
        (a.queue / a.queueCapacity) - (b.queue / b.queueCapacity)
      )[0];

    if (innerAlt && (innerAlt.queue / innerAlt.queueCapacity) < 0.70) {
      this.reroutes++;
      return { server: innerAlt, rerouted: true, reason: 'IGRP' };
    }

    // ── EGRP: try least-loaded outer-zone server ──
    const outerAlt = this.zones.outer
      .slice()
      .sort((a, b) =>
        (a.queue / a.queueCapacity) - (b.queue / b.queueCapacity)
      )[0];

    if (outerAlt && (outerAlt.queue / outerAlt.queueCapacity) < 0.90) {
      this.reroutes++;
      return { server: outerAlt, rerouted: true, reason: 'EGRP' };
    }

    // ── All paths saturated ──
    return { server: target, rerouted: false, reason: 'SATURATED' };
  }

  // ── Lifecycle ────────────────────────────────────────────────
  reset() {
    this.reroutes = 0;
  }
}
