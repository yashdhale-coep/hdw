# Option 1 — Python (no install needed)
cd hdw-load-balancer
python3 -m http.server 8080
# then open: http://localhost:8080

# Option 2 — Node (if you have it)
npx serve hdw-load-balancer
```

---

## 📁 Module map
```
hdw-load-balancer/
│
├── index.html                  ← OPEN THIS
├── app.js                      ← Entry point, wires everything together
│
├── core/                       ← Pure logic, zero DOM dependency
│   ├── hash-ip.js              ← FNV-1a hash, computes request fingerprint
│   ├── hash-table.js           ← Insert / search / delete with linear probing
│   ├── weighted-scheduler.js   ← Eq.1–4 + Deficit Round-Robin + DWRR/WLB/DWRS
│   ├── dynamic-switching-path.js ← IGRP/EGRP congestion rerouting
│   ├── models.js               ← Server + ClientRequest classes
│   └── hdw-load-balancer.js    ← Orchestrator: Hash → Scheduler → DSP → Process
│
├── simulation/
│   ├── server-configs.js       ← Default server presets (paper-based)
│   └── sim-runner.js           ← Tick loop, pause/resume, live config updates
│
├── ui/
│   ├── topology-canvas.js      ← Canvas draw loop + packet animations
│   ├── renderer.js             ← Server cards, log, stats, distribution bars
│   └── config-modal.js         ← Server config modal (add/remove/edit servers)
│
└── styles/
    └── main.css                ← All styles extracted from original inline CSS