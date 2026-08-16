import type { ScheduledTask, Task } from "../scheduler/types";
import { atLocalTime } from "./time";

export interface DemoState {
  tasks: Task[];
  schedule: ScheduledTask[];
  dayStart: Date;
  dayEnd: Date;
  simulationTime: Date;
}

export function createDemoState(baseDate: Date): DemoState {
  const dayStart = atLocalTime(baseDate, 6, 0);
  const dayEnd = atLocalTime(baseDate, 24, 0);

  const tasks: Task[] = [
    {
      id: "lecture",
      title: "Algorithms lecture",
      description: "FIT lecture on campus",
      durationMinutes: 60,
      priority: 5,
      category: "academic",
      fixedStart: atLocalTime(baseDate, 9, 0),
      fixedEnd: atLocalTime(baseDate, 10, 0),
      travelMinutesBefore: 10,
      location: "Lecture hall",
      optional: false,
      status: "planned",
    },
    {
      id: "assignment",
      title: "Study for A1",
      description: "Focused assignment preparation",
      durationMinutes: 90,
      priority: 5,
      category: "academic",
      earliestStart: atLocalTime(baseDate, 10, 0),
      deadline: atLocalTime(baseDate, 18, 0),
      optional: false,
      status: "planned",
    },
    {
      id: "lunch",
      title: "Lunch",
      durationMinutes: 60,
      priority: 3,
      category: "social",
      earliestStart: atLocalTime(baseDate, 12, 0),
      latestEnd: atLocalTime(baseDate, 14, 0),
      travelMinutesBefore: 10,
      travelMinutesAfter: 10,
      location: "Campus cafe",
      optional: false,
      status: "planned",
    },
    {
      id: "meeting",
      title: "Project meeting",
      durationMinutes: 60,
      priority: 5,
      category: "other",
      fixedStart: atLocalTime(baseDate, 14, 0),
      fixedEnd: atLocalTime(baseDate, 15, 0),
      travelMinutesBefore: 5,
      optional: false,
      status: "planned",
    },
    {
      id: "paper",
      title: "Read research paper",
      durationMinutes: 60,
      priority: 3,
      category: "development",
      earliestStart: atLocalTime(baseDate, 15, 0),
      deadline: atLocalTime(baseDate, 20, 0),
      optional: false,
      status: "planned",
    },
    {
      id: "emails",
      title: "Reply to admin emails",
      durationMinutes: 30,
      priority: 1,
      category: "other",
      earliestStart: atLocalTime(baseDate, 16, 0),
      latestEnd: atLocalTime(baseDate, 17, 0),
      optional: true,
      status: "planned",
    },
    {
      id: "gym",
      title: "Gym session",
      durationMinutes: 60,
      priority: 1,
      category: "fitness",
      latestEnd: atLocalTime(baseDate, 21, 0),
      travelMinutesBefore: 10,
      location: "Gym",
      optional: true,
      status: "planned",
    },
  ];

  // Deliberately valid but sub-optimal demo schedule. The first-load experience
  // is meant to show the value of the optimizer: the user sees avoidable gaps,
  // presses "Optimize my day", and then watches flexible work compact around
  // the fixed commitments. Nothing is optimized implicitly on page load.
  const schedule: ScheduledTask[] = [
    {
      taskId: "lecture",
      start: atLocalTime(baseDate, 9, 0),
      end: atLocalTime(baseDate, 10, 0),
    },
    {
      taskId: "assignment",
      start: atLocalTime(baseDate, 10, 30),
      end: atLocalTime(baseDate, 12, 0),
    },
    {
      taskId: "lunch",
      start: atLocalTime(baseDate, 12, 30),
      end: atLocalTime(baseDate, 13, 30),
    },
    {
      taskId: "meeting",
      start: atLocalTime(baseDate, 14, 0),
      end: atLocalTime(baseDate, 15, 0),
    },
    {
      taskId: "paper",
      start: atLocalTime(baseDate, 15, 30),
      end: atLocalTime(baseDate, 16, 30),
    },
    {
      taskId: "emails",
      start: atLocalTime(baseDate, 16, 30),
      end: atLocalTime(baseDate, 17, 0),
    },
    {
      taskId: "gym",
      start: atLocalTime(baseDate, 18, 30),
      end: atLocalTime(baseDate, 19, 30),
    },
  ];

  return {
    tasks,
    schedule,
    dayStart,
    dayEnd,
    simulationTime: atLocalTime(baseDate, 8, 30),
  };
}
