import type { Request, Response } from "express";
import { z } from "zod";
import { getWorkspaceForUser } from "../workspaces/workspace.service.js";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from "./task.service.js";

const statuses = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH"] as const;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(200).optional(),
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  projectId: z.string().uuid().optional(),
});

const taskFields = {
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
};

const createTaskSchema = z.object({
  ...taskFields,
  title: z.string().trim().min(1).max(200),
});

const updateTaskSchema = z.object(taskFields).refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required.",
);

async function workspaceIdForRequest(request: Request, response: Response) {
  const membership = await getWorkspaceForUser(request.auth!.userId);
  if (!membership) {
    response.status(404).json({ error: "No workspace is available for this account." });
    return null;
  }
  return membership.workspaceId;
}

export async function listTasksController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = listQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid task filters." });
    return;
  }

  const workspaceId = await workspaceIdForRequest(request, response);
  if (!workspaceId) return;

  response.json(await listTasks(workspaceId, parsed.data));
}

export async function createTaskController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = createTaskSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid task details." });
    return;
  }

  const workspaceId = await workspaceIdForRequest(request, response);
  if (!workspaceId) return;

  const task = await createTask(workspaceId, request.auth!.userId, parsed.data);
  if (!task) {
    response.status(400).json({ error: "Project or assignee is not in this workspace." });
    return;
  }

  response.status(201).json({ task });
}

export async function updateTaskController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = updateTaskSchema.safeParse(request.body);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!parsed.success || !id.success) {
    response.status(400).json({ error: "Invalid task update." });
    return;
  }

  const workspaceId = await workspaceIdForRequest(request, response);
  if (!workspaceId) return;

  const result = await updateTask(workspaceId, id.data, parsed.data);
  if (result.kind === "invalid-relation") {
    response.status(400).json({ error: "Project or assignee is not in this workspace." });
    return;
  }
  if (result.kind === "not-found") {
    response.status(404).json({ error: "Task not found." });
    return;
  }

  response.json({ task: result.task });
}

export async function deleteTaskController(
  request: Request,
  response: Response,
): Promise<void> {
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ error: "Invalid task id." });
    return;
  }

  const workspaceId = await workspaceIdForRequest(request, response);
  if (!workspaceId) return;

  if (!(await deleteTask(workspaceId, id.data))) {
    response.status(404).json({ error: "Task not found." });
    return;
  }
  response.status(204).end();
}
