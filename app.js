// ═══════════════════════════════════════════════════════════════
// FILE: app.js   ← ENTRY POINT — open index.html to run
//
// Wires together all modules:
//   core/  → HashIP, HashTable, WeightedScheduler, DSP, Models
//   simulation/ → SimRunner, server-configs
//   ui/    → TopologyCanvas, Renderer, ConfigModal
// ═══════════════════════════════════════════════════════════════

import { SimRunner }       from './simulation/sim-runner.js';
import { getDefaultConfigs } from './simulation/server-configs.js';
import { TopologyCanvas }  from './ui/topology-canvas.js';
import { Renderer }        from './ui/renderer.js';
import { ConfigModal }     from './ui/config-modal.js';

// ── DOM references ────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
  // Controls
  rateSlider:    $('rateSlider'),
  rateVal:       $('rateVal'),
  minPktSlider:  $('minPktSlider'),
  minPkt:        $('minPkt'),
  maxPktSlider:  $('maxPktSlider'),
  maxPkt:        $('maxPkt'),
  modeSelect:    $('modeSelect'),
  startBtn:      $('startBtn'),
  resetBtn:      $('resetBtn'),
  configBtn:     $('configBtn'),

  // Status
  statusDot:     $('statusDot'),
  simStatusLabel:$('simStatusLabel'),

  // Panels
  serverList:    $('serverList'),
  logContainer:  $('logContainer'),
  distPanel:     $('distPanel'),

  // Stats
  stats: {
    requests:   $('statRequests'),
    collisions: $('statCollisions'),
    jitter:     $('statJitter'),
    throughput: $('statThroughput'),
    reroutes:   $('statReroutes'),
    security:   $('statSecurity'),
  },

  // Modal
  configModal:   $('configModal'),
  serverConfigRows: $('serverConfigRows'),
  cfgWarning:    $('cfgWarning'),
  closeConfig:   $('closeConfig'),
  cfgApply:      $('cfgApply'),
  cfgReset:      $('cfgReset'),
  addServerBtn:  $('addServerBtn'),

  canvas:        $('topoCanvas'),
};

// ── Initial server configs ─────────────────────────────────────
let serverConfigs = getDefaultConfigs();

// ── Topology canvas ────────────────────────────────────────────
const topoCanvas = new TopologyCanvas(els.canvas);
topoCanvas.resize();
topoCanvas.start();

// ── Simulation runner ──────────────────────────────────────────
const sim = new SimRunner({
  serverConfigs,
  mode:           els.modeSelect.value,
  requestsPerSec: +els.rateSlider.value,
  minPktKB:       +els.minPktSlider.value,
  maxPktKB:       +els.maxPktSlider.value,

  onPacket(serverIndex) {
    // Extract last hash key label from log for canvas particle
    const lastLog   = sim.log[0]?.msg ?? '';
    const keyMatch  = lastLog.match(/key:([A-F0-9]+)/);
    const hashLabel = keyMatch ? keyMatch[1].slice(0, 6) : '';
    topoCanvas.spawnPacket(serverIndex, hashLabel);
  },

  onTick({ balancer }) {
    topoCanvas.update(balancer.servers, balancer.mode);
    Renderer.renderServers(
      els.serverList,
      balancer.servers,
      sim.getBandwidthAllocations()
    );
    Renderer.renderLog(els.logContainer, balancer.log);
    Renderer.renderStats(els.stats, sim.stats);
    Renderer.renderDistribution(els.distPanel, balancer.servers);
  },
});

// ── Config modal ───────────────────────────────────────────────
const modal = new ConfigModal({
  overlayEl:      els.configModal,
  rowsEl:         els.serverConfigRows,
  warningEl:      els.cfgWarning,
  closeBtn:       els.closeConfig,
  applyBtn:       els.cfgApply,
  resetBtn:       els.cfgReset,
  addBtn:         els.addServerBtn,
  initialConfigs: serverConfigs,
  getDefaultConfigs,
  isRunning:      () => sim.running && !sim.paused,

  onApply(newConfigs) {
    serverConfigs = newConfigs;
    sim.opts.serverConfigs = newConfigs;

    // If not running, reset so new config takes effect on next start
    if (!sim.running || sim.paused) {
      sim.reset();
      topoCanvas.update(null, null);
      Renderer.renderStats(els.stats, sim.stats);
      Renderer.renderDistribution(els.distPanel, []);
      els.serverList.innerHTML = '';
      els.logContainer.innerHTML = '';
      els.startBtn.textContent = '▶ Start Simulation';
      els.statusDot.classList.add('inactive');
      els.simStatusLabel.textContent = 'IDLE';
    }
  },
});

// ── Control bindings ──────────────────────────────────────────
els.rateSlider.addEventListener('input', function () {
  els.rateVal.textContent = this.value;
  sim.updateRate(+this.value);
});

els.minPktSlider.addEventListener('input', function () {
  els.minPkt.textContent = this.value;
  sim.updatePacketRange(+this.value, +els.maxPktSlider.value);
});

els.maxPktSlider.addEventListener('input', function () {
  els.maxPkt.textContent = this.value;
  sim.updatePacketRange(+els.minPktSlider.value, +this.value);
});

els.modeSelect.addEventListener('change', function () {
  sim.updateMode(this.value);
});

els.startBtn.addEventListener('click', function () {
  if (sim.running && !sim.paused) {
    // Pause
    sim.pause();
    this.textContent = '▶ Resume';
    els.statusDot.classList.add('inactive');
    els.simStatusLabel.textContent = 'PAUSED';
  } else {
    // Start / resume
    sim.opts.mode           = els.modeSelect.value;
    sim.opts.requestsPerSec = +els.rateSlider.value;
    sim.opts.minPktKB       = +els.minPktSlider.value;
    sim.opts.maxPktKB       = +els.maxPktSlider.value;
    sim.start();
    this.textContent = '⏸ Pause';
    els.statusDot.classList.remove('inactive');
    els.simStatusLabel.textContent = 'RUNNING';
  }
});

els.resetBtn.addEventListener('click', function () {
  sim.reset();
  topoCanvas.update(null, null);
  topoCanvas.packets = [];
  els.startBtn.textContent = '▶ Start Simulation';
  els.statusDot.classList.add('inactive');
  els.simStatusLabel.textContent = 'IDLE';
  els.serverList.innerHTML       = '';
  els.logContainer.innerHTML     = '';
  Renderer.renderStats(els.stats, sim.stats);
  Renderer.renderDistribution(els.distPanel, []);
});

els.configBtn.addEventListener('click', () => modal.open());

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize', () => topoCanvas.resize());
