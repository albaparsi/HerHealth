// Where Her Signs is hosted.
export const APP = "https://her-health-wheat.vercel.app";

/** Opens Her Signs and starts making a lesson right away. */
export function lessonUrl({ link, topic, level = "everyday" }) {
  const params = new URLSearchParams({ level, auto: "1" });
  if (link) params.set("link", link);
  if (topic) params.set("topic", topic);
  return `${APP}/make?${params}`;
}
