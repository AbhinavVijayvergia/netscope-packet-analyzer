"""
REST API routes for the packet analyzer dashboard.
"""
import os
import tempfile
from flask import Blueprint, jsonify, request, current_app
from . import capture as cap

api = Blueprint("api", __name__, url_prefix="/api")


@api.route("/interfaces", methods=["GET"])
def interfaces():
    ifaces = cap.get_interfaces()
    return jsonify({"interfaces": ifaces})


@api.route("/capture/start", methods=["POST"])
def start():
    data = request.get_json(silent=True) or {}
    iface = data.get("interface", "")
    if not iface:
        return jsonify({"ok": False, "message": "No interface specified"}), 400
    ok, msg = cap.start_capture(iface)
    return jsonify({"ok": ok, "message": msg}), (200 if ok else 400)


@api.route("/capture/stop", methods=["POST"])
def stop():
    ok, msg = cap.stop_capture()
    return jsonify({"ok": ok, "message": msg}), (200 if ok else 400)


@api.route("/capture/status", methods=["GET"])
def status():
    return jsonify({"running": cap.capture_state["running"]})


@api.route("/dashboard", methods=["GET"])
def dashboard():
    data = cap.get_dashboard_data()
    return jsonify(data)


@api.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"ok": False, "message": "No file part"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"ok": False, "message": "No file selected"}), 400
    if not f.filename.lower().endswith(".pcap"):
        return jsonify({"ok": False, "message": "Only .pcap files are supported"}), 400

    # Save to temp file
    tmp = tempfile.NamedTemporaryFile(suffix=".pcap", delete=False)
    f.save(tmp.name)
    tmp.close()

    try:
        ok, msg = cap.analyze_pcap(tmp.name)
    finally:
        os.unlink(tmp.name)

    return jsonify({"ok": ok, "message": msg}), (200 if ok else 500)
