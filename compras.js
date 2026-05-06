const purchasesState = {
  purchases: [],
  providers: [],
  providerProducts: [],
  categories: [],
  editingId: null,
  selectedId: null
};

const PURCHASES_API_URL = "api/compras.php";
const PROVIDERS_API_URL = "api/proveedores.php";
const PROVIDER_PRODUCTS_API_URL = "api/proveedor_productos.php";
const CATEGORIES_API_URL = "api/categorias.php";

const ORDERS_STORAGE_KEY = "admin_orders";
const CLIENTS_STORAGE_KEY = "admin_clients";

document.addEventListener("DOMContentLoaded", async () => {
  setupPurchasesEvents();
  await loadInitialData();
});

function setupPurchasesEvents() {
  document.getElementById("openPurchaseModal").addEventListener("click", () => {
    openPurchaseModal();
  });

  document.getElementById("closePurchaseModal").addEventListener("click", closePurchaseModal);
  document.getElementById("cancelPurchaseModal").addEventListener("click", closePurchaseModal);

  document.getElementById("purchaseModal").addEventListener("click", event => {
    if (event.target.id === "purchaseModal") {
      closePurchaseModal();
    }
  });

  document.getElementById("purchaseForm").addEventListener("submit", async event => {
    event.preventDefault();
    await savePurchase();
  });

  document.getElementById("purchaseSearch").addEventListener("input", renderPurchasesPage);
  document.getElementById("purchaseStatusFilter").addEventListener("change", renderPurchasesPage);

  document.getElementById("supplierSelect").addEventListener("change", async event => {
    const idProveedor = event.target.value;

    document.getElementById("purchaseItemsContainer").innerHTML = "";
    purchasesState.providerProducts = [];

    if (idProveedor) {
      await loadProviderProducts(idProveedor);
      addPurchaseItemRow();
    }

    updatePurchaseModalTotal();
  });

  document.getElementById("addPurchaseItem").addEventListener("click", () => {
    const supplierId = document.getElementById("supplierSelect").value;

    if (!supplierId) {
      alert("Primero selecciona un proveedor.");
      return;
    }

    addPurchaseItemRow();
  });

  document.getElementById("purchaseItemsContainer").addEventListener("click", event => {
    if (event.target.classList.contains("remove-purchase-item")) {
      event.target.closest(".purchase-item-row").remove();
      updatePurchaseModalTotal();
    }
  });

  document.getElementById("purchaseItemsContainer").addEventListener("change", event => {
    const row = event.target.closest(".purchase-item-row");

    if (!row) return;

    if (event.target.classList.contains("purchase-item-product")) {
      handleProductTypeChange(row);
    }

    updatePurchaseModalTotal();
  });

  document.getElementById("purchaseItemsContainer").addEventListener("input", () => {
    updatePurchaseModalTotal();
  });

  document.getElementById("closePurchaseDetailModal").addEventListener("click", closePurchaseDetailModal);

  document.getElementById("purchaseDetailModal").addEventListener("click", event => {
    if (event.target.id === "purchaseDetailModal") {
      closePurchaseDetailModal();
    }
  });
}

async function loadInitialData() {
  await Promise.all([
    loadProviders(),
    loadCategories()
  ]);

  await loadPurchasesData();

  renderPurchasesPage();
  renderSidebarBadges();
}

async function loadProviders() {
  try {
    const response = await fetch(PROVIDERS_API_URL);
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error(data.mensaje || "No se pudieron cargar proveedores.");
    }

    purchasesState.providers = data;
    renderProviderOptions();

  } catch (error) {
    alert("Error cargando proveedores: " + error.message);
  }
}

async function loadCategories() {
  try {
    const response = await fetch(CATEGORIES_API_URL);
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error(data.mensaje || "No se pudieron cargar categorías.");
    }

    purchasesState.categories = data;

  } catch (error) {
    console.error("Error cargando categorías:", error);
    purchasesState.categories = [];
  }
}

async function loadProviderProducts(idProveedor) {
  try {
    const response = await fetch(`${PROVIDER_PRODUCTS_API_URL}?id_proveedor=${encodeURIComponent(idProveedor)}`);
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error(data.mensaje || "No se pudieron cargar productos del proveedor.");
    }

    purchasesState.providerProducts = data;

  } catch (error) {
    alert("Error cargando productos del proveedor: " + error.message);
    purchasesState.providerProducts = [];
  }
}

async function loadPurchasesData() {
  try {
    const response = await fetch(PURCHASES_API_URL);
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error(data.mensaje || "No se pudieron cargar compras.");
    }

    purchasesState.purchases = data;

  } catch (error) {
    alert("Error cargando compras: " + error.message);
    purchasesState.purchases = [];
  }
}

function renderProviderOptions() {
  const select = document.getElementById("supplierSelect");

  select.innerHTML = `
    <option value="">Selecciona un proveedor</option>
  `;

  purchasesState.providers.forEach(provider => {
    const option = document.createElement("option");
    option.value = provider.id_proveedor;
    option.textContent = provider.nombre;
    select.appendChild(option);
  });
}

function renderPurchasesPage() {
  renderPurchasesSummary();
  renderPurchasesTable();
  renderSidebarBadges();
}

function renderPurchasesSummary() {
  const totalCount = purchasesState.purchases.length;
  const pending = purchasesState.purchases.filter(item => item.estado === "pendiente").length;
  const received = purchasesState.purchases.filter(item => item.estado === "recibida").length;
  const cancelled = purchasesState.purchases.filter(item => item.estado === "cancelada").length;

  const totalAmount = purchasesState.purchases.reduce((sum, item) => {
    if (item.estado !== "recibida") return sum;
    return sum + Number(item.pago_total || 0);
  }, 0);

  document.getElementById("purchaseTotalCount").textContent = totalCount;
  document.getElementById("purchasePendingCount").textContent = pending;
  document.getElementById("purchaseReceivedCount").textContent = received;
  document.getElementById("purchaseCancelledCount").textContent = cancelled;
  document.getElementById("purchaseTotalAmount").textContent = formatMoney(totalAmount);
}

function renderPurchasesTable() {
  const table = document.getElementById("purchasesTable");
  const countLabel = document.getElementById("purchaseListCount");
  const purchases = getFilteredPurchases();

  countLabel.textContent = purchases.length;
  table.innerHTML = "";

  if (purchases.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">No hay compras registradas.</td>
      </tr>
    `;
    return;
  }

  purchases.forEach(purchase => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <strong>${escapeHTML(purchase.referencia)}</strong>
        <div class="product-meta">ID: ${purchase.id_compra}</div>
      </td>

      <td>${escapeHTML(purchase.proveedor)}</td>

      <td>
        <div>${Number(purchase.productos_count || 0)} productos</div>
        <div class="purchase-products-meta">${escapeHTML(shortText(purchase.productos_preview || "Sin productos", 45))}</div>
      </td>

      <td><strong>${formatMoney(purchase.pago_total)}</strong></td>

      <td>${getPurchaseStatusBadge(purchase.estado)}</td>

      <td>${formatDate(purchase.fecha_compra)}</td>

      <td>
        <div class="action-buttons">
          <button class="small-secondary" onclick="openPurchaseDetail(${purchase.id_compra})">Ver</button>
          <button class="small-primary" onclick="editPurchase(${purchase.id_compra})">Editar</button>
          <button class="small-danger" onclick="deletePurchase(${purchase.id_compra})">Eliminar</button>
        </div>
      </td>
    `;

    table.appendChild(row);
  });
}

function getFilteredPurchases() {
  const search = document.getElementById("purchaseSearch").value.trim().toLowerCase();
  const statusFilter = document.getElementById("purchaseStatusFilter").value;

  return purchasesState.purchases.filter(purchase => {
    const supplier = String(purchase.proveedor || "").toLowerCase();
    const reference = String(purchase.referencia || "").toLowerCase();

    const matchesSearch =
      supplier.includes(search) ||
      reference.includes(search);

    const matchesStatus =
      statusFilter === "all" ||
      purchase.estado === statusFilter;

    return matchesSearch && matchesStatus;
  });
}

async function openPurchaseModal(purchase = null) {
  const modal = document.getElementById("purchaseModal");
  const title = document.getElementById("purchaseModalTitle");

  document.getElementById("purchaseForm").reset();
  document.getElementById("purchaseItemsContainer").innerHTML = "";

  purchasesState.editingId = null;
  purchasesState.providerProducts = [];

  if (purchase) {
    purchasesState.editingId = purchase.id_compra;
    title.textContent = "Editar Compra";

    document.getElementById("supplierSelect").value = purchase.id_proveedor;
    document.getElementById("purchaseReference").value = purchase.referencia || "";
    document.getElementById("purchaseDate").value = normalizeDateForInput(purchase.fecha_compra);
    document.getElementById("purchaseStatus").value = purchase.estado || "pendiente";
    document.getElementById("purchaseNotes").value = purchase.observaciones || "";

    await loadProviderProducts(purchase.id_proveedor);

    if (Array.isArray(purchase.items) && purchase.items.length > 0) {
      purchase.items.forEach(item => addPurchaseItemRow({
        id_proveedor_producto: item.id_proveedor_producto,
        quantity: item.cantidad,
        cost: item.precio_unitario
      }));
    } else {
      addPurchaseItemRow();
    }
  } else {
    title.textContent = "Nueva Compra";
    document.getElementById("purchaseDate").value = getTodayDate();
  }

  updatePurchaseModalTotal();
  modal.classList.add("show");
}

function closePurchaseModal() {
  document.getElementById("purchaseModal").classList.remove("show");
  document.getElementById("purchaseForm").reset();
  document.getElementById("purchaseItemsContainer").innerHTML = "";
  document.getElementById("purchaseModalTotal").textContent = "$0.00";

  purchasesState.editingId = null;
  purchasesState.providerProducts = [];
}

function addPurchaseItemRow(item = {}) {
  const container = document.getElementById("purchaseItemsContainer");
  const row = document.createElement("div");

  row.className = "purchase-item-row";

  row.innerHTML = `
    <label>
      Producto
      <select class="purchase-item-product" required>
        <option value="">Selecciona producto</option>
        <option value="__new__">+ Producto nuevo</option>
      </select>
    </label>

    <label>
      Cantidad
      <input type="number" class="purchase-item-qty" min="1" value="${item.quantity || ""}" placeholder="0" />
    </label>

    <label>
      Costo unitario
      <input type="number" class="purchase-item-cost" min="0" step="0.01" value="${item.cost || ""}" readonly />
    </label>

    <button type="button" class="remove-purchase-item">✕</button>

    <div class="new-product-fields hidden">
      <label>
        Nombre nuevo producto
        <input type="text" class="new-product-name" placeholder="Ej: Atún en lata" />
      </label>

      <label>
        Categoría
        <select class="new-product-category">
          <option value="">Sin categoría</option>
        </select>
      </label>

      <label>
        Precio venta
        <input type="number" class="new-product-sale-price" min="0" step="0.01" placeholder="Opcional" />
      </label>
    </div>
  `;

  container.appendChild(row);

  fillProductSelect(row.querySelector(".purchase-item-product"), item.id_proveedor_producto || "");
  fillCategorySelect(row.querySelector(".new-product-category"));

  handleProductTypeChange(row);
  updatePurchaseModalTotal();
}

function fillProductSelect(select, selectedValue = "") {
  purchasesState.providerProducts.forEach(product => {
    const option = document.createElement("option");
    option.value = product.id_prov_prod;
    option.textContent = `${product.producto} - ${formatMoney(product.precio_proveedor)}`;
    option.dataset.price = product.precio_proveedor;
    option.dataset.name = product.producto;
    select.appendChild(option);
  });

  select.value = selectedValue;
}

function fillCategorySelect(select) {
  purchasesState.categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category.id_categoria;
    option.textContent = category.nombre;
    select.appendChild(option);
  });
}

function handleProductTypeChange(row) {
  const productSelect = row.querySelector(".purchase-item-product");
  const costInput = row.querySelector(".purchase-item-cost");
  const newFields = row.querySelector(".new-product-fields");

  if (productSelect.value === "__new__") {
    newFields.classList.remove("hidden");
    costInput.readOnly = false;
    costInput.value = costInput.value || "";
    return;
  }

  newFields.classList.add("hidden");
  costInput.readOnly = true;
  updateRowCost(row);
}

function updateRowCost(row) {
  const productSelect = row.querySelector(".purchase-item-product");
  const costInput = row.querySelector(".purchase-item-cost");

  const selectedOption = productSelect.options[productSelect.selectedIndex];

  if (!selectedOption || !selectedOption.value || selectedOption.value === "__new__") {
    if (selectedOption && selectedOption.value !== "__new__") {
      costInput.value = "";
    }

    return;
  }

  costInput.value = Number(selectedOption.dataset.price || 0).toFixed(2);
}

function updatePurchaseModalTotal() {
  const total = getPurchaseItemsFromForm().reduce((sum, item) => {
    return sum + Number(item.cantidad) * Number(item.precio_unitario);
  }, 0);

  document.getElementById("purchaseModalTotal").textContent = formatMoney(total);
}

function getPurchaseItemsFromForm() {
  const rows = document.querySelectorAll(".purchase-item-row");
  const items = [];

  rows.forEach(row => {
    const productSelect = row.querySelector(".purchase-item-product");
    const selectedOption = productSelect.options[productSelect.selectedIndex];

    const cantidad = Number(row.querySelector(".purchase-item-qty").value);
    const precioUnitario = Number(row.querySelector(".purchase-item-cost").value);

    if (productSelect.value === "__new__") {
      const nombreProducto = row.querySelector(".new-product-name").value.trim();
      const idCategoria = row.querySelector(".new-product-category").value;
      const precioVenta = Number(row.querySelector(".new-product-sale-price").value);

      if (nombreProducto && cantidad > 0 && precioUnitario > 0) {
        items.push({
          nuevo_producto: true,
          nombre_producto: nombreProducto,
          id_categoria: idCategoria || null,
          cantidad: cantidad,
          precio_unitario: precioUnitario,
          precio_venta: precioVenta || 0
        });
      }

      return;
    }

    const idProveedorProducto = Number(productSelect.value);

    if (idProveedorProducto && cantidad > 0 && precioUnitario >= 0) {
      items.push({
        id_proveedor_producto: idProveedorProducto,
        producto: selectedOption.dataset.name || "",
        cantidad: cantidad,
        precio_unitario: precioUnitario
      });
    }
  });

  return items;
}

async function savePurchase() {
  const idProveedor = document.getElementById("supplierSelect").value;
  const referencia = document.getElementById("purchaseReference").value.trim();
  const fechaCompra = document.getElementById("purchaseDate").value;
  const estado = document.getElementById("purchaseStatus").value;
  const observaciones = document.getElementById("purchaseNotes").value.trim();
  const items = getPurchaseItemsFromForm();

  if (!idProveedor || !referencia || !fechaCompra) {
    alert("Completa proveedor, referencia y fecha.");
    return;
  }

  if (items.length === 0) {
    alert("Debes añadir al menos un producto válido a la compra.");
    return;
  }

  const compraAnterior = purchasesState.editingId
    ? purchasesState.purchases.find(item => Number(item.id_compra) === Number(purchasesState.editingId))
    : null;

  if (
    estado === "recibida" &&
    (!compraAnterior || compraAnterior.estado !== "recibida")
  ) {
    const confirmed = confirm(
      "Al guardar esta compra como RECIBIDA se sumará el stock y contará en Total Invertido. ¿Deseas continuar?"
    );

    if (!confirmed) return;
  }

  if (
    compraAnterior &&
    compraAnterior.estado === "recibida" &&
    estado !== "recibida"
  ) {
    const confirmed = confirm(
      "Esta compra estaba RECIBIDA. Al cambiarla a otro estado se revertirá el stock y dejará de contar como inversión. ¿Deseas continuar?"
    );

    if (!confirmed) return;
  }

  if (
    estado === "cancelada" &&
    (!compraAnterior || compraAnterior.estado !== "cancelada")
  ) {
    const confirmed = confirm(
      "Al guardar esta compra como CANCELADA no se sumará stock ni contará como inversión. ¿Deseas continuar?"
    );

    if (!confirmed) return;
  }

  const payload = {
    id_compra: purchasesState.editingId,
    id_proveedor: idProveedor,
    referencia: referencia,
    fecha_compra: fechaCompra,
    estado: estado,
    observaciones: observaciones,
    items: items
  };

  const method = purchasesState.editingId ? "PUT" : "POST";

  try {
    const response = await fetch(PURCHASES_API_URL, {
      method: method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo guardar la compra.");
    }

    closePurchaseModal();
    await loadPurchasesData();
    renderPurchasesPage();

  } catch (error) {
    console.error("Error guardando compra:", error);
    alert("Error guardando compra: " + error.message);
  }
}

async function editPurchase(id) {
  try {
    const response = await fetch(`${PURCHASES_API_URL}?id=${encodeURIComponent(id)}`);
    const purchase = await response.json();

    if (!response.ok || purchase.ok === false) {
      throw new Error(purchase.mensaje || "No se pudo cargar la compra.");
    }

    await openPurchaseModal(purchase);

  } catch (error) {
    alert("Error cargando compra: " + error.message);
  }
}

async function deletePurchase(id) {
  const confirmed = confirm("¿Seguro que deseas eliminar esta compra?");

  if (!confirmed) return;

  try {
    const response = await fetch(`${PURCHASES_API_URL}?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo eliminar la compra.");
    }

    await loadPurchasesData();
    renderPurchasesPage();

  } catch (error) {
    alert("Error eliminando compra: " + error.message);
  }
}

async function openPurchaseDetail(id) {
  try {
    const response = await fetch(`${PURCHASES_API_URL}?id=${encodeURIComponent(id)}`);
    const purchase = await response.json();

    if (!response.ok || purchase.ok === false) {
      throw new Error(purchase.mensaje || "No se pudo cargar el detalle.");
    }

    purchasesState.selectedId = id;

    document.getElementById("detailSupplierName").textContent = purchase.proveedor || "-";
    document.getElementById("detailReference").textContent = purchase.referencia || "-";
    document.getElementById("detailPurchaseDate").textContent = formatDate(purchase.fecha_compra);
    document.getElementById("detailStatusBox").innerHTML = getPurchaseStatusBadge(purchase.estado);
    document.getElementById("detailPurchaseNotes").textContent = purchase.observaciones || "Sin observaciones.";
    document.getElementById("detailPurchaseTotal").textContent = formatMoney(purchase.pago_total);

    renderPurchaseDetailItems(purchase.items || []);
    document.getElementById("purchaseDetailModal").classList.add("show");

  } catch (error) {
    alert("Error cargando detalle: " + error.message);
  }
}

function closePurchaseDetailModal() {
  document.getElementById("purchaseDetailModal").classList.remove("show");
  purchasesState.selectedId = null;
}

function renderPurchaseDetailItems(items) {
  const container = document.getElementById("purchaseDetailItems");
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<div class="purchase-empty">No hay productos registrados en esta compra.</div>`;
    return;
  }

  const header = document.createElement("div");
  header.className = "purchase-detail-row header";
  header.innerHTML = `
    <div>Producto</div>
    <div>Cantidad</div>
    <div>Costo</div>
    <div>Subtotal</div>
  `;
  container.appendChild(header);

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "purchase-detail-row";
    row.innerHTML = `
      <div>${escapeHTML(item.producto)}</div>
      <div>${Number(item.cantidad)}</div>
      <div>${formatMoney(item.precio_unitario)}</div>
      <div>${formatMoney(item.subtotal)}</div>
    `;
    container.appendChild(row);
  });
}

function getPurchaseStatusBadge(status) {
  if (status === "recibida") return `<span class="status green">Recibida</span>`;
  if (status === "pendiente") return `<span class="status yellow">Pendiente</span>`;
  if (status === "parcial") return `<span class="status blue">Parcial</span>`;
  if (status === "cancelada") return `<span class="status red">Cancelada</span>`;

  return `<span class="status gray">${status || "Sin estado"}</span>`;
}

function renderSidebarBadges() {
  const savedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
  const savedClients = localStorage.getItem(CLIENTS_STORAGE_KEY);

  const orders = savedOrders ? JSON.parse(savedOrders) : [];
  const clients = savedClients ? JSON.parse(savedClients) : [];

  document.getElementById("sidebarOrders").textContent = orders.length;
  document.getElementById("sidebarClients").textContent = clients.length;
}

function formatMoney(value) {
  return "$" + Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function normalizeDateForInput(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shortText(text, limit) {
  text = String(text || "");

  if (text.length <= limit) return text;

  return text.slice(0, limit) + "...";
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}