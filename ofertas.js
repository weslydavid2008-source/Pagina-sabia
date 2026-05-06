const offersState = {
  offers: [],
  products: [],
  editingId: null
};

const OFFERS_API_URL = "api/ofertas.php";
const PRODUCTS_API_URL = "api/productos.php";

document.addEventListener("DOMContentLoaded", async () => {
  setupOfferEvents();
  await loadProducts();
  await loadOffers();
});

function setupOfferEvents() {
  const openOfferModalBtn = document.getElementById("openOfferModal");
  const closeOfferModalBtn = document.getElementById("closeOfferModal");
  const cancelOfferModal = document.getElementById("cancelOfferModal");
  const offerModal = document.getElementById("offerModal");
  const offerForm = document.getElementById("offerForm");
  const productSelect = document.getElementById("offerProductSelect");
  const originalPriceInput = document.getElementById("offerOriginalPrice");
  const offerPriceInput = document.getElementById("offerPrice");

  if (openOfferModalBtn) {
    openOfferModalBtn.addEventListener("click", () => {
      openOfferModal();
    });
  }

  if (closeOfferModalBtn) {
    closeOfferModalBtn.addEventListener("click", closeOfferModal);
  }

  if (cancelOfferModal) {
    cancelOfferModal.addEventListener("click", closeOfferModal);
  }

  if (offerModal) {
    offerModal.addEventListener("click", event => {
      if (event.target.id === "offerModal") {
        closeOfferModal();
      }
    });
  }

  if (offerForm) {
    offerForm.addEventListener("submit", async event => {
      event.preventDefault();
      await saveOffer();
    });
  }

  if (productSelect) {
    productSelect.addEventListener("change", fillOriginalPriceFromProduct);
  }

  if (originalPriceInput) {
    originalPriceInput.addEventListener("input", validateOfferPrices);
  }

  if (offerPriceInput) {
    offerPriceInput.addEventListener("input", validateOfferPrices);
  }
}

async function loadProducts() {
  try {
    const response = await fetch(PRODUCTS_API_URL);
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("productos.php no devolvió JSON válido.");
    }

    if (!response.ok) {
      throw new Error(data.mensaje || "No se pudieron cargar los productos.");
    }

    if (!Array.isArray(data)) {
      throw new Error("La API de productos no devolvió una lista.");
    }

    offersState.products = data.filter(product => {
      return String(product.estado || "activo") === "activo";
    });

    renderProductOptions();

  } catch (error) {
    console.error("Error cargando productos:", error);
    alert("No se pudieron cargar los productos: " + error.message);
  }
}

async function loadOffers() {
  try {
    const response = await fetch(OFFERS_API_URL);
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error("Respuesta cruda de ofertas.php:", text);
      throw new Error("ofertas.php no devolvió JSON válido.");
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudieron cargar las ofertas.");
    }

    offersState.offers = Array.isArray(data.ofertas) ? data.ofertas : [];

    renderOffersPage();

  } catch (error) {
    console.error("Error cargando ofertas:", error);
    alert("No se pudieron cargar las ofertas: " + error.message);
  }
}

function renderProductOptions() {
  const productSelect = document.getElementById("offerProductSelect");

  if (!productSelect) return;

  productSelect.innerHTML = `
    <option value="">Selecciona un producto</option>
  `;

  offersState.products.forEach(product => {
    const option = document.createElement("option");

    option.value = product.id_producto;
    option.textContent = `${product.nombre} - ${formatMoney(product.precio_venta)}`;
    option.dataset.price = product.precio_venta;

    productSelect.appendChild(option);
  });
}

function fillOriginalPriceFromProduct() {
  const productSelect = document.getElementById("offerProductSelect");
  const originalPriceInput = document.getElementById("offerOriginalPrice");

  if (!productSelect || !originalPriceInput) return;

  const selectedProduct = getSelectedProduct();

  if (!selectedProduct) {
    originalPriceInput.value = "";
    return;
  }

  originalPriceInput.value = Number(selectedProduct.precio_venta || 0).toFixed(2);
  validateOfferPrices();
}

function renderOffersPage() {
  renderOfferSummary();
  renderOfferGroups();
  renderSidebarBadges();
}

function renderOfferSummary() {
  const activeOffers = offersState.offers.filter(offer => offer.estado === "activa");
  const inactiveOffers = offersState.offers.filter(offer => offer.estado !== "activa");

  setText("activeOffersCount", activeOffers.length);
  setText("inactiveOffersCount", inactiveOffers.length);
  setText("averageDiscount", `${getAverageDiscount()}%`);
}

function renderOfferGroups() {
  const activeContainer = document.getElementById("activeOffersGrid");
  const inactiveContainer = document.getElementById("inactiveOffersGrid");

  const activeOffers = offersState.offers.filter(offer => offer.estado === "activa");
  const inactiveOffers = offersState.offers.filter(offer => offer.estado !== "activa");

  renderOffersInContainer(activeContainer, activeOffers, "No hay ofertas activas.");
  renderOffersInContainer(inactiveContainer, inactiveOffers, "No hay ofertas inactivas.");
}

function renderOffersInContainer(container, offers, emptyMessage) {
  if (!container) return;

  container.innerHTML = "";

  if (offers.length === 0) {
    container.innerHTML = `
      <div class="empty-offers">
        ${emptyMessage}
      </div>
    `;
    return;
  }

  offers.forEach(offer => {
    const card = document.createElement("article");
    const expired = isExpired(offer.fecha_fin);
    const isActive = offer.estado === "activa";

    card.className = `offer-admin-card ${!isActive ? "inactive-offer" : ""}`;

    card.innerHTML = `
      <div class="offer-card-top">
        <div>
          <h3>${escapeHTML(offer.producto_nombre || "Producto")}</h3>
          <span class="discount-pill">-${getDiscount(offer.precio_original, offer.precio_oferta)}%</span>
          ${expired ? '<span class="expired-pill">Expirada</span>' : ""}
        </div>

        <button 
          class="offer-toggle ${isActive ? "active" : ""}"
          onclick="toggleOffer(${Number(offer.id_oferta)})"
          title="Activar o desactivar oferta"
        ></button>
      </div>

      <div class="offer-price-row">
        <span>Precio original:</span>
        <span class="old-price">${formatMoney(offer.precio_original)}</span>
      </div>

      <div class="offer-price-row">
        <span>Precio oferta:</span>
        <strong>${formatMoney(offer.precio_oferta)}</strong>
      </div>

      <div class="offer-valid-date ${expired ? "expired" : ""}">
        <span>📅 Válido hasta:</span>
        <span>${formatDate(offer.fecha_fin)}</span>
      </div>

      <div class="offer-card-actions">
        <button class="offer-edit-btn" onclick="editOffer(${Number(offer.id_oferta)})">
          ✎ Editar
        </button>

        <button class="offer-delete-btn" onclick="deleteOffer(${Number(offer.id_oferta)})">
          🗑
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function openOfferModal(offer = null) {
  const modal = document.getElementById("offerModal");
  const title = document.getElementById("offerModalTitle");
  const form = document.getElementById("offerForm");

  if (!modal) return;

  modal.classList.add("show");
  renderProductOptions();

  if (offer) {
    offersState.editingId = Number(offer.id_oferta);

    if (title) title.textContent = "Editar Oferta";

    document.getElementById("offerProductSelect").value = offer.id_producto || "";
    document.getElementById("offerOriginalPrice").value = Number(offer.precio_original || 0).toFixed(2);
    document.getElementById("offerPrice").value = Number(offer.precio_oferta || 0).toFixed(2);
    document.getElementById("offerValidUntil").value = normalizeDateInput(offer.fecha_fin);
    document.getElementById("offerActive").value = offer.estado || "activa";

  } else {
    offersState.editingId = null;

    if (title) title.textContent = "Nueva Oferta";
    if (form) form.reset();

    document.getElementById("offerOriginalPrice").value = "";
    document.getElementById("offerActive").value = "activa";
  }
}

function closeOfferModal() {
  const modal = document.getElementById("offerModal");
  const form = document.getElementById("offerForm");

  if (modal) modal.classList.remove("show");
  if (form) form.reset();

  offersState.editingId = null;
}

async function saveOffer() {
  const productSelect = document.getElementById("offerProductSelect");
  const originalPriceInput = document.getElementById("offerOriginalPrice");
  const offerPriceInput = document.getElementById("offerPrice");
  const validUntilInput = document.getElementById("offerValidUntil");
  const activeInput = document.getElementById("offerActive");

  const idProducto = Number(productSelect ? productSelect.value : 0);
  const originalPrice = Number(originalPriceInput ? originalPriceInput.value : 0);
  const offerPrice = Number(offerPriceInput ? offerPriceInput.value : 0);
  const validUntil = validUntilInput ? validUntilInput.value : "";
  const estado = activeInput ? activeInput.value : "activa";

  if (!idProducto) {
    alert("Selecciona un producto registrado en la base de datos.");
    return;
  }

  if (!validUntil) {
    alert("Selecciona la fecha de vencimiento de la oferta.");
    return;
  }

  if (originalPrice <= 0 || Number.isNaN(originalPrice)) {
    alert("El precio original no es válido.");
    return;
  }

  if (offerPrice <= 0 || Number.isNaN(offerPrice)) {
    alert("El precio de oferta no es válido.");
    return;
  }

  if (offerPrice >= originalPrice) {
    alert("El precio de oferta debe ser menor que el precio original.");
    return;
  }

  const payload = {
    id_oferta: offersState.editingId,
    id_producto: idProducto,
    precio_original: originalPrice,
    precio_oferta: offerPrice,
    fecha_fin: validUntil,
    estado: estado
  };

  const method = offersState.editingId ? "PUT" : "POST";

  try {
    const response = await fetch(OFFERS_API_URL, {
      method: method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error("Respuesta cruda de ofertas.php:", text);
      throw new Error("ofertas.php no devolvió JSON válido al guardar.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo guardar la oferta.");
    }

    closeOfferModal();
    await loadOffers();

  } catch (error) {
    console.error("Error guardando oferta:", error);
    alert("No se pudo guardar la oferta: " + error.message);
  }
}

function editOffer(id) {
  const offer = offersState.offers.find(item => {
    return Number(item.id_oferta) === Number(id);
  });

  if (offer) {
    openOfferModal(offer);
  }
}

async function deleteOffer(id) {
  const confirmed = confirm("¿Seguro que deseas eliminar esta oferta?");

  if (!confirmed) return;

  try {
    const response = await fetch(`${OFFERS_API_URL}?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error("Respuesta cruda de ofertas.php:", text);
      throw new Error("ofertas.php no devolvió JSON válido al eliminar.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo eliminar la oferta.");
    }

    await loadOffers();

  } catch (error) {
    console.error("Error eliminando oferta:", error);
    alert("No se pudo eliminar la oferta: " + error.message);
  }
}

async function toggleOffer(id) {
  const offer = offersState.offers.find(item => {
    return Number(item.id_oferta) === Number(id);
  });

  if (!offer) return;

  const nuevoEstado = offer.estado === "activa" ? "inactiva" : "activa";

  try {
    const response = await fetch(OFFERS_API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id_oferta: Number(offer.id_oferta),
        id_producto: Number(offer.id_producto),
        precio_original: Number(offer.precio_original),
        precio_oferta: Number(offer.precio_oferta),
        fecha_fin: normalizeDateInput(offer.fecha_fin),
        estado: nuevoEstado
      })
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error("Respuesta cruda de ofertas.php:", text);
      throw new Error("ofertas.php no devolvió JSON válido al cambiar estado.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo cambiar el estado.");
    }

    await loadOffers();

  } catch (error) {
    console.error("Error cambiando estado:", error);
    alert("No se pudo cambiar el estado: " + error.message);
  }
}

function validateOfferPrices() {
  const originalPrice = Number(document.getElementById("offerOriginalPrice").value);
  const offerPrice = Number(document.getElementById("offerPrice").value);
  const offerPriceInput = document.getElementById("offerPrice");

  if (!offerPriceInput) return;

  if (originalPrice > 0 && offerPrice >= originalPrice) {
    offerPriceInput.setCustomValidity(
      "El precio de oferta debe ser menor que el precio original."
    );
  } else {
    offerPriceInput.setCustomValidity("");
  }
}

function getSelectedProduct() {
  const productSelect = document.getElementById("offerProductSelect");

  if (!productSelect) return null;

  const idProducto = Number(productSelect.value);

  return offersState.products.find(product => {
    return Number(product.id_producto) === idProducto;
  });
}

function getDiscount(originalPrice, offerPrice) {
  originalPrice = Number(originalPrice || 0);
  offerPrice = Number(offerPrice || 0);

  if (originalPrice <= 0) return 0;

  return Math.max(0, Math.round(((originalPrice - offerPrice) / originalPrice) * 100));
}

function getAverageDiscount() {
  if (offersState.offers.length === 0) return 0;

  const totalDiscount = offersState.offers.reduce((total, offer) => {
    return total + getDiscount(offer.precio_original, offer.precio_oferta);
  }, 0);

  return Math.round(totalDiscount / offersState.offers.length);
}

function isExpired(dateValue) {
  if (!dateValue) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validDate = new Date(String(dateValue).slice(0, 10) + "T00:00:00");
  validDate.setHours(0, 0, 0, 0);

  return validDate < today;
}

function normalizeDateInput(dateValue) {
  if (!dateValue) return "";

  return String(dateValue).slice(0, 10);
}

function formatMoney(value) {
  return "$" + Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(String(dateValue).slice(0, 10) + "T00:00:00");

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function renderSidebarBadges() {
  setText("sidebarOrders", "0");
  setText("sidebarClients", "0");
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