// ═══════════════════════════════════════════════════════════════
// MODULE: simulation/sim-runner.js
// Simulation loop — drives dispatch ticks and packet animations
// ═══════════════════════════════════════════════════════════════

import { HDWLoadBalancer }   from '../core/hdw-load-balancer.js';
import { WeightedScheduler } from '../core/weighted-scheduler.js';

export class SimRunner {
  /**
   * @param {object} opts
   * @param {object[]}  opts.serverConfigs
   * @param {string}    opts.mode
   * @param {number}    opts.requestsPerSec
   * @param {number}    opts.minPktKB
   * @param {number}    opts.maxPktKB
   * @param {Function}  opts.onTick         - Called after every dispatch with { req, server, balancer }
   * @param {Function}  opts.onPacket       - Called with serverIndex to spawn canvas particle
   */
  constructor(opts) {
    this.opts      = opts;
    this.balancer  = null;
    this._timer    = null;
    this.running   = false;
    this.paused    = false;
  }

  // ── Start / resume ────────────────────────────────────────────
  start() {
    if (!this.balancer) {
      this.balancer = new HDWLoadBalancer(
        this.opts.serverConfigs,
        this.opts.mode
      );
      this.balancer._log('info',
        `HDW NLB initialised | ${this.opts.serverConfigs.length} servers | Mode: ${this.opts.mode.toUpperCase()} | Hash Table: 1024 slots`
      );
      this.balancer._log('info',
        `Servers: ${this.opts.serverConfigs.map(c => `${c.label}(${c.maxThroughputMbps}Mbps·Q${c.queueCapacity})`).join(', ')}`
      );
    } else {
      // Mode change mid-run
      this.balancer.mode = this.opts.mode;
    }

    this.running = true;
    this.paused  = false;
    this._restartTimer();
  }

  // ── Pause ─────────────────────────────────────────────────────
  pause() {
    this._clearTimer();
    this.paused = true;
  }

  // ── Reset ─────────────────────────────────────────────────────
  reset() {
    this._clearTimer();
    if (this.balancer) {
      this.balancer.destroy();
      this.balancer = null;
    }
    this.running = false;
    this.paused  = false;
  }

  // ── Update settings live ──────────────────────────────────────
  updateRate(requestsPerSec) {
    this.opts.requestsPerSec = requestsPerSec;
    if (this.running && !this.paused) this._restartTimer();
  }

  updateMode(mode) {
    this.opts.mode = mode;
    if (this.balancer) this.balancer.mode = mode;
  }

  updatePacketRange(minPktKB, maxPktKB) {
    this.opts.minPktKB = minPktKB;
    this.opts.maxPktKB = maxPktKB;
  }

  // ── Internal timer ────────────────────────────────────────────
  _restartTimer() {
    this._clearTimer();
    const interval = Math.max(50, 1000 / this.opts.requestsPerSec);
    this._timer = setInterval(() => this._tick(), interval);
  }

  _clearTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _tick() {
    const { minPktKB, maxPktKB } = this.opts;
    const result = this.balancer.dispatch(
      minPktKB,
      Math.max(maxPktKB, minPktKB + 1)
    );

    this.opts.onPacket?.(result.server.id);
    this.opts.onTick?.({ ...result, balancer: this.balancer });
  }

  // ── Convenience getters ───────────────────────────────────────
  get servers()  { return this.balancer?.servers ?? []; }
  get log()      { return this.balancer?.log ?? []; }
  get stats() {
    const b = this.balancer;
    if (!b) return { requests: 0, collisions: 0, jitter: '0.0000', throughput: '0.0000', reroutes: 0, secured: false };
    return {
      requests:   b.reqCounter,
      collisions: b.hashTable.collisions,
      jitter:     b.avgJitter,
      throughput: (b.totalThroughputMB / 1024).toFixed(4),
      reroutes:   b.dsp.reroutes,
      secured:    b.mode === 'hdw',
    };
  }

  getBandwidthAllocations() {
    return this.balancer
      ? WeightedScheduler.computeBandwidthAllocations(this.balancer.servers)
      : [];
  }
}
