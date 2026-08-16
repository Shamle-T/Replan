import { addMinutes } from "../scheduler";
import type { ScheduleChange, ScheduledTask, Task } from "../scheduler";

export function parseUpdateMessage(message: string, task: Task | undefined, placement: ScheduledTask | undefined, currentTime: Date): ScheduleChange | null {
  if (!task) return null;
  const text = message.trim().toLowerCase();
  if (/\b(cancel|cancelled|canceled)\b/.test(text)) return { type: "TASK_CANCELLED", taskId: task.id };
  if (/\b(skip|skipping)\b/.test(text)) return { type: "TASK_SKIPPED", taskId: task.id };
  if (/\b(done|finish|finished|complete|completed)\b/.test(text)) return { type: "TASK_COMPLETED", taskId: task.id, actualEnd: new Date(currentTime.getTime()) };
  const minutes = text.match(/\b(15|30|45|60)\s*(?:m|min|minutes)?\b/);
  if (minutes && placement) return { type: "TASK_OVERRUN", taskId: task.id, newExpectedEnd: addMinutes(placement.end, Number(minutes[1])) };
  return null;
}
