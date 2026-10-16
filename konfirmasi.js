const DRAFT_KEY = "sosialisasi.employeeDraft";
const LISTS = {
  hadir: { label: "Daftar Hadir", defaults: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "No. WhatsApp", "Tanda Tangan"] },
  souvenir: { label: "Suvenir", defaults: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "Tanda Tangan"] },
  uang_saku: { label: "Uang Saku", defaults: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "Nominal Uang Saku", "Nama Bank", "Nomor Rekening", "Nama Rekening", "Tanda Tangan"] },
};
const saveButton = document.querySelector("#confirm-event");
const saveError = document.querySelector("#save-error");
let draft;
let columns;

try {
  draft = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) draft = {};
  draft.selectedLists = window.SosialisasiApp.getSelectedLists();
  draft.event = window.SosialisasiApp.getEventData();
  columns = window.SosialisasiApp.getColumns();
  draft.selectedLists = Array.isArray(draft.selectedLists) ? draft.selectedLists : [];
  draft.event = draft.event && typeof draft.event === "object" ? draft.event : {};
  if (localStorage.getItem("role") !== "pegawai") {
    window.location.replace("index.html");
  } else if (!Array.isArray(draft.selectedLists) || draft.selectedLists.length === 0) {
    window.location.replace("pilih-daftar.html");
  } else if (!draft.event?.name || !draft.event?.date || !draft.event?.time || !draft.event?.location) {
    window.location.replace("informasi-kegiatan.html");
  }
} catch (error) {
  console.error("Ringkasan kegiatan tidak dapat dibaca.", error);
  draft = { selectedLists: [], event: {}, columns: {} };
  columns = {};
  window.location.replace("index.html");
}
draft.selectedLists = Array.isArray(draft.selectedLists) ? draft.selectedLists : [];
draft.event = draft.event && typeof draft.event === "object" ? draft.event : {};
columns = columns && typeof columns === "object" ? columns : {};

function formatDate(dateValue) {
  return window.SosialisasiApp.formatDate(dateValue) || "—";
}

function getColumnEntries(key) {
  const saved = columns[key];
  if (Array.isArray(saved) && saved.length) {
    return saved
      .map((column) => typeof column === "string"
        ? { name: column, enabled: true }
        : { name: column.name, enabled: column.enabled !== false })
      .filter((column) => column.name);
  }
  const custom = Array.isArray(draft.columns?.[key]) ? draft.columns[key] : [];
  return [...LISTS[key].defaults, ...custom].map((name) => ({ name, enabled: true }));
}

function addEventValue(parent, label, value) {
  const item = document.createElement("div");
  item.className = "event-summary-item";
  const caption = document.createElement("span");
  caption.textContent = label;
  const content = document.createElement("strong");
  content.textContent = value || "—";
  item.append(caption, content);
  parent.append(item);
}

function renderLists() {
  const badges = document.querySelector("#selected-list-badges");
  badges.replaceChildren();
  draft.selectedLists.filter((key) => Object.hasOwn(LISTS, key)).forEach((key) => {
    const badge = document.createElement("span");
    badge.className = `selected-list-badge ${key}`;
    badge.textContent = LISTS[key].label;
    badges.append(badge);
  });
}

function renderEvent() {
  const summary = document.querySelector("#event-summary");
  summary.replaceChildren();
  addEventValue(summary, "Nama Kegiatan", draft.event.name);
  addEventValue(summary, "Tanggal", formatDate(draft.event.date));
  addEventValue(summary, "Waktu", draft.event.time);
  addEventValue(summary, "Tempat", draft.event.location);
  if (draft.selectedLists.includes("uang_saku")) {
    const amount = Number(draft.event.allowanceAmount);
    addEventValue(summary, "Nominal Uang Saku per Peserta",
      Number.isFinite(amount) && amount > 0
        ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)
        : "Belum ditentukan");
  }
}

function renderColumns() {
  const summary = document.querySelector("#column-summary");
  summary.replaceChildren();
  draft.selectedLists.filter((key) => Object.hasOwn(LISTS, key)).forEach((key) => {
    const card = document.createElement("section");
    card.className = `confirmation-list-card ${key}`;
    const heading = document.createElement("h3");
    heading.textContent = LISTS[key].label;
    const list = document.createElement("ul");
    getColumnEntries(key).filter((column) => column.enabled).forEach((column) => {
      const item = document.createElement("li");
      item.textContent = column.name;
      list.append(item);
    });
    if (!list.children.length) {
      const empty = document.createElement("li");
      empty.className = "no-active-columns";
      empty.textContent = "Tidak ada kolom aktif";
      list.append(empty);
    }
    card.append(heading, list);
    summary.append(card);
  });
}

function showSaveError(message) {
  saveError.textContent = message;
  saveError.hidden = false;
}

function setLoading(isLoading) {
  saveButton.disabled = isLoading;
  saveButton.setAttribute("aria-busy", String(isLoading));
  saveButton.querySelector(".save-button-label").textContent = isLoading ? "Menyimpan..." : "✓ Simpan";
  saveButton.classList.toggle("is-loading", isLoading);
}

saveButton.addEventListener("click", () => {
  saveError.hidden = true;
  saveError.textContent = "";
  setLoading(true);
  window.setTimeout(() => {
    try {
      window.SosialisasiApp.createEvent();
    } catch (error) {
      console.error("Kegiatan tidak dapat disimpan.", error);
      showSaveError(error.message || "Kegiatan tidak dapat disimpan. Coba lagi.");
      setLoading(false);
      return;
    }
    window.location.href = "berhasil.html";
  }, 350);
});

renderLists();
renderEvent();
renderColumns();
