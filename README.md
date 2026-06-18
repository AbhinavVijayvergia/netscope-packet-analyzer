# NetScope — Network Packet Analyzer Dashboard

A full-stack, single-page packet analyzer built with Flask + Scapy on the backend and vanilla JS + Chart.js on the frontend. Supports live capture on any network interface and offline analysis of `.pcap` files.

---

## Project Structure

```
packet-analyzer/
├── app.py                  # Flask entry point
├── requirements.txt
├── backend/
│   ├── __init__.py
│   ├── capture.py          # Scapy capture/pcap analysis logic
│   └── routes.py           # REST API blueprints
└── frontend/
    ├── index.html          # Single-page UI
    ├── css/
    │   └── style.css
    └── js/
        ├── main.js         # App controller, polling, table
        ├── charts.js       # Chart.js init + update helpers
        └── api.js          # Fetch wrappers for REST API
```

---

## Requirements

- Python 3.9+
- `libpcap` (for Scapy raw capture)

### Install libpcap

**Linux (Debian/Ubuntu):**
```bash
sudo apt install libpcap-dev
```

**macOS:**
```bash
brew install libpcap
```

**Windows:**  
Install [Npcap](https://npcap.com/) with "WinPcap compatibility mode" enabled.

---

## Setup

```bash
# 1. Clone / navigate into the project
cd packet-analyzer

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt
```

---

## Running

> **Raw packet capture requires root/administrator privileges.**

```bash
# Linux / macOS
sudo python app.py

# Windows (run terminal as Administrator)
python app.py
```

Then open **http://localhost:5000** in your browser.

---

## API Endpoints

| Method | Endpoint            | Description                        |
|--------|---------------------|------------------------------------|
| GET    | `/api/interfaces`   | List available network interfaces  |
| POST   | `/api/capture/start`| Start live capture `{interface}`   |
| POST   | `/api/capture/stop` | Stop live capture                  |
| GET    | `/api/capture/status`| Capture running status            |
| GET    | `/api/dashboard`    | All chart + table data             |
| POST   | `/api/upload`       | Upload and analyze a `.pcap` file  |

---

## Dashboard Features

| Feature | Details |
|---|---|
| **Live Capture** | Start/stop on any detected interface; packets stream in real-time |
| **PCAP Upload** | Drop any `.pcap` file for instant offline analysis |
| **Protocol Breakdown** | Doughnut chart — TCP, UDP, ICMP, ARP, DNS, Other |
| **Traffic Timeline** | Line chart — packets per second bucketed to clock time |
| **Top 10 Source IPs** | Horizontal bar chart |
| **Top 10 Destination IPs** | Horizontal bar chart |
| **Packet Stream Table** | Scrollable; timestamp, src, dst, protocol badge, length |
| **Summary Stats** | Total packets, bytes transferred, most active IP, top protocol |

---

## Notes

- Live capture is capped at the **last 1,000 packets** in memory to avoid unbounded RAM growth.
- The packet table auto-scrolls during live capture and keeps the last 200 rows rendered.
- PCAP timeline uses the embedded packet timestamps, not wall-clock time.
- All chart data refreshes every **1 second** during live capture via polling.
