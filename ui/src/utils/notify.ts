type NotifyType = "info" | "success" | "error";

const CONTAINER_ID = "van-nav-toast-container";

const getColor = (type: NotifyType) => {
  if (type === "success") return "#2f855a";
  if (type === "error") return "#c53030";
  return "#2b6cb0";
};

const ensureContainer = () => {
  let container = document.getElementById(CONTAINER_ID);
  if (container) {
    return container;
  }
  container = document.createElement("div");
  container.id = CONTAINER_ID;
  container.style.position = "fixed";
  container.style.top = "16px";
  container.style.right = "16px";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "8px";
  container.style.zIndex = "9999";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);
  return container;
};

const notify = (text: string, type: NotifyType = "info") => {
  if (typeof window === "undefined" || !text) {
    return;
  }
  const container = ensureContainer();
  const item = document.createElement("div");
  item.textContent = text;
  item.style.background = getColor(type);
  item.style.color = "#fff";
  item.style.padding = "10px 12px";
  item.style.borderRadius = "8px";
  item.style.fontSize = "13px";
  item.style.boxShadow = "0 6px 18px rgba(0,0,0,.22)";
  item.style.maxWidth = "360px";
  item.style.pointerEvents = "auto";
  item.style.opacity = "0";
  item.style.transform = "translateY(-4px)";
  item.style.transition = "all .18s ease";
  container.appendChild(item);
  requestAnimationFrame(() => {
    item.style.opacity = "1";
    item.style.transform = "translateY(0)";
  });
  window.setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(-4px)";
    window.setTimeout(() => item.remove(), 180);
  }, 2200);
};

export const notifyInfo = (text: string) => notify(text, "info");
export const notifySuccess = (text: string) => notify(text, "success");
export const notifyError = (text: string) => notify(text, "error");
