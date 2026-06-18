/**
 * charts.js — Chart.js chart initialization and update logic
 */

// Color palette aligned with CSS tokens
const C = {
  green:  "#00ff88",
  amber:  "#ffb347",
  teal:   "#00d4ff",
  red:    "#ff4757",
  purple: "#a78bfa",
  orange: "#f97316",
  pink:   "#ec4899",
  blue:   "#60a5fa",
  lime:   "#84cc16",
  cyan:   "#22d3ee",
};

const PROTO_COLORS = {
  TCP:   C.green,
  UDP:   C.amber,
  ICMP:  C.orange,
  ARP:   C.purple,
  DNS:   C.teal,
  IP:    C.blue,
  IPv6:  C.cyan,
  Other: "#4a5a6e",
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: {
    legend: {
      labels: {
        color: "#8a9ab0",
        font: { family: "'JetBrains Mono', monospace", size: 11 },
        boxWidth: 12,
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: "#111820",
      borderColor: "#1e2d3d",
      borderWidth: 1,
      titleColor: "#e8edf3",
      bodyColor: "#8a9ab0",
      titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
      bodyFont:  { family: "'JetBrains Mono', monospace", size: 11 },
      padding: 10,
    },
  },
};

const AXIS_STYLE = {
  grid: { color: "rgba(30, 45, 61, 0.8)", drawBorder: false },
  ticks: {
    color: "#4a5a6e",
    font: { family: "'JetBrains Mono', monospace", size: 10 },
  },
  border: { color: "rgba(30, 45, 61, 0.5)" },
};

// ---- Protocol Pie ------------------------------------------------
export function initProtocolChart(ctx) {
  return new Chart(ctx, {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: "#0d1117", borderWidth: 3, hoverOffset: 6 }] },
    options: {
      ...CHART_DEFAULTS,
      maintainAspectRatio: true,
      cutout: "62%",
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { ...CHART_DEFAULTS.plugins.legend, position: "right" },
      },
    },
  });
}

export function updateProtocolChart(chart, protocols) {
  const labels = Object.keys(protocols);
  const data   = Object.values(protocols);
  const colors = labels.map((l) => PROTO_COLORS[l] || C.blue);

  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].backgroundColor = colors;
  chart.update("none");
}

// ---- Top IPs Bar -------------------------------------------------
function makeBarChart(ctx, label, color) {
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        backgroundColor: color + "33",
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: "y",
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: {
        x: {
          ...AXIS_STYLE,
          beginAtZero: true,
          ticks: { ...AXIS_STYLE.ticks, stepSize: 1, maxTicksLimit: 6 },
        },
        y: {
          ...AXIS_STYLE,
          ticks: {
            ...AXIS_STYLE.ticks,
            color: "#8a9ab0",
            font: { family: "'JetBrains Mono', monospace", size: 10 },
          },
        },
      },
    },
  });
}

export function initSrcIpChart(ctx) {
  return makeBarChart(ctx, "Packets", C.green);
}

export function initDstIpChart(ctx) {
  return makeBarChart(ctx, "Packets", C.teal);
}

export function updateIpChart(chart, ipList) {
  // ipList: [{ip, count}, ...]
  const labels = ipList.map((x) => x.ip);
  const data   = ipList.map((x) => x.count);
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update("none");
}

// ---- Traffic Timeline Line ----------------------------------------
export function initTimelineChart(ctx) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Packets/s",
        data: [],
        borderColor: C.amber,
        backgroundColor: "rgba(255,179,71,0.08)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: C.amber,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          ...AXIS_STYLE,
          ticks: {
            ...AXIS_STYLE.ticks,
            maxTicksLimit: 10,
            maxRotation: 0,
          },
        },
        y: {
          ...AXIS_STYLE,
          beginAtZero: true,
          ticks: { ...AXIS_STYLE.ticks, stepSize: 1 },
        },
      },
    },
  });
}

export function updateTimelineChart(chart, timeline) {
  if (!timeline || timeline.length === 0) return;

  // Format timestamps as HH:MM:SS relative labels
  const labels = timeline.map((t) => {
    const d = new Date(t.time * 1000);
    return d.toLocaleTimeString("en-US", { hour12: false });
  });
  const data = timeline.map((t) => t.count);

  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update("none");
}
