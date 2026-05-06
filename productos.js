const productState = {
  products: [],
  categories: [],
  page: 1,
  perPage: 8,
  editingId: null
};

const API_URL = "api/productos.php";
const CATEGORIES_API_URL = "api/categorias.php";

document.addEventListener("DOMContentLoaded", async () => {
  setupProductEvents();
  await loadCategories();
  await loadProducts();
});

function setupProductEvents() {
  const openAddProduct = document.getElementById("openAddProduct");
  const closeProductModalBtn = document.getElementById("closeProductModal");
  const cancelProductModal = document.getElementById("cancelProductModal");
  const productModal = document.getElementById("productModal");
  const productForm = document.getElementById("productForm");
  const productSearch = document.getElementById("productSearch");
  const categoryFilter = document.getElementById("categoryFilter");
  const stockStatusFilter = document.getElementById("stockStatusFilter");
  const productStateFilter = document.getElementById("productStateFilter");
  const prevPage = document.getElementById("prevPage");
  const nextPage = document.getElementById("nextPage");

  if (openAddProduct) {
    openAddProduct.addEventListener("click", () => {
      openProductModal();
    });
  }

  if (closeProductModalBtn) {
    closeProductModalBtn.addEventListener("click", closeProductModal);
  }

  if (cancelProductModal) {
    cancelProductModal.addEventListener("click", closeProductModal);
  }

  if (productModal) {
    productModal.addEventListener("click", event => {
      if (event.target.id === "productModal") {
        closeProductModal();
      }
    });
  }

  if (productForm) {
    productForm.addEventListener("submit", async event => {
      event.preventDefault();
      await saveProduct();
    });
  }

  if (productSearch) {
    productSearch.addEventListener("input", () => {
      productState.page = 1;
      renderProductsPage();
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      productState.page = 1;
      renderProductsPage();
    });
  }

  if (stockStatusFilter) {
    stockStatusFilter.addEventListener("change", () => {
      productState.page = 1;
      renderProductsPage();
    });
  }

  if (productStateFilter) {
    productStateFilter.addEventListener("change", () => {
      productState.page = 1;
      renderProductsPage();
    });
  }

  if (prevPage) {
    prevPage.addEventListener("click", () => {
      if (productState.page > 1) {
        productState.page--;
        renderProductsPage();
      }
    });
  }

  if (nextPage) {
    nextPage.addEventListener("click", () => {
      const totalPages = getTotalPages();

      if (productState.page < totalPages) {
        productState.page++;
        renderProductsPage();
      }
    });
  }
}

async function loadProducts() {
  try {
    const response = await fetch(API_URL);
    const text = await response.text();

    console.log("Respuesta cruda de productos.php:", text);

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("productos.php no devolvió JSON válido. Revisa si hay errores PHP.");
    }

    if (!response.ok) {
      throw new Error(data.mensaje || "Error HTTP al cargar productos.");
    }

    if (!Array.isArray(data)) {
      throw new Error(data.mensaje || "La API no devolvió una lista de productos.");
    }

    productState.products = data;
    renderProductInventorySummary();
    renderProductsPage();

  } catch (error) {
    console.error("Error cargando productos:", error);
    alert("No se pudieron cargar los productos desde MySQL: " + error.message);
  }
}

async function loadCategories() {
  try {
    const response = await fetch(CATEGORIES_API_URL);
    const text = await response.text();

    console.log("Respuesta cruda de categorias.php:", text);

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("categorias.php no devolvió JSON válido.");
    }

    if (!response.ok) {
      throw new Error(data.mensaje || "Error al cargar categorías.");
    }

    if (!Array.isArray(data)) {
      throw new Error("La API de categorías no devolvió una lista.");
    }

    productState.categories = data;
    renderCategoryOptions();

  } catch (error) {
    console.error("Error cargando categorías:", error);
    productState.categories = [];
    renderCategoryOptions();
  }
}

function renderCategoryOptions() {
  const categoryFilter = document.getElementById("categoryFilter");
  const productCategory = document.getElementById("productCategory");

  if (categoryFilter) {
    categoryFilter.innerHTML = `
      <option value="all">Todas las categorías</option>
    `;

    productState.categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category.id_categoria;
      option.textContent = category.nombre;
      categoryFilter.appendChild(option);
    });
  }

  if (productCategory) {
    productCategory.innerHTML = `
      <option value="">Sin categoría</option>
    `;

    productState.categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category.id_categoria;
      option.textContent = category.nombre;
      productCategory.appendChild(option);
    });
  }
}

function renderProductInventorySummary() {
  const total = productState.products.length;
  const normal = productState.products.filter(product => getStockStatus(product).label === "Normal").length;
  const low = productState.products.filter(product => getStockStatus(product).label === "Stock Bajo").length;
  const critical = productState.products.filter(product => getStockStatus(product).label === "Crítico").length;
  const excess = productState.products.filter(product => getStockStatus(product).label === "Exceso").length;

  setText("productsInventoryTotal", total);
  setText("productsInventoryNormal", normal);
  setText("productsInventoryLow", low);
  setText("productsInventoryCritical", critical);
  setText("productsInventoryExcess", excess);
}

function renderProductsPage() {
  const table = document.getElementById("productsTable");
  const productsTotal = document.getElementById("productsTotal");
  const productsCounter = document.getElementById("productsCounter");
  const currentPage = document.getElementById("currentPage");
  const prevPage = document.getElementById("prevPage");
  const nextPage = document.getElementById("nextPage");

  if (!table) {
    console.error("No existe el elemento #productsTable en productos.html");
    return;
  }

  renderProductInventorySummary();

  const filteredProducts = getFilteredProducts();
  const totalPages = getTotalPages();

  if (productState.page > totalPages) {
    productState.page = totalPages;
  }

  const start = (productState.page - 1) * productState.perPage;
  const end = start + productState.perPage;
  const productsToShow = filteredProducts.slice(start, end);

  table.innerHTML = "";

  if (productsToShow.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">No hay productos registrados.</td>
      </tr>
    `;
  } else {
    productsToShow.forEach(product => {
      const row = document.createElement("tr");
      const stockStatus = getStockStatus(product);
      const stockLevel = getStockLevel(product);
      const minStock = getStockMin(product);
      const maxStock = getStockMax(product);

      row.innerHTML = `
        <td>
          <strong>${escapeHTML(product.nombre)}</strong>
          <div class="product-meta">${escapeHTML(product.descripcion || "")}</div>
        </td>

        <td>
          <span class="category-pill">
            ${escapeHTML(product.categoria || "Sin categoría")}
          </span>
        </td>

        <td>${formatMoney(product.precio_venta)}</td>

        <td class="product-stock-cell">
          <strong>${Number(product.inventario || 0)}</strong>
          <span>unidades</span>
          <div class="product-meta">Min: ${minStock} | Max: ${maxStock}</div>
        </td>

        <td>
          <div class="stock-level-wrap">
            <div class="stock-bar-bg">
              <div
                class="stock-bar-fill ${stockStatus.barClass}"
                style="width: ${stockLevel}%"
              ></div>
            </div>
            <small>${stockLevel}% de capacidad</small>
          </div>
        </td>

        <td>
          <span class="inventory-status ${stockStatus.className}">
            ${stockStatus.icon} ${stockStatus.label}
          </span>
        </td>

        <td>
          ${getProductBadges(product)}
        </td>

        <td>
          <div class="action-buttons">
            <button class="action-btn edit-btn icon-action" onclick="editProduct(${Number(product.id_producto)})">
              ✎ Editar
            </button>
            <button class="action-btn delete-btn icon-action" onclick="deleteProduct(${Number(product.id_producto)})">
              🗑 Eliminar
            </button>
          </div>
        </td>
      `;

      table.appendChild(row);
    });
  }

  if (productsTotal) {
    productsTotal.textContent = filteredProducts.length;
  }

  if (productsCounter) {
    productsCounter.textContent = `Mostrando ${productsToShow.length} de ${filteredProducts.length} productos`;
  }

  if (currentPage) {
    currentPage.textContent = productState.page;
  }

  if (prevPage) {
    prevPage.disabled = productState.page <= 1;
  }

  if (nextPage) {
    nextPage.disabled = productState.page >= totalPages;
  }

  const sidebarOrders = document.getElementById("sidebarOrders");
  const sidebarClients = document.getElementById("sidebarClients");

  if (sidebarOrders) sidebarOrders.textContent = "0";
  if (sidebarClients) sidebarClients.textContent = "0";
}

function getProductBadges(product) {
  const badges = [];

  if (Number(product.destacado) === 1) {
    badges.push(`<span class="featured-pill">Destacado</span>`);
  }

  if (Number(product.en_oferta) === 1) {
    badges.push(`<span class="featured-pill offer-pill">Oferta</span>`);
  }

  if (Number(product.tiene_proveedor) === 1) {
    badges.push(`<span class="featured-pill provider-pill">Proveedor</span>`);
  } else {
    badges.push(`<span class="status gray">Sin proveedor</span>`);
  }

  if (product.estado === "activo") {
    badges.push(`<span class="status green">Activo</span>`);
  } else {
    badges.push(`<span class="status red">Inactivo</span>`);
  }

  return badges.join(" ");
}

function getFilteredProducts() {
  const searchInput = document.getElementById("productSearch");
  const categorySelect = document.getElementById("categoryFilter");
  const stockStatusSelect = document.getElementById("stockStatusFilter");
  const productStateSelect = document.getElementById("productStateFilter");

  const search = searchInput ? normalizeText(searchInput.value) : "";
  const category = categorySelect ? categorySelect.value : "all";
  const stockStatusFilter = stockStatusSelect ? stockStatusSelect.value : "all";
  const productStateFilter = productStateSelect ? productStateSelect.value : "all";

  return productState.products.filter(product => {
    const stockStatus = getStockStatus(product);
    const name = normalizeText(product.nombre);
    const description = normalizeText(product.descripcion);
    const productCategoryName = normalizeText(product.categoria);
    const status = normalizeText(product.estado);
    const stockStatusText = normalizeText(stockStatus.label);
    const providerText = Number(product.tiene_proveedor) === 1 ? "proveedor" : "sin proveedor";
    const productStateText = getProductStateSearchText(product);

    const matchesSearch =
      name.includes(search) ||
      description.includes(search) ||
      productCategoryName.includes(search) ||
      status.includes(search) ||
      stockStatusText.includes(search) ||
      providerText.includes(search) ||
      productStateText.includes(search);

    const matchesCategory =
      category === "all" ||
      String(product.id_categoria || "") === String(category);

    const matchesStockStatus =
      stockStatusFilter === "all" ||
      stockStatus.label === stockStatusFilter;

    const matchesProductState = productMatchesState(product, productStateFilter);

    return matchesSearch && matchesCategory && matchesStockStatus && matchesProductState;
  });
}

function productMatchesState(product, selectedState) {
  if (selectedState === "all") return true;

  const isActive = String(product.estado || "activo") === "activo";
  const isFeatured = Number(product.destacado) === 1;
  const isOffer = Number(product.en_oferta) === 1;
  const hasProvider = Number(product.tiene_proveedor) === 1;

  const stateChecks = {
    activo: isActive,
    inactivo: !isActive,
    destacado: isFeatured,
    oferta: isOffer,
    proveedor: hasProvider,
    sin_proveedor: !hasProvider
  };

  return Boolean(stateChecks[selectedState]);
}

function getProductStateSearchText(product) {
  const states = [];

  states.push(String(product.estado || "activo"));

  if (Number(product.destacado) === 1) states.push("destacado");
  if (Number(product.en_oferta) === 1) states.push("oferta en oferta");

  if (Number(product.tiene_proveedor) === 1) {
    states.push("proveedor con proveedor");
  } else {
    states.push("sin proveedor");
  }

  return normalizeText(states.join(" "));
}

function getTotalPages() {
  const total = getFilteredProducts().length;
  return Math.max(1, Math.ceil(total / productState.perPage));
}

function openProductModal(product = null) {
  const modal = document.getElementById("productModal");
  const title = document.getElementById("modalTitle");
  const form = document.getElementById("productForm");

  if (!modal) {
    console.error("No existe el modal #productModal");
    return;
  }

  modal.classList.add("show");

  if (product) {
    productState.editingId = Number(product.id_producto);

    if (title) title.textContent = "Editar Producto";

    document.getElementById("productName").value = product.nombre || "";
    document.getElementById("productCategory").value = product.id_categoria || "";
    document.getElementById("productPrice").value = product.precio_venta || 0;
    document.getElementById("productStock").value = product.inventario || 0;
    document.getElementById("productMinStock").value = getStockMin(product);
    document.getElementById("productMaxStock").value = getStockMax(product);

    const featured = document.getElementById("productFeatured");
    if (featured) featured.value = Number(product.destacado) === 1 ? "true" : "false";

    const offer = document.getElementById("productOffer");
    if (offer) offer.value = Number(product.en_oferta) === 1 ? "true" : "false";

    const status = document.getElementById("productStatus");
    if (status) status.value = product.estado || "activo";

  } else {
    productState.editingId = null;

    if (title) title.textContent = "Añadir Producto";
    if (form) form.reset();

    const minStock = document.getElementById("productMinStock");
    if (minStock) minStock.value = 10;

    const maxStock = document.getElementById("productMaxStock");
    if (maxStock) maxStock.value = 100;

    const featured = document.getElementById("productFeatured");
    if (featured) featured.value = "false";

    const offer = document.getElementById("productOffer");
    if (offer) offer.value = "false";

    const status = document.getElementById("productStatus");
    if (status) status.value = "activo";
  }
}

function closeProductModal() {
  const modal = document.getElementById("productModal");
  const form = document.getElementById("productForm");

  if (modal) modal.classList.remove("show");
  if (form) form.reset();

  productState.editingId = null;
}

async function saveProduct() {
  const nameInput = document.getElementById("productName");
  const categoryInput = document.getElementById("productCategory");
  const priceInput = document.getElementById("productPrice");
  const stockInput = document.getElementById("productStock");
  const minStockInput = document.getElementById("productMinStock");
  const maxStockInput = document.getElementById("productMaxStock");
  const featuredInput = document.getElementById("productFeatured");
  const offerInput = document.getElementById("productOffer");
  const statusInput = document.getElementById("productStatus");

  const nombre = nameInput ? nameInput.value.trim() : "";
  const categoria = categoryInput ? categoryInput.value : "";
  const precio = priceInput ? Number(priceInput.value) : 0;
  const inventario = stockInput ? Number(stockInput.value) : 0;
  const stockMinimo = minStockInput ? Number(minStockInput.value) : 10;
  const stockMaximo = maxStockInput ? Number(maxStockInput.value) : 100;
  const destacado = featuredInput ? featuredInput.value === "true" : false;
  const enOferta = offerInput ? offerInput.value === "true" : false;
  const estado = statusInput ? statusInput.value : "activo";

  if (!nombre) {
    alert("Completa el nombre del producto.");
    return;
  }

  if (precio < 0 || Number.isNaN(precio)) {
    alert("El precio no es válido.");
    return;
  }

  if (inventario < 0 || Number.isNaN(inventario)) {
    alert("El stock no es válido.");
    return;
  }

  if (stockMinimo < 0 || Number.isNaN(stockMinimo)) {
    alert("El stock mínimo no es válido.");
    return;
  }

  if (stockMaximo <= 0 || Number.isNaN(stockMaximo)) {
    alert("El stock máximo debe ser mayor a 0.");
    return;
  }

  if (stockMaximo < stockMinimo) {
    alert("El stock máximo no puede ser menor que el stock mínimo.");
    return;
  }

  const productoActual = productState.editingId
  ? productState.products.find(product => {
      return Number(product.id_producto) === Number(productState.editingId);
    })
  : null;

const productData = {
  id_producto: productState.editingId,
  nombre: nombre,
  descripcion: productoActual ? productoActual.descripcion || "" : "",
  id_categoria: categoria || null,
  precio_compra: productoActual ? Number(productoActual.precio_compra || 0) : 0,
  precio_venta: precio,
  inventario: inventario,
  stock_minimo: stockMinimo,
  stock_maximo: stockMaximo,
  estado: estado,
  en_oferta: enOferta,
  destacado: destacado
};

  const method = productState.editingId ? "PUT" : "POST";

  try {
    const response = await fetch(API_URL, {
      method: method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(productData)
    });

    const text = await response.text();

    console.log("Respuesta al guardar producto:", text);

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("productos.php no devolvió JSON válido al guardar.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo guardar el producto.");
    }

    closeProductModal();
    await loadProducts();

  } catch (error) {
    console.error("Error guardando producto:", error);
    alert("No se pudo guardar el producto: " + error.message);
  }
}

function editProduct(id) {
  const product = productState.products.find(item => {
    return Number(item.id_producto) === Number(id);
  });

  if (product) {
    openProductModal(product);
  } else {
    alert("No se encontró el producto seleccionado.");
  }
}

async function deleteProduct(id) {
  const confirmed = confirm("¿Seguro que deseas eliminar este producto?");

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    const text = await response.text();

    console.log("Respuesta al eliminar producto:", text);

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("productos.php no devolvió JSON válido al eliminar.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo eliminar el producto.");
    }

    await loadProducts();

  } catch (error) {
    console.error("Error eliminando producto:", error);
    alert("No se pudo eliminar el producto: " + error.message);
  }
}

function getStockStatus(product) {
  const stock = Number(product.inventario || 0);
  const min = getStockMin(product);
  const max = getStockMax(product);

  if (stock <= 0 || stock <= Math.floor(min / 2)) {
    return {
      label: "Crítico",
      className: "critical",
      barClass: "critical",
      icon: "×"
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

function getStockLevel(product) {
  const stock = Number(product.inventario || 0);
  const max = getStockMax(product);
  const level = Math.round((stock / max) * 100);

  return Math.min(100, Math.max(0, level));
}

function getStockMin(product) {
  const min = Number(product.stock_minimo);
  return Number.isFinite(min) && min >= 0 ? min : 10;
}

function getStockMax(product) {
  const max = Number(product.stock_maximo);
  return Number.isFinite(max) && max > 0 ? max : 100;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatMoney(value) {
  return "$" + Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}