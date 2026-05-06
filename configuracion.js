const settingsState = {
  settings: {
    storeName: "",
    storePhone: "",
    storeEmail: "",
    storeAddress: "",
    openingTime: "",
    closingTime: "",

    deliveryCost: "",
    minimumOrder: "",
    maxDistance: "",

    freeDelivery: false,
    pickup: false,
    scheduledDelivery: false,

    newOrders: false,
    lowStock: false,
    newClients: false,
    dailyReport: false,

    emailChannel: false,
    pushChannel: false,

    theme: "light",
    mainColor: "green",
    compactMode: false
  }
};

const SETTINGS_STORAGE_KEY = "admin_settings";
const ORDERS_STORAGE_KEY = "admin_orders";
const CLIENTS_STORAGE_KEY = "admin_clients";

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  setupSettingsEvents();
  fillSettingsForm();
  applyAppearance();
  renderSidebarBadges();
});

function setupSettingsEvents() {
  document.querySelectorAll(".config-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      changeTab(tab.dataset.tab);
    });
  });

  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettingsFromForm);

  setupSwitch("freeDeliverySwitch", "freeDelivery");
  setupSwitch("pickupSwitch", "pickup");
  setupSwitch("scheduledDeliverySwitch", "scheduledDelivery");

  setupSwitch("newOrdersSwitch", "newOrders");
  setupSwitch("lowStockSwitch", "lowStock");
  setupSwitch("newClientsSwitch", "newClients");
  setupSwitch("dailyReportSwitch", "dailyReport");

  setupSwitch("emailChannelSwitch", "emailChannel");
  setupSwitch("pushChannelSwitch", "pushChannel");

  setupSwitch("compactModeSwitch", "compactMode");

  document.getElementById("themeSelect").addEventListener("change", event => {
    settingsState.settings.theme = event.target.value;
    applyAppearance();
  });

  document.getElementById("mainColorSelect").addEventListener("change", event => {
    settingsState.settings.mainColor = event.target.value;
    applyAppearance();
  });

  document.querySelectorAll("[data-security]").forEach(button => {
    button.addEventListener("click", () => {
      openSecurityModal(button.dataset.security);
    });
  });

  document.getElementById("closeSettingsModal").addEventListener("click", closeSettingsModal);
  document.getElementById("acceptSettingsModal").addEventListener("click", closeSettingsModal);

  document.getElementById("settingsModal").addEventListener("click", event => {
    if (event.target.id === "settingsModal") {
      closeSettingsModal();
    }
  });
}

function loadSettings() {
  const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

  if (savedSettings) {
    settingsState.settings = {
      ...settingsState.settings,
      ...JSON.parse(savedSettings)
    };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsState.settings));
}

function fillSettingsForm() {
  const settings = settingsState.settings;

  document.getElementById("storeName").value = settings.storeName;
  document.getElementById("storePhone").value = settings.storePhone;
  document.getElementById("storeEmail").value = settings.storeEmail;
  document.getElementById("storeAddress").value = settings.storeAddress;
  document.getElementById("openingTime").value = settings.openingTime;
  document.getElementById("closingTime").value = settings.closingTime;

  document.getElementById("deliveryCost").value = settings.deliveryCost;
  document.getElementById("minimumOrder").value = settings.minimumOrder;
  document.getElementById("maxDistance").value = settings.maxDistance;

  document.getElementById("themeSelect").value = settings.theme;
  document.getElementById("mainColorSelect").value = settings.mainColor;

  refreshSwitches();
}

function saveSettingsFromForm() {
  const settings = settingsState.settings;

  settings.storeName = document.getElementById("storeName").value.trim();
  settings.storePhone = document.getElementById("storePhone").value.trim();
  settings.storeEmail = document.getElementById("storeEmail").value.trim();
  settings.storeAddress = document.getElementById("storeAddress").value.trim();
  settings.openingTime = document.getElementById("openingTime").value;
  settings.closingTime = document.getElementById("closingTime").value;

  settings.deliveryCost = document.getElementById("deliveryCost").value;
  settings.minimumOrder = document.getElementById("minimumOrder").value;
  settings.maxDistance = document.getElementById("maxDistance").value;

  settings.theme = document.getElementById("themeSelect").value;
  settings.mainColor = document.getElementById("mainColorSelect").value;

  saveSettings();
  applyAppearance();
  showToast("Cambios guardados correctamente");
}

function changeTab(tabName) {
  document.querySelectorAll(".config-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  document.querySelectorAll(".config-content").forEach(content => {
    content.classList.remove("active");
  });

  document.getElementById(`tab-${tabName}`).classList.add("active");
}

function setupSwitch(elementId, settingKey) {
  const button = document.getElementById(elementId);

  button.addEventListener("click", () => {
    settingsState.settings[settingKey] = !settingsState.settings[settingKey];
    button.classList.toggle("active", settingsState.settings[settingKey]);

    if (settingKey === "compactMode") {
      applyAppearance();
    }
  });
}

function refreshSwitches() {
  const switches = {
    freeDeliverySwitch: "freeDelivery",
    pickupSwitch: "pickup",
    scheduledDeliverySwitch: "scheduledDelivery",

    newOrdersSwitch: "newOrders",
    lowStockSwitch: "lowStock",
    newClientsSwitch: "newClients",
    dailyReportSwitch: "dailyReport",

    emailChannelSwitch: "emailChannel",
    pushChannelSwitch: "pushChannel",

    compactModeSwitch: "compactMode"
  };

  Object.entries(switches).forEach(([elementId, settingKey]) => {
    const button = document.getElementById(elementId);

    if (button) {
      button.classList.toggle("active", Boolean(settingsState.settings[settingKey]));
    }
  });
}

function applyAppearance() {
  document.body.classList.remove(
    "dark-theme",
    "compact-mode",
    "color-green",
    "color-blue",
    "color-purple",
    "color-red"
  );

  if (settingsState.settings.theme === "dark") {
    document.body.classList.add("dark-theme");
  }

  if (settingsState.settings.compactMode) {
    document.body.classList.add("compact-mode");
  }

  document.body.classList.add(`color-${settingsState.settings.mainColor}`);
}

function openSecurityModal(type) {
  const title = document.getElementById("settingsModalTitle");
  const text = document.getElementById("settingsModalText");

  const messages = {
    twoFactor: {
      title: "Autenticación de dos factores",
      text: "Aquí podrás conectar un método de verificación cuando integres el backend."
    },
    password: {
      title: "Cambiar contraseña",
      text: "Esta opción quedará lista para conectarse con el sistema de usuarios."
    },
    sessions: {
      title: "Sesiones activas",
      text: "Aquí se mostrarán los dispositivos conectados cuando tengas autenticación real."
    }
  };

  title.textContent = messages[type].title;
  text.textContent = messages[type].text;

  document.getElementById("settingsModal").classList.add("show");
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.remove("show");
}

function showToast(message) {
  const oldToast = document.querySelector(".save-toast");

  if (oldToast) {
    oldToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = "save-toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

function renderSidebarBadges() {
  const savedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
  const savedClients = localStorage.getItem(CLIENTS_STORAGE_KEY);

  const orders = savedOrders ? JSON.parse(savedOrders) : [];
  const clients = savedClients ? JSON.parse(savedClients) : [];

  document.getElementById("sidebarOrders").textContent = orders.length;
  document.getElementById("sidebarClients").textContent = clients.length;
}