function getConfig(name, defaultValue = null) {
  // If inside a docker container, prefer window.ENV, then build-time env
  const runtimeValue = window.ENV !== undefined ? window.ENV[name] : undefined;

  return runtimeValue || import.meta.env[name] || defaultValue;
}

export function getBackendUrl() {
  return getConfig("VITE_BACKEND_URL");
}

export function getHoursCloseTicketsAuto() {
  return getConfig("VITE_HOURS_CLOSE_TICKETS_AUTO");
}
