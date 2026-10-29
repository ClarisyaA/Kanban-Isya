export type Priority = "low" | "medium" | "high";

export type Project = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type Column = {
  id: string;
  projectId: string;
  name: string;
  position: number;
};

export type Task = {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  startDate: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  position: number;
};

export const ALL_PROJECTS = "all";

export const PROJECT_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];

export const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
