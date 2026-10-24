import { lessonUrl } from "./config.js";

let level = "everyday";
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
document.getElementById("page").textContent = tab?.title ?? "";

for (const button of document.querySelectorAll("[data-level]")) {
  button.addEventListener("click", () => {
    level = button.dataset.level;
    for (const b of document.querySelectorAll("[data-level]")) b.setAttribute("aria-pressed", String(b === button));
  });
}

const open = (url) => {
  chrome.tabs.create({ url });
  window.close();
};

document.getElementById("teach").addEventListener("click", () => open(lessonUrl({ link: tab?.url, level })));
document.getElementById("topic-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const topic = document.getElementById("topic").value.trim();
  if (topic) open(lessonUrl({ topic, level }));
});
