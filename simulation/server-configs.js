// ═══════════════════════════════════════════════════════════════
// MODULE: simulation/server-configs.js
// Default server configurations
// Based on paper's performance data (Osei Kofi & Ahene, 2023)
// Paper tested bandwidths ~9.56–10.7 Mbits/sec with controller
// Scaled up to realistic server capacities for simulation
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_SERVER_CONFIGS = [
  {
    label:             'Server A',
    maxThroughputMbps: 100,
    queueCapacity:     50,
    meanPacketSizeKB:  750,
    userWeight:        1.0,
    ip:                '10.0.0.1',
  },
  {
    label:             'Server B',
    maxThroughputMbps: 500,
    queueCapacity:     150,
    meanPacketSizeKB:  750,
    userWeight:        2.0,
    ip:                '10.0.0.2',
  },
  {
    label:             'Server C',
    maxThroughputMbps: 1000,
    queueCapacity:     300,
    meanPacketSizeKB:  750,
    userWeight:        3.0,
    ip:                '10.0.0.3',
  },
];

/**
 * Deep-clone default configs so mutations don't affect the master list.
 * @returns {object[]}
 */
export function getDefaultConfigs() {
  return DEFAULT_SERVER_CONFIGS.map(cfg => ({ ...cfg }));
}
