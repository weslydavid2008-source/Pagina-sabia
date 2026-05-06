const ADMIN_AUTH_API_URL = "api/auth.php";

let adminActual = null;

document.addEventListener("DOMContentLoaded", async () => {
  await cargarAdministradorActual();
  configurarEventosAdministrador();
});

async function cargarAdministradorActual() {
  try {
    const respuesta = await fetch(`${ADMIN_AUTH_API_URL}?accion=me`, {
      credentials: "include"
    });

    const datos = await respuesta.json();

    if (!datos.ok || !datos.logueado || !datos.usuario) {
      limpiarDatosAdmin();
      return;
    }

    adminActual = datos.usuario;

    pintarDatosAdmin();
  } catch (error) {
    console.error("Error cargando administrador:", error);
    limpiarDatosAdmin();
  }
}

function pintarDatosAdmin() {
  if (!adminActual) return;

  const nombreCompleto = `${adminActual.nombre || ""} ${adminActual.apellido || ""}`.trim();
  const correo = adminActual.correo || "Sin correo";
  const rol = adminActual.rol || "Administrador";

  const adminAvatar = document.getElementById("adminAvatar");
  const adminName = document.getElementById("adminName");
  const adminEmail = document.getElementById("adminEmail");

  if (adminAvatar) {
    adminAvatar.textContent = obtenerIniciales(nombreCompleto || correo);
  }

  if (adminName) {
    adminName.textContent = rol;
  }

  if (adminEmail) {
    adminEmail.textContent = correo;
    adminEmail.title = correo;
  }

  llenarModalPerfilAdmin();
}

function limpiarDatosAdmin() {
  const adminAvatar = document.getElementById("adminAvatar");
  const adminName = document.getElementById("adminName");
  const adminEmail = document.getElementById("adminEmail");

  if (adminAvatar) adminAvatar.textContent = "AD";
  if (adminName) adminName.textContent = "Administrador";
  if (adminEmail) adminEmail.textContent = "Sin sesión";
}

function configurarEventosAdministrador() {
  const openAdminProfile = document.getElementById("openAdminProfile");
  const closeAdminProfile = document.getElementById("closeAdminProfile");
  const closeAdminProfileBtn = document.getElementById("closeAdminProfileBtn");
  const adminProfileModal = document.getElementById("adminProfileModal");

  if (openAdminProfile) {
    openAdminProfile.addEventListener("click", () => {
      if (!adminActual) {
        alert("No hay una sesión iniciada.");
        return;
      }

      llenarModalPerfilAdmin();

      if (adminProfileModal) {
        adminProfileModal.classList.add("show");
      }
    });
  }

  if (closeAdminProfile) {
    closeAdminProfile.addEventListener("click", cerrarModalPerfilAdmin);
  }

  if (closeAdminProfileBtn) {
    closeAdminProfileBtn.addEventListener("click", cerrarModalPerfilAdmin);
  }

  if (adminProfileModal) {
    adminProfileModal.addEventListener("click", event => {
      if (event.target.id === "adminProfileModal") {
        cerrarModalPerfilAdmin();
      }
    });
  }
}

function cerrarModalPerfilAdmin() {
  const adminProfileModal = document.getElementById("adminProfileModal");

  if (adminProfileModal) {
    adminProfileModal.classList.remove("show");
  }
}

function llenarModalPerfilAdmin() {
  if (!adminActual) return;

  colocarTexto("adminProfileAvatar", obtenerIniciales(`${adminActual.nombre || ""} ${adminActual.apellido || ""}`.trim() || adminActual.correo));
  colocarTexto("adminProfileFullName", `${adminActual.nombre || ""} ${adminActual.apellido || ""}`.trim() || "Administrador");
  colocarTexto("adminProfileRole", adminActual.rol || "Administrador");

  colocarValor("adminProfileName", adminActual.nombre || "");
  colocarValor("adminProfileLastName", adminActual.apellido || "");
  colocarValor("adminProfileDocument", adminActual.documento || "");
  colocarValor("adminProfileEmail", adminActual.correo || "");
  colocarValor("adminProfilePhone", adminActual.telefono || "");
  colocarValor("adminProfileGender", obtenerNombreGenero(adminActual.genero || adminActual.id_genero));
  colocarValor("adminProfileNeighborhood", adminActual.barrio || adminActual.id_barrio || "");
  colocarValor("adminProfileAddress", adminActual.direccion || "");
  colocarValor("adminProfileRoleInput", adminActual.rol || "Administrador");
}

function colocarTexto(id, texto) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = texto;
  }
}

function colocarValor(id, valor) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.value = valor;
  }
}

function obtenerIniciales(texto) {
  const limpio = String(texto || "").trim();

  if (!limpio) return "AD";

  const partes = limpio.split(/\s+/);

  if (partes.length === 1) {
    return partes[0].substring(0, 2).toUpperCase();
  }

  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}
function obtenerNombreGenero(valor) {
  const generos = {
    "1": "Masculino",
    "2": "Femenino",
    "3": "No binario / X",
    "4": "Tercer género",
    "5": "Intersexual / indeterminado",
    "6": "Otro"
  };

  if (!valor) {
    return "Sin género";
  }

  return generos[String(valor)] || valor;
}
/* =========================================================
   BOTÓN MODO OSCURO / CLARO GLOBAL DEL PANEL ADMIN
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  crearBotonTemaAdmin();
  aplicarTemaGuardado();
});

function crearBotonTemaAdmin() {
  const sidebar = document.querySelector(".sidebar");

  if (!sidebar) return;

  if (document.getElementById("themeToggleAdmin")) return;

  const themeButton = document.createElement("button");
  themeButton.type = "button";
  themeButton.id = "themeToggleAdmin";
  themeButton.className = "theme-toggle-admin";
  themeButton.setAttribute("aria-label", "Cambiar tema");

  themeButton.innerHTML = `
    <span class="theme-toggle-icon sun-icon">☀️</span>
    <span class="theme-toggle-icon moon-icon">🌙</span>
    <span class="theme-toggle-thumb"></span>
  `;

  const profileButton = document.getElementById("openAdminProfile");

  if (profileButton) {
    profileButton.insertAdjacentElement("afterend", themeButton);
  } else {
    sidebar.prepend(themeButton);
  }

  themeButton.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");

    localStorage.setItem("admin_theme", isDark ? "dark" : "light");

    actualizarEstadoBotonTema();
  });
}

function aplicarTemaGuardado() {
  const savedTheme = localStorage.getItem("admin_theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  } else {
    document.body.classList.remove("dark-theme");
  }

  actualizarEstadoBotonTema();
}

function actualizarEstadoBotonTema() {
  const themeButton = document.getElementById("themeToggleAdmin");

  if (!themeButton) return;

  const isDark = document.body.classList.contains("dark-theme");

  themeButton.classList.toggle("active", isDark);
}
/* =========================================================
   ICONOS LINEALES DEL MENÚ ADMIN
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  aplicarIconosMenuAdmin();
});

function aplicarIconosMenuAdmin() {
  const menuLinks = document.querySelectorAll(".sidebar .menu a");

  if (!menuLinks.length) return;

  const menuData = {
    "index.html": {
      label: "Inicio",
      icon: iconHome()
    },
    "productos.html": {
      label: "Productos",
      icon: iconBox()
    },
    "pedidos.html": {
      label: "Pedidos",
      icon: iconCart()
    },
    "ofertas.html": {
      label: "Ofertas",
      icon: iconTag()
    },
    "clientes.html": {
      label: "Clientes",
      icon: iconUsers()
    },
    "estadisticas.html": {
      label: "Estadísticas",
      icon: iconChart()
    },
    "inventario.html": {
      label: "Inventario",
      icon: iconInventory()
    },
    "compras.html": {
      label: "Compras",
      icon: iconReceipt()
    },
    "configuracion.html": {
      label: "Configuración",
      icon: iconSettings()
    }
  };

  menuLinks.forEach(link => {
    const href = link.getAttribute("href") || "";
    const fileName = href.split("/").pop();
    const item = menuData[fileName];

    if (!item) return;

    const badge = link.querySelector(".badge");
    const badgeText = badge ? badge.textContent.trim() : null;
    const isActive = link.classList.contains("active");

    link.innerHTML = `
      <span class="menu-link-left">
        ${item.icon}
        <span class="menu-label">${item.label}</span>
      </span>
      ${badgeText !== null ? `<span class="badge">${badgeText}</span>` : ""}
    `;

    if (isActive) {
      link.classList.add("active");
    }
  });
}

function iconHome() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <path d="M3 10.5L12 3l9 7.5"></path>
      <path d="M5 9.5V21h14V9.5"></path>
      <path d="M9 21v-6h6v6"></path>
    </svg>
  `;
}

function iconBox() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <path d="M21 8l-9-5-9 5 9 5 9-5z"></path>
      <path d="M3 8v8l9 5 9-5V8"></path>
      <path d="M12 13v8"></path>
    </svg>
  `;
}

function iconCart() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L23 6H6"></path>
    </svg>
  `;
}

function iconTag() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <path d="M20.5 13.5L13.5 20.5a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8z"></path>
      <circle cx="7.5" cy="7.5" r="1"></circle>
    </svg>
  `;
}

function iconUsers() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
      <circle cx="10" cy="7" r="4"></circle>
      <path d="M21 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  `;
}

function iconChart() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <path d="M3 3v18h18"></path>
      <path d="M8 17V9"></path>
      <path d="M13 17V5"></path>
      <path d="M18 17v-6"></path>
    </svg>
  `;
}

function iconInventory() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <path d="M12 3l4 2.3v4.6l-4 2.3-4-2.3V5.3L12 3z"></path>
      <path d="M5 12l4 2.3v4.6L5 21l-4-2.1v-4.6L5 12z"></path>
      <path d="M19 12l4 2.3v4.6L19 21l-4-2.1v-4.6L19 12z"></path>
    </svg>
  `;
}

function iconReceipt() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path>
      <path d="M8 7h8"></path>
      <path d="M8 11h8"></path>
      <path d="M8 15h5"></path>
    </svg>
  `;
}

function iconSettings() {
  return `
    <svg class="menu-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 20 7.1l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>
    </svg>
  `;
}
/* =========================================================
   ICONOS LINEALES EN ENCABEZADOS Y TARJETAS RESUMEN
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  aplicarIconosEncabezadosAdmin();
  aplicarIconosResumenAdmin();
});

function aplicarIconosEncabezadosAdmin() {
  const titleIcon = document.querySelector(".title-icon");
  const titleText = document.querySelector(".title-box h1")?.textContent.trim();

  if (!titleIcon || !titleText) return;

  const iconsByTitle = {
    "Inicio": "home",
    "Productos": "box",
    "Pedidos": "cart",
    "Ofertas": "tag",
    "Clientes": "users",
    "Estadísticas": "chart",
    "Inventario": "inventory",
    "Compras": "receipt",
    "Configuración": "settings"
  };

  const iconName = iconsByTitle[titleText];

  if (!iconName) return;

  titleIcon.innerHTML = adminLineIcon(iconName);
  titleIcon.classList.add("line-title-icon");
}

function aplicarIconosResumenAdmin() {
  document.querySelectorAll(".offer-summary-icon").forEach(iconBox => {
    const card = iconBox.closest(".offer-summary-card");
    const label = card?.querySelector("p")?.textContent.trim().toLowerCase() || "";

    if (label.includes("descuento")) {
      iconBox.innerHTML = adminLineIcon("percent");
    } else {
      iconBox.innerHTML = adminLineIcon("tag");
    }

    iconBox.classList.add("line-summary-icon");
  });

  document.querySelectorAll(".inventory-icon").forEach(iconBox => {
    const card = iconBox.closest(".inventory-card");
    const label = card?.querySelector("p")?.textContent.trim().toLowerCase() || "";

    if (label.includes("normal")) {
      iconBox.innerHTML = adminLineIcon("check");
    } else if (label.includes("bajo")) {
      iconBox.innerHTML = adminLineIcon("alert");
    } else if (label.includes("crítico") || label.includes("critico")) {
      iconBox.innerHTML = adminLineIcon("x");
    } else if (label.includes("exceso")) {
      iconBox.innerHTML = adminLineIcon("arrowUp");
    } else {
      iconBox.innerHTML = adminLineIcon("box");
    }

    iconBox.classList.add("line-summary-icon");
  });

  document.querySelectorAll(".analytics-icon").forEach(iconBox => {
    const card = iconBox.closest(".analytics-card");
    const label = card?.querySelector("p")?.textContent.trim().toLowerCase() || "";

    if (label.includes("ventas")) {
      iconBox.innerHTML = adminLineIcon("money");
    } else if (label.includes("pedidos")) {
      iconBox.innerHTML = adminLineIcon("cart");
    } else if (label.includes("ticket")) {
      iconBox.innerHTML = adminLineIcon("trend");
    } else if (label.includes("clientes")) {
      iconBox.innerHTML = adminLineIcon("users");
    }

    iconBox.classList.add("line-summary-icon");
  });
}

function adminLineIcon(name) {
  const icons = {
    home: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M3 10.5L12 3l9 7.5"></path>
        <path d="M5 9.5V21h14V9.5"></path>
        <path d="M9 21v-6h6v6"></path>
      </svg>
    `,

    box: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M21 8l-9-5-9 5 9 5 9-5z"></path>
        <path d="M3 8v8l9 5 9-5V8"></path>
        <path d="M12 13v8"></path>
      </svg>
    `,

    cart: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L23 6H6"></path>
      </svg>
    `,

    tag: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M20.5 13.5L13.5 20.5a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8z"></path>
        <circle cx="7.5" cy="7.5" r="1"></circle>
      </svg>
    `,

    users: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
        <circle cx="10" cy="7" r="4"></circle>
        <path d="M21 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    `,

    chart: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M3 3v18h18"></path>
        <path d="M8 17V9"></path>
        <path d="M13 17V5"></path>
        <path d="M18 17v-6"></path>
      </svg>
    `,

    inventory: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M12 3l4 2.3v4.6l-4 2.3-4-2.3V5.3L12 3z"></path>
        <path d="M5 12l4 2.3v4.6L5 21l-4-2.1v-4.6L5 12z"></path>
        <path d="M19 12l4 2.3v4.6L19 21l-4-2.1v-4.6L19 12z"></path>
      </svg>
    `,

    receipt: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path>
        <path d="M8 7h8"></path>
        <path d="M8 11h8"></path>
        <path d="M8 15h5"></path>
      </svg>
    `,

    settings: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 20 7.1l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>
      </svg>
    `,

    percent: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M19 5L5 19"></path>
        <circle cx="7" cy="7" r="2"></circle>
        <circle cx="17" cy="17" r="2"></circle>
      </svg>
    `,

    check: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
    `,

    alert: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M10.3 4.3L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"></path>
        <path d="M12 9v4"></path>
        <path d="M12 17h.01"></path>
      </svg>
    `,

    x: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M18 6L6 18"></path>
        <path d="M6 6l12 12"></path>
      </svg>
    `,

    arrowUp: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M7 17L17 7"></path>
        <path d="M8 7h9v9"></path>
      </svg>
    `,

    money: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M12 1v22"></path>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    `,

    trend: `
      <svg class="admin-line-svg" viewBox="0 0 24 24">
        <path d="M3 17l6-6 4 4 8-8"></path>
        <path d="M14 7h7v7"></path>
      </svg>
    `,
    userPlus: `
  <svg class="admin-line-svg" viewBox="0 0 24 24">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M19 8v6"></path>
    <path d="M16 11h6"></path>
  </svg>
`,
  };

  return icons[name] || icons.box;
}
/* =========================================================
   ICONOS LINEALES EN TARJETAS RESUMEN DE CLIENTES
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  aplicarIconosResumenClientes();

  setTimeout(() => {
    aplicarIconosResumenClientes();
  }, 300);
});

function aplicarIconosResumenClientes() {
  document.querySelectorAll(".client-summary-icon").forEach(iconBox => {
    const card = iconBox.closest(".client-summary-card");
    const label = card?.querySelector("p")?.textContent.trim().toLowerCase() || "";

    if (label.includes("total clientes")) {
      iconBox.innerHTML = adminLineIcon("users");
    } else if (label.includes("total ventas")) {
      iconBox.innerHTML = adminLineIcon("money");
    } else if (label.includes("total pedidos")) {
      iconBox.innerHTML = adminLineIcon("cart");
    } else if (label.includes("nuevos")) {
      iconBox.innerHTML = adminLineIcon("userPlus");
    }

    iconBox.classList.add("line-summary-icon");
  });
}