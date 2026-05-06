const ORDERS_API_URL = "api/pedidos.php";

const orderState = {
  orders: [],
  selectedOrderId: null
};

document.addEventListener("DOMContentLoaded", async () => {
  setupOrderEvents();
  await loadOrders();
});

function setupOrderEvents() {
  const orderSearch = document.getElementById("orderSearch");
  const statusFilter = document.getElementById("statusFilter");
  const closeOrderModal = document.getElementById("closeOrderModal");
  const orderModal = document.getElementById("orderModal");
  const modalStatusSelect = document.getElementById("modalStatusSelect");

  if (orderSearch) {
    orderSearch.addEventListener("input", renderOrders);
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", renderOrders);
  }

  if (closeOrderModal) {
    closeOrderModal.addEventListener("click", closeOrderDetail);
  }

  if (orderModal) {
    orderModal.addEventListener("click", event => {
      if (event.target.id === "orderModal") {
        closeOrderDetail();
      }
    });
  }

  if (modalStatusSelect) {
    modalStatusSelect.addEventListener("change", async () => {
      if (!orderState.selectedOrderId) return;

      await updateOrderStatus(orderState.selectedOrderId, modalStatusSelect.value, true);
    });
  }
}

async function loadOrders() {
  try {
    const response = await fetch(ORDERS_API_URL);
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("pedidos.php no devolvió JSON válido. Revisa errores PHP.");
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudieron cargar los pedidos.");
    }

    orderState.orders = Array.isArray(data.pedidos) ? data.pedidos : [];

    renderSummary();
    renderOrders();

  } catch (error) {
    console.error("Error cargando pedidos:", error);
    alert("No se pudieron cargar los pedidos: " + error.message);
  }
}

function renderSummary() {
  const total = orderState.orders.length;
  const pendientes = orderState.orders.filter(order => order.estado === "pendiente").length;
  const enCamino = orderState.orders.filter(order => order.estado === "en_camino").length;
  const entregados = orderState.orders.filter(order => order.estado === "entregado").length;
  const cancelados = orderState.orders.filter(order => order.estado === "cancelado").length;

  setText("totalOrders", total);
  setText("pendingOrders", pendientes);
  setText("shippingOrders", enCamino);
  setText("deliveredOrders", entregados);
  setText("cancelledOrders", cancelados);
  setText("sidebarOrders", total);

  const clientesUnicos = new Set(
    orderState.orders.map(order => order.id_cliente).filter(Boolean)
  );

  setText("sidebarClients", clientesUnicos.size);
}

function renderOrders() {
  const table = document.getElementById("ordersTable");
  const totalLabel = document.getElementById("ordersTotalLabel");

  if (!table) return;

  const filteredOrders = getFilteredOrders();

  table.innerHTML = "";

  if (totalLabel) {
    totalLabel.textContent = filteredOrders.length;
  }

  if (filteredOrders.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">
          No hay pedidos registrados.
        </td>
      </tr>
    `;
    return;
  }

  filteredOrders.forEach(order => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <strong>#${String(order.id_venta).padStart(4, "0")}</strong>
      </td>

      <td class="client-cell">
        <strong>${escapeHTML(order.cliente_nombre_completo || "Cliente")}</strong>
        <span>${escapeHTML(order.cliente_telefono || "Sin teléfono")}</span>
      </td>

      <td>
        ${Number(order.total_productos || 0)} items
      </td>

      <td>
        <strong>${formatMoney(order.pago_total)}</strong>
      </td>

      <td>
        <select
          class="order-status-select ${getStatusClass(order.estado)}"
          onchange="updateOrderStatus(${Number(order.id_venta)}, this.value)"
        >
          ${getStatusOptions(order.estado)}
        </select>
      </td>

      <td>
        ${formatDate(order.fecha_venta)}
      </td>

      <td>
        <button class="view-btn" onclick="openOrderDetail(${Number(order.id_venta)})">
          👁 Ver
        </button>
      </td>
    `;

    table.appendChild(row);
  });
}

function getFilteredOrders() {
  const searchInput = document.getElementById("orderSearch");
  const statusFilter = document.getElementById("statusFilter");

  const search = searchInput ? normalizeText(searchInput.value) : "";
  const status = statusFilter ? statusFilter.value : "all";

  return orderState.orders.filter(order => {
    const pedido = `#${String(order.id_venta).padStart(4, "0")}`;
    const nombre = normalizeText(order.cliente_nombre_completo);
    const telefono = normalizeText(order.cliente_telefono);
    const correo = normalizeText(order.cliente_correo);
    const pedidoNormalizado = normalizeText(pedido);

    const matchesSearch =
      !search ||
      nombre.includes(search) ||
      telefono.includes(search) ||
      correo.includes(search) ||
      pedidoNormalizado.includes(search) ||
      String(order.id_venta).includes(search);

    const matchesStatus =
      status === "all" ||
      order.estado === status;

    return matchesSearch && matchesStatus;
  });
}

async function updateOrderStatus(idVenta, nuevoEstado, fromModal = false) {
  if (!idVenta || !nuevoEstado) return;

  const order = orderState.orders.find(item => Number(item.id_venta) === Number(idVenta));

  if (!order) {
    alert("No se encontró el pedido.");
    await loadOrders();
    return;
  }

  const estadoAnterior = order.estado;

  if (estadoAnterior === nuevoEstado) {
    renderOrders();
    if (fromModal) fillOrderModal(order);
    return;
  }

  if (!confirmStatusChange(order, nuevoEstado)) {
    renderOrders();
    if (fromModal) fillOrderModal(order);
    return;
  }

  try {
    const response = await fetch(ORDERS_API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id_venta: idVenta,
        estado: nuevoEstado
      })
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("pedidos.php no devolvió JSON válido al actualizar.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo actualizar el estado.");
    }

    order.estado = result.estado || nuevoEstado;
    order.estado_label = result.estado_label || getStatusLabel(nuevoEstado);

    renderSummary();
    renderOrders();

    if (fromModal) {
      fillOrderModal(order);
    }

  } catch (error) {
    console.error("Error actualizando estado:", error);
    alert("No se pudo actualizar el estado: " + error.message);

    await loadOrders();
  }
}

function confirmStatusChange(order, nuevoEstado) {
  const estadoAnterior = order.estado;

  if (estadoAnterior !== "entregado" && nuevoEstado === "entregado") {
    return confirm(
      "Al marcar este pedido como ENTREGADO se descontará el stock y contará como venta. ¿Deseas continuar?"
    );
  }

  if (estadoAnterior === "entregado" && nuevoEstado !== "entregado") {
    return confirm(
      "Este pedido ya estaba ENTREGADO. Al cambiarlo a otro estado se devolverá el stock y dejará de contar como venta. ¿Deseas continuar?"
    );
  }

  if (nuevoEstado === "cancelado") {
    return confirm(
      "Al cancelar este pedido no se descontará stock ni contará como venta. ¿Deseas continuar?"
    );
  }

  return true;
}

function openOrderDetail(idVenta) {
  const order = orderState.orders.find(item => Number(item.id_venta) === Number(idVenta));

  if (!order) {
    alert("No se encontró el pedido seleccionado.");
    return;
  }

  orderState.selectedOrderId = idVenta;
  fillOrderModal(order);

  const modal = document.getElementById("orderModal");

  if (modal) {
    modal.classList.add("show");
  }
}

function fillOrderModal(order) {
  setText("orderModalTitle", `Detalle del Pedido #${String(order.id_venta).padStart(4, "0")}`);
  setText("modalClientName", order.cliente_nombre_completo || "Cliente");
  setText("modalClientPhone", `Teléfono: ${order.cliente_telefono || "Sin teléfono"}`);

  const direccion = order.direccion_entrega || order.cliente_direccion || "Sin dirección";
  const barrio = order.barrio_nombre ? ` - Barrio: ${order.barrio_nombre}` : "";
  const referencia = order.referencia ? ` - Ref: ${order.referencia}` : "";

  setText("modalClientAddress", `Dirección: ${direccion}${barrio}${referencia}`);
  setText("modalOrderTotal", formatMoney(order.pago_total));
  setText("modalOrderDate", formatDate(order.fecha_venta));

  const statusBadge = document.getElementById("modalOrderStatusBadge");

  if (statusBadge) {
    statusBadge.className = `status ${getSimpleStatusClass(order.estado)}`;
    statusBadge.textContent = getStatusLabel(order.estado);
  }

  const modalStatusSelect = document.getElementById("modalStatusSelect");

  if (modalStatusSelect) {
    modalStatusSelect.value = order.estado;
  }

  renderModalProducts(order.productos || []);
}

function renderModalProducts(products) {
  const container = document.getElementById("modalProductsList");

  if (!container) return;

  if (!products.length) {
    container.innerHTML = `
      <div class="empty-products">
        Este pedido no tiene productos registrados.
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(product => {
    return `
      <div class="order-product-item">
        <div>
          <h4>${escapeHTML(product.nombre || "Producto")}</h4>
          <p>
            Cantidad: ${Number(product.cantidad || 0)} × ${formatMoney(product.precio_venta)}
          </p>
        </div>

        <strong>${formatMoney(product.subtotal)}</strong>
      </div>
    `;
  }).join("");
}

function closeOrderDetail() {
  const modal = document.getElementById("orderModal");

  if (modal) {
    modal.classList.remove("show");
  }

  orderState.selectedOrderId = null;
}

function getStatusOptions(currentStatus) {
  const statuses = [
    { value: "pendiente", label: "Pendiente" },
    { value: "en_camino", label: "En camino" },
    { value: "entregado", label: "Entregado" },
    { value: "cancelado", label: "Cancelado" }
  ];

  return statuses.map(status => {
    const selected = status.value === currentStatus ? "selected" : "";

    return `
      <option value="${status.value}" ${selected}>
        ${status.label}
      </option>
    `;
  }).join("");
}

function getStatusLabel(status) {
  const labels = {
    pendiente: "Pendiente",
    en_camino: "En camino",
    entregado: "Entregado",
    cancelado: "Cancelado"
  };

  return labels[status] || "Pendiente";
}

function getStatusClass(status) {
  const classes = {
    pendiente: "pendiente",
    en_camino: "en-camino",
    entregado: "entregado",
    cancelado: "cancelado"
  };

  return classes[status] || "pendiente";
}

function getSimpleStatusClass(status) {
  const classes = {
    pendiente: "yellow",
    en_camino: "blue",
    entregado: "green",
    cancelado: "red"
  };

  return classes[status] || "yellow";
}

function formatMoney(value) {
  return "$" + Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
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
