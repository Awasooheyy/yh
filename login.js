const form = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const errorMessage = document.querySelector("#login-error");
const passwordToggle = document.querySelector("#password-toggle");
const roleOptions = [...document.querySelectorAll("[data-login-role]")];
const loginDescription = document.querySelector(".login-card-heading p");
const loginTopLabel = document.querySelector(".login-top-label");
const demoHint = document.querySelector("#demo-hint");
let selectedRole = "pegawai";

function selectRole(role) {
  selectedRole = role;
  roleOptions.forEach((option) => {
    const selected = option.dataset.loginRole === role;
    option.classList.toggle("is-selected", selected);
    option.setAttribute("aria-pressed", String(selected));
  });
  const isParticipant = role === "peserta";
  loginDescription.textContent = isParticipant
    ? "Masuk sebagai peserta untuk mengisi data kegiatan sosialisasi."
    : "Masuk sebagai pegawai untuk mengelola kegiatan sosialisasi.";
  loginTopLabel.textContent = isParticipant ? "Portal peserta" : "Portal pegawai";
  demoHint.innerHTML = isParticipant
    ? 'Demo login: <strong>peserta</strong> / <strong>peserta123</strong>'
    : 'Demo login: <strong>pegawai</strong> / <strong>pegawai123</strong>';
  clearLoginError();
}

function showLoginError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  usernameInput.setAttribute("aria-invalid", usernameInput.value.trim() ? "false" : "true");
  passwordInput.setAttribute("aria-invalid", passwordInput.value ? "false" : "true");
}

function clearLoginError() {
  errorMessage.hidden = true;
  errorMessage.textContent = "";
  usernameInput.removeAttribute("aria-invalid");
  passwordInput.removeAttribute("aria-invalid");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showLoginError("Username dan password wajib diisi.");
    (!username ? usernameInput : passwordInput).focus();
    return;
  }

  const validCredentials = selectedRole === "pegawai"
    ? username === "pegawai" && password === "pegawai123"
    : username === "peserta" && password === "peserta123";
  if (!validCredentials) {
    showLoginError("Username atau password yang Anda masukkan tidak sesuai.");
    passwordInput.focus();
    passwordInput.select();
    return;
  }

  clearLoginError();
  try {
    localStorage.setItem("role", selectedRole);
  } catch (error) {
    console.error("Role pengguna tidak dapat disimpan.", error);
    showLoginError("Sesi tidak dapat disimpan. Aktifkan penyimpanan lokal pada browser Anda.");
    return;
  }
  window.location.href = selectedRole === "pegawai" ? "pilih-daftar.html" : "peserta/peserta.html";
});

roleOptions.forEach((option) => {
  option.addEventListener("click", () => selectRole(option.dataset.loginRole));
});

passwordToggle.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  passwordToggle.setAttribute("aria-label", isPassword ? "Sembunyikan password" : "Tampilkan password");
  passwordToggle.setAttribute("aria-pressed", String(isPassword));
});

form.addEventListener("input", clearLoginError);
