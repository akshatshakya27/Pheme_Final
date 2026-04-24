document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    sendViolation("TAB_SWITCH");
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    sendViolation("EXIT_FULLSCREEN");
  }
});
