(function () {
  function applyDarkModeClass() {
    var mode = window.localStorage.getItem("theme");
    if (mode !== "dark") {
      return;
    }
    var el = document.body || document.documentElement;
    if (el && el.classList) {
      el.classList.add("dark-mode");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDarkModeClass, { once: true });
  } else {
    applyDarkModeClass();
  }
})();
