(() => {
  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem("project-rag-theme");
  } catch {
    // Storage can be disabled; use the operating-system preference instead.
  }

  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : systemPrefersDark ? "dark" : "light";

  document.documentElement.dataset.theme = theme;
})();
