// ═══════════════════════════════════════════════════════════════
// MODULE: core/models.js
// Server — per-server state and processing logic
// ClientRequest — represents a single incoming network request
// Paper: Osei Kofi & Ahene, PLOS ONE 18(4) 2023
// ═══════════════════════════════════════════════════════════════

// ── SERVER ───────────────────────────────────────────────────────
export class Server {
  /**
   * @param {object} cfg
   * @param {string} cfg.label
   * @param {string} cfg.ip
   * @param {number} cfg.maxThroughputMbps  - Peak bandwidth (Mbps)
   * @param {number} cfg.queueCapacity      - Max concurrent requests
   * @param {number} cfg.meanPacketSizeKB   - Initial m_i value (Eq.2)
   * @param {number} cfg.userWeight         - User override for w_i (Eq.4)
   * @param {number} index                  - Zero-based server index → used as id
   */
  constructor(cfg, index) {
    // Identity
    this.id    = index;
    this.label = cfg.label;
    this.ip    = cfg.ip || `10.0.0.${index + 1}`;

    // ── Paper parameters ──
    this.maxThroughputMbps = cfg.maxThroughputMbps; // peak bandwidth
    this.queueCapacity     = cfg.queueCapacity;      // max queue depth
    this.meanPacketSizeKB  = cfg.meanPacketSizeKB;   // m_i (Eq.2)
    this.userWeight        = cfg.userWeight;          // w_i override (Eq.4)

    // ── Runtime state ──
    this.queue             = 0;
    this.processed         = 0;
    this.throughputMB      = 0;      // cumulative MB processed
    this.throughputMbps    = 0;      // current effective throughput
    this.jitter            = 0;      // |RT_i − RT_{i-1}|
    this.lastResponseTime  = 0;
    this.prevResponseTime  = 0;

    // ── Incremental mean packet size tracking ──
    this._pktCount    = 0;
    this._pktSizeAccum = 0;
  }

  // ── Eq.2: incremental mean update for m_i ──────────────────
  /**
   * Welford-style running mean:
   *   m_i(n) = accumSum / n
   * Updates this.meanPacketSizeKB in place.
   */
  updateMeanPacketSize(pktSizeKB) {
    this._pktCount++;
    this._pktSizeAccum += pktSizeKB;
    this.meanPacketSizeKB = this._pktSizeAccum / this._pktCount;
  }

  // ── Process a single request ────────────────────────────────
  /**
   * Simulates packet transmission and updates all runtime metrics.
   *
   * Response time model:
   *   baseRT          = (pktSize × 8 bits) / (maxThroughput × 1000)
   *   congestionPenalty = (queue/capacity) × baseRT × 2
   *   responseTime    = baseRT + congestionPenalty + noise
   *
   * Jitter:
   *   jitter = |RT_i − RT_{i-1}|
   *
   * Effective throughput:
   *   throughputMbps = (pktSize × 8) / (responseTime × 1000)
   *
   * @param {ClientRequest} req
   */
  process(req) {
    this.updateMeanPacketSize(req.packetSizeKB);
    this.processed++;
    this.throughputMB += req.packetSizeKB / 1024;

    const baseRT = (req.packetSizeKB * 8) / (this.maxThroughputMbps * 1000);
    const congestionPenalty = (this.queue / this.queueCapacity) * baseRT * 2;
    const responseTime = baseRT + congestionPenalty + Math.random() * 0.001;

    this.prevResponseTime = this.lastResponseTime;
    this.lastResponseTime = responseTime;

    if (this.prevResponseTime > 0) {
      this.jitter = Math.abs(responseTime - this.prevResponseTime);
    }

    this.throughputMbps = (req.packetSizeKB * 8) / (responseTime * 1000);
  }

  /** Reset all runtime state (keeps paper parameters intact) */
  reset(initialMeanPacketSizeKB) {
    this.queue             = 0;
    this.processed         = 0;
    this.throughputMB      = 0;
    this.throughputMbps    = 0;
    this.jitter            = 0;
    this.lastResponseTime  = 0;
    this.prevResponseTime  = 0;
    this._pktCount         = 0;
    this._pktSizeAccum     = 0;
    this.meanPacketSizeKB  = initialMeanPacketSizeKB ?? this.meanPacketSizeKB;
  }
}

// ── CLIENT REQUEST ────────────────────────────────────────────────
export class ClientRequest {
  /**
   * @param {number} id          - Monotonic request counter RN(i)
   * @param {string} srcIP
   * @param {string} dstIP
   * @param {number} pktSizeKB  - Packet size in KB
   */
  constructor(id, srcIP, dstIP, pktSizeKB) {
    this.id           = id;
    this.srcIP        = srcIP;
    this.dstIP        = dstIP;
    this.packetSizeKB = pktSizeKB;

    // w_i = pktSize / 1500 KB (MTU reference, Eq.4)
    this.weight = pktSizeKB / 1500;

    this.hashKey       = null;    // filled by HDWLoadBalancer.dispatch()
    this.assignedServer = null;  // filled after routing
  }

  /** Generate a random valid unicast source IP */
  static randomIP() {
    return [
      Math.floor(Math.random() * 223) + 1,
      Math.floor(Math.random() * 254) + 1,
      Math.floor(Math.random() * 254),
      Math.floor(Math.random() * 254) + 1,
    ].join('.');
  }
}
