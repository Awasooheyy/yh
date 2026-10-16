(function () {
  const KEYS = {
    selectedLists: "selectedLists",
    event: "event",
    columns: "columns",
    draft: "sosialisasi.employeeDraft",
    createdEvent: "createdEvent",
    activities: "activities",
  };
  const LIST_KEYS = ["hadir", "souvenir", "uang_saku"];
  const EMPTY_EVENT = { name: "", date: "", time: "", location: "" };
  const EMPTY_COLUMNS = { hadir: [], souvenir: [], uang_saku: [] };

  function readJson(key, fallback) {
    const rawValue = localStorage.getItem(key);
    return rawValue === null ? fallback : JSON.parse(rawValue);
  }

  function readDraft() {
    const value = readJson(KEYS.draft, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function saveSelectedLists(selectedLists) {
    if (!Array.isArray(selectedLists)) {
      throw new TypeError("Pilihan daftar harus berupa array.");
    }
    const cleanLists = [...new Set(selectedLists.filter((key) => LIST_KEYS.includes(key)))];
    localStorage.setItem(KEYS.selectedLists, JSON.stringify(cleanLists));
    const draft = readDraft();
    draft.selectedLists = cleanLists;
    localStorage.setItem(KEYS.draft, JSON.stringify(draft));
    return cleanLists;
  }

  function getSelectedLists() {
    const selectedLists = readJson(KEYS.selectedLists, null);
    if (Array.isArray(selectedLists)) {
      return [...new Set(selectedLists.filter((key) => LIST_KEYS.includes(key)))];
    }
    const draftLists = readDraft().selectedLists;
    return Array.isArray(draftLists)
      ? [...new Set(draftLists.filter((key) => LIST_KEYS.includes(key)))]
      : [];
  }

  function saveEventData(eventData) {
    if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) {
      throw new TypeError("Informasi kegiatan harus berupa object.");
    }
    const cleanEvent = {
      name: String(eventData.name || "").trim(),
      date: String(eventData.date || ""),
      time: String(eventData.time || "").trim(),
      location: String(eventData.location || "").trim(),
      allowanceAmount: eventData.allowanceAmount === "" || eventData.allowanceAmount == null
        ? ""
        : Number(eventData.allowanceAmount),
    };
    if (cleanEvent.allowanceAmount !== "" && (!Number.isFinite(cleanEvent.allowanceAmount) || cleanEvent.allowanceAmount < 0)) {
      throw new TypeError("Nominal uang saku harus berupa angka nol atau lebih.");
    }
    localStorage.setItem(KEYS.event, JSON.stringify(cleanEvent));
    const draft = readDraft();
    draft.event = cleanEvent;
    localStorage.setItem(KEYS.draft, JSON.stringify(draft));
    return cleanEvent;
  }

  function getEventData() {
    const savedEvent = readJson(KEYS.event, null);
    if (savedEvent && typeof savedEvent === "object" && !Array.isArray(savedEvent)) {
      return { ...EMPTY_EVENT, ...savedEvent };
    }
    const draftEvent = readDraft().event;
    return draftEvent && typeof draftEvent === "object"
      ? { ...EMPTY_EVENT, ...draftEvent }
      : { ...EMPTY_EVENT };
  }

  function normalizeColumns(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return LIST_KEYS.reduce((result, key) => {
      result[key] = Array.isArray(source[key]) ? source[key] : [];
      return result;
    }, {});
  }

  function saveColumns(columns) {
    const cleanColumns = normalizeColumns(columns);
    localStorage.setItem(KEYS.columns, JSON.stringify(cleanColumns));
    const draft = readDraft();
    draft.columns = normalizeDraftColumns(cleanColumns);
    localStorage.setItem(KEYS.draft, JSON.stringify(draft));
    return cleanColumns;
  }

  function normalizeDraftColumns(columns) {
    return LIST_KEYS.reduce((result, key) => {
      result[key] = columns[key]
        .filter((column) => typeof column === "string" || (column && column.isDefault === false))
        .map((column) => typeof column === "string" ? column : column.name)
        .filter((name) => typeof name === "string" && name.trim())
        .map((name) => name.trim());
      return result;
    }, {});
  }

  function getColumns() {
    const storedColumns = readJson(KEYS.columns, null);
    if (storedColumns && typeof storedColumns === "object" && !Array.isArray(storedColumns)) {
      return normalizeColumns(storedColumns);
    }
    return normalizeColumns(readDraft().columns);
  }

  function createEvent() {
    const selectedLists = getSelectedLists();
    const eventData = getEventData();
    const columns = getColumns();
    if (!selectedLists.length) throw new Error("Pilih setidaknya satu daftar sebelum menyimpan kegiatan.");
    if (!eventData.name || !eventData.date || !eventData.time || !eventData.location) {
      throw new Error("Lengkapi informasi kegiatan sebelum menyimpan.");
    }
    if (selectedLists.includes("uang_saku")
      && (!Number.isFinite(Number(eventData.allowanceAmount)) || Number(eventData.allowanceAmount) <= 0)) {
      throw new Error("Tentukan nominal uang saku per peserta sebelum menyimpan kegiatan.");
    }

    const timestamp = Date.now();
    const createdEvent = {
      id: String(timestamp),
      selectedLists,
      event: eventData,
      columns,
      status: "active",
      createdAt: new Date(timestamp).toISOString(),
    };
    const previousValues = new Map(
      [KEYS.createdEvent, "createdActivity", KEYS.activities, KEYS.draft]
        .map((key) => [key, localStorage.getItem(key)]),
    );

    try {
      const activities = readJson(KEYS.activities, []);
      if (!Array.isArray(activities)) throw new TypeError("Format riwayat kegiatan tidak valid.");
      localStorage.setItem(KEYS.createdEvent, JSON.stringify(createdEvent));
      localStorage.setItem("createdActivity", JSON.stringify({
        ...createdEvent,
        employee: readDraft().employee || { name: "Pegawai", unit: "" },
      }));
      localStorage.setItem(KEYS.activities, JSON.stringify([...activities, createdEvent]));
      const draft = readDraft();
      draft.selectedLists = selectedLists;
      draft.event = eventData;
      draft.columns = normalizeDraftColumns(columns);
      draft.created = true;
      draft.currentStep = "success";
      draft.activityId = createdEvent.id;
      localStorage.setItem(KEYS.draft, JSON.stringify(draft));
    } catch (error) {
      try {
        previousValues.forEach((value, key) => {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        });
      } catch (rollbackError) {
        console.error("Data kegiatan parsial tidak dapat dipulihkan.", rollbackError);
      }
      throw error;
    }
    return createdEvent;
  }

  function clearTemporaryData() {
    const draft = readDraft();
    draft.selectedLists = [];
    draft.event = { ...EMPTY_EVENT };
    draft.columns = { ...EMPTY_COLUMNS };
    draft.currentStep = "lists";
    draft.created = false;
    delete draft.activityId;
    localStorage.setItem(KEYS.draft, JSON.stringify(draft));
    localStorage.removeItem(KEYS.selectedLists);
    localStorage.removeItem(KEYS.event);
    localStorage.removeItem(KEYS.columns);
  }

  function formatDate(dateValue) {
    if (!dateValue) return "";
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function validateRequiredFields(fields) {
    const fieldEntries = Array.isArray(fields)
      ? fields.map((field) => [field, field.dataset.errorMessage || "Field ini wajib diisi."])
      : Object.entries(fields || {});
    let firstInvalid = null;

    fieldEntries.forEach(([field, message]) => {
      const input = typeof field === "string" ? document.querySelector(field) : field;
      if (!input) return;
      const value = input.value.trim();
      const errorId = input.getAttribute("aria-describedby")?.split(/\s+/)[0];
      const errorElement = errorId ? document.getElementById(errorId) : null;
      if (!value) {
        input.setAttribute("aria-invalid", "true");
        if (errorElement) {
          errorElement.textContent = typeof message === "string" ? message : "Field ini wajib diisi.";
          errorElement.hidden = false;
        }
        if (!firstInvalid) firstInvalid = input;
      } else {
        input.removeAttribute("aria-invalid");
        if (errorElement) {
          errorElement.textContent = "";
          errorElement.hidden = true;
        }
      }
    });

    if (firstInvalid) firstInvalid.focus();
    return firstInvalid === null;
  }

  window.SosialisasiApp = Object.freeze({
    saveSelectedLists,
    getSelectedLists,
    saveEventData,
    getEventData,
    saveColumns,
    getColumns,
    createEvent,
    clearTemporaryData,
    formatDate,
    validateRequiredFields,
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.dataset.appStorage = "local";
  });
})();
