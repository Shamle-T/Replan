import type { SchedulingRequest } from "../scheduler/types";

export function findTimeRequest(taskId: string): SchedulingRequest {
  return { type: "FIND_TIME", taskId };
}

export function optimizeDayRequest(): SchedulingRequest {
  return { type: "OPTIMIZE_DAY" };
}
