const clientsState = {
  clients: [],
  genders: [],
  neighborhoods: [],
  editingId: null,
  selectedClientId: null
};

const CLIENTS_API_URL = "api/clientes.php";
const GENDERS_API_URL = "api/generos.php";
const NEIGHBORHOODS_API_URL = "api/barrios.php";

document.addEventListener("DOMContentLoaded", async () => {
  setupClientsEvents();
  await loadGenders();
  await loadNeighborhoods();
  await loadClients();
});

function setupClientsEvents() {
  const openClientModal = document.getElementById("openClientModal");
  const closeClientModalBtn = document.getElementById("closeClientModal");
  const cancelClientModal = document.getElementById("cancelClientModal");
  const clientModal = document.getElementById("clientModal");
  const clientForm = document.getElementById("clientForm");
  const clientSearch = document.getElementById("clientSearch");
  const closeClientDetailModalBtn = document.getElementById("closeClientDetailModal");
  const clientDetailModal = document.getElementById("clientDetailModal");

  if (openClientModal) {
    openClientModal.addEventListener("click", () => {
      openClientModalForm();
    });
  }

  if (closeClientModalBtn) {
    closeClientModalBtn.addEventListener("click", closeClientModal);
  }

  if (cancelClientModal) {
    cancelClientModal.addEventListener("click", closeClientModal);
  }

  if (clientModal) {
    clientModal.addEventListener("click", event => {
      if (event.target.id === "clientModal") {
        closeClientModal();
      }
    });
  }

  if (clientForm) {
    clientForm.addEventListener("submit", async event => {
      event.preventDefault();
      await saveClient();
    });
  }

  if (clientSearch) {
    clientSearch.addEventListener("input", renderClientsPage);
  }

  if (closeClientDetailModalBtn) {
    closeClientDetailModalBtn.addEventListener("click", closeClientDetailModal);
  }

  if (clientDetailModal) {
    clientDetailModal.addEventListener("click", event => {
      if (event.target.id === "clientDetailModal") {
        closeClientDetailModal();
      }
    });
  }
}

async function loadClients() {
  try {
    const response = await fetch(CLIENTS_API_URL);
    const text = await response.text();

    console.log("Respuesta cruda de clientes.php:", text);

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("clientes.php no devolvió JSON válido.");
    }

    if (!response.ok) {
      throw new Error(data.mensaje || "Error HTTP al cargar clientes.");
    }

    if (!Array.isArray(data)) {
      throw new Error(data.mensaje || "La API no devolvió una lista de clientes.");
    }

    clientsState.clients = data;
    renderClientsPage();

  } catch (error) {
    console.error("Error cargando clientes:", error);
    alert("No se pudieron cargar los clientes desde MySQL: " + error.message);
  }
}

async function loadGenders() {
  try {
    const response = await fetch(GENDERS_API_URL);
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("generos.php no devolvió JSON válido.");
    }

    if (!response.ok) {
      throw new Error(data.mensaje || "Error al cargar géneros.");
    }

    clientsState.genders = Array.isArray(data) ? data : [];
    renderGenderOptions();

  } catch (error) {
    console.error("Error cargando géneros:", error);
    clientsState.genders = [];
    renderGenderOptions();
  }
}

async function loadNeighborhoods() {
  try {
    const response = await fetch(NEIGHBORHOODS_API_URL);
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("barrios.php no devolvió JSON válido.");
    }

    if (!response.ok) {
      throw new Error(data.mensaje || "Error al cargar barrios.");
    }

    clientsState.neighborhoods = Array.isArray(data) ? data : [];
    renderNeighborhoodOptions();

  } catch (error) {
    console.error("Error cargando barrios:", error);
    clientsState.neighborhoods = [];
    renderNeighborhoodOptions();
  }
}

function renderGenderOptions() {
  const select = document.getElementById("clientGender");

  if (!select) return;

  select.innerHTML = `<option value="">Sin género</option>`;

  clientsState.genders.forEach(gender => {
    const option = document.createElement("option");
    option.value = gender.id_genero;
    option.textContent = gender.genero;
    select.appendChild(option);
  });
}

function renderNeighborhoodOptions() {
  const select = document.getElementById("clientNeighborhood");

  if (!select) return;

  select.innerHTML = `<option value="">Sin barrio</option>`;

  clientsState.neighborhoods.forEach(neighborhood => {
    const option = document.createElement("option");
    option.value = neighborhood.id_barrio;
    option.textContent = neighborhood.nombre;
    select.appendChild(option);
  });
}

function renderClientsPage() {
  renderSummaryCards();
  renderClientsGrid();
  renderSidebarBadges();
}

function renderSummaryCards() {
  const totalClients = clientsState.clients.length;

  const totalOrders = clientsState.clients.reduce((sum, client) => {
    return sum + Number(client.total_pedidos || 0);
  }, 0);

  const totalSales = clientsState.clients.reduce((sum, client) => {
    return sum + Number(client.total_gastado || 0);
  }, 0);

  const newClients = clientsState.clients.filter(client => {
    return isDateInCurrentMonth(client.fecha_registro);
  }).length;

  document.getElementById("totalClients").textContent = totalClients;
  document.getElementById("totalClientSales").textContent = formatMoney(totalSales);
  document.getElementById("totalClientOrders").textContent = totalOrders;
  document.getElementById("newClientsThisMonth").textContent = newClients;
}

function renderClientsGrid() {
  const grid = document.getElementById("clientsGrid");
  const filteredClients = getFilteredClients();

  if (!grid) return;

  grid.innerHTML = "";

  if (filteredClients.length === 0) {
    grid.innerHTML = `
      <div class="empty-clients">
        No hay clientes registrados.
      </div>
    `;
    return;
  }

  filteredClients.forEach(client => {
    const card = document.createElement("article");
    const fullName = getFullName(client);

    card.className = "client-card";

    card.innerHTML = `
      <div class="client-card-header">
        <div class="client-avatar">${getInitials(fullName)}</div>

        <div>
          <h3>${escapeHTML(fullName)}</h3>
          <p>🪪 ${escapeHTML(client.documento || "Sin documento")}</p>
          <p>✉ ${escapeHTML(client.correo || "Sin correo")}</p>
          <p>📞 ${escapeHTML(client.telefono || "Sin teléfono")}</p>
        </div>
      </div>

      <div class="client-card-extra">
        <p><strong>Barrio:</strong> ${escapeHTML(client.barrio || "Sin barrio")}</p>
        <p><strong>Género:</strong> ${escapeHTML(client.genero || "Sin género")}</p>
      </div>

      <div class="client-card-stats">
        <div>
          <p>Pedidos</p>
          <strong>${Number(client.total_pedidos || 0)}</strong>
        </div>

        <div>
          <p>Total gastado</p>
          <strong class="money">${formatMoney(client.total_gastado)}</strong>
        </div>
      </div>

      <div class="client-card-actions">
        <button class="client-view-btn" onclick="openClientDetail(${Number(client.id_cliente)})">
          👁 Ver
        </button>

        <button class="client-edit-btn" onclick="editClient(${Number(client.id_cliente)})">
          ✎
        </button>

        <button class="client-delete-btn" onclick="deleteClient(${Number(client.id_cliente)})">
          🗑
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

function getFilteredClients() {
  const searchInput = document.getElementById("clientSearch");
  const search = searchInput ? searchInput.value.trim().toLowerCase() : "";

  if (!search) return clientsState.clients;

  return clientsState.clients.filter(client => {
    const fullName = getFullName(client).toLowerCase();
    const document = String(client.documento || "").toLowerCase();
    const email = String(client.correo || "").toLowerCase();
    const phone = String(client.telefono || "").toLowerCase();
    const neighborhood = String(client.barrio || "").toLowerCase();
    const gender = String(client.genero || "").toLowerCase();

    return (
      fullName.includes(search) ||
      document.includes(search) ||
      email.includes(search) ||
      phone.includes(search) ||
      neighborhood.includes(search) ||
      gender.includes(search)
    );
  });
}

function openClientModalForm(client = null) {
  const modal = document.getElementById("clientModal");
  const title = document.getElementById("clientModalTitle");
  const form = document.getElementById("clientForm");

  if (!modal) return;

  modal.classList.add("show");

  if (client) {
    clientsState.editingId = Number(client.id_cliente);

    if (title) title.textContent = "Editar Cliente";

    document.getElementById("clientName").value = client.nombre || "";
    document.getElementById("clientLastName").value = client.apellido || "";
    document.getElementById("clientDocument").value = client.documento || "";
    document.getElementById("clientEmail").value = client.correo || "";
    document.getElementById("clientPhone").value = client.telefono || "";
    document.getElementById("clientAddress").value = client.direccion || "";
    document.getElementById("clientGender").value = client.id_genero || "";
    document.getElementById("clientNeighborhood").value = client.id_barrio || "";

  } else {
    clientsState.editingId = null;

    if (title) title.textContent = "Añadir Cliente";
    if (form) form.reset();

    document.getElementById("clientGender").value = "";
    document.getElementById("clientNeighborhood").value = "";
  }
}

function closeClientModal() {
  const modal = document.getElementById("clientModal");
  const form = document.getElementById("clientForm");

  if (modal) modal.classList.remove("show");
  if (form) form.reset();

  clientsState.editingId = null;
}

async function saveClient() {
  const nombre = document.getElementById("clientName").value.trim();
  const apellido = document.getElementById("clientLastName").value.trim();
  const documento = document.getElementById("clientDocument").value.trim();
  const correo = document.getElementById("clientEmail").value.trim();
  const telefono = document.getElementById("clientPhone").value.trim();
  const direccion = document.getElementById("clientAddress").value.trim();
  const idGenero = document.getElementById("clientGender").value;
  const idBarrio = document.getElementById("clientNeighborhood").value;

  if (!nombre) {
    alert("Completa el nombre del cliente.");
    return;
  }

  const clientData = {
    id_cliente: clientsState.editingId,
    nombre: nombre,
    apellido: apellido || null,
    documento: documento || null,
    correo: correo || null,
    telefono: telefono || null,
    direccion: direccion || null,
    id_genero: idGenero || null,
    id_barrio: idBarrio || null
  };

  const method = clientsState.editingId ? "PUT" : "POST";

  try {
    const response = await fetch(CLIENTS_API_URL, {
      method: method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(clientData)
    });

    const text = await response.text();

    console.log("Respuesta al guardar cliente:", text);

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("clientes.php no devolvió JSON válido al guardar.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo guardar el cliente.");
    }

    closeClientModal();
    await loadClients();

  } catch (error) {
    console.error("Error guardando cliente:", error);
    alert("No se pudo guardar el cliente: " + error.message);
  }
}

function editClient(id) {
  const client = clientsState.clients.find(item => {
    return Number(item.id_cliente) === Number(id);
  });

  if (client) {
    openClientModalForm(client);
  } else {
    alert("No se encontró el cliente seleccionado.");
  }
}

async function deleteClient(id) {
  const confirmed = confirm("¿Seguro que deseas eliminar este cliente?");

  if (!confirmed) return;

  try {
    const response = await fetch(`${CLIENTS_API_URL}?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    const text = await response.text();

    console.log("Respuesta al eliminar cliente:", text);

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("clientes.php no devolvió JSON válido al eliminar.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(result.mensaje || "No se pudo eliminar el cliente.");
    }

    await loadClients();

  } catch (error) {
    console.error("Error eliminando cliente:", error);
    alert("No se pudo eliminar el cliente: " + error.message);
  }
}

function openClientDetail(id) {
  const client = clientsState.clients.find(item => {
    return Number(item.id_cliente) === Number(id);
  });

  if (!client) return;

  clientsState.selectedClientId = id;

  const fullName = getFullName(client);
  const ordersCount = Number(client.total_pedidos || 0);
  const totalSpent = Number(client.total_gastado || 0);
  const average = ordersCount > 0 ? totalSpent / ordersCount : 0;

  document.getElementById("detailAvatar").textContent = getInitials(fullName);
  document.getElementById("detailName").textContent = fullName;
  document.getElementById("detailDocument").textContent = `🪪 Documento: ${client.documento || "Sin documento"}`;
  document.getElementById("detailEmail").textContent = `✉ ${client.correo || "Sin correo"}`;
  document.getElementById("detailPhone").textContent = `📞 ${client.telefono || "Sin teléfono"}`;
  document.getElementById("detailAddress").textContent = `📍 ${client.direccion || "Sin dirección"}`;
  document.getElementById("detailGender").textContent = `Género: ${client.genero || "Sin género"}`;
  document.getElementById("detailNeighborhood").textContent = `Barrio: ${client.barrio || "Sin barrio"}`;

  document.getElementById("detailOrdersCount").textContent = ordersCount;
  document.getElementById("detailTotalSpent").textContent = formatMoney(totalSpent);
  document.getElementById("detailAverage").textContent = formatMoney(average);

  document.getElementById("detailClientSince").textContent =
    `📅 Cliente desde: ${formatDateLong(client.fecha_registro)}`;

  document.getElementById("clientDetailModal").classList.add("show");
}

function closeClientDetailModal() {
  const modal = document.getElementById("clientDetailModal");

  if (modal) modal.classList.remove("show");

  clientsState.selectedClientId = null;
}

function getFullName(client) {
  return `${client.nombre || ""} ${client.apellido || ""}`.trim() || "Cliente";
}

function getInitials(name) {
  const parts = String(name || "CL").trim().split(" ").filter(Boolean);

  if (parts.length === 0) return "CL";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function isDateInCurrentMonth(dateValue) {
  if (!dateValue) return false;

  const date = new Date(dateValue.replace(" ", "T"));
  const today = new Date();

  if (isNaN(date.getTime())) return false;

  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function formatMoney(value) {
  return "$" + Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}
function formatDateLong(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(String(dateValue).replace(" ", "T"));

  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function renderSidebarBadges() {
  const sidebarOrders = document.getElementById("sidebarOrders");
  const sidebarClients = document.getElementById("sidebarClients");

  const totalOrders = clientsState.clients.reduce((sum, client) => {
    return sum + Number(client.total_pedidos || 0);
  }, 0);

  if (sidebarOrders) sidebarOrders.textContent = totalOrders;
  if (sidebarClients) sidebarClients.textContent = clientsState.clients.length;
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}