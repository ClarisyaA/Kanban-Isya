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
  "#c2410c",
  "#0f766e",
  "#3f5f8a",
  "#a16207",
  "#7c3a5e",
  "#4d7c0f",
  "#57534e",
  "#b4534b",
];

export const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"];
