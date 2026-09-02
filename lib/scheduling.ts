export function appointmentEnd(
  startsAt: Date | string,
  durationMinutes: number,
): Date {
  const start =
    startsAt instanceof Date ? startsAt.getTime() : new Date(startsAt).getTime();
  return new Date(start + Math.max(durationMinutes, 0) * 60_000);
}

export function rangesOverlap(
  leftStart: Date | string,
  leftEnd: Date | string,
  rightStart: Date | string,
  rightEnd: Date | string,
): boolean {
  return (
    new Date(leftStart).getTime() < new Date(rightEnd).getTime() &&
    new Date(leftEnd).getTime() > new Date(rightStart).getTime()
  );
}
