(function () {
  var mode = window.localStorage.getItem('theme');
  if (mode === 'dark') {
    var el = document.querySelector('body');
    if (el) {
      el.classList.toggle('dark-mode', true);
    }
  }
})();
