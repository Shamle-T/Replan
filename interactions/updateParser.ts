import { addMinutes } from "../scheduler/slots";
import type { ScheduleChange, ScheduledTask, Task } from "../scheduler/types";

export interface ParseUpdateContext {
  currentTime: Date;
  currentTask?: Task;
  currentPlacement?: ScheduledTask;
}

export type ParseUpdateResult =
  | { ok: true; change: ScheduleChange; normalizedIntent: string }
  | { ok: false; message: string };

export function parseUpdateMessage(
  message: string,
  context: ParseUpdateContext,
): ParseUpdateResult {
  const text = message.trim().toLowerCase();
  const task = context.currentTask;
  const placement = context.currentPlacement;

  if (!text) {
    return { ok: false, message: "Enter an update about the current task." };
  }
  if (!task) {
    return {
      ok: false,
      message: "There is no current task to apply this update to.",
    };
  }

  if (/\b(cancel|cancelled|canceled|no longer|not needed)\b/.test(text)) {
    return {
      ok: true,
      normalizedIntent: "cancel current task",
      change: { type: "TASK_CANCELLED", taskId: task.id },
    };
  }

  if (/\b(skip|skipping)\b/.test(text)) {
    return {
      ok: true,
      normalizedIntent: "skip current task",
      change: { type: "TASK_SKIPPED", taskId: task.id },
    };
  }

  if (/\b(done|finished|complete|completed|finish early|finished early)\b/.test(text)) {
    return {
      ok: true,
      normalizedIntent: "complete current task",
      change: {
        type: "TASK_COMPLETED",
        taskId: task.id,
        actualEnd: new Date(context.currentTime.getTime()),
      },
    };
  }

  const minuteMatch = text.match(/(?:\+|another\s+|need\s+|needs\s+)?(15|30|45|60)\s*(?:m|min|mins|minute|minutes)?\b/);
  if (minuteMatch && placement) {
    const extraMinutes = Number(minuteMatch[1]);
    return {
      ok: true,
      normalizedIntent: `extend current task by ${extraMinutes} minutes`,
      change: {
        type: "TASK_OVERRUN",
        taskId: task.id,
        newExpectedEnd: addMinutes(placement.end, extraMinutes),
      },
    };
  }

  return {
    ok: false,
    message:
      "I could not map that to a safe structured update. Try “done”, “need +15m”, “need +30m”, “skip”, or “cancel”.",
  };
}
