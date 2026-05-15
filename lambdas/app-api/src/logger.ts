/**
 * Single-line JSON logs for CloudWatch (works with Lambda JSON log format).
 */
export function log(record: Record<string, unknown>): void {
  const line = JSON.stringify(record);
  console.log(line);
}

