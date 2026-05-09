// ═══════════════════════════════════════════════════════════════
// MODULE: core/hash-table.js
// Hash Table — Algorithm 1: insert / search / delete
// Linear probing open-addressing collision resolution
// Paper: Osei Kofi & Ahene, PLOS ONE 18(4) 2023
// ═══════════════════════════════════════════════════════════════

export class HashTable {
  /**
   * @param {number} size - Number of slots (default 1024, must be power of 2)
   */
  constructor(size = 1024) {
    this.size       = size;
    this.table      = new Array(size).fill(null);
    this.collisions = 0;
  }

  /** Map hex key → slot index via modulo */
  _slot(hexKey) {
    return parseInt(hexKey, 16) % this.size;
  }

  /**
   * Insert a record — linear probing on collision
   * @param {string} hexKey  - 8-char hex key from HashIP
   * @param {object} payload - Arbitrary metadata to store
   * @returns {number|null}  - Slot index, or null if table is full
   */
  insert(hexKey, payload) {
    let slot   = this._slot(hexKey);
    let probes = 0;

    while (
      this.table[slot] !== null &&
      this.table[slot] !== 'DELETED' &&
      probes < this.size
    ) {
      this.collisions++;
      slot = (slot + 1) % this.size;
      probes++;
    }

    if (probes < this.size) {
      this.table[slot] = { key: hexKey, ...payload };
      return slot;
    }
    return null; // table full
  }

  /**
   * Search for a record by key
   * @param {string} hexKey
   * @returns {object|null}
   */
  search(hexKey) {
    let slot   = this._slot(hexKey);
    let probes = 0;

    while (this.table[slot] !== null && probes < this.size) {
      if (
        this.table[slot] !== 'DELETED' &&
        this.table[slot].key === hexKey
      ) {
        return this.table[slot];
      }
      slot = (slot + 1) % this.size;
      probes++;
    }
    return null;
  }

  /**
   * Lazy delete — marks slot as DELETED so probing chains remain intact
   * @param {string} hexKey
   * @returns {boolean}
   */
  remove(hexKey) {
    let slot   = this._slot(hexKey);
    let probes = 0;

    while (this.table[slot] !== null && probes < this.size) {
      if (
        this.table[slot] !== 'DELETED' &&
        this.table[slot].key === hexKey
      ) {
        this.table[slot] = 'DELETED';
        return true;
      }
      slot = (slot + 1) % this.size;
      probes++;
    }
    return false;
  }

  /** Full reset — clears all slots and collision counter */
  reset() {
    this.table      = new Array(this.size).fill(null);
    this.collisions = 0;
  }
}
