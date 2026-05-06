const statsState = {
  summary: null,
  dailySales: [],
  statusCounts: {},
  monthlyTrend: [],
  topProducts: [],
  sidebar: {
    pedidos: 0,
    clientes: 0
  }
};

const STATS_API_URL = "api/estadisticas.php";

document.addEventListener("DOMContentLoaded", async () => {
  setupStatsEvents();
  await loadStatsData();
});

function setupStatsEvents() {
  const statsRange = document.getElementById("statsRange");

  if (statsRange) {
    statsRange.addEventListener("change", async () => {
      await loadStatsData();
    });
  }
}

async function loadStatsData() {
  const range = document.getElementById("statsRange")?.value || "7";

  try {
    showLoadingState();

    const response = await fetch(`${STATS_API_URL}?range=${encodeURIComponent(range)}`);
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error("Respuesta cruda de estadisticas.php:", text);
      throw new Error("estadisticas.php no devolvió JSON válido.");
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudieron cargar las estadísticas.");
    }

    statsState.summary = data.summary || null;
    statsState.dailySales = Array.isArray(data.daily_sales) ? data.daily_sales : [];
    statsState.statusCounts = data.status_counts || {};
    statsState.monthlyTrend = Array.isArray(data.monthly_trend) ? data.monthly_trend : [];
    statsState.topProducts = Array.isArray(data.top_products) ? data.top_products : [];
    statsState.sidebar = data.sidebar || {
      pedidos: 0,
      clientes: 0
    };

    renderStatsPage();

  } catch (error) {
    console.error("Error cargando estadísticas:", error);
    alert("No se pudieron cargar las estadísticas: " + error.message);
  }
}

function showLoadingState() {
  setText("totalSalesStats", "Cargando...");
  setText("totalOrdersStats", "...");
  setText("averageTicketStats", "...");
  setText("activeClientsStats", "...");

  const dailySalesChart = document.getElementById("dailySalesChart");
  const monthlyTrendChart = document.getElementById("monthlyTrendChart");
  const topProductsList = document.getElementById("topProductsList");
  const ordersStatusList = document.getElementById("ordersStatusList");

  if (dailySalesChart) {
    dailySalesChart.innerHTML = `<div class="analytics-empty">Cargando ventas...</div>`;
  }

  if (monthlyTrendChart) {
    monthlyTrendChart.innerHTML = `<div class="analytics-empty">Cargando tendencia...</div>`;
  }

  if (topProductsList) {
    topProductsList.innerHTML = `<div class="analytics-empty" style="padding: 45px;">Cargando productos...</div>`;
  }

  if (ordersStatusList) {
    ordersStatusList.innerHTML = `<div class="analytics-empty">Cargando estados...</div>`;
  }
}

function renderStatsPage() {
  renderSummaryCards();
  renderDailySalesChart();
  renderOrdersStatusChart();
  renderMonthlyTrendChart();
  renderTopProducts();
  renderSidebarBadges();
  updateChartLabel();
}

function renderSummaryCards() {
  const summary = statsState.summary || {
    ventas_totales: 0,
    pedidos_totales: 0,
    ticket_promedio: 0,
    clientes_activos: 0
  };

  setText("totalSalesStats", formatMoney(summary.ventas_totales));
  setText("totalOrdersStats", Number(summary.pedidos_totales || 0));
  setText("averageTicketStats", formatMoney(summary.ticket_promedio));
  setText("activeClientsStats", Number(summary.clientes_activos || 0));

  setText(
    "salesGrowthText",
    Number(summary.ventas_totales || 0) > 0
      ? "Ventas calculadas desde MySQL"
      : "Sin ventas en este rango"
  );

  setText(
    "ordersGrowthText",
    Number(summary.pedidos_totales || 0) > 0
      ? "Pedidos calculados desde MySQL"
      : "Sin pedidos en este rango"
  );
}

function renderDailySalesChart() {
  const chart = document.getElementById("dailySalesChart");

  if (!chart) return;

  const sales = statsState.dailySales.map(item => {
    return {
      fecha: item.fecha,
      label: formatShortDate(item.fecha),
      total: Number(item.total || 0)
    };
  });

  const hasData = sales.some(item => item.total > 0);

  if (!hasData) {
    chart.innerHTML = `<div class="analytics-empty">No hay datos de ventas para mostrar.</div>`;
    return;
  }

  const maxValue = Math.max(...sales.map(item => item.total));

  chart.innerHTML = "";

  sales.forEach(item => {
    const height = maxValue > 0 ? Math.max(5, (item.total / maxValue) * 100) : 0;

    const div = document.createElement("div");
    div.className = "analytics-bar-wrap";

    div.innerHTML = `
      <div class="analytics-bar" style="height:${height}%">
        <span class="analytics-bar-value">${formatMoneyShort(item.total)}</span>
      </div>
      <span class="analytics-bar-label">${item.label}</span>
    `;

    chart.appendChild(div);
  });
}

function renderOrdersStatusChart() {
  const counts = statsState.statusCounts || {};

  const statuses = [
    {
      key: "entregado",
      name: "Entregados",
      className: "dot-green",
      color: "#22c55e"
    },
    {
      key: "pendiente",
      name: "Pendientes",
      className: "dot-yellow",
      color: "#f59e0b"
    },
    {
      key: "en_camino",
      name: "En camino",
      className: "dot-blue",
      color: "#3b82f6"
    },
    {
      key: "cancelado",
      name: "Cancelados",
      className: "dot-red",
      color: "#ef4444"
    }
  ];

  const totalOrders = statuses.reduce((sum, status) => {
    return sum + Number(counts[status.key] || 0);
  }, 0);

  const donut = document.getElementById("ordersDonut");
  const list = document.getElementById("ordersStatusList");

  if (!donut || !list) return;

  list.innerHTML = "";

  if (totalOrders === 0) {
    donut.style.background = document.body.classList.contains("dark-theme")
  ? "#1f2937"
  : "#f3f4f6";
    donut.innerHTML = `
      <div class="donut-center">
        <strong>0</strong>
        <span>pedidos</span>
      </div>
    `;

    list.innerHTML = `<div class="analytics-empty">No hay pedidos registrados.</div>`;
    return;
  }

  let currentPercentage = 0;
  const gradientParts = [];

  statuses.forEach(status => {
    const count = Number(counts[status.key] || 0);
    const percentage = totalOrders > 0 ? (count / totalOrders) * 100 : 0;

    if (percentage > 0) {
      const start = currentPercentage;
      const end = currentPercentage + percentage;

      gradientParts.push(`${status.color} ${start}% ${end}%`);
      currentPercentage = end;
    }

    const div = document.createElement("div");
    div.className = "status-list-item";

    div.innerHTML = `
      <div class="status-list-left">
        <span class="status-dot ${status.className}"></span>
        <span>${status.name}</span>
      </div>

      <strong>${count} (${Math.round(percentage)}%)</strong>
    `;

    list.appendChild(div);
  });

  donut.style.background = `conic-gradient(${gradientParts.join(", ")})`;

  donut.innerHTML = `
    <div class="donut-center">
      <strong>${totalOrders}</strong>
      <span>pedidos</span>
    </div>
  `;
}

function renderMonthlyTrendChart() {
  const chart = document.getElementById("monthlyTrendChart");

  if (!chart) return;

  const monthlySales = statsState.monthlyTrend.map(item => {
    return {
      label: item.label,
      total: Number(item.total || 0)
    };
  });

  const hasData = monthlySales.some(item => item.total > 0);

  if (!hasData) {
    chart.innerHTML = `<div class="analytics-empty">No hay tendencia mensual disponible.</div>`;
    return;
  }

  const maxValue = Math.max(...monthlySales.map(item => item.total));

  chart.innerHTML = "";

  monthlySales.forEach(item => {
    const height = maxValue > 0 ? Math.max(5, (item.total / maxValue) * 100) : 0;

    const div = document.createElement("div");
    div.className = "analytics-bar-wrap";

    div.innerHTML = `
      <div class="analytics-bar" style="height:${height}%">
        <span class="analytics-bar-value">${formatMoneyShort(item.total)}</span>
      </div>
      <span class="analytics-bar-label">${escapeHTML(item.label)}</span>
    `;

    chart.appendChild(div);
  });
}

function renderTopProducts() {
  const container = document.getElementById("topProductsList");

  if (!container) return;

  const products = statsState.topProducts.map(product => {
    return {
      id_producto: Number(product.id_producto || 0),
      name: product.nombre || "Producto",
      quantity: Number(product.cantidad_vendida || 0),
      total: Number(product.total_vendido || 0)
    };
  });

  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = `
      <div class="analytics-empty" style="padding: 45px;">
        No hay productos vendidos para mostrar.
      </div>
    `;
    return;
  }

  products.forEach((product, index) => {
    const div = document.createElement("div");
    div.className = "top-product-item";

    div.innerHTML = `
      <div class="top-product-rank">${index + 1}</div>

      <div class="top-product-info">
        <h3>${escapeHTML(product.name)}</h3>
        <p>${product.quantity} unidades vendidas</p>
      </div>

      <div class="top-product-sales">
        <strong>${formatMoney(product.total)}</strong>
      </div>
    `;

    container.appendChild(div);
  });
}

function updateChartLabel() {
  const range = document.getElementById("statsRange")?.value || "7";
  const label = document.getElementById("salesChartLabel");

  const labels = {
    "7": "Últimos 7 días",
    "30": "Últimos 30 días",
    "month": "Este mes",
    "year": "Este año",
    "all": "Todo"
  };

  if (label) {
    label.textContent = labels[range] || "Últimos 7 días";
  }
}

function renderSidebarBadges() {
  setText("sidebarOrders", Number(statsState.sidebar.pedidos || 0));
  setText("sidebarClients", Number(statsState.sidebar.clientes || 0));
}

function formatMoney(value) {
  return "$" + Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatMoneyShort(value) {
  const number = Number(value || 0);

  if (number >= 1000000) {
    return "$" + (number / 1000000).toLocaleString("es-CO", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + "M";
  }

  if (number >= 1000) {
    return "$" + (number / 1000).toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + "k";
  }

  return "$" + number.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatShortDate(value) {
  if (!value) return "-";

  const date = new Date(String(value) + "T00:00:00");

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short"
  });
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
