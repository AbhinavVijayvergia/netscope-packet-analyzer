"""
Packet capture and analysis logic using Scapy.
"""
import threading
import time
from collections import defaultdict
from datetime import datetime

try:
    from scapy.all import sniff, rdpcap, IP, IPv6, TCP, UDP, ICMP, ARP, DNS, Ether
    from scapy.layers.http import HTTP
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

# --- Shared state ---
capture_state = {
    "running": False,
    "packets": [],
    "stats": {
        "total_packets": 0,
        "total_bytes": 0,
        "protocols": defaultdict(int),
        "src_ips": defaultdict(int),
        "dst_ips": defaultdict(int),
        "timeline": [],  # list of {"time": epoch_second, "count": n}
    },
    "thread": None,
}

_timeline_bucket = {}  # epoch_second -> count

def _reset_stats():
    capture_state["packets"] = []
    capture_state["stats"] = {
        "total_packets": 0,
        "total_bytes": 0,
        "protocols": defaultdict(int),
        "src_ips": defaultdict(int),
        "dst_ips": defaultdict(int),
        "timeline": [],
    }
    _timeline_bucket.clear()


def _detect_protocol(pkt):
    if pkt.haslayer(ARP):
        return "ARP"
    if pkt.haslayer(DNS):
        return "DNS"
    if pkt.haslayer(ICMP):
        return "ICMP"
    if pkt.haslayer(TCP):
        return "TCP"
    if pkt.haslayer(UDP):
        return "UDP"
    if pkt.haslayer(IP):
        return "IP"
    if pkt.haslayer(IPv6):
        return "IPv6"
    return "Other"


def _process_packet(pkt):
    stats = capture_state["stats"]
    proto = _detect_protocol(pkt)
    length = len(pkt)

    # IPs
    src_ip = dst_ip = "N/A"
    if pkt.haslayer(IP):
        src_ip = pkt[IP].src
        dst_ip = pkt[IP].dst
    elif pkt.haslayer(IPv6):
        src_ip = pkt[IPv6].src
        dst_ip = pkt[IPv6].dst
    elif pkt.haslayer(ARP):
        src_ip = pkt[ARP].psrc
        dst_ip = pkt[ARP].pdst

    # Update stats
    stats["total_packets"] += 1
    stats["total_bytes"] += length
    stats["protocols"][proto] += 1
    if src_ip != "N/A":
        stats["src_ips"][src_ip] += 1
    if dst_ip != "N/A":
        stats["dst_ips"][dst_ip] += 1

    # Timeline bucketing by second
    epoch_sec = int(time.time())
    _timeline_bucket[epoch_sec] = _timeline_bucket.get(epoch_sec, 0) + 1

    # Rebuild timeline (keep last 60 seconds)
    now = int(time.time())
    stats["timeline"] = [
        {"time": t, "count": c}
        for t, c in sorted(_timeline_bucket.items())
        if t >= now - 60
    ]

    # Store packet row (keep last 1000)
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    capture_state["packets"].append({
        "timestamp": ts,
        "src": src_ip,
        "dst": dst_ip,
        "protocol": proto,
        "length": length,
    })
    if len(capture_state["packets"]) > 1000:
        capture_state["packets"] = capture_state["packets"][-1000:]


def _capture_loop(iface, stop_event):
    def _pkt_cb(pkt):
        if stop_event.is_set():
            return True  # stops sniff
        _process_packet(pkt)

    sniff(iface=iface, prn=_pkt_cb, store=False,
          stop_filter=lambda p: stop_event.is_set())


def start_capture(iface):
    if not SCAPY_AVAILABLE:
        return False, "Scapy not installed"
    if capture_state["running"]:
        return False, "Capture already running"

    _reset_stats()
    stop_event = threading.Event()
    capture_state["_stop_event"] = stop_event
    t = threading.Thread(
        target=_capture_loop, args=(iface, stop_event), daemon=True
    )
    t.start()
    capture_state["thread"] = t
    capture_state["running"] = True
    return True, "Capture started"


def stop_capture():
    if not capture_state["running"]:
        return False, "No capture running"
    capture_state["_stop_event"].set()
    capture_state["running"] = False
    return True, "Capture stopped"


def analyze_pcap(filepath):
    if not SCAPY_AVAILABLE:
        return False, "Scapy not installed"

    _reset_stats()
    try:
        packets = rdpcap(filepath)
    except Exception as e:
        return False, f"Failed to read PCAP: {e}"

    # Use packet timestamps for timeline
    first_ts = None
    for pkt in packets:
        # Override timeline to use pcap timestamps
        if hasattr(pkt, "time"):
            epoch_sec = int(float(pkt.time))
            if first_ts is None:
                first_ts = epoch_sec
            _timeline_bucket[epoch_sec] = _timeline_bucket.get(epoch_sec, 0) + 1

        _process_packet(pkt)

    # Rebuild timeline with pcap-relative seconds
    stats = capture_state["stats"]
    stats["timeline"] = [
        {"time": t, "count": c}
        for t, c in sorted(_timeline_bucket.items())
    ]
    return True, f"Analyzed {len(packets)} packets"


def get_dashboard_data():
    stats = capture_state["stats"]

    # Top 10 src/dst IPs
    top_src = sorted(stats["src_ips"].items(), key=lambda x: x[1], reverse=True)[:10]
    top_dst = sorted(stats["dst_ips"].items(), key=lambda x: x[1], reverse=True)[:10]

    # Most active IP
    all_ips = defaultdict(int)
    for ip, c in stats["src_ips"].items():
        all_ips[ip] += c
    for ip, c in stats["dst_ips"].items():
        all_ips[ip] += c
    most_active_ip = max(all_ips, key=all_ips.get) if all_ips else "N/A"

    most_common_proto = (
        max(stats["protocols"], key=stats["protocols"].get)
        if stats["protocols"] else "N/A"
    )

    return {
        "running": capture_state["running"],
        "total_packets": stats["total_packets"],
        "total_bytes": stats["total_bytes"],
        "most_active_ip": most_active_ip,
        "most_common_protocol": most_common_proto,
        "protocols": dict(stats["protocols"]),
        "top_src_ips": [{"ip": ip, "count": c} for ip, c in top_src],
        "top_dst_ips": [{"ip": ip, "count": c} for ip, c in top_dst],
        "timeline": stats["timeline"],
        "packets": capture_state["packets"][-200:],  # last 200 rows for table
    }


def get_interfaces():
    """Return available network interfaces."""
    try:
        from scapy.arch import get_if_list
        ifaces = get_if_list()
        return ifaces
    except Exception:
        import socket
        return [socket.gethostname()]
