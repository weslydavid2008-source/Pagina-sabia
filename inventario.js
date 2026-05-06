const inventoryState = {
  products: [],
  inventory: [],
  selectedId: null,
  adjustmentType: "add"
};

const PRODUCTS_STORAGE_KEY = "admin_products";
const INVENTORY_STORAGE_KEY = "admin_inventory";
const ORDERS_STORAGE_KEY = "admin_orders";
const CLIENTS_STORAGE_KEY = "admin_clients";

document.addEventListener("DOMContentLoaded", () => {
  loadInventoryData();
  setupInventoryEvents();
  renderInventoryPage();
});

function setupInventoryEvents() {
  document.getElementById("inventorySearch").addEventListener("input", renderInventoryPage);
  document.getElementById("inventoryStatusFilter").addEventListener("change", renderInventoryPage);

  document.getElementById("closeStockModal").addEventListener("click", closeStockModal);
  document.getElementById("cancelStockModal").addEventListener("click", closeStockModal);

  document.getElementById("stockModal").addEventListener("click", event => {
    if (event.target.id === "stockModal") {
      closeStockModal();
    }
  });

  document.getElementById("addStockBtn").addEventListener("click", () => {
    setAdjustmentType("add");
  });

  document.getElementById("removeStockBtn").addEventListener("click", () => {
    setAdjustmentType("remove");
  });

  document.getElementById("stockForm").addEventListener("submit", event => {
    event.preventDefault();
    confirmStockAdjustment();
  });
}

function loadInventoryData() {
  const savedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
  const savedInventory = localStorage.getItem(INVENTORY_STORAGE_KEY);

  inventoryState.products = savedProducts ? JSON.parse(savedProducts) : [];
  inventoryState.inventory = savedInventory ? JSON.parse(savedInventory) : [];

  syncInventoryWithProducts();
}

function syncInventoryWithProducts() {
  const productIds = inventoryState.products.map(product => Number(product.id));

  inventoryState.inventory = inventoryState.inventory.filter(item => {
    return productIds.includes(Number(item.productId));
  });

  inventoryState.products.forEach(product => {
    let item = inventoryState.inventory.find(inventoryItem => {
      return Number(inventoryItem.productId) === Number(product.id);
    });

    if (!item) {
      item = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        productId: product.id,
        productName: product.name,
        category: product.category || "",
        currentStock: Number(product.stock || 0),
        minStock: 10,
        maxStock: 100,
        lastRestock: null
      };

      inventoryState.inventory.push(item);
    } else {
      item.productName = product.name;
      item.category = product.category || "";
    }
  });

  saveInventory();
}

function saveInventory() {
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventoryState.inventory));
}

function saveProducts() {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(inventoryState.products));
}

function renderInventoryPage() {
  renderInventorySummary();
  renderInventoryAlert();
  renderInventoryTable();
  renderSidebarBadges();
}

function renderInventorySummary() {
  const total = inventoryState.inventory.length;
  const normal = inventoryState.inventory.filter(item => getInventoryStatus(item).label === "Normal").length;
  const low = inventoryState.inventory.filter(item => getInventoryStatus(item).label === "Stock Bajo").length;
  const critical = inventoryState.inventory.filter(item => getInventoryStatus(item).label === "Crítico").length;
  const excess = inventoryState.inventory.filter(item => getInventoryStatus(item).label === "Exceso").length;

  document.getElementById("inventoryTotal").textContent = total;
  document.getElementById("inventoryNormal").textContent = normal;
  document.getElementById("inventoryLow").textContent = low;
  document.getElementById("inventoryCritical").textContent = critical;
  document.getElementById("inventoryExcess").textContent = excess;
}

function renderInventoryAlert() {
  const alertBox = document.getElementById("inventoryAlert");
  const alertText = document.getElementById("inventoryAlertText");

  const low = inventoryState.inventory.filter(item => getInventoryStatus(item).label === "Stock Bajo").length;
  const critical = inventoryState.inventory.filter(item => getInventoryStatus(item).label === "Crítico").length;

  if (low === 0 && critical === 0) {
    alertBox.classList.add("hidden");
    return;
  }

  alertBox.classList.remove("hidden");
  alertText.textContent = `Tienes ${critical} productos en nivel crítico y ${low} productos con stock bajo. Considera reabastecer pronto.`;
}

function renderInventoryTable() {
  const table = document.getElementById("inventoryTable");
  const countLabel = document.getElementById("inventoryCountLabel");

  const filteredItems = getFilteredInventory();

  countLabel.textContent = filteredItems.length;
  table.innerHTML = "";

  if (filteredItems.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          No hay productos en inventario.
        </td>
      </tr>
    `;
    return;
  }

  filteredItems.forEach(item => {
    const status = getInventoryStatus(item);
    const level = getStockLevel(item);

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <strong>${item.productName}</strong>
        <div class="product-meta">
          Min: ${item.minStock} | Max: ${item.maxStock}
        </div>
      </td>

      <td class="product-stock-cell">
        <strong>${item.currentStock}</strong>
        <span>unidades</span>
      </td>

      <td>
        <div class="stock-level-wrap">
          <div class="stock-bar-bg">
            <div 
              class="stock-bar-fill ${status.barClass}" 
              style="width: ${level}%"
            ></div>
          </div>
          <small>${level}% de capacidad</small>
        </div>
      </td>

      <td>
        <span class="inventory-status ${status.className}">
          ${status.icon} ${status.label}
        </span>
      </td>

      <td>${formatDate(item.lastRestock)}</td>

      <td>
        <button class="adjust-stock-btn" onclick="openStockModal(${item.id})">
          Ajustar Stock
        </button>
      </td>
    `;

    table.appendChild(row);
  });
}

function getFilteredInventory() {
  const search = document
    .getElementById("inventorySearch")
    .value
    .trim()
    .toLowerCase();

  const statusFilter = document.getElementById("inventoryStatusFilter").value;

  return inventoryState.inventory.filter(item => {
    const name = String(item.productName || "").toLowerCase();
    const category = String(item.category || "").toLowerCase();
    const status = getInventoryStatus(item).label;

    const matchesSearch =
      name.includes(search) ||
      category.includes(search);

    const matchesStatus =
      statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}

function openStockModal(id) {
  const item = inventoryState.inventory.find(inventoryItem => Number(inventoryItem.id) === Number(id));

  if (!item) return;

  inventoryState.selectedId = id;
  setAdjustmentType("add");

  document.getElementById("stockModalSubtitle").textContent =
    `Ajusta el inventario de ${item.productName}`;

  document.getElementById("currentStockValue").textContent = item.currentStock;
  document.getElementById("modalMinStock").textContent = item.minStock;
  document.getElementById("modalMaxStock").textContent = item.maxStock;
  document.getElementById("stockAmount").value = "";

  document.getElementById("stockModal").classList.add("show");
}

function closeStockModal() {
  document.getElementById("stockModal").classList.remove("show");
  document.getElementById("stockForm").reset();
  inventoryState.selectedId = null;
  setAdjustmentType("add");
}

function setAdjustmentType(type) {
  inventoryState.adjustmentType = type;

  const addBtn = document.getElementById("addStockBtn");
  const removeBtn = document.getElementById("removeStockBtn");

  addBtn.classList.toggle("active", type === "add");
  removeBtn.classList.toggle("active", type === "remove");
}

function confirmStockAdjustment() {
  const amount = Number(document.getElementById("stockAmount").value);

  if (!inventoryState.selectedId || amount <= 0) return;

  const item = inventoryState.inventory.find(inventoryItem => {
    return Number(inventoryItem.id) === Number(inventoryState.selectedId);
  });

  if (!item) return;

  if (inventoryState.adjustmentType === "add") {
    item.currentStock += amount;
    item.lastRestock = new Date().toISOString();
  } else {
    if (amount > item.currentStock) {
      alert("No puedes retirar más unidades de las que hay en stock.");
      return;
    }

    item.currentStock -= amount;
  }

  updateProductStock(item.productId, item.currentStock);

  saveInventory();
  saveProducts();

  closeStockModal();
  renderInventoryPage();
}

function updateProductStock(productId, newStock) {
  const product = inventoryState.products.find(item => {
    return Number(item.id) === Number(productId);
  });

  if (product) {
    product.stock = newStock;
  }
}

function getInventoryStatus(item) {
  const stock = Number(item.currentStock || 0);
  const min = Number(item.minStock || 0);
  const max = Number(item.maxStock || 0);

  if (stock <= 0 || stock <= Math.floor(min / 2)) {
    return {
      label: "Crítico",
      className: "critical",
      barClass: "critical",
      icon: "⊗"
    };
  }

  if (stock < min) {
    return {
      label: "Stock Bajo",
      className: "low",
      barClass: "low",
      icon: "⚠"
    };
  }

  if (stock > max) {
    return {
      label: "Exceso",
      className: "excess",
      barClass: "excess",
      icon: "↗"
    };
  }

  return {
    label: "Normal",
    className: "normal",
    barClass: "",
    icon: "✓"
  };
}

function getStockLevel(item) {
  const stock = Number(item.currentStock || 0);
  const max = Number(item.maxStock || 1);

  const level = Math.round((stock / max) * 100);

  return Math.min(100, Math.max(0, level));
}

function renderSidebarBadges() {
  const savedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
  const savedClients = localStorage.getItem(CLIENTS_STORAGE_KEY);

  const orders = savedOrders ? JSON.parse(savedOrders) : [];
  const clients = savedClients ? JSON.parse(savedClients) : [];

  document.getElementById("sidebarOrders").textContent = orders.length;
  document.getElementById("sidebarClients").textContent = clients.length;
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