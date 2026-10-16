(function () {
  "use strict";

  const LISTS = {
    hadir: { label: "Daftar Hadir", className: "hadir" },
    souvenir: { label: "Suvenir", className: "souvenir" },
    uang_saku: { label: "Uang Saku", className: "uang_saku" },
  };
  const SIGNATURE_LABELS = ["tanda_tangan", "tanda_tangan_daftar_hadir", "tanda_tangan_suvenir", "tanda_tangan_uang_saku"];
  const participantsKey = (id) => `sosialisasi.participants.${encodeURIComponent(id)}`;
  const content = document.querySelector("#results-content");
  const unavailable = document.querySelector("#results-unavailable");
  const tabs = document.querySelector("#list-tabs");
  const tableHead = document.querySelector("#results-table-head");
  const tableBody = document.querySelector("#results-table-body");
  const tableColumns = document.querySelector("#results-table-columns");
  const count = document.querySelector("#participant-count");
  const search = document.querySelector("#participant-search");
  const ktpDialog = document.querySelector("#ktp-dialog");
  const ktpImage = document.querySelector("#ktp-dialog-image");
  const issuedDate = document.querySelector("#issued-date");
  const activeListTitle = document.querySelector("#active-list-title");
  let activity;
  let activityParticipants = [];
  let activeList = "";
  let columns = [];
  let sortKey = "";
  let sortDirection = 1;

  function readJson(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  }

  function slugify(value) {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("id").trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function formatDate(value, withWeekday = false) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat("id-ID", {
        ...(withWeekday ? { weekday: "long" } : {}),
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
  }

  function getColumnInfo(column) {
    const label = typeof column === "string"
      ? column.trim()
      : String(column?.label || column?.name || "").trim();
    const slug = slugify(label);
    if (!label || slug === "no") return null;
    const signature = SIGNATURE_LABELS.includes(slug);
    if (signature) return { key: activeList, label: "TTD", signature: true };

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
    const key = aliases[slug] || slug;
    return {
      key: String((typeof column === "object" && column && (column.id || column.key)) || key),
      fallbackKey: key,
      label: key === "whatsapp" ? "NOMOR WA" : key === "nama" ? "NAMA" : label.toLocaleUpperCase("id"),
      signature: false,
    };
  }

  function getColumnsForList(listKey) {
    const listColumns = Array.isArray(activity.columns?.[listKey]) ? activity.columns[listKey] : [];
    const configured = listColumns
      .filter((column) => !column || typeof column !== "object" || column.enabled !== false)
      .map(getColumnInfo)
      .filter(Boolean);
    const result = [{ key: "row_number", label: "No.", number: true }, ...configured];
    if (!configured.some((column) => column.signature)) {
      result.push({ key: listKey, label: LISTS[listKey].label, signature: true });
    }
    return result;
  }

  function getParticipantsForActivity(id) {
    const scoped = readJson(participantsKey(id), []);
    if (!Array.isArray(scoped)) throw new TypeError("Format data peserta kegiatan tidak valid.");
    const legacy = readJson("sosialisasi.participantData", null);
    if (legacy && typeof legacy === "object" && String(legacy.eventId) === id
      && !scoped.some((participant) => participant?.id === legacy.id)) {
      scoped.push(legacy);
    }
    return scoped.filter((participant) => participant && String(participant.eventId) === id);
  }

  function renderEventInfo() {
    const event = activity.event || {};
    document.querySelector("#event-name").textContent = event.name || "Kegiatan tanpa nama";
    document.querySelector("#event-date").textContent = formatDate(event.date, true);
    document.querySelector("#event-time").textContent = event.time || "—";
    const locationLines = String(event.location || "").split(/\r?\n/);
    document.querySelector("#event-location").textContent = locationLines[0] || "—";
    const address = String(event.address || locationLines.slice(1).join("\n")).trim();
    if (address) {
      document.querySelector("#event-address").textContent = address;
      document.querySelector("#address-row").hidden = false;
    }
    activeListTitle.textContent = LISTS[activeList].label.toLocaleUpperCase("id");
    document.querySelector("#print-results").textContent = `Cetak ${LISTS[activeList].label}`;
    issuedDate.textContent = "Tanggal dikeluarkan :";
  }

  function renderTabs() {
    tabs.replaceChildren();
    tabs.hidden = activity.selectedLists.length < 2;
    activity.selectedLists.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "tab";
      button.id = `tab-${key}`;
      button.dataset.list = key;
      button.setAttribute("aria-selected", String(activeList === key));
      button.className = `results-tab${activeList === key ? " is-active" : ""}`;
      button.textContent = LISTS[key].label;
      tabs.append(button);
    });
  }

  function getCellValue(participant, column) {
    if (column.number) return "";
    if (column.signature) return participant.signatures?.[column.key] || "";
    const data = participant.data && typeof participant.data === "object" ? participant.data : {};
    if (Object.hasOwn(data, column.key)) return data[column.key];
    if (Object.hasOwn(data, column.fallbackKey)) return data[column.fallbackKey];
    return "";
  }

  function getVisibleParticipants() {
    const query = search.value.trim().toLocaleLowerCase("id");
    let visible = activityParticipants.filter((participant) => {
      if (!query) return true;
      const data = participant.data && typeof participant.data === "object" ? participant.data : {};
      return Object.values(data).some((value) => String(value ?? "").toLocaleLowerCase("id").includes(query));
    });
    const sortColumn = columns.find((column) => column.key === sortKey);
    if (sortColumn) {
      visible = [...visible].sort((left, right) => {
        const a = String(getCellValue(left, sortColumn) ?? "").toLocaleLowerCase("id");
        const b = String(getCellValue(right, sortColumn) ?? "").toLocaleLowerCase("id");
        return a.localeCompare(b, "id", { numeric: true }) * sortDirection;
      });
    }
    return visible;
  }

  function addSafeImage(parent, src, className, alt) {
    if (typeof src !== "string" || !src.startsWith("data:image/")) return false;
    const image = document.createElement("img");
    image.className = className === "results-signature" ? "participant-signature results-signature" : className;
    image.src = src;
    image.alt = alt;
    parent.append(image);
    return true;
  }

  function renderTable() {
    columns = getColumnsForList(activeList);
    activeListTitle.textContent = LISTS[activeList].label.toLocaleUpperCase("id");

    tableHead.replaceChildren();
    tableColumns.replaceChildren();
    const widthWeights = columns.map((column) => {
      if (column.number) return 4;
      if (column.signature) return 17;
      switch (column.fallbackKey) {
        case "nama": return 24;
        case "instansi": return 20;
        case "desa": return 14;
        case "kecamatan": return 16;
        case "whatsapp": return 20;
        default: return 17;
      }
    });
    const totalWeight = widthWeights.reduce((total, weight) => total + weight, 0);
    columns.forEach((column, index) => {
      const col = document.createElement("col");
      col.style.width = `${((widthWeights[index] / totalWeight) * 100).toFixed(2)}%`;
      tableColumns.append(col);
    });

    const headerRow = document.createElement("tr");
    columns.forEach((column) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = column.number ? "NO" : column.label;
      if (!column.number && !column.signature) {
        th.dataset.sortKey = column.key;
        th.tabIndex = 0;
        th.setAttribute("aria-label", `Urutkan berdasarkan ${column.label}`);
        th.setAttribute("aria-sort", sortKey === column.key
          ? sortDirection === 1 ? "ascending" : "descending"
          : "none");
      }
      headerRow.append(th);
    });
    tableHead.append(headerRow);

    const visible = getVisibleParticipants();
    tableBody.replaceChildren();
    visible.forEach((participant, index) => {
      const row = document.createElement("tr");
      const ktpColumn = columns.find((column) => column.fallbackKey === "nama")
        || columns.find((column) => !column.number);
      columns.forEach((column) => {
        const cell = document.createElement("td");
        if (column.number) {
          cell.textContent = String(index + 1);
        } else if (column.signature) {
          if (!addSafeImage(cell, getCellValue(participant, column), "results-signature", `Tanda tangan ${LISTS[activeList].label}`)) {
            cell.textContent = "—";
          }
        } else {
          const value = String(getCellValue(participant, column) ?? "");
          cell.textContent = value || "—";
        }
        if (ktpColumn?.key === column.key && typeof participant.ktp === "string"
            && /^data:image\/(?:png|jpeg);base64,/i.test(participant.ktp)) {
          const ktpButton = document.createElement("button");
          ktpButton.type = "button";
          ktpButton.className = "results-ktp-button";
          ktpButton.textContent = "Lihat KTP";
          ktpButton.addEventListener("click", () => {
            ktpImage.src = participant.ktp;
            ktpDialog.showModal();
          });
          cell.append(document.createElement("br"), ktpButton);
        }
        row.append(cell);
      });
      tableBody.append(row);
    });
    const blankRowCount = Math.max(0, 10 - visible.length);
    for (let index = 0; index < blankRowCount; index += 1) {
      const row = document.createElement("tr");
      row.className = "blank-row sheet-blank-row";
      columns.forEach((column) => {
        const cell = document.createElement("td");
        if (column.number) cell.textContent = String(visible.length + index + 1);
        row.append(cell);
      });
      tableBody.append(row);
    }
    count.textContent = activityParticipants.length === 0
      ? "0 peserta — Belum ada peserta yang mengisi formulir"
      : `${activityParticipants.length} peserta mengirim formulir`;
    if (visible.length === 0 && activityParticipants.length > 0) {
      count.textContent = `${activityParticipants.length} peserta · Tidak ada yang cocok dengan pencarian`;
    }
    tableHead.closest("table").hidden = false;
  }

  function csvEscape(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const exportColumns = columns;
    const rows = [
      exportColumns.map((column) => column.number ? "NO" : column.label),
      ...getVisibleParticipants().map((participant, index) =>
        exportColumns.map((column) => {
          if (column.number) return index + 1;
          const value = getCellValue(participant, column);
          return column.signature ? (value ? "Ada" : "Belum ada") : value;
        })),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hasil-${slugify(activity.event?.name || "kegiatan")}-${activeList}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
      const activities = readJson("activities", []);
      if (!Array.isArray(activities)) throw new TypeError("Format daftar kegiatan tidak valid.");
      activity = activities.find((item) => item && String(item.id) === id);
      if (!activity) {
        unavailable.hidden = false;
        return;
      }
      activity.selectedLists = Array.isArray(activity.selectedLists)
        ? activity.selectedLists.filter((key) => Object.hasOwn(LISTS, key))
        : [];
      if (!activity.selectedLists.length) {
        unavailable.hidden = false;
        return;
      }
      activityParticipants = getParticipantsForActivity(id);
      activeList = activity.selectedLists[0];
      renderEventInfo();
      renderTabs();
      renderTable();
      content.hidden = false;
    } catch (error) {
      console.error("Hasil kegiatan tidak dapat dibaca.", error);
      unavailable.hidden = false;
    }
  }

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-list]");
    if (!button) return;
    activeList = button.dataset.list;
    renderTabs();
    renderEventInfo();
    renderTable();
  });
  search.addEventListener("input", renderTable);
  tableHead.addEventListener("click", (event) => {
    const header = event.target.closest("th[data-sort-key]");
    if (!header) return;
    if (sortKey === header.dataset.sortKey) sortDirection *= -1;
    else {
      sortKey = header.dataset.sortKey;
      sortDirection = 1;
    }
    renderTable();
  });
  tableHead.addEventListener("keydown", (event) => {
    const header = event.target.closest("th[data-sort-key]");
    if (!header || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (sortKey === header.dataset.sortKey) sortDirection *= -1;
    else {
      sortKey = header.dataset.sortKey;
      sortDirection = 1;
    }
    renderTable();
  });
  document.querySelector("#export-results").addEventListener("click", exportCsv);
  document.querySelector("#print-results").addEventListener("click", () => window.print());
  document.querySelector("#close-ktp-dialog").addEventListener("click", () => {
    ktpDialog.close();
    ktpImage.removeAttribute("src");
  });
  ktpDialog.addEventListener("close", () => ktpImage.removeAttribute("src"));
  document.addEventListener("DOMContentLoaded", initialize);
})();
