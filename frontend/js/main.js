/**
 * main.js — Application controller
 * Handles UI interactions, polling, table rendering, and stat updates.
 */

import * as API from "./api.js";
import {
  initProtocolChart, updateProtocolChart,
  initSrcIpChart,    updateIpChart,
  initDstIpChart,
  initTimelineChart, updateTimelineChart,
} from "./charts.js";

// ---- DOM refs -------------------------------------------------------
const elIface      = document.getElementById("iface-select");
const btnStart     = document.getElementById("btn-start");
const btnStop      = document.getElementById("btn-stop");
const btnUpload    = document.getElementById("btn-upload");
const fileInput    = document.getElementById("pcap-file");
const statusMsg    = document.getElementById("status-msg");
const headerDot    = document.getElementById("header-dot");
const headerStatus = document.getElementById("header-status-text");

const elTotal      = document.getElementById("stat-total");
const elBytes      = document.getElementById("stat-bytes");
const elActiveIp   = document.getElementById("stat-active-ip");
const elProto      = document.getElementById("stat-proto");

const tableBody    = document.getElementById("packet-tbody");
const tableCount   = document.getElementById("table-count");
const emptyState   = document.getElementById("empty-state");
const toastCont    = document.getElementById("toast-container");

// ---- Chart instances ------------------------------------------------
let chartProto, chartSrc, chartDst, chartTimeline;
let pollTimer = null;
let isCapturing = false;

// ---- Init -----------------------------------------------------------
async function init() {
  // Load interfaces
  try {
    const { interfaces } = await API.fetchInterfaces();
    elIface.innerHTML = "";
    if (!interfaces.length) {
      elIface.innerHTML = '<option value="">No interfaces found</option>';
    } else {
      interfaces.forEach((iface) => {
        const o = document.createElement("option");
        o.value = iface;
        o.textContent = iface;
        elIface.appendChild(o);
      });
    }
  } catch (e) {
    setStatus("Failed to load interfaces. Is the server running?", "err");
  }

  // Init charts
  chartProto    = initProtocolChart(document.getElementById("chart-proto").getContext("2d"));
  chartSrc      = initSrcIpChart(document.getElementById("chart-src").getContext("2d"));
  chartDst      = initDstIpChart(document.getElementById("chart-dst").getContext("2d"));
  chartTimeline = initTimelineChart(document.getElementById("chart-timeline").getContext("2d"));

  // Wire buttons
  btnStart.addEventListener("click", onStart);
  btnStop.addEventListener("click", onStop);
  btnUpload.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", onFileChange);

  // Initial dashboard fetch
  await refreshDashboard();
}

// ---- Capture controls -----------------------------------------------
async function onStart() {
  const iface = elIface.value;
  if (!iface) { setStatus("Select a network interface first.", "err"); return; }

  btnStart.disabled = true;
  setStatus('<span class="spinner"></span>&nbsp; Starting capture…', "info");

  try {
    const res = await API.startCapture(iface);
    if (res.ok) {
      isCapturing = true;
      btnStop.disabled  = false;
      btnStart.disabled = true;
      setStatus(`Capturing on ${iface}`, "ok");
      setHeaderActive(true);
      startPolling();
    } else {
      btnStart.disabled = false;
      setStatus(res.message || "Failed to start capture", "err");
    }
  } catch (e) {
    btnStart.disabled = false;
    setStatus("Error: " + e.message, "err");
  }
}

async function onStop() {
  btnStop.disabled = true;
  setStatus("Stopping capture…", "info");

  try {
    const res = await API.stopCapture();
    isCapturing = false;
    stopPolling();
    btnStart.disabled = false;
    setStatus(res.message || "Capture stopped", res.ok ? "ok" : "err");
    setHeaderActive(false);
    await refreshDashboard(); // final update
  } catch (e) {
    setStatus("Error: " + e.message, "err");
    btnStop.disabled = false;
  }
}

// ---- PCAP upload ----------------------------------------------------
async function onFileChange() {
  const file = fileInput.files[0];
  if (!file) return;

  if (isCapturing) {
    toast("Stop live capture before uploading a PCAP file.", "err");
    return;
  }

  btnUpload.disabled = true;
  setStatus(`<span class="spinner"></span>&nbsp; Analyzing ${file.name}…`, "info");

  try {
    const res = await API.uploadPcap(file, (pct) => {
      setStatus(`<span class="spinner"></span>&nbsp; Uploading… ${pct}%`, "info");
    });

    if (res.ok) {
      setStatus(res.message, "ok");
      toast(res.message, "ok");
      await refreshDashboard();
    } else {
      setStatus(res.message || "Analysis failed", "err");
      toast(res.message || "Analysis failed", "err");
    }
  } catch (e) {
    setStatus("Upload error: " + e.message, "err");
  } finally {
    btnUpload.disabled = false;
    fileInput.value = "";
  }
}

// ---- Polling --------------------------------------------------------
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshDashboard, 1000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ---- Dashboard refresh ----------------------------------------------
async function refreshDashboard() {
  try {
    const data = await API.fetchDashboard();
    updateStats(data);
    updateCharts(data);
    updateTable(data.packets || []);
  } catch (e) {
    // silently ignore during polling
  }
}

// ---- Stats ----------------------------------------------------------
function updateStats(data) {
  elTotal.textContent    = fmtNum(data.total_packets);
  elBytes.textContent    = fmtBytes(data.total_bytes);
  elActiveIp.textContent = data.most_active_ip || "—";
  elProto.textContent    = data.most_common_protocol || "—";
}

// ---- Charts ---------------------------------------------------------
function updateCharts(data) {
  if (data.protocols && Object.keys(data.protocols).length) {
    updateProtocolChart(chartProto, data.protocols);
  }
  if (data.top_src_ips?.length) {
    updateIpChart(chartSrc, data.top_src_ips);
  }
  if (data.top_dst_ips?.length) {
    updateIpChart(chartDst, data.top_dst_ips);
  }
  if (data.timeline?.length) {
    updateTimelineChart(chartTimeline, data.timeline);
  }
}

// ---- Packet Table ---------------------------------------------------
const MAX_TABLE_ROWS = 200;
let renderedCount = 0;

function updateTable(packets) {
  if (!packets.length) {
    if (renderedCount === 0) emptyState.classList.add("show");
    return;
  }
  emptyState.classList.remove("show");

  // Only append new rows (avoid full re-render)
  const newPackets = packets.slice(renderedCount);
  if (!newPackets.length) return;

  const frag = document.createDocumentFragment();
  newPackets.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="ts">${escHtml(p.timestamp)}</td>
      <td class="ip">${escHtml(p.src)}</td>
      <td class="ip">${escHtml(p.dst)}</td>
      <td><span class="proto-badge proto-${escHtml(p.protocol)}">${escHtml(p.protocol)}</span></td>
      <td class="len">${p.length}</td>
    `;
    frag.appendChild(tr);
  });

  tableBody.appendChild(frag);
  renderedCount += newPackets.length;

  // Trim old rows if exceeding max
  while (tableBody.rows.length > MAX_TABLE_ROWS) {
    tableBody.deleteRow(0);
  }

  tableCount.textContent = `${fmtNum(renderedCount)} packets`;

  // Auto-scroll to bottom
  const scroll = tableBody.closest(".table-scroll");
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

// Reset table on new capture/upload
function resetTable() {
  tableBody.innerHTML = "";
  renderedCount = 0;
  tableCount.textContent = "0 packets";
  emptyState.classList.add("show");
}

// Expose reset for capture start / upload
const _origOnStart = onStart;
btnStart.addEventListener("click", resetTable, { capture: true });
fileInput.addEventListener("change", resetTable, { capture: true });

// ---- Helpers --------------------------------------------------------
function setStatus(html, type = "") {
  statusMsg.innerHTML = html;
  statusMsg.className = "status-msg" + (type ? " " + type : "");
}

function setHeaderActive(active) {
  headerDot.className = "status-dot" + (active ? " active" : "");
  headerStatus.textContent = active ? "CAPTURING" : "IDLE";
}

function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.textContent = msg;
  toastCont.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function fmtNum(n) {
  return (n || 0).toLocaleString();
}

function fmtBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  if (n < 1024 ** 3) return (n / 1024 / 1024).toFixed(2) + " MB";
  return (n / 1024 ** 3).toFixed(2) + " GB";
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Boot -----------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);
