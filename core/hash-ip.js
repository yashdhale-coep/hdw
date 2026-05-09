// ═══════════════════════════════════════════════════════════════
// MODULE: core/hash-ip.js
// Cryptographic Hash-IP — Algorithm 1
// h ← Hash{RN(i), Key(srcIP+dstIP), Data(pktSize), Weight}
// Paper: Osei Kofi & Ahene, PLOS ONE 18(4) 2023
// ═══════════════════════════════════════════════════════════════

export class HashIP {
  /**
   * FNV-1a 32-bit hash — fast, low-collision, non-cryptographic
   * Used as the base hash function for the HDW pipeline
   */
  static fnv1a(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  /**
   * Compute hash key for a request
   * Eq: h ← Hash{ RN(i), Key(srcIP|dstIP), Data(pktSize), Weight(w_i) }
   *
   * @param {string} srcIP       - Source IP address
   * @param {string} dstIP       - Destination IP address
   * @param {number} weight      - Packet weight w_i = pktSize / 1500
   * @param {number} pktSize     - Packet size in KB
   * @param {number} requestNum  - Monotonic request counter RN(i)
   * @returns {string}           - 8-char uppercase hex key
   */
  static computeKey(srcIP, dstIP, weight, pktSize, requestNum) {
    const raw = `${srcIP}|${dstIP}|${weight.toFixed(5)}|${pktSize}|${requestNum}`;
    const h   = this.fnv1a(raw);
    return h.toString(16).toUpperCase().padStart(8, '0');
  }
}
