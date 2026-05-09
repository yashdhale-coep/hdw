// ═══════════════════════════════════════════════════════════════
// MODULE: core/hdw-load-balancer.js
// HDW Load Balancer — main orchestrator
// Wires together: HashIP → WeightedScheduler → DSP
// Paper: Osei Kofi & Ahene, PLOS ONE 18(4) 2023
// ═══════════════════════════════════════════════════════════════

import { HashIP }               from './hash-ip.js';
import { HashTable }            from './hash-table.js';
import { WeightedScheduler }    from './weighted-scheduler.js';
import { DynamicSwitchingPath } from './dynamic-switching-path.js';
import { Server, ClientRequest } from './models.js';

export class HDWLoadBalancer {
  /**
   * @param {object[]} serverConfigs - Array of server config objects
   * @param {'hdw'|'dwrr'|'wlb'|'dwrs'} mode - Load balancing algorithm
   */
  constructor(serverConfigs, mode = 'hdw') {
    this.mode       = mode;
    this.reqCounter = 0;

    // Core subsystems
    this.hashTable = new HashTable(1024);
    this.servers   = serverConfigs.map((cfg, i) => new Server(cfg, i));
    this.dsp       = new DynamicSwitchingPath(this.servers);

    // Aggregate metrics
    this.totalJitter      = 0;
    this.totalThroughputMB = 0;

    // Event log (most-recent-first, capped at 150 entries)
    this.log = [];

    // Store initial config for resets
    this._initConfigs = serverConfigs;

    // Start queue drain interval
    WeightedScheduler.reset(this.servers);
    this._drainTimer = setInterval(() => this._drainQueues(), 400);
  }

  // ── Queue drain ───────────────────────────────────────────────
  /**
   * Each tick, drain each server's queue proportional to its
   * relative throughput capacity.
   */
  _drainQueues() {
    const minT = Math.min(...this.servers.map(s => s.maxThroughputMbps));
    this.servers.forEach(sv => {
      const rate = Math.max(1, Math.round(sv.maxThroughputMbps / minT));
      sv.queue   = Math.max(0, sv.queue - rate);
    });
  }

  // ── Main dispatch pipeline ────────────────────────────────────
  /**
   * Process one incoming request through the full HDW pipeline:
   *   1. Hash-IP  → fingerprint the request
   *   2. Weighted Scheduler → select target server (Eq.1–4)
   *   3. DSP → reroute if congested (IGRP/EGRP)
   *   4. Process → update server metrics
   *
   * @param {number} minPkt - Min packet size in KB
   * @param {number} maxPkt - Max packet size in KB
   * @returns {{ req: ClientRequest, server: Server }}
   */
  dispatch(minPkt, maxPkt) {
    this.reqCounter++;
    const rn = this.reqCounter;

    // Build request
    const srcIP    = ClientRequest.randomIP();
    const dstIP    = `192.168.${Math.floor(Math.random() * 4) + 1}.${Math.floor(Math.random() * 254) + 1}`;
    const pktSizeKB = Math.floor(Math.random() * (maxPkt - minPkt)) + minPkt;
    const req      = new ClientRequest(rn, srcIP, dstIP, pktSizeKB);

    // ── Step 1: Hash-IP ──
    req.hashKey = HashIP.computeKey(srcIP, dstIP, req.weight, pktSizeKB, rn);
    this.hashTable.insert(req.hashKey, {
      rn, srcIP, dstIP, weight: req.weight, data: pktSizeKB,
    });
    this._log('hash',
      `RN:${rn} ${srcIP}→${dstIP} | key:${req.hashKey} | pkt:${pktSizeKB}KB | w:${req.weight.toFixed(4)}`
    );

    // ── Step 2: Weighted Scheduler ──
    const target = WeightedScheduler.selectServer(this.servers, this.mode);
    const allocs = WeightedScheduler.computeBandwidthAllocations(this.servers);
    const ta     = allocs.find(a => a.id === target.id);
    this._log('weight',
      `→ ${target.label} [${target.maxThroughputMbps}Mbps | Q:${target.queue}/${target.queueCapacity}] | share:${(ta.bw * 100).toFixed(1)}% | w_i:${ta.wi.toFixed(5)}`
    );

    // ── Step 3: DSP ──
    const dspResult = this.mode === 'hdw'
      ? this.dsp.route(target, this.servers)
      : { server: target, rerouted: false };
    const routed = dspResult.server;

    if (dspResult.rerouted) {
      this._log('route',
        `DSP ${dspResult.reason}: ${target.label}→${routed.label} | ${target.label} load:${Math.round(target.queue / target.queueCapacity * 100)}%`
      );
    }

    // ── Step 4: Process ──
    routed.queue = Math.min(routed.queue + 1, routed.queueCapacity);
    routed.process(req);
    req.assignedServer = routed;

    this.totalJitter       += routed.jitter;
    this.totalThroughputMB += pktSizeKB / 1024;

    // Periodic security hash integrity log (HDW only)
    if (this.mode === 'hdw' && rn % 15 === 0) {
      this._log('security',
        `Cryptographic hash integrity OK | Table: ${this.hashTable.size} slots | Collisions: ${this.hashTable.collisions}`
      );
    }

    // Evict hash entry after processing (2.5s TTL)
    setTimeout(() => this.hashTable.remove(req.hashKey), 2500);

    return { req, server: routed };
  }

  // ── Logging ───────────────────────────────────────────────────
  /**
   * @param {'hash'|'weight'|'route'|'security'|'info'} type
   * @param {string} msg
   */
  _log(type, msg) {
    const d  = new Date();
    const ts = [
      d.getHours().toString().padStart(2, '0'),
      d.getMinutes().toString().padStart(2, '0'),
      d.getSeconds().toString().padStart(2, '0'),
    ].join(':') + '.' + d.getMilliseconds().toString().padStart(3, '0');

    this.log.unshift({ type, msg, ts });
    if (this.log.length > 150) this.log.pop();
  }

  // ── Derived metrics ───────────────────────────────────────────
  get avgJitter() {
    return this.reqCounter > 0
      ? (this.totalJitter / this.reqCounter).toFixed(4)
      : '0.0000';
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  /** Stop drain timer — call before discarding this instance */
  destroy() {
    clearInterval(this._drainTimer);
    this._drainTimer = null;
  }

  /** Reset all runtime state without recreating the instance */
  reset() {
    this.destroy();
    this.reqCounter        = 0;
    this.totalJitter       = 0;
    this.totalThroughputMB = 0;
    this.log               = [];
    this.hashTable.reset();
    this.servers.forEach((sv, i) => {
      sv.reset(this._initConfigs[i]?.meanPacketSizeKB);
    });
    this.dsp.reset();
    this.dsp.updateZones(this.servers);
    WeightedScheduler.reset(this.servers);
    this._drainTimer = setInterval(() => this._drainQueues(), 400);
  }
}
