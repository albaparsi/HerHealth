/** Anonymous id kept in this browser, so scores pair up and progress can be shown without an account. */
export function learnerId() {
  try {
    let id = localStorage.getItem("her-signs-learner");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("her-signs-learner", id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

/** The id if this browser already has one, without creating it. */
export function existingLearnerId() {
  try {
    return localStorage.getItem("her-signs-learner");
  } catch {
    return null;
  }
}
