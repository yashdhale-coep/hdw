# HDW Load Balancer — SDN Simulation

Interactive simulation of the **Hash‑IP · Dynamic‑Weight · Routing (HDW)** load‑balancing pipeline for Software Defined Networks, based on:

**“Enhanced network load balancing technique for efficient performance in software defined network”**  
Osei Kofi & Ahene, *PLOS ONE* (2023)  
PDF: `Enhanced_network_load_balancing_technique_for_effi.pdf`

---

## ✨ What this project does

This project implements a browser‑based simulator of the HDW algorithm and compares it against:

- **DWRR** — Deficit Weighted Round‑Robin  
- **WLB** — Weighted Least Busy  
- **DWRS** — Dynamic Weighted Random Selection  

The UI lets you:

- Start/stop the simulation
- Adjust request rate & packet size range
- Switch algorithms on the fly
- Configure server capacities and weights
- Visualize topology, routing, collisions, jitter, throughput, and DSP reroutes

---

## 🚀 Run locally

### Option 1 — Python (no install needed)
```bash
python3 -m http.server 8080
# open http://localhost:8080
```

### Option 2 — Node (if installed)
```bash
npx serve
# open the URL shown in the terminal
```

Then open **index.html**.

---

## 🧠 HDW Pipeline (as implemented)

1. **Hash‑IP**  
   Generates a request fingerprint using FNV‑1a to secure routing.

2. **Dynamic‑Weight Scheduler**  
   Calculates weights using equations from the paper (Eq. 1–4) and allocates bandwidth share.

3. **DSP (Dynamic Switching Path)**  
   Detects congestion and reroutes using IGRP/EGRP‑style logic.

---

## 📁 Project structure

```
.
├── index.html                  # UI entry point
├── app.js                      # Main controller
├── core/
│   ├── hash-ip.js              # FNV‑1a hash implementation
│   ├── hash-table.js           # Hash table with linear probing
│   ├── weighted-scheduler.js   # Eq.1–4 + DWRR/WLB/DWRS
│   ├── dynamic-switching-path.js
│   ├── models.js               # Server + ClientRequest classes
│   └── hdw-load-balancer.js    # Orchestrator pipeline
├── simulation/
│   ├── server-configs.js       # Default server presets
│   └── sim-runner.js           # Tick loop + live updates
├── ui/
│   ├── topology-canvas.js      # Visualization + animation
│   ├── renderer.js             # UI render helpers
│   └── config-modal.js         # Server configuration modal
├── styles/
│   └── main.css                # UI styling
└── Enhanced_network_load_balancing_technique_for_effi.pdf
```

---

## 📊 Metrics tracked

- Requests processed  
- Hash collisions  
- Average jitter  
- Throughput (GB)  
- DSP reroutes  
- Hash integrity checks  

---

## 📌 Notes

This is a **front‑end only** simulation built for visualization and algorithm comparison, not a production SDN controller.

---

## 📄 Paper

The original publication is included as:

`Enhanced_network_load_balancing_technique_for_effi.pdf`

---

## ✅ Citation

If you use or extend this work, please cite the original paper:

Osei Kofi, E., & Ahene, E. (2023). *Enhanced network load balancing technique for efficient performance in software defined network*. PLOS ONE.

---
