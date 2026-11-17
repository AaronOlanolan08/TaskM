import { TaskPriority, TaskStatus, type Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

const taskRelations = {
  project: { select: { id: true, name: true, color: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
};

export type TaskInput = {
  title?: string;
  description?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
};

export type TaskFilters = {
  page: number;
  limit: number;
  query?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
};

async function validWorkspaceRelations(
  workspaceId: string,
  input: Pick<TaskInput, "projectId" | "assigneeId">,
) {
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, workspaceId, archivedAt: null },
      select: { id: true },
    });
    if (!project) return false;
  }

  if (input.assigneeId) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: input.assigneeId,
        },
      },
      select: { userId: true },
    });
    if (!membership) return false;
  }

  return true;
}

export async function listTasks(workspaceId: string, filters: TaskFilters) {
  const where: Prisma.TaskWhereInput = {
    workspaceId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.query
      ? {
          OR: [
            { title: { contains: filters.query, mode: "insensitive" } },
            { description: { contains: filters.query, mode: "insensitive" } },
            { project: { name: { contains: filters.query, mode: "insensitive" } } },
            { assignee: { name: { contains: filters.query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: taskRelations,
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.task.count({ where }),
  ]);

  return { items, total, page: filters.page, limit: filters.limit };
}

export async function createTask(
  workspaceId: string,
  userId: string,
  input: TaskInput,
) {
  if (!(await validWorkspaceRelations(workspaceId, input))) return null;

  const status = input.status ?? TaskStatus.TODO;
  return prisma.task.create({
    data: {
      workspaceId,
      createdById: userId,
      title: input.title!,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      assigneeId: input.assigneeId ?? null,
      status,
      priority: input.priority ?? TaskPriority.MEDIUM,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
    },
    include: taskRelations,
  });
}

export async function updateTask(
  workspaceId: string,
  taskId: string,
  input: TaskInput,
) {
  if (!(await validWorkspaceRelations(workspaceId, input))) {
    return { kind: "invalid-relation" as const };
  }

  const data: Prisma.TaskUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueAt !== undefined
      ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
      : {}),
    ...(input.status !== undefined
      ? {
          status: input.status,
          completedAt: input.status === TaskStatus.COMPLETED ? new Date() : null,
        }
      : {}),
  };

  const result = await prisma.task.updateMany({
    where: { id: taskId, workspaceId },
    data,
  });
  if (result.count === 0) return { kind: "not-found" as const };

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
    include: taskRelations,
  });
  return task ? { kind: "updated" as const, task } : { kind: "not-found" as const };
}

export async function deleteTask(workspaceId: string, taskId: string) {
  const result = await prisma.task.deleteMany({
    where: { id: taskId, workspaceId },
  });
  return result.count > 0;
}
