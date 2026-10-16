(function () {
  "use strict";

  const LIST_KEY = "hadir";
  const DEFAULT_COLUMNS = ["No", "Nama", "Instansi", "Desa", "Kecamatan", "No. WhatsApp", "Tanda Tangan"];
  const unavailable = document.querySelector("#unavailable");
  const form = document.querySelector("#attendance-form");
  const tableColumns = document.querySelector("#attendance-columns");
  const tableHead = document.querySelector("#attendance-head");
  const tableBody = document.querySelector("#attendance-body");
  const backLink = document.querySelector("#back-link");

  function readJson(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  }

  function slugify(value) {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("id").trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function displayDate(value, withWeekday) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", {
      ...(withWeekday ? { weekday: "long" } : {}),
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function normalizeColumn(column) {
    const label = typeof column === "string"
      ? column.trim()
      : String(column?.label || column?.name || "").trim();
    if (!label) return null;
    const slug = slugify(label);
    const aliases = {
      nama_lengkap: "nama",
      nama_peserta: "nama",
      nomor_whatsapp: "whatsapp",
      no_whatsapp: "whatsapp",
      no_hp: "whatsapp",
      no_wa: "whatsapp",
      nomor_wa: "whatsapp",
      wa: "whatsapp",
    };
    const key = aliases[slug] || slug;
    if (slug === "no") return { key: "row_number", label: "NO", number: true };
    if (["tanda_tangan", "ttd", "tanda_tangan_daftar_hadir"].includes(slug)) {
      return { key: LIST_KEY, label: "TTD", signature: true };
    }
    return {
      key: String((column && typeof column === "object" && (column.id || column.key)) || key),
      dataKey: key,
      label: key === "nama" ? "NAMA" : key === "whatsapp" ? "NO HP" : label.toLocaleUpperCase("id"),
    };
  }

  function getConfiguredColumns(activity) {
    const saved = Array.isArray(activity.columns?.[LIST_KEY]) ? activity.columns[LIST_KEY] : null;
    const source = saved?.length ? saved : DEFAULT_COLUMNS;
    const result = source
      .filter((column) => !column || typeof column !== "object" || column.enabled !== false)
      .map(normalizeColumn)
      .filter(Boolean);
    if (!result.some((column) => column.number)) {
      result.unshift({ key: "row_number", label: "NO", number: true });
    }
    return result;
  }

  function getActivityParticipants(id) {
    const key = `sosialisasi.participants.${encodeURIComponent(id)}`;
    const saved = readJson(key, []);
    if (!Array.isArray(saved)) throw new TypeError("Data peserta kegiatan tidak valid.");
    const participants = saved.filter((participant) =>
      participant && String(participant.eventId) === id);
    const legacy = readJson("sosialisasi.participantData", null);
    if (legacy && String(legacy.eventId) === id
      && !participants.some((participant) => participant.id === legacy.id)) {
      participants.push(legacy);
    }
    return participants;
  }

  function getValue(participant, column) {
    if (column.number) return "";
    if (column.signature) return participant.signatures?.[LIST_KEY] || "";
    const data = participant.data && typeof participant.data === "object" ? participant.data : {};
    if (Object.hasOwn(data, column.key)) return data[column.key];
    if (Object.hasOwn(data, column.dataKey)) return data[column.dataKey];
    return "";
  }

  function createColumnWidths(columns) {
    const weights = columns.map((column) => {
      if (column.number) return 4;
      if (column.signature) return 16;
      if (column.dataKey === "nama") return 25;
      if (column.dataKey === "instansi") return 24;
      if (column.dataKey === "whatsapp") return 20;
      return 17;
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    columns.forEach((column, index) => {
      const col = document.createElement("col");
      col.style.width = `${(weights[index] / total * 100).toFixed(2)}%`;
      tableColumns.append(col);
    });
  }

  function renderTable(columns, participants) {
    createColumnWidths(columns);
    const headerRow = document.createElement("tr");
    columns.forEach((column) => {
      const heading = document.createElement("th");
      heading.scope = "col";
      heading.textContent = column.number ? "NO" : column.label;
      headerRow.append(heading);
    });
    tableHead.append(headerRow);

    const minimumRows = Math.max(10, participants.length);
    for (let rowIndex = 0; rowIndex < minimumRows; rowIndex += 1) {
      const participant = participants[rowIndex];
      const row = document.createElement("tr");
      if (!participant) row.className = "blank-row";
      columns.forEach((column) => {
        const cell = document.createElement("td");
        if (column.number) {
          cell.textContent = String(rowIndex + 1);
          cell.className = "number-cell";
        } else if (participant && column.signature) {
          const imageData = getValue(participant, column);
          if (typeof imageData === "string" && /^data:image\/(?:png|jpeg);base64,/i.test(imageData)) {
            const image = document.createElement("img");
            image.className = "participant-signature";
            image.src = imageData;
            image.alt = "Tanda tangan peserta";
            cell.append(image);
          }
        } else if (participant) {
          cell.textContent = String(getValue(participant, column) ?? "");
        }
        row.append(cell);
      });
      tableBody.append(row);
    }
  }

  function renderActivity(activity, id) {
    const event = activity.event || {};
    const location = String(event.location || "");
    const locationLines = location.split(/\r?\n/);
    document.querySelector("#event-agenda").textContent = event.name || "—";
    document.querySelector("#event-date").textContent = displayDate(event.date, true);
    document.querySelector("#event-time").textContent = event.time || "—";
    document.querySelector("#event-location").textContent = locationLines[0] || "—";
    const address = event.address || locationLines.slice(1).join("\n").trim();
    if (address) {
      document.querySelector("#event-address").textContent = address;
      document.querySelector("#address-row").hidden = false;
    }

    const columns = getConfiguredColumns(activity);
    const participants = getActivityParticipants(id);
    renderTable(columns, participants);
    form.hidden = false;
  }

  function initialize() {
    try {
      if (localStorage.getItem("role") !== "pegawai") {
        window.location.replace("index.html");
        return;
      }

      const id = new URLSearchParams(window.location.search).get("id");
      if (!id) {
        unavailable.hidden = false;
        return;
      }
      backLink.href = `hasil-kegiatan.html?id=${encodeURIComponent(id)}`;

      const activities = readJson("activities", []);
      if (!Array.isArray(activities)) throw new TypeError("Format daftar kegiatan tidak valid.");
      const activity = activities.find((item) => item && String(item.id) === id);
      if (!activity || !Array.isArray(activity.selectedLists) || !activity.selectedLists.includes(LIST_KEY)) {
        unavailable.hidden = false;
        return;
      }
      renderActivity(activity, id);
    } catch (error) {
      console.error("Daftar hadir tidak dapat dibuka.", error);
      unavailable.hidden = false;
    }
  }

  document.querySelector("#print-button").addEventListener("click", () => window.print());
  initialize();
})();
