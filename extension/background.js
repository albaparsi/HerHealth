import { lessonUrl } from "./config.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "page", title: "Teach me this page", contexts: ["page"] });
  chrome.contextMenus.create({ id: "selection", title: "Teach me about “%s”", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url =
    info.menuItemId === "selection"
      ? lessonUrl({ topic: info.selectionText.trim().slice(0, 120) })
      : lessonUrl({ link: tab?.url });
  chrome.tabs.create({ url });
});
