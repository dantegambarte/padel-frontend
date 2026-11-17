// Applies the saved (or system) dark theme before the first paint, so the page
// does not flash light. Loaded as an external, render-blocking script from
// index.html because the Content-Security-Policy forbids inline scripts.
(function () {
  try {
    var saved = localStorage.getItem('padelsys-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
