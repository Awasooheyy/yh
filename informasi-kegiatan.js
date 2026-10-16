const DRAFT_KEY = "sosialisasi.employeeDraft";
const eventForm = document.querySelector("#event-form");
const eventFields = {
  name: document.querySelector("#event-name"),
  date: document.querySelector("#event-date"),
  time: document.querySelector("#event-time"),
  location: document.querySelector("#event-location"),
  allowanceAmount: document.querySelector("#event-allowance-amount"),
};
const allowanceField = document.querySelector("#allowance-amount-field");

function emptyDraft() {
  return {
    selectedLists: [],
    event: { name: "", date: "", time: "", location: "", allowanceAmount: "" },
    columns: { hadir: [], souvenir: [], uang_saku: [] },
    employee: { name: "Pegawai", unit: "" },
    currentStep: "event",
    created: false,
  };
}

let draft = emptyDraft();
let storageReady = true;

try {
  draft = { ...emptyDraft(), ...(JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}) };
  draft.event = { ...emptyDraft().event, ...window.SosialisasiApp.getEventData() };
  draft.selectedLists = window.SosialisasiApp.getSelectedLists();

  if (localStorage.getItem("role") !== "pegawai") {
    window.location.replace("index.html");
  } else if (draft.selectedLists.length === 0) {
    window.location.replace("pilih-daftar.html");
  }
} catch (error) {
  storageReady = false;
  console.error("Data kegiatan tidak dapat dibaca dari penyimpanan lokal.", error);
  showFormError("Data lokal tidak dapat dibaca. Periksa pengaturan penyimpanan browser.");
}

function showFormError(message) {
  const formMessage = document.querySelector("#event-form-error");
  if (formMessage) {
    formMessage.textContent = message;
    formMessage.hidden = false;
  } else {
    const card = document.querySelector(".event-info-card");
    const messageElement = document.createElement("p");
    messageElement.id = "event-form-error";
    messageElement.className = "event-info-error";
    messageElement.setAttribute("role", "alert");
    messageElement.textContent = message;
    card.prepend(messageElement);
  }
}

function currentEvent() {
  return {
    name: eventFields.name.value.trim(),
    date: eventFields.date.value,
    time: eventFields.time.value.trim(),
    location: eventFields.location.value.trim(),
    allowanceAmount: draft.selectedLists.includes("uang_saku") ? eventFields.allowanceAmount.value : "",
  };
}

function saveEvent() {
  if (!storageReady) return;
  try {
    draft.event = window.SosialisasiApp.saveEventData(currentEvent());
  } catch (error) {
    console.error("Informasi kegiatan tidak dapat disimpan.", error);
    storageReady = false;
    showFormError("Informasi kegiatan tidak dapat disimpan. Aktifkan penyimpanan lokal browser.");
  }
}

function validateForm() {
  const requiredFields = {
    "#event-name": "Nama kegiatan wajib diisi.",
    "#event-date": "Tanggal kegiatan wajib diisi.",
    "#event-time": "Waktu kegiatan wajib diisi.",
    "#event-location": "Tempat kegiatan wajib diisi.",
  };
  if (draft.selectedLists.includes("uang_saku")) {
    requiredFields["#event-allowance-amount"] = "Nominal uang saku per peserta wajib diisi.";
    const amount = Number(eventFields.allowanceAmount.value);
    if (eventFields.allowanceAmount.value && (!Number.isFinite(amount) || amount <= 0)) {
      eventFields.allowanceAmount.setAttribute("aria-invalid", "true");
      const error = document.querySelector("#event-allowance-amount-error");
      error.textContent = "Nominal uang saku harus lebih besar dari nol.";
      error.hidden = false;
      return false;
    }
  }
  return window.SosialisasiApp.validateRequiredFields(requiredFields);
}

Object.entries(eventFields).forEach(([fieldName, input]) => {
  if (fieldName === "allowanceAmount") {
    allowanceField.hidden = !draft.selectedLists.includes("uang_saku");
    input.value = draft.selectedLists.includes("uang_saku") ? draft.event.allowanceAmount ?? "" : "";
  } else {
    input.value = draft.event[fieldName] || "";
  }
  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    const errorSuffix = fieldName === "allowanceAmount" ? "allowance-amount" : fieldName;
    const fieldError = document.querySelector(`#event-${errorSuffix}-error`);
    fieldError.hidden = true;
    fieldError.textContent = "";
    const formMessage = document.querySelector("#event-form-error");
    if (formMessage) formMessage.hidden = true;
    saveEvent();
  });
  input.addEventListener("change", () => {
    saveEvent();
  });
});

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateForm()) return;

  draft.event = currentEvent();
  draft.currentStep = "columns";
  draft.created = false;
  try {
    draft.event = window.SosialisasiApp.saveEventData(draft.event);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error("Informasi kegiatan tidak dapat disimpan.", error);
    storageReady = false;
    showFormError("Informasi kegiatan tidak dapat disimpan. Aktifkan penyimpanan lokal browser.");
    return;
  }
  window.location.href = "atur-kolom.html";
});
