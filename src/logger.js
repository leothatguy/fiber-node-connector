const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

export function createLogger({ level = "info", format = "pretty" } = {}) {
  if (!(level in LEVELS)) throw new Error(`Unsupported LOG_LEVEL: ${level}`);
  if (!["pretty", "json"].includes(format)) {
    throw new Error(`Unsupported LOG_FORMAT: ${format}`);
  }

  function emit(eventLevel, event, fields = {}) {
    if (LEVELS[eventLevel] < LEVELS[level]) return;
    const record = {
      time: new Date().toISOString(),
      level: eventLevel,
      event,
      ...fields,
    };
    const line =
      format === "json"
        ? JSON.stringify(record)
        : `${record.time} ${eventLevel.toUpperCase()} ${event}${formatFields(fields)}`;
    const target = eventLevel === "error" ? console.error : eventLevel === "warn" ? console.warn : console.log;
    target(line);
  }

  return Object.freeze({
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
  });
}

function formatFields(fields) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  return entries.length === 0
    ? ""
    : ` ${entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ")}`;
}
