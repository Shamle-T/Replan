import defaultPlan from "../data/default-plan.json";
import type { ScheduledTask, Task } from "../scheduler/types";
import { atLocalTime } from "./time";

export interface DemoState {
  tasks: Task[];
  schedule: ScheduledTask[];
  dayStart: Date;
  dayEnd: Date;
  simulationTime: Date;
}

type TimeField = "deadline" | "fixedStart" | "fixedEnd" | "earliestStart" | "latestEnd";

type DefaultPlanTask = Omit<Task, TimeField> & {
  [key in TimeField]?: string;
};

interface DefaultPlanScheduleItem {
  taskId: string;
  start: string;
  end: string;
}

interface DefaultPlan {
  version: number;
  dayStart: string;
  dayEnd: string;
  simulationTime: string;
  tasks: DefaultPlanTask[];
  schedule: DefaultPlanScheduleItem[];
}

const plan = defaultPlan as DefaultPlan;

export function createDemoState(baseDate: Date): DemoState {
  const taskIds = new Set(plan.tasks.map((task) => task.id));
  const tasks = plan.tasks.map((task) => {
    const converted = { ...task } as Task;
    for (const field of ["deadline", "fixedStart", "fixedEnd", "earliestStart", "latestEnd"] as const) {
      const value = task[field];
      if (value) converted[field] = parsePlanTime(baseDate, value, `${field} for ${task.id}`);
    }
    return converted;
  });

  const schedule = plan.schedule.map((item) => {
    if (!taskIds.has(item.taskId)) {
      throw new Error(`Default plan references unknown task: ${item.taskId}`);
    }
    return {
      taskId: item.taskId,
      start: parsePlanTime(baseDate, item.start, `schedule start for ${item.taskId}`),
      end: parsePlanTime(baseDate, item.end, `schedule end for ${item.taskId}`),
    };
  });

  return {
    tasks,
    schedule,
    dayStart: parsePlanTime(baseDate, plan.dayStart, "dayStart"),
    dayEnd: parsePlanTime(baseDate, plan.dayEnd, "dayEnd"),
    simulationTime: parsePlanTime(baseDate, plan.simulationTime, "simulationTime"),
  };
}

function parsePlanTime(baseDate: Date, value: string, label: string): Date {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid default plan time for ${label}: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    throw new Error(`Invalid default plan time for ${label}: ${value}`);
  }
  return atLocalTime(baseDate, hours, minutes);
}
