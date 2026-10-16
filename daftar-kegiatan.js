const LISTS = {
  hadir: "Daftar Hadir",
  souvenir: "Suvenir",
  uang_saku: "Uang Saku",
};
const list = document.querySelector("#activity-list");
const error = document.querySelector("#activity-list-error");

function formatDate(dateValue) {
  return window.SosialisasiApp.formatDate(dateValue) || "Tanggal belum diatur";
}

function renderActivities(activities) {
  list.replaceChildren();
  document.querySelector("#activity-count").textContent = `${activities.length} kegiatan`;
  if (activities.length === 0) {
    const empty = document.createElement("div");
    empty.className = "activity-list-empty";
    empty.textContent = "Belum ada kegiatan yang dibuat.";
    list.append(empty);
    return;
  }

  [...activities].reverse().forEach((activity) => {
    const card = document.createElement("article");
    card.className = "activity-item";
    const details = document.createElement("div");
    details.className = "activity-item-details";
    const title = document.createElement("h3");
    title.textContent = activity.event?.name || "Kegiatan tanpa nama";
    const metadata = document.createElement("p");
    metadata.textContent = `${formatDate(activity.event?.date)} · ${activity.event?.time || "Waktu belum diatur"} · ${activity.event?.location || "Tempat belum diatur"}`;
    details.append(title, metadata);

    const tags = document.createElement("div");
    tags.className = "activity-item-lists";
    (Array.isArray(activity.selectedLists) ? activity.selectedLists : []).forEach((key) => {
      if (!Object.hasOwn(LISTS, key)) return;
      const tag = document.createElement("span");
      tag.className = `activity-tag ${key}`;
      tag.textContent = LISTS[key];
      tags.append(tag);
    });

    const state = document.createElement("span");
    state.className = "activity-state";
    state.textContent = activity.status === "active" ? "Aktif" : "Draft";
    const actions = document.createElement("div");
    actions.className = "activity-item-actions";
    actions.append(state);
    if (activity.id != null && String(activity.id)) {
      const resultLink = document.createElement("a");
      resultLink.className = "button button-secondary activity-results-link";
      resultLink.href = `hasil-kegiatan.html?id=${encodeURIComponent(String(activity.id))}`;
      resultLink.textContent = "Lihat Data Peserta";
      actions.append(resultLink);
    }
    card.append(details, tags, actions);
    list.append(card);
  });
}

try {
  if (localStorage.getItem("role") !== "pegawai") {
    window.location.replace("index.html");
  }
  const activities = JSON.parse(localStorage.getItem("activities")) || [];
  if (!Array.isArray(activities)) throw new TypeError("Format daftar kegiatan tidak valid.");
  renderActivities(activities);
} catch (exception) {
  console.error("Daftar kegiatan tidak dapat dibaca.", exception);
  error.textContent = "Daftar kegiatan tidak dapat dibaca dari penyimpanan lokal.";
  error.hidden = false;
  renderActivities([]);
}
