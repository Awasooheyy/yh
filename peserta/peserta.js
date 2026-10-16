(function () {
  "use strict";

  const STORAGE = {
    draft: "sosialisasi.employeeDraft",
    columns: "columns",
    createdEvent: "createdEvent",
    participant: "sosialisasi.participantData",
  };
  const LISTS = {
    hadir: { label: "Daftar Hadir", color: "attendance" },
    souvenir: { label: "Suvenir", color: "souvenir" },
    uang_saku: { label: "Uang Saku", color: "uang_saku" },
  };
  const DEFAULT_COLUMNS = {
    hadir: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "No. WhatsApp", "Tanda Tangan"],
    souvenir: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "Tanda Tangan"],
    uang_saku: ["No", "Nama", "Instansi", "Desa", "Kecamatan", "Nominal Uang Saku", "Nama Bank", "Nomor Rekening", "Nama Rekening", "Tanda Tangan"],
  };
  const FIELD_DEFINITIONS = {
    nama: { label: "Nama Lengkap", type: "text", placeholder: "Contoh: Budi Santoso", icon: "user" },
    desa: { label: "Desa", type: "text", placeholder: "Contoh: Sumberrejo", icon: "pin" },
    kecamatan: { label: "Kecamatan", type: "text", placeholder: "Contoh: Banyuwangi", icon: "pin" },
    whatsapp: { label: "Nomor WhatsApp", type: "tel", placeholder: "08xxxxxxxxxx", icon: "phone" },
    instansi: { label: "Instansi", type: "text", placeholder: "Masukkan nama instansi", icon: "building" },
    nama_bank: {
      label: "Nama Bank",
      type: "text",
      placeholder: "Pilih nama bank",
      icon: "building",
      select: true,
      required: false,
      options: ["BRI", "BNI", "Bank Mandiri", "BTN", "BSI", "BCA", "CIMB Niaga", "Danamon", "Bank Permata", "OCBC", "Maybank", "Lainnya"],
    },
    nomor_rekening: { label: "Nomor Rekening", type: "text", placeholder: "Masukkan nomor rekening", icon: "money", required: false },
    nama_rekening: { label: "Nama Rekening", type: "text", placeholder: "Masukkan nama pemilik rekening", icon: "user", required: false },
  };
  const SIGNATURE_LABELS = ["Tanda Tangan", "Tanda Tangan Daftar Hadir", "Tanda Tangan Suvenir", "Tanda Tangan Uang Saku"];
  const MAX_FILE_SIZE = 2 * 1024 * 1024;

  let employeeDraft = null;
  let selectedLists = [];
  let participantFields = [];
  let signatureCanvases = {};
  let ktpFile = null;
  let ktpDataUrl = "";
  let previewUrl = "";
  let isSubmitting = false;

  const content = document.querySelector("#participant-content");
  const unavailableState = document.querySelector("#unavailable-state");
  const eventDetails = document.querySelector("#event-details");
  const fieldsContainer = document.querySelector("#participant-fields");
  const fixedAllowance = document.querySelector("#allowance-fixed-amount");
  const signaturesContainer = document.querySelector("#signature-grid");
  const form = document.querySelector("#participant-form");
  const formMessage = document.querySelector("#form-message");
  const submitButton = document.querySelector("#submit-button");
  const fileInput = document.querySelector("#ktp-file");
  const uploadArea = document.querySelector("#upload-area");
  const uploadError = document.querySelector("#ktp-error");

  function parseJson(value) {
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error("Konfigurasi kegiatan tidak berformat JSON yang valid.", error);
      return null;
    }
  }

  function loadEmployeeDraft() {
    const rawDraft = localStorage.getItem(STORAGE.draft);
    if (!rawDraft) return null;
    const draft = parseJson(rawDraft);
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;
    const requestedId = new URLSearchParams(window.location.search).get("id") || draft.activityId;
    if (requestedId == null || String(requestedId).trim() === "") return null;

    const activities = parseJson(localStorage.getItem("activities")) || [];
    if (!Array.isArray(activities)) return null;
    const activity = activities.find((item) => item && String(item.id) === String(requestedId))
      || (() => {
        const current = parseJson(localStorage.getItem(STORAGE.createdEvent));
        return current && String(current.id) === String(requestedId) ? current : null;
      })();
    if (!activity) return null;

    const lists = Array.isArray(activity.selectedLists)
      ? [...new Set(activity.selectedLists.filter((key) => Object.hasOwn(LISTS, key)))]
      : [];
    const event = activity.event || {};
    if (!lists.length || !event || typeof event !== "object" || !event.name) return null;
    return {
      ...draft,
      activityId: String(activity.id),
      selectedLists: lists,
      eventInfo: event,
      columns: activity.columns || {},
      event,
    };
  }

  function showUnavailable() {
    unavailableState.hidden = false;
    content.hidden = true;
  }

  function formatEventDate(dateValue) {
    if (!dateValue) return "—";
    const date = new Date(`${dateValue}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
    }
    return String(dateValue);
  }

  function iconSvg(name) {
    const paths = {
      calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M7.5 3v4m9-4v4M3.5 9h17M8 13h3m-3 4h3m3-4h2"/>',
      date: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 9h16m-11 4h.01M12 13h.01M15 13h.01M8 16h.01M12 16h.01"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
      user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.75 20a7.25 7.25 0 0 1 14.5 0"/>',
      phone: '<path d="M7 3.75h10a2 2 0 0 1 2 2v12.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2ZM10 17h4"/>',
      building: '<path d="M4 20V5.5L12 3l8 2.5V20M2.5 20h19M8 8h1m6 0h1M8 11.5h1m6 0h1M8 15h1m6 0h1M11 20v-3h2v3"/>',
      money: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 10h.01M17 15h.01M12 10v5m-1.5-3.5h2a1 1 0 0 1 0 2h-1a1 1 0 0 0 0 2h2"/>',
      group: '<path d="M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a2.5 2.5 0 1 0 0-5M3.75 19a5.25 5.25 0 0 1 10.5 0M15 14a4.5 4.5 0 0 1 5.25 4.5"/>',
      gift: '<path d="M4.75 10h14.5v9.25H4.75V10ZM3.75 6.75h16.5V10H3.75V6.75ZM12 6.75v12.5M12 6.75H8.75a2 2 0 1 1 2-2c0 1.1 1.25 2 1.25 2Zm0 0h3.25a2 2 0 1 0-2-2c0 1.1-1.25 2-1.25 2Z"/>',
      pen: '<path d="m14.5 5.5 4 4m-13.8 9.8 4.2-.8L20 7.4a2.83 2.83 0 0 0-4-4L4.9 15.2l-.8 4.1ZM4 21h16"/>',
      trash: '<path d="M4.75 7h14.5M9.25 7V4.75h5.5V7m-8 0 .8 12.25h8.9L17.25 7M10 10.5v5.5m4-5.5v5.5"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.user}</svg>`;
  }

  function renderEventInfo() {
    const event = employeeDraft.eventInfo;
    const values = [
      ["Nama Kegiatan", event.name || "—", "calendar"],
      ["Tanggal", formatEventDate(event.date), "date"],
      ["Waktu", event.time || "—", "clock"],
      ["Tempat", event.location || "—", "pin"],
    ];
    eventDetails.replaceChildren();
    values.forEach(([label, value, icon]) => {
      const row = document.createElement("div");
      row.className = "event-detail";
      const term = document.createElement("dt");
      term.innerHTML = iconSvg(icon);
      const labelText = document.createElement("span");
      labelText.textContent = label;
      term.append(labelText);
      const separator = document.createElement("span");
      separator.className = "event-separator";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = ":";
      const description = document.createElement("dd");
      description.textContent = value;
      row.append(term, separator, description);
      eventDetails.append(row);
    });
  }

  function slugify(value) {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("id").trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function normalizeField(column) {
    const label = typeof column === "string"
      ? column.trim()
      : String(column?.label || column?.name || "").trim();
    if (!label) return null;
    const normalized = slugify(label);
    if (normalized === "no" || SIGNATURE_LABELS.some((name) => slugify(name) === normalized)) return null;

    const aliases = {
      nama_lengkap: "nama",
      nama_peserta: "nama",
      nomor_whatsapp: "whatsapp",
      no_whatsapp: "whatsapp",
      no_wa: "whatsapp",
      nomor_wa: "whatsapp",
      wa: "whatsapp",
      rekening: "nomor_rekening",
      no_rekening: "nomor_rekening",
      nama_pemilik_rekening: "nama_rekening",
      nominal: "nominal_uang_saku",
      uang_saku: "nominal_uang_saku",
    };
    const key = aliases[normalized] || normalized;
    if (key === "nominal_uang_saku") return null;
    const standard = FIELD_DEFINITIONS[key];
    const isObject = typeof column === "object" && column !== null;
    return {
      key: String(standard ? key : (isObject && (column.id || column.key)) || key),
      label: standard?.label || label,
      type: standard?.type || (isObject && column.type === "number" ? "number" : "text"),
      placeholder: standard?.placeholder || `Masukkan ${label.toLocaleLowerCase("id")}`,
      icon: standard?.icon || "user",
      options: standard?.options || (isObject && Array.isArray(column.options) ? column.options : []),
      select: Boolean(standard?.select || key === "nama_bank"),
      required: standard?.required ?? (isObject ? column.required !== false : true),
    };
  }

  function getColumnsForList(listKey) {
    const storedColumns = employeeDraft.columns;
    const storedForList = storedColumns && Array.isArray(storedColumns[listKey]) ? storedColumns[listKey] : null;
    if (storedForList?.length) return storedForList;

    const draftForList = employeeDraft.columns?.[listKey];
    if (Array.isArray(draftForList) && draftForList.length) {
      const names = draftForList.map((column) => typeof column === "string" ? column : column?.name || column?.label);
      return [...DEFAULT_COLUMNS[listKey], ...names.filter(Boolean)];
    }
    return DEFAULT_COLUMNS[listKey];
  }

  function getUniqueParticipantFields() {
    const fields = [];
    const seen = new Set();
    selectedLists.forEach((listKey) => {
      getColumnsForList(listKey).forEach((column) => {
        if (column && typeof column === "object" && column.enabled === false) return;
        const field = normalizeField(column);
        if (!field || seen.has(field.key)) return;
        seen.add(field.key);
        fields.push(field);
      });
    });
    return fields;
  }

  function renderParticipantFields() {
    participantFields = getUniqueParticipantFields();
    fieldsContainer.replaceChildren();
    renderFixedAllowance();
    if (!participantFields.length) {
      const empty = document.createElement("p");
      empty.className = "participant-empty-fields";
      empty.textContent = "Tidak ada kolom data diri yang diperlukan untuk kegiatan ini.";
      fieldsContainer.append(empty);
      return;
    }

    participantFields.forEach((field, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "participant-field";
      const inputId = `participant-field-${index}`;
      const errorId = `${inputId}-error`;
      const label = document.createElement("label");
      label.htmlFor = inputId;
      label.append(document.createTextNode(field.label));
      if (field.required) {
        const required = document.createElement("span");
        required.className = "required-mark";
        required.setAttribute("aria-label", "wajib diisi");
        required.textContent = "*";
        label.append(required);
      } else if (["nama_bank", "nomor_rekening", "nama_rekening"].includes(field.key)) {
        const optional = document.createElement("span");
        optional.className = "optional-mark";
        optional.textContent = "(Opsional)";
        label.append(optional);
      }

      const shell = document.createElement("div");
      shell.className = "input-shell";
      shell.innerHTML = iconSvg(field.icon);
      const input = field.select ? document.createElement("select") : document.createElement("input");
      input.id = inputId;
      input.name = field.key;
      input.dataset.fieldKey = field.key;
      input.dataset.required = String(field.required);
      if (field.select) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Pilih nama bank";
        input.append(placeholder);
        field.options.forEach((optionName) => {
          const option = document.createElement("option");
          option.value = optionName;
          option.textContent = optionName;
          input.append(option);
        });
        if (!field.options.length) {
          const noOptions = document.createElement("option");
          noOptions.value = "";
          noOptions.textContent = "Pilihan bank belum diatur pegawai";
          noOptions.disabled = true;
          input.append(noOptions);
        }
      } else {
        input.type = field.type;
        input.placeholder = field.placeholder;
        input.autocomplete = field.key === "whatsapp" ? "tel" : "off";
        if (field.key === "whatsapp") {
          input.inputMode = "numeric";
          input.pattern = "[0-9]*";
          input.maxLength = 20;
        }
      }
      input.setAttribute("aria-describedby", errorId);
      if (field.type === "number") {
        input.min = "0";
        input.step = "1";
        input.inputMode = "numeric";
      }
      shell.append(input);
      const error = document.createElement("p");
      error.className = "inline-error";
      error.id = errorId;
      error.hidden = true;
      wrapper.append(label, shell, error);
      fieldsContainer.append(wrapper);
    });
  }

  function getFixedAllowance() {
    const amount = Number(employeeDraft.eventInfo.allowanceAmount);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  function renderFixedAllowance() {
    const amount = getFixedAllowance();
    fixedAllowance.hidden = !selectedLists.includes("uang_saku");
    fixedAllowance.replaceChildren();
    if (fixedAllowance.hidden) return;

    const label = document.createElement("span");
    label.textContent = "Nominal Uang Saku per Peserta";
    const value = document.createElement("strong");
    value.textContent = amount === null
      ? "Belum ditentukan oleh pegawai"
      : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
    const note = document.createElement("small");
    note.textContent = "Nominal uang saku belum dipotong pajak.";
    fixedAllowance.append(label, value, note);
  }

  function signatureIcon(listKey) {
    if (listKey === "souvenir") return iconSvg("gift");
    if (listKey === "uang_saku") return iconSvg("money");
    return iconSvg("group");
  }

  function renderSignatureCards() {
    signatureCanvases = {};
    signaturesContainer.replaceChildren();
    selectedLists.forEach((listKey) => {
      const config = LISTS[listKey];
      if (!config) return;
      const card = document.createElement("section");
      card.className = `signature-card ${config.color}`;
      card.dataset.signatureCard = listKey;
      const heading = document.createElement("div");
      heading.className = "signature-card-heading";
      const icon = document.createElement("span");
      icon.className = "signature-icon";
      icon.innerHTML = signatureIcon(listKey);
      const title = document.createElement("h3");
      title.textContent = config.label;
      heading.append(icon, title);

      const wrap = document.createElement("div");
      wrap.className = "signature-canvas-wrap";
      const canvas = document.createElement("canvas");
      canvas.className = "signature-canvas";
      canvas.dataset.signature = listKey;
      canvas.setAttribute("aria-label", `Area tanda tangan ${config.label}`);
      canvas.setAttribute("role", "img");
      const placeholder = document.createElement("div");
      placeholder.className = "signature-placeholder";
      placeholder.innerHTML = `${iconSvg("pen")}<span>Tanda tangan di sini</span>`;
      wrap.append(canvas, placeholder);

      const error = document.createElement("p");
      error.className = "signature-error";
      error.dataset.signatureError = listKey;
      error.hidden = true;
      const clear = document.createElement("button");
      clear.className = "signature-clear";
      clear.type = "button";
      clear.dataset.clearSignature = listKey;
      clear.innerHTML = `${iconSvg("trash")}<span>Hapus TTD</span>`;
      card.append(heading, wrap, error, clear);
      signaturesContainer.append(card);
      signatureCanvases[listKey] = { canvas, card, strokes: [], currentStroke: null };
      setupSignatureCanvas(listKey);
    });
    signaturesContainer.style.maxWidth = selectedLists.length === 1 ? "360px" : selectedLists.length === 2 ? "740px" : "";
    signaturesContainer.style.marginInline = selectedLists.length < 3 ? "auto" : "";
  }

  function setupSignatureCanvas(listKey) {
    const state = signatureCanvases[listKey];
    if (!state) return;
    const { canvas } = state;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas tanda tangan tidak dapat dijalankan di browser ini.");

    function redraw() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * ratio);
      const height = Math.round(rect.height * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      context.strokeStyle = "#174a8b";
      context.lineWidth = 2;
      context.lineCap = "round";
      context.lineJoin = "round";
      state.strokes.forEach((stroke) => drawStroke(context, stroke, rect.width, rect.height));
      if (state.currentStroke) drawStroke(context, state.currentStroke, rect.width, rect.height);
      state.card.classList.toggle("has-signature", state.strokes.length > 0 || Boolean(state.currentStroke));
    }

    function pointFromEvent(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      };
    }

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      state.currentStroke = [pointFromEvent(event)];
      hideSignatureError(listKey);
      redraw();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.currentStroke) return;
      state.currentStroke.push(pointFromEvent(event));
      redraw();
    });
    const finishStroke = () => {
      if (!state.currentStroke) return;
      state.strokes.push(state.currentStroke);
      state.currentStroke = null;
      redraw();
    };
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    canvas.addEventListener("lostpointercapture", finishStroke);
    state.redraw = redraw;
    redraw();
  }

  function drawStroke(context, stroke, width, height) {
    if (!stroke.length) return;
    context.beginPath();
    context.moveTo(stroke[0].x * width, stroke[0].y * height);
    if (stroke.length === 1) {
      context.lineTo(stroke[0].x * width + .1, stroke[0].y * height + .1);
    } else {
      stroke.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height));
    }
    context.stroke();
  }

  function hideSignatureError(listKey) {
    const error = signaturesContainer.querySelector(`[data-signature-error="${listKey}"]`);
    if (error) error.hidden = true;
  }

  function clearSignature(listKey) {
    const state = signatureCanvases[listKey];
    if (!state) return;
    state.strokes = [];
    state.currentStroke = null;
    state.redraw();
    hideSignatureError(listKey);
  }

  function setupSignatureControls() {
    signaturesContainer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-clear-signature]");
      if (button) clearSignature(button.dataset.clearSignature);
    });
    window.addEventListener("resize", () => {
      Object.values(signatureCanvases).forEach((state) => state.redraw?.());
    });
  }

  function setupNumericWhatsappFields() {
    fieldsContainer.addEventListener("input", (event) => {
      const input = event.target.closest('[data-field-key="whatsapp"]');
      if (!input) return;
      const start = input.selectionStart;
      const previousValue = input.value;
      input.value = previousValue.replace(/\D/g, "");
      if (start !== null && input === document.activeElement) {
        const removedBeforeCursor = previousValue.slice(0, start).replace(/\D/g, "").length;
        input.setSelectionRange(removedBeforeCursor, removedBeforeCursor);
      }
      input.removeAttribute("aria-invalid");
      const error = input.closest(".participant-field")?.querySelector(".inline-error");
      if (error) {
        error.hidden = true;
        error.textContent = "";
      }
    });
  }

  function formatFileSize(size) {
    return size < 1024 * 1024
      ? `${(size / 1024).toFixed(0)} KB`
      : `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  function displayKtpFile(file) {
    ktpFile = file;
    ktpDataUrl = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    document.querySelector("#ktp-preview-image").src = previewUrl;
    document.querySelector("#ktp-file-name").textContent = file.name;
    document.querySelector("#ktp-file-size").textContent = formatFileSize(file.size);
    document.querySelector("#upload-prompt").hidden = true;
    document.querySelector("#upload-preview").hidden = false;
    uploadError.hidden = true;
    uploadError.textContent = "";
  }

  function validateKtpFile(file) {
    if (!file) return "";
    const extension = file.name.split(".").pop().toLocaleLowerCase("id");
    const validExtension = ["jpg", "jpeg", "png"].includes(extension);
    const validMime = !file.type || ["image/jpeg", "image/png"].includes(file.type);
    if (!validExtension || !validMime) {
      return "Format file tidak sesuai. Gunakan JPG, JPEG, atau PNG.";
    }
    if (file.size > MAX_FILE_SIZE) return "Ukuran foto KTP maksimal 2MB.";
    if (file.size === 0) return "File foto KTP kosong. Pilih file lain.";
    return "";
  }

  function handleKtpFile(file) {
    const error = validateKtpFile(file);
    if (error) {
      uploadError.textContent = error;
      uploadError.hidden = false;
      fileInput.value = "";
      return;
    }
    displayKtpFile(file);
  }

  function setupKtpUpload() {
    fileInput.addEventListener("change", () => {
      if (fileInput.files?.[0]) handleKtpFile(fileInput.files[0]);
    });
    uploadArea.addEventListener("click", (event) => {
      if (event.target.closest("#remove-ktp")) return;
      fileInput.click();
    });
    uploadArea.addEventListener("keydown", (event) => {
      if (event.target.closest("#remove-ktp")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });
    ["dragenter", "dragover"].forEach((type) => uploadArea.addEventListener(type, (event) => {
      event.preventDefault();
      uploadArea.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach((type) => uploadArea.addEventListener(type, (event) => {
      event.preventDefault();
      uploadArea.classList.remove("is-dragging");
    }));
    uploadArea.addEventListener("drop", (event) => {
      const file = event.dataTransfer.files?.[0];
      if (file) handleKtpFile(file);
    });
    document.querySelector("#remove-ktp").addEventListener("click", (event) => {
      event.stopPropagation();
      clearKtpFile();
    });
  }

  function clearKtpFile() {
    ktpFile = null;
    ktpDataUrl = "";
    fileInput.value = "";
    document.querySelector("#ktp-preview-image").removeAttribute("src");
    document.querySelector("#upload-prompt").hidden = false;
    document.querySelector("#upload-preview").hidden = true;
    uploadError.hidden = true;
    uploadError.textContent = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }

  function validateParticipantForm() {
    let valid = true;
    let firstInvalid = null;
    participantFields.forEach((field) => {
      const input = getFieldInput(field.key);
      const error = input?.closest(".participant-field")?.querySelector(".inline-error");
      if (!input || !field.required) return;
      const invalid = !input.value.trim()
        || (input.type === "number" && Number(input.value) < 0)
        || (field.key === "whatsapp" && !/^\d+$/.test(input.value));
      input.setAttribute("aria-invalid", String(invalid));
      if (error) {
        error.textContent = invalid
          ? field.key === "whatsapp" && input.value.trim()
            ? "Nomor WhatsApp hanya boleh berisi angka."
            : `${field.label} wajib diisi dengan benar.`
          : "";
        error.hidden = !invalid;
      }
      if (invalid) {
        valid = false;
        if (!firstInvalid) firstInvalid = input;
      }
    });

    selectedLists.forEach((listKey) => {
      const signature = signatureCanvases[listKey];
      const error = signaturesContainer.querySelector(`[data-signature-error="${listKey}"]`);
      const invalid = !signature || signature.strokes.length === 0;
      if (error) {
        error.textContent = invalid ? `Tanda tangan ${LISTS[listKey].label} wajib diisi.` : "";
        error.hidden = !invalid;
      }
      if (invalid) valid = false;
    });

    if (selectedLists.includes("uang_saku") && getFixedAllowance() === null) {
      fixedAllowance.classList.add("is-missing");
      valid = false;
    } else {
      fixedAllowance.classList.remove("is-missing");
    }

    const ktpValidationError = validateKtpFile(ktpFile);
    uploadError.textContent = ktpValidationError;
    uploadError.hidden = !ktpValidationError;
    if (ktpValidationError) valid = false;
    if (firstInvalid) firstInvalid.focus();
    else if (!valid && ktpValidationError) uploadArea.focus();
    return valid;
  }

  function collectParticipantData() {
    const data = {};
    participantFields.forEach((field) => {
      const input = getFieldInput(field.key);
      if (input) data[field.key] = field.type === "number" && input.value ? Number(input.value) : input.value.trim();
    });
    const allowance = getFixedAllowance();
    if (selectedLists.includes("uang_saku") && allowance !== null) {
      data.nominal_uang_saku = allowance;
    }
    const signatures = {};
    selectedLists.forEach((listKey) => {
      const canvas = signatureCanvases[listKey]?.canvas;
      if (canvas) signatures[listKey] = canvas.toDataURL("image/png");
    });
    return { data, signatures };
  }

  function getFieldInput(fieldKey) {
    return [...fieldsContainer.querySelectorAll("[data-field-key]")]
      .find((input) => input.dataset.fieldKey === fieldKey) || null;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Foto KTP tidak dapat dibaca."));
          return;
        }
        resolve(reader.result);
      });
      reader.addEventListener("error", () => reject(reader.error || new Error("Foto KTP tidak dapat dibaca.")));
      reader.readAsDataURL(file);
    });
  }

  function saveParticipantData(participant) {
    if (!participant.eventId) {
      throw new Error("ID kegiatan tidak tersedia untuk pengiriman peserta.");
    }

    const eventKey = `sosialisasi.participants.${encodeURIComponent(participant.eventId)}`;
    const rawParticipants = localStorage.getItem(eventKey);
    const participants = rawParticipants === null ? [] : JSON.parse(rawParticipants);
    if (!Array.isArray(participants)) {
      throw new TypeError("Format penyimpanan peserta untuk kegiatan ini tidak valid.");
    }

    const previousLatest = localStorage.getItem(STORAGE.participant);
    localStorage.setItem(eventKey, JSON.stringify([...participants, participant]));
    try {
      // Keep the existing single-record key for the participant success page and older clients.
      localStorage.setItem(STORAGE.participant, JSON.stringify(participant));
    } catch (error) {
      if (rawParticipants === null) localStorage.removeItem(eventKey);
      else localStorage.setItem(eventKey, rawParticipants);
      if (previousLatest === null) localStorage.removeItem(STORAGE.participant);
      else localStorage.setItem(STORAGE.participant, previousLatest);
      throw error;
    }
  }

  function setSubmitting(submitting) {
    isSubmitting = submitting;
    submitButton.disabled = submitting;
    submitButton.setAttribute("aria-busy", String(submitting));
    submitButton.querySelector("span").textContent = submitting ? "Mengirim..." : "Kirim Data";
  }

  function showFormError(message) {
    formMessage.textContent = message;
    formMessage.hidden = false;
  }

  function setupForm() {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isSubmitting) return;
      formMessage.hidden = true;
      formMessage.textContent = "";
      if (!validateParticipantForm()) {
        showFormError(selectedLists.includes("uang_saku") && getFixedAllowance() === null
          ? "Nominal Uang Saku belum ditentukan pegawai. Minta pegawai melengkapi informasi kegiatan."
          : "Periksa kembali data wajib dan tanda tangan Anda.");
        return;
      }

      setSubmitting(true);
      try {
        const { data, signatures } = collectParticipantData();
        if (ktpFile) ktpDataUrl = await readFileAsDataUrl(ktpFile);
        const participant = {
          id: `participant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          eventId: String(employeeDraft.activityId),
          data,
          signatures,
          submittedAt: new Date().toISOString(),
        };
        if (ktpDataUrl) participant.ktp = ktpDataUrl;
        saveParticipantData(participant);
        window.location.href = "peserta-berhasil.html";
      } catch (error) {
        console.error("Data peserta tidak dapat disimpan.", error);
        showFormError("Data belum berhasil dikirim. Pastikan penyimpanan browser tersedia, lalu coba lagi.");
        setSubmitting(false);
      }
    });
    document.querySelector("#back-button").addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else showFormError("Halaman sebelumnya tidak tersedia.");
    });
    document.querySelector("#unavailable-back").addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
    });
  }

  function initialize() {
    try {
      if (localStorage.getItem("role") !== "peserta") {
        window.location.replace("../index.html");
        return;
      }
      employeeDraft = loadEmployeeDraft();
      if (!employeeDraft) {
        showUnavailable();
        return;
      }
      selectedLists = employeeDraft.selectedLists;
      content.hidden = false;
      unavailableState.hidden = true;
      renderEventInfo();
      renderParticipantFields();
      renderSignatureCards();
      setupSignatureControls();
      setupNumericWhatsappFields();
      setupKtpUpload();
      setupForm();
    } catch (error) {
      console.error("Halaman peserta tidak dapat dimuat.", error);
      showUnavailable();
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
