type LogLevel = 'info' | 'warn' | 'error';

export function logOperationalEvent(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {},
) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(details),
  });
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else console.info(record);
}

function sanitize(details: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (/token|secret|authorization|password/i.test(key)) return [key, '[redacted]'];
      if (value instanceof Error)
        return [key, { name: value.name, message: value.message }];
      return [key, value];
    }),
  );
}
