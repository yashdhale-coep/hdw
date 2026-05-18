# HDW Load Balancer — SDN Simulation

> **Browser-based interactive simulation** of the **Hash-IP · Dynamic-Weight · Routing (HDW)** load-balancing pipeline for Software Defined Networks (SDN).

Based on the peer-reviewed research paper:

> **"Enhanced network load balancing technique for efficient performance in software defined network"**  
> Osei Kofi, E. & Ahene, E. — *PLOS ONE 18(4)*, 2023

Included references:
- 📄 `Enhanced_network_load_balancing_technique_for_effi.pdf` — original paper  
- 📘 `Conceptual-1.pdf` — complete theory + code walkthrough guide

---

## 📑 Table of Contents

1. [What is Load Balancing?](#1-what-is-load-balancing)
2. [What is HDW?](#2-what-is-hdw)
3. [The HDW Pipeline — 4 Steps](#3-the-hdw-pipeline--4-steps)
4. [The 4 Key Equations](#4-the-4-key-equations)
5. [Algorithm Comparison](#5-algorithm-comparison)
6. [Features](#6-features)
7. [Project Structure](#7-project-structure)
8. [Running Locally](#8-running-locally)
9. [Metrics Tracked](#9-metrics-tracked)
10. [Module Reference](#10-module-reference)
11. [Citation](#11-citation)

---

## 1. What is Load Balancing?

Imagine a popular pizza restaurant on Friday night — 500 orders come in at once, but there is only one chef. Orders pile up, customers leave angry. The solution: **hire multiple chefs and split the orders intelligently**.

That is load balancing — distributing incoming network requests across multiple servers so no single server is overwhelmed.

| Term | Meaning |
|------|---------|
| **Load Balancer** | The smart manager that decides which server gets each request |
| **Server** | One worker — has a maximum throughput (speed) and a finite queue |
| **Request** | One incoming packet — has a source IP, destination IP, and size |
| **Queue** | The backlog of requests a server still needs to handle |

**Why not use simple Round-Robin?**  
Basic Round-Robin sends request 1 to Server A, request 2 to Server B, and so on — treating every server as equal. A 100 Mbps machine and a 1000 Mbps machine are NOT equals. Weighted scheduling accounts for server speed, queue depth, and packet size simultaneously.

---

## 2. What is HDW?

**HDW** = **H**ash-IP + **D**ynamic-Weight Scheduler + **DSP** (Dynamic Switching Path)

It is a three-component load balancing system that combines:

| Component | Role |
|-----------|------|
| **Hash-IP** | Fingerprint every request for security and O(1) lookup |
| **Dynamic-Weight Scheduler** | Select the best server using live-computed weights (Eq. 1–4) |
| **DSP** | Escape congestion by rerouting via IGRP / EGRP logic |

### What makes HDW better than simpler algorithms?

| Feature | HDW advantage |
|---------|--------------|
| **Security layer** | Hash-IP detects tampered/spoofed packets; plain DWRS has no authentication |
| **Congestion escape** | DSP reroutes away from overloaded servers in real-time |
| **Audit trail** | Every packet gets a hash key stored with 2.5 s TTL for forensic lookup |
| **Adaptive weights** | Weights recalculate continuously as packet sizes and queue depths change |

---

## 3. The HDW Pipeline — 4 Steps

Every incoming request flows through exactly **4 steps**:

```
Request arrives
     |
     v
+------------------------------------------------------------------+
|  Step 1 — Hash-IP                                                |
|  Fingerprint: FNV-1a( RN(i) | srcIP | dstIP | pktSize | w_i )   |
|  -> 8-char hex key (e.g. 3A7F9C12)                              |
|  -> Stored in 1024-slot hash table (TTL 2.5 s)                  |
+------------------------------------------------------------------+
                           |
                           v
+------------------------------------------------------------------+
|  Step 2 — Dynamic-Weight Scheduler (Eq. 1–4)                    |
|  Compute l_i (Eq. 3), w_i (Eq. 4), bw_i (Eq. 2)               |
|  Accrue deficit credits per server (Eq. 1)                       |
|  -> Highest-credit, non-full server wins                         |
+------------------------------------------------------------------+
                           |
                           v
+------------------------------------------------------------------+
|  Step 3 — DSP (Dynamic Switching Path)                           |
|  Is target server load > 85%?                                    |
|    No  -> proceed                                                |
|    Yes -> try IGRP (inner zone, load < 70%)                     |
|           try EGRP (outer zone, load < 90%)                      |
|           SATURATED -> use original target                       |
+------------------------------------------------------------------+
                           |
                           v
+------------------------------------------------------------------+
|  Step 4 — Process                                                |
|  Update server: queue depth, jitter, throughput, meanPktSize    |
|  Schedule hash eviction after 2.5 s                              |
+------------------------------------------------------------------+
```

### DSP Decision Tree

| Step | Condition | Action | Reason |
|------|-----------|--------|--------|
| 1 | Target load <= 85% | Use target as-is | Not congested |
| 2 | Target load > 85%, inner-zone server load < 70% | Reroute via **IGRP** | Keep traffic local first |
| 3 | Inner zone all > 70%, outer-zone server load < 90% | Reroute via **EGRP** | Escalate to overflow zone |
| 4 | All servers > 90% | Use original target | SATURATED — best-effort |

> **IGRP** = inner gateway routing (primary servers, stricter 70% threshold)  
> **EGRP** = exterior gateway routing (overflow servers, relaxed 90% threshold)

### Queue Drain (every 400 ms)

A background timer drains each server's queue proportionally to its throughput capacity:

```
drain_rate = max(1, round(server.maxThroughputMbps / minThroughputMbps))
```

A 1000 Mbps server drains 10x faster than a 100 Mbps server — faithfully simulating real processing speed differences.

---

## 4. The 4 Key Equations

These equations are taken directly from Osei Kofi & Ahene, PLOS ONE 2023.

### Equation 1 — Proportional Scheduling Share

```
proportion_i = w_i / (w_1 + w_2 + ... + w_n)
```

What fraction of all requests should server i receive?  
Example: w_A=1, w_B=2, w_C=3 means A gets 16.7%, B gets 33.3%, C gets 50%.

### Equation 2 — Bandwidth Allocation Share

```
bw_i = (m_i x w_i) / sum_k(m_k x w_k)
```

What share of actual **bandwidth** does server i handle?  
Packet size `m_i` is multiplied in — a server handling small packets can process more for the same bandwidth.

### Equation 3 — Link Capacity Share

```
l_i = maxThroughput_i / sum_k(maxThroughput_k)
```

What fraction of total available bandwidth does server i own?  
Example: A=100 Mbps, B=500 Mbps, C=1000 Mbps (total=1600) gives l_A=0.0625, l_B=0.3125, l_C=0.625.

### Equation 4 — Scheduling Weight

```
w_i = l_i / m_i
```

The final scheduling weight used in Eq. 1 and Eq. 2.  
Dividing by `m_i` is intentional: servers handling **larger** packets should receive **fewer** of them — each packet consumes more of their capacity.

### How the equations chain together

```
Eq. 3  -->  l_i  (raw capacity ratios from Mbps data)
  |
  v
Eq. 4  -->  w_i  (divide by mean packet size)
  |
  v
Eq. 1  -->  proportion_i  (normalise to request share)
  |
  v
Eq. 2  -->  bw_i  (weight x packet size = bandwidth share)
```

---

## 5. Algorithm Comparison

All four modes are selectable in the simulation UI. From the paper (Table 4):

| Algorithm | Full Name | Throughput | Secured | Congestion Control | Availability | Avg Jitter |
|-----------|-----------|:---:|:---:|:---:|:---:|:---:|
| **DWRS** | Dynamic Weighted Random Selection | Yes | No | Yes | Yes | 0.21 |
| **WLB** | Weighted Least Busy | No | Yes | Yes | Yes | 0.35 |
| **DWRR** | Deficit Weighted Round-Robin | Yes | No | No | Yes | 0.19 |
| **HDW** *(proposed)* | Hash-IP + DWRS + DSP | Yes | Yes | Yes | Yes | 0.28 |

### How each mode selects a server

| Mode | Server Selection Logic | DSP | Hash |
|------|----------------------|:---:|:---:|
| `hdw` | Deficit Round-Robin with w_i credits (Eq. 1–4). Highest credit wins; winner's credit decreases by 1.0. | Yes | Yes |
| `dwrr` | Slot array built proportional to maxThroughput/minThroughput. Cycle through slots. | No | Yes |
| `wlb` | Always pick the server with the smallest queue (least-connections). | No | Yes |
| `dwrs` | Pick a completely random server. | No | Yes |

---

## 6. Features

- **4 algorithms** switchable live: HDW, DWRR, WLB, DWRS
- **Adjustable request rate** (1–50 req/s) and **packet size range** (1 KB – 64 MB)
- **Real-time topology canvas** — animated packet flows across an SDN tree (2 servers, 3 core + 4 aggregation switches, 8 hosts)
- **Server configuration modal** — add/remove/edit servers with custom throughput, queue capacity, and mean packet size
- **Event log** — timestamped pipeline trace (Hash-IP -> Scheduler -> DSP -> Process)
- **Live metrics** — requests, hash collisions, average jitter, throughput (GB), DSP reroutes, hash integrity status
- **Traffic distribution bars** — per-server request percentage
- **Zero dependencies** — pure ES Modules, no bundler needed; runs in any modern browser

---

## 7. Project Structure

```
hdw/
├── index.html                     # UI entry point — open this in a browser
├── app.js                         # Main controller — wires all modules together
│
├── core/                          # Pure logic, zero DOM dependency
│   ├── hash-ip.js                 # FNV-1a hash -> 8-char hex fingerprint
│   ├── hash-table.js              # 1024-slot open-addressed table (linear probing, lazy delete)
│   ├── weighted-scheduler.js      # Eq. 1–4, Deficit RR, DWRR / WLB / DWRS modes
│   ├── dynamic-switching-path.js  # IGRP / EGRP congestion rerouting
│   ├── models.js                  # Server + ClientRequest classes
│   └── hdw-load-balancer.js       # Orchestrator — Hash -> Scheduler -> DSP -> Process
│
├── simulation/
│   ├── server-configs.js          # Default server presets (paper-based)
│   └── sim-runner.js              # Tick loop, pause/resume, live config updates
│
├── ui/
│   ├── topology-canvas.js         # Canvas draw loop + packet animations
│   ├── renderer.js                # Server cards, log, stats, distribution bars
│   └── config-modal.js            # Add/remove/edit server configuration modal
│
├── styles/
│   └── main.css                   # All UI styles
│
├── Conceptual-1.pdf               # Complete theory + code walkthrough guide
└── Enhanced_network_load_balancing_technique_for_effi.pdf  # Original paper
```

---

## 8. Running Locally

This is a **static, front-end-only** project. No build step or package install needed.

### Option 1 — Python (no install)

```bash
cd hdw
python3 -m http.server 8080
# open http://localhost:8080
```

### Option 2 — Node.js

```bash
cd hdw
npx serve
# open the URL shown in the terminal
```

Then open **`index.html`** in your browser.

> **Note:** The project uses ES Modules (`type="module"`). You **must** serve it via HTTP — opening `index.html` directly from the filesystem (`file://`) will not work in most browsers due to CORS restrictions on ES Modules.

---

## 9. Metrics Tracked

| Metric | Description |
|--------|-------------|
| **Requests** | Total requests dispatched through the pipeline |
| **Hash Collisions** | Number of key collisions in the 1024-slot hash table |
| **Avg Jitter (s)** | `|responseTime_current - responseTime_previous|` averaged across all requests |
| **Throughput (GB)** | Total data processed (`sum(pktSizeKB) / 1024 / 1024`) |
| **DSP Reroutes** | Number of IGRP + EGRP reroutes triggered by congestion |
| **Hash Security** | Periodic cryptographic integrity check of the hash table (every 15 requests, HDW mode only) |

---

## 10. Module Reference

### `core/models.js` — Server & ClientRequest

**Server** fields used by the equations:

| Field | Role |
|-------|------|
| `maxThroughputMbps` | Peak bandwidth — used in Eq. 3 (l_i) |
| `queueCapacity` | Max concurrent requests before congestion |
| `meanPacketSizeKB` | m_i — updated live as packets arrive; used in Eq. 2 & 4 |
| `queue` | Current queue depth |
| `jitter` | `|RT_current - RT_previous|` — response-time variation |

**ClientRequest** fields:

| Field | Role |
|-------|------|
| `weight` | `pktSizeKB / 1500` (1500 KB = standard MTU reference for Eq. 4) |
| `hashKey` | Filled by `HashIP.computeKey()` in Step 1 |
| `assignedServer` | Filled after DSP routing in Step 3 |

### `core/hash-ip.js` — FNV-1a Hashing

```
HashIP.computeKey(srcIP, dstIP, weight, pktSize, requestNum)
  concatenates: "srcIP|dstIP|weight|pktSize|RN"
  feeds into fnv1a()
  returns 8-char uppercase hex key
```

**Why FNV-1a?** Fast (XOR + multiply), low collision rate, strong avalanche effect.  
**Why 5 inputs?** `RN(i)` prevents replay attacks; `srcIP+dstIP` ties hash to the connection; `pktSize` and `weight` ensure different payloads always differ.

### `core/hash-table.js` — 1024-Slot Table

| Operation | Behaviour |
|-----------|-----------|
| **Insert** | `slot = parseInt(hexKey, 16) % 1024`; linear probing on collision |
| **Search** | Walk forward from starting slot; skip `DELETED` tombstones |
| **Delete** | Lazy deletion — mark as `DELETED` to preserve probe chain |
| **TTL** | Entries evicted after 2.5 s via `setTimeout` |

### `core/weighted-scheduler.js` — Scheduling (Eq. 1–4)

| Method | What it does |
|--------|-------------|
| `computeWeights(servers)` | Returns `{id, li, wi}` per server (Eq. 3 + 4) |
| `computeBandwidthAllocations(servers)` | Returns `{id, wi, li, bw}` per server (Eq. 2) |
| `selectServerHDW(servers)` | Deficit Round-Robin — accrues Eq. 1 credits, highest wins |
| `selectServer(servers, mode)` | Routes to correct algorithm based on mode string |

### `core/dynamic-switching-path.js` — DSP Rerouting

Servers are split into **inner** (first half) and **outer** (second half) zones at startup.  
The `route(target, allServers)` method implements the 4-step decision tree (see section 3 above).  
DSP is only active in `hdw` mode; all other modes skip it entirely.

### `core/hdw-load-balancer.js` — Orchestrator

The `dispatch(minPkt, maxPkt)` method runs the full 4-step HDW pipeline.  
A background `setInterval` (400 ms) drains server queues proportionally to throughput.  
Every 15 requests (HDW mode), a security log entry verifies hash-table integrity.

---

## 11. Citation

If you use or extend this work, please cite the original paper:

```
Osei Kofi, E., & Ahene, E. (2023).
Enhanced network load balancing technique for efficient performance
in software defined network.
PLOS ONE, 18(4).
https://doi.org/10.1371/journal.pone.0283798
```

---

> This is a **front-end only** simulation built for visualization and algorithm comparison — not a production SDN controller.
