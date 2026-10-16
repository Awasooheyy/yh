const STORAGE_KEY = "sosialisasi.employeeDraft";

const LISTS = {
  hadir: {
    label: "Daftar Hadir",
    defaults: ["No", "Nama", "Desa", "Kecamatan", "No. WhatsApp", "Tanda Tangan"],
  },
  souvenir: {
    label: "Souvenir",
    defaults: ["No", "Nama", "Desa", "Kecamatan", "Tanda Tangan"],
  },
  uang_saku: {
    label: "Uang Saku",
    defaults: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "Nominal Uang Saku", "Nama Bank", "Nomor Rekening", "Nama Rekening", "Tanda Tangan"],
  },
};

const STEPS = ["login", "lists", "event", "columns", "review", "success"];
const STEP_COPY = {
  login: ["SELAMAT DATANG", "Masuk ke workspace", "Gunakan nama Anda untuk memulai pengelolaan daftar kegiatan."],
  lists: ["LANGKAH 1 DARI 4", "Pilih daftar kegiatan", "Tentukan administrasi yang perlu disiapkan untuk kegiatan ini."],
  event: ["LANGKAH 2 DARI 4", "Lengkapi informasi kegiatan", "Isi detail kegiatan sosialisasi yang akan diselenggarakan."],
  columns: ["LANGKAH 3 DARI 4", "Sesuaikan kolom daftar", "Atur kolom yang akan digunakan pada setiap daftar."],
  review: ["LANGKAH 4 DARI 4", "Konfirmasi kegiatan", "Periksa detail kegiatan sebelum menyimpan pengaturan."],
  success: ["SELESAI", "Kegiatan berhasil dibuat", "Pengaturan kegiatan Anda sudah siap."],
};

function emptyDraft() {
  return {
    selectedLists: [],
    event: { name: "", date: "", time: "", location: "" },
    columns: { hadir: [], souvenir: [], uang_saku: [] },
    employee: { name: "", unit: "" },
    currentStep: "login",
    created: false,
  };
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const draft = { ...emptyDraft(), ...(saved && typeof saved === "object" ? saved : {}) };
    draft.event = { ...emptyDraft().event, ...(draft.event || {}) };
    draft.employee = { ...emptyDraft().employee, ...(draft.employee || {}) };
    draft.columns = { ...emptyDraft().columns, ...(draft.columns || {}) };
    draft.selectedLists = Array.isArray(draft.selectedLists)
      ? draft.selectedLists.filter((key) => Object.hasOwn(LISTS, key))
      : [];
    Object.keys(LISTS).forEach((key) => {
      if (!Array.isArray(draft.columns[key])) draft.columns[key] = [];
      draft.columns[key] = draft.columns[key]
        .filter((column) => typeof column === "string")
        .map((column) => column.trim())
        .filter(Boolean);
    });
    if (!STEPS.includes(draft.currentStep)) draft.currentStep = "login";
    return draft;
  } catch (error) {
    console.error("Data kegiatan tidak dapat dibaca dari penyimpanan lokal.", error);
    return emptyDraft();
  }
}

let draft = loadDraft();
const panels = [...document.querySelectorAll("[data-panel]")];
const errorBox = document.querySelector("#form-error");
const progressFill = document.querySelector("#progress-fill");

function saveDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    localStorage.setItem("selectedLists", JSON.stringify(draft.selectedLists));
    document.querySelector("#draft-status").innerHTML =
      '<span class="status-dot"></span> Tersimpan otomatis';
  } catch (error) {
    console.error("Data kegiatan tidak dapat disimpan ke penyimpanan lokal.", error);
    document.querySelector("#draft-status").textContent = "Gagal menyimpan";
    showError("Penyimpanan lokal tidak tersedia. Pastikan browser mengizinkan penyimpanan data.");
  }
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function goTo(step) {
  if (!STEPS.includes(step)) return;
  clearError();
  draft.currentStep = step;
  saveDraft();
  panels.forEach((panel) => {
    const isActive = panel.dataset.panel === step;
    panel.hidden = !isActive;
    panel.classList.toggle("is-visible", isActive);
  });
  document.querySelectorAll("[data-step-item]").forEach((item) => {
    const itemStep = item.dataset.stepItem;
    const currentIndex = STEPS.indexOf(step);
    const itemIndex = STEPS.indexOf(itemStep);
    item.classList.toggle("is-current", itemStep === step);
    item.classList.toggle("is-complete", itemIndex < currentIndex);
  });
  const [eyebrow, title, description] = STEP_COPY[step];
  document.querySelector("#page-eyebrow").textContent = eyebrow;
  document.querySelector("#page-title").textContent = title;
  document.querySelector("#page-description").textContent = description;
  const progress = step === "login" ? 0 : step === "success" ? 100 : (STEPS.indexOf(step) / 4) * 100;
  progressFill.style.width = `${progress}%`;

  if (step === "login") populateEmployeeForm();
  if (step === "lists") populateListChoices();
  if (step === "event") populateEventForm();
  if (step === "columns") renderColumnGroups();
  if (step === "review") renderReview();
  if (step === "success") renderSuccess();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function populateEmployeeForm() {
  document.querySelector("#employee-name").value = draft.employee.name;
  document.querySelector("#employee-unit").value = draft.employee.unit;
}

function populateListChoices() {
  document.querySelectorAll('input[name="selected-list"]').forEach((input) => {
    input.checked = draft.selectedLists.includes(input.value);
  });
}

function populateEventForm() {
  document.querySelector("#event-name").value = draft.event.name;
  document.querySelector("#event-date").value = draft.event.date;
  document.querySelector("#event-time").value = draft.event.time;
  document.querySelector("#event-location").value = draft.event.location;
}

function getColumns(listKey) {
  return [...LISTS[listKey].defaults, ...draft.columns[listKey]];
}

function renderColumnGroups() {
  const container = document.querySelector("#column-groups");
  container.replaceChildren();
  draft.selectedLists.forEach((key) => {
    const group = document.createElement("section");
    group.className = "column-group";
    group.dataset.columnGroup = key;

    const heading = document.createElement("div");
    heading.className = "column-group-heading";
    const title = document.createElement("h3");
    title.textContent = LISTS[key].label;
    const count = document.createElement("span");
    count.className = "column-count";
    count.textContent = `${getColumns(key).length} kolom`;
    heading.append(title, count);

    const chips = document.createElement("div");
    chips.className = "column-chips";
    LISTS[key].defaults.forEach((column) => chips.append(createColumnChip(column, true)));
    draft.columns[key].forEach((column, index) => chips.append(createColumnChip(column, false, key, index)));

    const addRow = document.createElement("form");
    addRow.className = "add-column-row";
    addRow.dataset.addColumn = key;
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 40;
    input.placeholder = "Nama kolom tambahan";
    input.setAttribute("aria-label", `Nama kolom tambahan untuk ${LISTS[key].label}`);
    const addButton = document.createElement("button");
    addButton.className = "add-column-button";
    addButton.type = "submit";
    addButton.innerHTML = "<span aria-hidden=\"true\">＋</span> Tambah kolom";
    addRow.append(input, addButton);
    group.append(heading, chips, addRow);
    container.append(group);
  });
}

function createColumnChip(name, isDefault, listKey, index) {
  const chip = document.createElement("span");
  chip.className = `column-chip${isDefault ? " is-default" : ""}`;
  chip.append(document.createTextNode(name));
  if (isDefault) {
    const label = document.createElement("span");
    label.className = "default-label";
    label.textContent = "standar";
    chip.append(label);
  } else {
    const remove = document.createElement("button");
    remove.className = "remove-column";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Hapus kolom ${name}`);
    remove.dataset.removeList = listKey;
    remove.dataset.removeIndex = String(index);
    chip.append(remove);
  }
  return chip;
}

function renderReview() {
  const container = document.querySelector("#review-content");
  container.replaceChildren();
  container.append(
    createReviewBlock("INFORMASI PEGAWAI", [
      ["Pegawai", draft.employee.name],
      ["Unit kerja", draft.employee.unit || "Tidak diisi"],
    ]),
    createReviewBlock("INFORMASI KEGIATAN", [
      ["Nama kegiatan", draft.event.name],
      ["Tanggal", formatDate(draft.event.date)],
      ["Waktu", draft.event.time],
      ["Lokasi", draft.event.location],
    ]),
  );

  const listBlock = document.createElement("section");
  listBlock.className = "review-block";
  const listHeading = document.createElement("h3");
  listHeading.textContent = "DAFTAR YANG DIGUNAKAN";
  const tags = document.createElement("div");
  tags.className = "review-lists";
  draft.selectedLists.forEach((key) => {
    const tag = document.createElement("span");
    tag.className = "review-list-tag";
    tag.textContent = LISTS[key].label;
    tags.append(tag);
  });
  listBlock.append(listHeading, tags);
  container.append(listBlock);

  const columnsBlock = document.createElement("section");
  columnsBlock.className = "review-block";
  const columnsHeading = document.createElement("h3");
  columnsHeading.textContent = "KOLOM DAFTAR";
  const columnLines = document.createElement("div");
  columnLines.className = "review-columns";
  draft.selectedLists.forEach((key) => {
    const line = document.createElement("div");
    line.className = "review-column-line";
    const label = document.createElement("strong");
    label.textContent = `${LISTS[key].label}: `;
    line.append(label, document.createTextNode(getColumns(key).join(", ")));
    columnLines.append(line);
  });
  columnsBlock.append(columnsHeading, columnLines);
  container.append(columnsBlock);
}

function createReviewBlock(title, details) {
  const block = document.createElement("section");
  block.className = "review-block";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const grid = document.createElement("div");
  grid.className = "review-detail-grid";
  details.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "review-detail";
    const itemLabel = document.createElement("label");
    itemLabel.textContent = label;
    const itemValue = document.createElement("strong");
    itemValue.textContent = value;
    item.append(itemLabel, itemValue);
    grid.append(item);
  });
  block.append(heading, grid);
  return block;
}

function renderSuccess() {
  const summary = document.querySelector("#success-summary");
  summary.replaceChildren();
  const name = document.createElement("strong");
  name.textContent = draft.event.name;
  const detail = document.createElement("span");
  detail.textContent = `${formatDate(draft.event.date)} · ${draft.event.time} · ${draft.event.location}`;
  summary.append(name, detail);
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function validEvent() {
  const form = document.querySelector("#event-form");
  if (!form.reportValidity()) return false;
  draft.event = {
    name: document.querySelector("#event-name").value.trim(),
    date: document.querySelector("#event-date").value,
    time: document.querySelector("#event-time").value,
    location: document.querySelector("#event-location").value.trim(),
  };
  if (!draft.event.name || !draft.event.location) {
    showError("Nama dan lokasi kegiatan wajib diisi.");
    return false;
  }
  saveDraft();
  return true;
}

document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#employee-name").value.trim();
  if (!name) {
    showError("Masukkan nama pegawai untuk melanjutkan.");
    return;
  }
  draft.employee = {
    name,
    unit: document.querySelector("#employee-unit").value.trim(),
  };
  saveDraft();
  goTo("lists");
});

document.querySelectorAll('input[name="selected-list"]').forEach((input) => {
  input.addEventListener("change", () => {
    draft.selectedLists = [...document.querySelectorAll('input[name="selected-list"]:checked')]
      .map((checkbox) => checkbox.value);
    saveDraft();
  });
});

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.next;
    if (next === "event" && draft.selectedLists.length === 0) {
      showError("Pilih setidaknya satu jenis daftar untuk melanjutkan.");
      return;
    }
    if (next === "review" && !validEvent()) return;
    goTo(next);
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    goTo(button.dataset.back);
  });
});

document.querySelector("#event-continue").addEventListener("click", () => {
  if (validEvent()) goTo("columns");
});

document.querySelector("#event-form").addEventListener("input", () => {
  draft.event = {
    name: document.querySelector("#event-name").value.trim(),
    date: document.querySelector("#event-date").value,
    time: document.querySelector("#event-time").value,
    location: document.querySelector("#event-location").value.trim(),
  };
  saveDraft();
});

document.querySelector("#column-groups").addEventListener("submit", (event) => {
  const form = event.target.closest("[data-add-column]");
  if (!form) return;
  event.preventDefault();
  const key = form.dataset.addColumn;
  const input = form.querySelector("input");
  const column = input.value.trim();
  if (!column) {
    showError("Tulis nama kolom sebelum menambahkannya.");
    input.focus();
    return;
  }
  const existingColumns = getColumns(key).map((item) => item.toLocaleLowerCase("id"));
  if (existingColumns.includes(column.toLocaleLowerCase("id"))) {
    showError(`Kolom "${column}" sudah tersedia pada ${LISTS[key].label}.`);
    input.focus();
    return;
  }
  clearError();
  draft.columns[key].push(column);
  saveDraft();
  renderColumnGroups();
});

document.querySelector("#column-groups").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-index]");
  if (!button) return;
  const key = button.dataset.removeList;
  const index = Number(button.dataset.removeIndex);
  if (!Object.hasOwn(draft.columns, key) || !Number.isInteger(index)) return;
  draft.columns[key].splice(index, 1);
  saveDraft();
  renderColumnGroups();
});

document.querySelector("#confirm-create").addEventListener("click", () => {
  if (!validEvent()) {
    goTo("event");
    showError("Lengkapi informasi kegiatan sebelum konfirmasi.");
    return;
  }
  draft.created = true;
  saveDraft();
  goTo("success");
});

document.querySelector("#edit-event").addEventListener("click", () => goTo("review"));
document.querySelector("#new-event").addEventListener("click", () => {
  draft = emptyDraft();
  saveDraft();
  goTo("login");
});

goTo(draft.created ? "success" : draft.currentStep);
