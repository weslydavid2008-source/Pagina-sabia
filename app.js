const DASHBOARD_API_URLS = {
  productos: "api/productos.php",
  ofertas: "api/ofertas.php",
  pedidos: "api/pedidos.php",
  clientes: "api/clientes.php",
  estadisticas: "api/estadisticas.php"
};

const state = {
  products: [],
  offers: [],
  orders: [],
  clients: [],
  productPage: 1,
  productsPerPage: 6,
  loading: false
};

document.addEventListener("DOMContentLoaded", async () => {
  setupEvents();
  setLoadingState(true);
  await loadDashboardData();
  setLoadingState(false);
});

function setupEvents() {
  const globalSearch = document.getElementById("globalSearch");
  const prevProductsPage = document.getElementById("prevProductsPage");
  const nextProductsPage = document.getElementById("nextProductsPage");
  const salesRange = document.getElementById("salesRange");
  const refreshDashboard = document.getElementById("refreshDashboard");

  if (globalSearch) {
    globalSearch.addEventListener("input", () => {
      state.productPage = 1;
      renderProductsTable();
    });
  }

  if (prevProductsPage) {
    prevProductsPage.addEventListener("click", () => {
      if (state.productPage > 1) {
        state.productPage--;
        renderProductsTable();
      }
    });
  }

  if (nextProductsPage) {
    nextProductsPage.addEventListener("click", () => {
      const totalPages = getTotalProductPages();

      if (state.productPage < totalPages) {
        state.productPage++;
        renderProductsTable();
      }
    });
  }

  if (salesRange) {
    salesRange.addEventListener("change", () => {
      renderSalesChart();
    });
  }

  if (refreshDashboard) {
    refreshDashboard.addEventListener("click", async () => {
      setLoadingState(true);
      await loadDashboardData();
      setLoadingState(false);
    });
  }
}

async function loadDashboardData() {
  const results = await Promise.allSettled([
    fetchJson(DASHBOARD_API_URLS.productos),
    fetchJson(DASHBOARD_API_URLS.ofertas),
    fetchJson(DASHBOARD_API_URLS.pedidos),
    fetchJson(DASHBOARD_API_URLS.clientes)
  ]);

  const [productsResult, offersResult, ordersResult, clientsResult] = results;

  state.products = getArrayFromResult(productsResult, []);
  state.offers = normalizeOffers(getValueFromResult(offersResult, []));
  state.orders = normalizeOrders(getValueFromResult(ordersResult, []));
  state.clients = getArrayFromResult(clientsResult, []);

  state.productPage = 1;
  renderDashboard();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store"
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${url} no devolvió JSON válido.`);
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.mensaje || `No se pudo consultar ${url}.`);
  }

  return data;
}

function getValueFromResult(result, fallback) {
  if (result.status !== "fulfilled") {
    console.error("Error cargando datos del dashboard:", result.reason);
    return fallback;
  }

  return result.value;
}

function getArrayFromResult(result, fallback) {
  const value = getValueFromResult(result, fallback);
  return Array.isArray(value) ? value : fallback;
}

function normalizeOffers(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.ofertas)) return value.ofertas;
  return [];
}

function normalizeOrders(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.pedidos)) return value.pedidos;
  return [];
}

function renderDashboard() {
  renderSummary();
  renderProductsTable();
  renderOffers();
  renderRecentOrders();
  renderSalesChart();
  renderLowStock();
}

function renderSummary() {
  const ordersToday = state.orders.filter(order => isToday(order.fecha_venta)).length;

  const salesToday = state.orders
    .filter(order => order.estado === "entregado" && isToday(order.fecha_venta))
    .reduce((sum, order) => sum + Number(order.pago_total || 0), 0);

  setText("ordersToday", ordersToday);
  setText("salesToday", formatMoney(salesToday));
  setText("totalProducts", state.products.length);
  setText("totalClients", state.clients.length);
  setText("sidebarOrders", state.orders.length);
  setText("sidebarClients", state.clients.length);
}

function getFilteredProducts() {
  const searchInput = document.getElementById("globalSearch");
  const search = normalizeText(searchInput ? searchInput.value : "");

  if (!search) return state.products;

  return state.products.filter(product => {
    const name = normalizeText(product.nombre);
    const category = normalizeText(product.categoria);
    const description = normalizeText(product.descripcion);
    const status = normalizeText(product.estado);

    return (
      name.includes(search) ||
      category.includes(search) ||
      description.includes(search) ||
      status.includes(search)
    );
  });
}

function getTotalProductPages() {
  const filteredProducts = getFilteredProducts();
  return Math.max(1, Math.ceil(filteredProducts.length / state.productsPerPage));
}

function renderProductsTable() {
  const tbody = document.getElementById("dashboardProductsTable");
  const counter = document.getElementById("productsCounter");
  const pageNumber = document.getElementById("productsPageNumber");
  const prevButton = document.getElementById("prevProductsPage");
  const nextButton = document.getElementById("nextProductsPage");

  if (!tbody) return;

  const filteredProducts = getFilteredProducts();
  const totalPages = getTotalProductPages();

  if (state.productPage > totalPages) {
    state.productPage = totalPages;
  }

  const start = (state.productPage - 1) * state.productsPerPage;
  const end = start + state.productsPerPage;
  const productsToShow = filteredProducts.slice(start, end);

  tbody.innerHTML = "";

  if (productsToShow.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          No hay productos para mostrar.
        </td>
      </tr>
    `;
  } else {
    productsToShow.forEach(product => {
      const tr = document.createElement("tr");
      const stockStatus = getStockStatus(product);
      const activeStatus = String(product.estado || "activo").toLowerCase();

      tr.innerHTML = `
        <td>
          <strong>${escapeHTML(product.nombre || "Producto")}</strong>
          <div class="product-meta">ID: ${Number(product.id_producto || 0)}</div>
        </td>
        <td>${escapeHTML(product.categoria || "Sin categoría")}</td>
        <td><strong>${formatMoney(product.precio_venta)}</strong></td>
        <td>
          <div class="dashboard-stock-mini">
            <strong>${Number(product.inventario || 0)}</strong>
            <span>${escapeHTML(stockStatus.label)}</span>
          </div>
        </td>
        <td>
          <span class="status ${activeStatus === "activo" ? "green" : "gray"}">
            ${activeStatus === "activo" ? "Activo" : "Inactivo"}
          </span>
          ${Number(product.destacado || 0) === 1 ? '<span class="featured-pill">Destacado</span>' : ""}
        </td>
        <td>
          <div class="action-buttons">
            <a class="small-secondary" href="productos.html">Gestionar</a>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  if (counter) {
    counter.textContent = `Mostrando ${productsToShow.length} de ${filteredProducts.length} productos`;
  }

  if (pageNumber) {
    pageNumber.textContent = state.productPage;
  }

  if (prevButton) {
    prevButton.disabled = state.productPage <= 1;
  }

  if (nextButton) {
    nextButton.disabled = state.productPage >= totalPages;
  }
}

function renderOffers() {
  const container = document.getElementById("activeOffersList");

  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeOffers = state.offers
    .filter(offer => {
      const estado = String(offer.estado || "activa").toLowerCase();
      const endDate = parseDate(offer.fecha_fin);
      return estado === "activa" && (!endDate || endDate >= today);
    })
    .slice(0, 5);

  if (activeOffers.length === 0) {
    container.innerHTML = `
      <div class="dashboard-empty-block">
        No hay ofertas activas.
      </div>
    `;
    return;
  }

  container.innerHTML = activeOffers.map(offer => {
    const original = Number(offer.precio_original || offer.producto_precio_venta || 0);
    const offerPrice = Number(offer.precio_oferta || 0);
    const discount = original > 0 && offerPrice > 0
      ? Math.round(((original - offerPrice) / original) * 100)
      : 0;

    return `
      <div class="dashboard-offer-item">
        <div>
          <strong>${escapeHTML(offer.producto_nombre || "Producto")}</strong>
          <span>Vence: ${formatDate(offer.fecha_fin)}</span>
        </div>
        <div>
          <strong>${formatMoney(offerPrice)}</strong>
          ${discount > 0 ? `<small>-${discount}%</small>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderRecentOrders() {
  const tbody = document.getElementById("recentOrdersTable");

  if (!tbody) return;

  tbody.innerHTML = "";

  const recentOrders = [...state.orders]
    .sort((a, b) => new Date(String(b.fecha_venta || "").replace(" ", "T")) - new Date(String(a.fecha_venta || "").replace(" ", "T")))
    .slice(0, 5);

  if (recentOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="empty-row">
          No hay pedidos recientes.
        </td>
      </tr>
    `;
    return;
  }

  recentOrders.forEach(order => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <strong>${escapeHTML(order.cliente_nombre_completo || "Cliente")}</strong>
        <div class="product-meta">#${String(order.id_venta || 0).padStart(4, "0")}</div>
      </td>
      <td><strong>${formatMoney(order.pago_total)}</strong></td>
      <td>${getStatusBadge(order.estado)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function renderSalesChart() {
  const chart = document.getElementById("salesChart");
  const rangeSelect = document.getElementById("salesRange");

  if (!chart) return;

  const range = rangeSelect ? rangeSelect.value : "7";
  const salesData = buildSalesData(range);
  const maxValue = Math.max(...salesData.map(item => item.total), 0);

  if (maxValue <= 0) {
    chart.innerHTML = `<div class="chart-empty">No hay ventas entregadas en este rango.</div>`;
    return;
  }

  chart.innerHTML = salesData.map(item => {
    const height = Math.max(8, Math.round((item.total / maxValue) * 150));

    return `
      <div class="dashboard-bar-wrap" title="${escapeHTML(item.label)}: ${formatMoney(item.total)}">
        <div class="bar dashboard-bar" style="height: ${height}px">
          <strong>${formatShortMoney(item.total)}</strong>
        </div>
        <span>${escapeHTML(item.label)}</span>
      </div>
    `;
  }).join("");
}

function renderLowStock() {
  const container = document.getElementById("lowStockList");

  if (!container) return;

  const lowStock = [...state.products]
    .filter(product => Number(product.inventario || 0) <= Number(product.stock_minimo || 0))
    .sort((a, b) => Number(a.inventario || 0) - Number(b.inventario || 0))
    .slice(0, 6);

  if (lowStock.length === 0) {
    container.innerHTML = `
      <div class="dashboard-empty-block">
        No hay productos por debajo del stock mínimo.
      </div>
    `;
    return;
  }

  container.innerHTML = lowStock.map(product => `
    <div class="dashboard-stock-alert">
      <div>
        <strong>${escapeHTML(product.nombre || "Producto")}</strong>
        <span>${escapeHTML(product.categoria || "Sin categoría")}</span>
      </div>
      <div>
        <strong>${Number(product.inventario || 0)}</strong>
        <small>Mín: ${Number(product.stock_minimo || 0)}</small>
      </div>
    </div>
  `).join("");
}

function buildSalesData(range) {
  const deliveredOrders = state.orders.filter(order => order.estado === "entregado");
  const days = getRangeDays(range);
  const map = new Map();

  days.forEach(day => {
    map.set(day.key, {
      label: day.label,
      total: 0
    });
  });

  deliveredOrders.forEach(order => {
    const date = parseDate(order.fecha_venta);

    if (!date) return;

    const key = getDateKey(date);

    if (!map.has(key)) return;

    const item = map.get(key);
    item.total += Number(order.pago_total || 0);
  });

  return Array.from(map.values());
}

function getRangeDays(range) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let start = new Date(today);

  if (range === "30") {
    start.setDate(today.getDate() - 29);
  } else if (range === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else {
    start.setDate(today.getDate() - 6);
  }

  const days = [];
  const cursor = new Date(start);

  while (cursor <= today) {
    days.push({
      key: getDateKey(cursor),
      label: cursor.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short"
      })
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function getStockStatus(product) {
  const stock = Number(product.inventario || 0);
  const min = Number(product.stock_minimo || 0);
  const max = Number(product.stock_maximo || 0);

  if (stock <= 0) {
    return { label: "Agotado", className: "critical" };
  }

  if (min > 0 && stock <= min) {
    return { label: "Bajo", className: "low" };
  }

  if (max > 0 && stock > max) {
    return { label: "Exceso", className: "excess" };
  }

  return { label: "Normal", className: "normal" };
}

function getStatusBadge(status) {
  const cleanStatus = String(status || "pendiente").toLowerCase();
  const classes = {
    pendiente: "yellow",
    en_camino: "blue",
    entregado: "green",
    cancelado: "red"
  };

  const labels = {
    pendiente: "Pendiente",
    en_camino: "En camino",
    entregado: "Entregado",
    cancelado: "Cancelado"
  };

  return `<span class="status ${classes[cleanStatus] || "gray"}">${labels[cleanStatus] || cleanStatus}</span>`;
}

function setLoadingState(isLoading) {
  state.loading = isLoading;

  const refreshDashboard = document.getElementById("refreshDashboard");

  if (refreshDashboard) {
    refreshDashboard.disabled = isLoading;
    refreshDashboard.textContent = isLoading ? "Cargando..." : "Actualizar";
  }
}

function isToday(value) {
  const date = parseDate(value);

  if (!date) return false;

  return getDateKey(date) === getDateKey(new Date());
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "-";

  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatMoney(value) {
  return "$" + Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatShortMoney(value) {
  const number = Number(value || 0);

  if (number >= 1000000) {
    return `$${(number / 1000000).toFixed(1)}M`;
  }

  if (number >= 1000) {
    return `$${Math.round(number / 1000)}K`;
  }

  return formatMoney(number);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

/* =========================================================
   FIX DEFINITIVO ICONOS LINEALES EN INICIO ADMIN
   Aplica directamente a los spans de las tarjetas rapidas
========================================================= */

window.addEventListener("load", () => {
  aplicarIconosInicioAdminDefinitivo();
  setTimeout(aplicarIconosInicioAdminDefinitivo, 300);
  setTimeout(aplicarIconosInicioAdminDefinitivo, 900);
});

function aplicarIconosInicioAdminDefinitivo() {
  if (typeof adminLineIcon !== "function") {
    return;
  }

  reemplazarIconoExacto("ordersTodayIcon", "cart");
  reemplazarIconoExacto("salesTodayIcon", "money");
  reemplazarIconoExacto("productsIcon", "box");
  reemplazarIconoExacto("clientsIcon", "users");

  const titleIcon = document.querySelector(".dashboard-title-icon");
  if (titleIcon) {
    titleIcon.innerHTML = adminLineIcon("home");
    titleIcon.classList.add("admin-home-svg-icon");
  }

  const quickIconMap = {
    "productos.html": "box",
    "pedidos.html": "cart",
    "ofertas.html": "tag",
    "compras.html": "receipt"
  };

  document.querySelectorAll(".dashboard-quick-grid .quick-card").forEach(card => {
    const href = (card.getAttribute("href") || "").split("/").pop();
    const iconName = quickIconMap[href];
    const iconBox = card.querySelector(":scope > span");

    if (!iconName || !iconBox) {
      return;
    }

    iconBox.innerHTML = adminLineIcon(iconName);
    iconBox.classList.add("admin-home-svg-icon");
  });
}

function reemplazarIconoExacto(id, iconName) {
  const element = document.getElementById(id);

  if (!element || typeof adminLineIcon !== "function") {
    return;
  }

  element.innerHTML = adminLineIcon(iconName);
  element.classList.add("admin-home-svg-icon");
}
