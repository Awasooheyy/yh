const DRAFT_KEY = "sosialisasi.employeeDraft";
const LISTS = {
  hadir: {
    label: "Daftar Hadir",
    theme: "attendance",
    defaults: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "No. WhatsApp", "Tanda Tangan"],
  },
  souvenir: {
    label: "Suvenir",
    theme: "souvenir",
    defaults: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "Tanda Tangan"],
  },
  uang_saku: {
    label: "Uang Saku",
    theme: "allowance",
    defaults: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "Nominal Uang Saku", "Nama Bank", "Nomor Rekening", "Nama Rekening", "Tanda Tangan"],
  },
};

const container = document.querySelector("#column-groups");
const errorBox = document.querySelector("#column-error");
const modal = document.querySelector("#column-modal");
const modalForm = document.querySelector("#column-modal-form");
const modalInput = document.querySelector("#new-column-name");
const modalError = document.querySelector("#column-modal-error");
let draft;
let columns;
let activeList = null;
let draggedColumn = null;

function normalizeListColumns(listKey, storedList) {
  const defaults = LISTS[listKey].defaults.map((name) => {
    const stored = Array.isArray(storedList)
      ? storedList.find((column) => (typeof column === "string" ? column : column?.name) === name)
      : null;
    return {
      name,
      enabled: stored && typeof stored === "object" ? stored.enabled !== false : true,
      isDefault: true,
    };
  });
  const custom = Array.isArray(storedList)
    ? storedList
      .map((column) => {
        if (typeof column === "string") {
          return LISTS[listKey].defaults.includes(column.trim())
            ? null
            : { name: column.trim(), enabled: true, isDefault: false };
        }
        if (!column || typeof column.name !== "string") return null;
        return LISTS[listKey].defaults.includes(column.name.trim())
          ? null
          : { name: column.name.trim(), enabled: column.enabled !== false, isDefault: false };
      })
      .filter((column) => column && column.name)
    : [];
  return [...defaults, ...custom];
}

try {
  draft = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  draft.selectedLists = window.SosialisasiApp.getSelectedLists();
  columns = window.SosialisasiApp.getColumns();
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) draft = {};
  draft.selectedLists = Array.isArray(draft.selectedLists) ? draft.selectedLists : [];
  draft.event = draft.event && typeof draft.event === "object" ? draft.event : {};
  if (localStorage.getItem("role") !== "pegawai") {
    window.location.replace("index.html");
  } else if (!Array.isArray(draft.selectedLists) || draft.selectedLists.length === 0) {
    window.location.replace("pilih-daftar.html");
  } else if (!draft.event || !draft.event.name) {
    window.location.replace("informasi-kegiatan.html");
  }
} catch (error) {
  console.error("Pengaturan kegiatan tidak dapat dibaca.", error);
  draft = { selectedLists: [], event: {}, columns: {} };
  columns = {};
  window.location.replace("index.html");
}
draft.selectedLists = Array.isArray(draft.selectedLists) ? draft.selectedLists : [];
draft.event = draft.event && typeof draft.event === "object" ? draft.event : {};
columns = columns && typeof columns === "object" ? columns : {};

Object.keys(LISTS).forEach((key) => {
  columns[key] = normalizeListColumns(key, columns[key]);
});

function formatDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

function saveColumns() {
  draft.columns = { hadir: [], souvenir: [], uang_saku: [] };
  Object.keys(LISTS).forEach((key) => {
    draft.columns[key] = columns[key].filter((column) => !column.isDefault).map((column) => column.name);
  });
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    window.SosialisasiApp.saveColumns(columns);
    return true;
  } catch (error) {
    console.error("Kolom daftar tidak dapat disimpan.", error);
    showError("Perubahan kolom tidak dapat disimpan. Aktifkan penyimpanan lokal browser.");
    return false;
  }
}

function renderColumns() {
  container.replaceChildren();
  draft.selectedLists.forEach((key) => {
    if (!Object.hasOwn(LISTS, key)) return;
    const config = LISTS[key];
    const listColumns = columns[key];
    const enabledCount = listColumns.filter((column) => column.enabled).length;

    const card = document.createElement("section");
    card.className = `column-card ${config.theme}`;
    card.dataset.list = key;

    const heading = document.createElement("div");
    heading.className = "column-card-heading";
    const identity = document.createElement("div");
    identity.className = "column-card-identity";
    const icon = document.createElement("span");
    icon.className = "column-card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = iconFor(key);
    const title = document.createElement("h2");
    title.textContent = config.label;
    identity.append(icon, title);
    const badge = document.createElement("span");
    badge.className = "column-count-badge";
    badge.textContent = `${enabledCount} kolom`;
    heading.append(identity, badge);

    const list = document.createElement("div");
    list.className = "column-checkbox-list";
    listColumns.forEach((column, index) => {
      const row = document.createElement("div");
      row.className = "column-checkbox-row";
      row.dataset.list = key;
      row.dataset.index = String(index);
      const dragHandle = document.createElement("button");
      dragHandle.className = "column-drag-handle";
      dragHandle.type = "button";
      dragHandle.draggable = true;
      dragHandle.setAttribute("aria-label", `Pindahkan kolom ${column.name} dengan tombol panah atas atau bawah`);
      dragHandle.title = "Seret untuk mengubah urutan";
      dragHandle.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>';
      const label = document.createElement("label");
      label.className = "column-checkbox-label";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = column.enabled;
      input.dataset.list = key;
      input.dataset.index = String(index);
      input.setAttribute("aria-label", `${column.name} pada ${config.label}`);
      const checkmark = document.createElement("span");
      checkmark.className = "column-checkmark";
      checkmark.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "column-name";
      name.textContent = column.name;
      if (column.isDefault) {
        const defaultLabel = document.createElement("span");
        defaultLabel.className = "column-default-label";
        defaultLabel.textContent = "Standar";
        label.append(input, checkmark, name, defaultLabel);
      } else {
        label.append(input, checkmark, name);
      }
      row.append(dragHandle, label);
      if (!column.isDefault) {
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-column-button";
        deleteButton.type = "button";
        deleteButton.dataset.deleteList = key;
        deleteButton.dataset.index = String(index);
        deleteButton.setAttribute("aria-label", `Hapus kolom ${column.name} dari ${config.label}`);
        deleteButton.title = `Hapus ${column.name}`;
        deleteButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.75 7h14.5M9.25 7V4.75h5.5V7m-8 0 .8 12.25h8.9L17.25 7M10 10.5v5.5m4-5.5v5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        row.append(deleteButton);
      }
      list.append(row);
    });

    const addButton = document.createElement("button");
    addButton.className = "add-column-trigger";
    addButton.type = "button";
    addButton.dataset.addList = key;
    addButton.innerHTML = '<span aria-hidden="true">＋</span> Tambah Kolom';
    card.append(heading, list, addButton);
    container.append(card);
  });

  if (!container.children.length) {
    const empty = document.createElement("p");
    empty.className = "column-setup-empty";
    empty.textContent = "Tidak ada daftar yang dipilih. Kembali dan pilih setidaknya satu daftar.";
    container.append(empty);
  }
}

function iconFor(key) {
  if (key === "hadir") {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a2.5 2.5 0 1 0 0-5M3.75 19a5.25 5.25 0 0 1 10.5 0M15 14a4.5 4.5 0 0 1 5.25 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }
  if (key === "souvenir") {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M4.75 10h14.5v9.25H4.75V10ZM3.75 6.75h16.5V10H3.75V6.75ZM12 6.75v12.5M12 6.75H8.75a2 2 0 1 1 2-2c0 1.1 1.25 2 1.25 2Zm0 0h3.25a2 2 0 1 0-2-2c0 1.1-1.25 2-1.25 2Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none"><rect x="3.75" y="5.25" width="16.5" height="13.5" rx="2.25" stroke="currentColor" stroke-width="1.7"/><path d="M3.75 9h16.5M8 14h3M16 13.5h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
}

function openModal(listKey) {
  activeList = listKey;
  modalForm.dataset.mode = "add-column";
  modalForm.dataset.columnIndex = "";
  clearError();
  modalError.hidden = true;
  modalError.textContent = "";
  modalInput.value = "";
  modalInput.required = true;
  document.querySelector("#column-modal-title").textContent = "Tambah Kolom";
  document.querySelector("#column-modal-submit").textContent = "Tambahkan";
  document.querySelector("#column-modal-description").textContent =
    `Tambahkan kolom baru untuk ${LISTS[listKey].label}.`;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  window.requestAnimationFrame(() => modalInput.focus());
}

function closeModal() {
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  activeList = null;
}

function reorderColumn(listKey, fromIndex, toIndex) {
  const listColumns = columns[listKey];
  if (!Array.isArray(listColumns) || fromIndex === toIndex
    || fromIndex < 0 || toIndex < 0
    || fromIndex >= listColumns.length || toIndex >= listColumns.length) return;

  const previousColumns = [...listColumns];
  const [column] = listColumns.splice(fromIndex, 1);
  listColumns.splice(toIndex, 0, column);
  clearError();
  if (saveColumns()) {
    renderColumns();
  } else {
    columns[listKey] = previousColumns;
    renderColumns();
  }
}

container.addEventListener("dragstart", (event) => {
  const handle = event.target.closest(".column-drag-handle");
  if (!handle) return;
  const row = handle.closest(".column-checkbox-row");
  draggedColumn = { list: row.dataset.list, index: Number(row.dataset.index) };
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", `${draggedColumn.list}:${draggedColumn.index}`);
});

container.addEventListener("dragover", (event) => {
  const row = event.target.closest(".column-checkbox-row");
  if (!draggedColumn || !row || row.dataset.list !== draggedColumn.list) return;
  event.preventDefault();
  container.querySelectorAll(".column-checkbox-row.is-drop-target").forEach((item) => {
    item.classList.remove("is-drop-target", "drop-before", "drop-after");
  });
  const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
  row.classList.add("is-drop-target", after ? "drop-after" : "drop-before");
  event.dataTransfer.dropEffect = "move";
});

container.addEventListener("drop", (event) => {
  const row = event.target.closest(".column-checkbox-row");
  if (!draggedColumn || !row || row.dataset.list !== draggedColumn.list) return;
  event.preventDefault();
  const targetIndex = Number(row.dataset.index);
  const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
  let insertIndex = targetIndex + (after ? 1 : 0);
  if (draggedColumn.index < insertIndex) insertIndex -= 1;
  reorderColumn(draggedColumn.list, draggedColumn.index, insertIndex);
  draggedColumn = null;
});

container.addEventListener("dragend", () => {
  draggedColumn = null;
  container.querySelectorAll(".column-checkbox-row").forEach((row) => {
    row.classList.remove("is-dragging", "is-drop-target", "drop-before", "drop-after");
  });
});

container.addEventListener("keydown", (event) => {
  const handle = event.target.closest(".column-drag-handle");
  if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  const row = handle.closest(".column-checkbox-row");
  const listKey = row.dataset.list;
  const fromIndex = Number(row.dataset.index);
  const toIndex = fromIndex + (event.key === "ArrowUp" ? -1 : 1);
  if (toIndex < 0 || toIndex >= columns[listKey].length) return;

  event.preventDefault();
  reorderColumn(listKey, fromIndex, toIndex);
  container.querySelector(
    `.column-checkbox-row[data-list="${listKey}"][data-index="${toIndex}"] .column-drag-handle`,
  )?.focus();
});

container.addEventListener("change", (event) => {
  const checkbox = event.target.closest('input[type="checkbox"][data-index]');
  if (!checkbox) return;
  const key = checkbox.dataset.list;
  const index = Number(checkbox.dataset.index);
  columns[key][index].enabled = checkbox.checked;
  clearError();
  if (saveColumns()) {
    const count = columns[key].filter((column) => column.enabled).length;
    container.querySelector(`[data-list="${key}"] .column-count-badge`).textContent = `${count} kolom`;
  }
});

container.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-list]");
  if (deleteButton) {
    const key = deleteButton.dataset.deleteList;
    const index = Number(deleteButton.dataset.index);
    const [removedColumn] = columns[key].splice(index, 1);
    clearError();
    if (saveColumns()) {
      renderColumns();
    } else {
      columns[key].splice(index, 0, removedColumn);
    }
    return;
  }
  const button = event.target.closest("[data-add-list]");
  if (button) openModal(button.dataset.addList);
});

document.querySelector("#column-modal-cancel").addEventListener("click", closeModal);
document.querySelector("#column-modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeModal();
});

modalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = modalInput.value.trim();
  if (!name || !activeList) {
    modalInput.focus();
    return;
  }
  const duplicate = columns[activeList].some(
    (column) => column.name.toLocaleLowerCase("id") === name.toLocaleLowerCase("id"),
  );
  if (duplicate) {
    modalError.textContent = `Kolom "${name}" sudah tersedia pada ${LISTS[activeList].label}.`;
    modalError.hidden = false;
    modalInput.focus();
    return;
  }

  modalError.hidden = true;
  modalError.textContent = "";
  columns[activeList].push({ name, enabled: true, isDefault: false });
  if (saveColumns()) {
    closeModal();
    renderColumns();
  }
});

document.querySelector("#columns-continue").addEventListener("click", () => {
  draft.currentStep = "review";
  if (!saveColumns()) return;
  window.location.href = "konfirmasi.html";
});

document.querySelector("#column-event-date").textContent = draft.event?.date
  ? `Tanggal kegiatan: ${formatDate(draft.event.date)}`
  : "";
renderColumns();
