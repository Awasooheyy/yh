const routes = {
  login: "index.html",
  lists: "pilih-daftar.html",
  event: "informasi-kegiatan.html",
  columns: "atur-kolom.html",
  review: "konfirmasi.html",
  success: "berhasil.html",
};

try {
  if (localStorage.getItem("role") !== "pegawai") {
    window.location.replace(routes.login);
  } else {
    const selectedLists = window.SosialisasiApp.getSelectedLists();
    const eventData = window.SosialisasiApp.getEventData();
    const draft = JSON.parse(localStorage.getItem("sosialisasi.employeeDraft")) || {};
    const step = draft.created ? "success"
      : !selectedLists.length ? "lists"
        : !eventData.name ? "event"
          : routes[draft.currentStep] ? draft.currentStep
            : "columns";
    window.location.replace(routes[step]);
  }
} catch (error) {
  console.error("Posisi kegiatan terakhir tidak dapat dibaca.", error);
  window.location.replace("pilih-daftar.html");
}
