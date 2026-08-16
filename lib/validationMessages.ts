import type { Task, ValidationIssue } from "../scheduler/types";
import { formatTime } from "./time";

export interface FriendlyValidationMessage {
  title: string;
  detail: string;
}

export function friendlyValidationMessage(
  issue: ValidationIssue | undefined,
  tasks: Task[],
): FriendlyValidationMessage {
  if (!issue) {
    return {
      title: "Replan cannot safely make that timing change",
      detail: "The remaining schedule would overlap a protected commitment, miss a deadline, or fall outside an allowed time window.",
    };
  }

  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const related = issue.taskIds
    .map((id) => taskMap.get(id))
    .filter((task): task is Task => Boolean(task));
  const first = related[0];
  const second = related[1];

  if (issue.code === "OVERLAP" && first && second) {
    const fixed = [first, second].find((task) => task.fixedStart && task.fixedEnd);
    const other = fixed?.id === first.id ? second : first;
    if (fixed?.fixedStart) {
      return {
        title: "A fixed commitment is in the way",
        detail: `${fixed.title} starts at ${formatTime(fixed.fixedStart)}, so ${other.title} cannot be extended into that time.`,
      };
    }
    return {
      title: "These tasks would overlap",
      detail: `${first.title} and ${second.title} need the same time. Adjust one of them before applying this update.`,
    };
  }

  if (issue.code === "TRAVEL_OVERLAP" && first && second) {
    const beforeSecond = second.travelMinutesBefore ?? 0;
    const afterFirst = first.travelMinutesAfter ?? 0;
    const requestedInterval = first.bufferMinutesAfter ?? 0;
    const needed = beforeSecond + afterFirst + requestedInterval;
    return {
      title: requestedInterval > 0 ? "Your requested interval does not fit here" : "There is not enough travel time between these tasks",
      detail:
        needed > 0
          ? `${first.title} and ${second.title} need ${needed} minutes between them for travel${requestedInterval > 0 ? " and your chosen interval" : ""}. Move one task or reduce that buffer.`
          : `${first.title} and ${second.title} are too close together to fit safely.`,
    };
  }

  if (issue.code === "FIXED_TIME_MISMATCH" && first) {
    return {
      title: "This commitment has a fixed time",
      detail: `${first.title} cannot move unless you edit the commitment itself.`,
    };
  }

  if (issue.code === "MISSED_DEADLINE" && first) {
    return {
      title: "The deadline would be missed",
      detail: `${first.title} would finish after its deadline. Shorten it, move another task, or change the deadline.`,
    };
  }

  if (issue.code === "BEFORE_EARLIEST_START" && first) {
    return {
      title: "That time is too early",
      detail: `${first.title} cannot begin before its earliest allowed start.`,
    };
  }

  if (issue.code === "AFTER_LATEST_END" && first) {
    return {
      title: "That time is too late",
      detail: `${first.title} would finish outside its allowed time window.`,
    };
  }

  if (issue.code === "WEATHER_UNSUITABLE" && first) {
    return {
      title: "The weather does not match this outdoor task",
      detail: `${first.title} is kept open because the selected time is not inside a verified clear, dry weather window.`,
    };
  }

  if (issue.code === "OUTSIDE_DAY" && first) {
    return {
      title: "This falls outside your planning day",
      detail: `${first.title} and its travel time must fit between 6:00 AM and 12:00 AM.`,
    };
  }

  if (issue.code === "MANDATORY_UNSCHEDULED" && first) {
    return {
      title: `${first.title} cannot fit yet`,
      detail: "Replan could not place it without breaking a fixed commitment, deadline, availability window, travel buffer, or another hard constraint.",
    };
  }

  if (first) {
    return {
      title: "Replan cannot safely move the remaining schedule",
      detail: `${first.title} cannot be placed anywhere else without overlapping another task or breaking one of its fixed times, deadlines, travel buffers, or availability limits.`,
    };
  }

  return {
    title: "Replan cannot safely make that timing change",
    detail: "The remaining schedule would overlap a protected commitment, miss a deadline, or fall outside an allowed time window.",
  };
}
