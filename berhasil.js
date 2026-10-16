const LISTS = {
  hadir: "Daftar Hadir",
  souvenir: "Suvenir",
  uang_saku: "Uang Saku",
};

function formatDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function renderActivity(activity) {
  const event = activity?.event || {};
  if (event.name) document.querySelector("#success-event-name").textContent = event.name;
  if (event.date) {
    const formattedDate = formatDate(event.date);
    if (formattedDate) document.querySelector("#success-event-date").textContent = formattedDate;
  }
  if (event.time) document.querySelector("#success-event-time").textContent = event.time;

  const badges = document.querySelector("#success-list-badges");
  badges.replaceChildren();
  const selectedLists = Array.isArray(activity?.selectedLists) ? activity.selectedLists : [];
  selectedLists.filter((key) => Object.hasOwn(LISTS, key)).forEach((key) => {
    const badge = document.createElement("span");
    badge.className = `success-list-badge ${key}`;
    badge.textContent = LISTS[key];
    badges.append(badge);
  });
  if (!badges.children.length) {
    const empty = document.createElement("span");
    empty.className = "success-list-empty";
    empty.textContent = "Belum ada daftar";
    badges.append(empty);
  }
}

try {
  const activity = JSON.parse(localStorage.getItem("createdEvent"))
    || JSON.parse(localStorage.getItem("createdActivity"));
  if (activity && typeof activity === "object" && activity.event) {
    renderActivity(activity);
  } else {
    const selectedLists = window.SosialisasiApp.getSelectedLists();
    const event = window.SosialisasiApp.getEventData();
    const destination = localStorage.getItem("role") !== "pegawai"
      ? "index.html"
      : !selectedLists.length
        ? "pilih-daftar.html"
        : event.name
          ? "konfirmasi.html"
          : "informasi-kegiatan.html";
    window.location.replace(destination);
  }
} catch (error) {
  console.error("Data kegiatan tersimpan tidak dapat dibaca.", error);
}

document.querySelector("#new-event-button").addEventListener("click", () => {
  try {
    window.SosialisasiApp.clearTemporaryData();
  } catch (error) {
    console.error("Konfigurasi sementara tidak dapat dibersihkan.", error);
    return;
  }
  window.location.href = "pilih-daftar.html";
});
