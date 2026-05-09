// ═══════════════════════════════════════════════════════════════
// MODULE: ui/config-modal.js
// Server Configuration Modal — read/write server config objects
// ═══════════════════════════════════════════════════════════════

export class ConfigModal {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.overlayEl    - .modal-overlay element
   * @param {HTMLElement} opts.rowsEl       - #serverConfigRows element
   * @param {HTMLElement} opts.warningEl    - #cfgWarning element
   * @param {HTMLButtonElement} opts.closeBtn
   * @param {HTMLButtonElement} opts.applyBtn
   * @param {HTMLButtonElement} opts.resetBtn
   * @param {HTMLButtonElement} opts.addBtn
   * @param {object[]}   opts.initialConfigs
   * @param {Function}   opts.getDefaultConfigs  - () => defaultConfig[]
   * @param {Function}   opts.isRunning           - () => boolean
   * @param {Function}   opts.onApply             - (configs: object[]) => void
   */
  constructor(opts) {
    this.opts    = opts;
    this._configs = opts.initialConfigs.map(c => ({ ...c }));

    this._bindEvents();
  }

  open() {
    this._buildRows();
    this.opts.overlayEl.classList.add('open');
    this.opts.warningEl.style.display = this.opts.isRunning() ? 'block' : 'none';
  }

  close() {
    this.opts.overlayEl.classList.remove('open');
  }

  // ── Build modal rows from current config ──────────────────────
  _buildRows() {
    const configs = this._configs;
    this.opts.rowsEl.innerHTML = '';

    configs.forEach((cfg, i) => {
      this.opts.rowsEl.innerHTML += `
      <div class="server-config-row" id="cfgrow_${i}">
        <div class="cfg-header">
          <span class="cfg-server-num">SERVER ${i + 1}</span>
          <button
            data-remove="${i}"
            style="margin-left:auto;background:none;border:1px solid var(--border);color:var(--muted);
                   border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;
                   font-family:'IBM Plex Mono',monospace">
            ✕ Remove
          </button>
        </div>
        <div class="cfg-grid">
          <div class="cfg-field">
            <label>Label</label>
            <input type="text" id="cfg_label_${i}" value="${cfg.label}" maxlength="20">
          </div>
          <div class="cfg-field">
            <label>Max Throughput (Mbps)</label>
            <input type="number" id="cfg_tput_${i}" value="${cfg.maxThroughputMbps}" min="1" step="1">
            <div class="cfg-hint">Paper avg: <span>9.56–10.7 Mbps</span></div>
          </div>
          <div class="cfg-field">
            <label>Queue Capacity (reqs)</label>
            <input type="number" id="cfg_qcap_${i}" value="${cfg.queueCapacity}" min="1" step="1">
            <div class="cfg-hint">Max concurrent requests</div>
          </div>
          <div class="cfg-field">
            <label>Mean Pkt Size m<sub>i</sub> (KB)</label>
            <input type="number" id="cfg_mpkt_${i}" value="${cfg.meanPacketSizeKB}" min="1" step="1">
            <div class="cfg-hint">Initial m_i for Eq.2</div>
          </div>
          <div class="cfg-field">
            <label>IP Address</label>
            <input type="text" id="cfg_ip_${i}" value="${cfg.ip}" maxlength="15">
          </div>
        </div>
      </div>`;
    });

    // Bind remove buttons (event delegation via data attribute)
    this.opts.rowsEl.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.remove);
        if (this._configs.length > 1) {
          this._readCurrentValues();
          this._configs.splice(idx, 1);
          this._buildRows();
        }
      });
    });
  }

  // ── Read current form values into _configs ────────────────────
  _readCurrentValues() {
    this._configs = this._configs.map((_, i) => ({
      label:             (document.getElementById(`cfg_label_${i}`)?.value.trim() || `Server ${i + 1}`),
      maxThroughputMbps: Math.max(1, parseInt(document.getElementById(`cfg_tput_${i}`)?.value)  || 1000),
      queueCapacity:     Math.max(1, parseInt(document.getElementById(`cfg_qcap_${i}`)?.value)  || 100),
      meanPacketSizeKB:  Math.max(1, parseFloat(document.getElementById(`cfg_mpkt_${i}`)?.value) || 750),
      userWeight:        1.0,
      ip:                (document.getElementById(`cfg_ip_${i}`)?.value.trim() || `10.0.0.${i + 1}`),
    }));
  }

  // ── Event bindings ────────────────────────────────────────────
  _bindEvents() {
    const { overlayEl, closeBtn, applyBtn, resetBtn, addBtn } = this.opts;

    closeBtn.addEventListener('click', () => this.close());
    overlayEl.addEventListener('click', e => {
      if (e.target === overlayEl) this.close();
    });

    applyBtn.addEventListener('click', () => {
      this._readCurrentValues();
      this.opts.onApply([...this._configs]);
      this.close();
    });

    resetBtn.addEventListener('click', () => {
      this._configs = this.opts.getDefaultConfigs();
      this._buildRows();
    });

    addBtn.addEventListener('click', () => {
      this._readCurrentValues();
      const n = this._configs.length;
      this._configs.push({
        label:             `Server ${String.fromCharCode(65 + n % 26)}`,
        maxThroughputMbps: 500,
        queueCapacity:     150,
        meanPacketSizeKB:  750,
        userWeight:        1.0,
        ip:                `10.0.0.${n + 1}`,
      });
      this._buildRows();
    });
  }
}
