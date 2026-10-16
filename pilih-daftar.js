const DRAFT_KEY = "sosialisasi.employeeDraft";
const SELECTED_LISTS_KEY = "selectedLists";
const listForm = document.querySelector("#list-form");
const errorBox = document.querySelector("#select-error");
const listInputs = [...document.querySelectorAll('input[name="selected-list"]')];

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

function readSelectedLists() {
  try {
    return window.SosialisasiApp.getSelectedLists();
  } catch (error) {
    console.error("Pilihan daftar sebelumnya tidak dapat dibaca.", error);
    return [];
  }
}

try {
  if (localStorage.getItem("role") !== "pegawai") {
    window.location.replace("index.html");
  } else {
    const savedLists = readSelectedLists();
    listInputs.forEach((input) => {
      input.checked = savedLists.includes(input.value);
    });
  }
} catch (error) {
  console.error("Sesi pegawai tidak dapat dibaca.", error);
  window.location.replace("index.html");
}

listInputs.forEach((input) => input.addEventListener("change", () => {
  clearError();
  try {
    window.SosialisasiApp.saveSelectedLists(
      listInputs.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value),
    );
  } catch (error) {
    console.error("Pilihan daftar tidak dapat disimpan.", error);
    showError("Pilihan daftar tidak dapat disimpan. Pastikan penyimpanan lokal browser aktif.");
  }
}));

document.querySelector("#logout-link").addEventListener("click", () => {
  try {
    localStorage.removeItem("role");
  } catch (error) {
    console.error("Sesi pegawai tidak dapat dihapus.", error);
  }
});

listForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedLists = listInputs.filter((input) => input.checked).map((input) => input.value);
  if (selectedLists.length === 0) {
    showError("Pilih setidaknya satu daftar untuk melanjutkan.");
    return;
  }

  try {
    window.SosialisasiApp.saveSelectedLists(selectedLists);
    const savedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
    const draft = {
      event: { name: "", date: "", time: "", location: "" },
      columns: { hadir: [], souvenir: [], uang_saku: [] },
      employee: { name: "Pegawai", unit: "" },
      currentStep: "event",
      created: false,
      ...savedDraft,
    };
    draft.selectedLists = selectedLists;
    draft.currentStep = "event";
    draft.created = false;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error("Pilihan daftar tidak dapat disimpan.", error);
    showError("Pilihan daftar tidak dapat disimpan. Pastikan penyimpanan lokal browser aktif.");
    return;
  }

  window.location.href = "informasi-kegiatan.html";
});
