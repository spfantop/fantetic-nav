export const decodeTheme = () => "dark";

export const applyTheme = (t: string, source: string, disableLog: boolean) => {
  const bodyEl = document.querySelector("body")!;
  bodyEl.classList.toggle("dark-mode", true);
  if (!disableLog) {
    console.log(`[Apply Theme][${source}] ${t}`);
  }
};

export const initTheme = () => "dark";

