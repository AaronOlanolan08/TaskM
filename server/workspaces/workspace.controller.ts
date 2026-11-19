import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  addWorkspaceMember,
  archiveProject,
  createProject,
  getWorkspaceForUser,
  listWorkspacesForUser,
  updateProject,
} from "./workspace.service.js";

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

const addWorkspaceMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

async function workspaceForRequest(request: Request, response: Response) {
  const query = z.object({ workspaceId: z.string().uuid().optional() }).safeParse(request.query);
  if (!query.success) {
    response.status(400).json({ error: "Invalid workspace selection." });
    return null;
  }
  const membership = await getWorkspaceForUser(request.auth!.userId, query.data.workspaceId);
  if (!membership) {
    response.status(404).json({ error: "No workspace is available for this account." });
    return null;
  }
  return membership;
}

export async function listWorkspacesController(
  request: Request,
  response: Response,
): Promise<void> {
  response.json({ items: await listWorkspacesForUser(request.auth!.userId) });
}

export async function addWorkspaceMemberController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = addWorkspaceMemberSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const membership = await workspaceForRequest(request, response);
  if (!membership) return;

  try {
    const result = await addWorkspaceMember(
      membership.workspaceId,
      parsed.data.email,
    );
    if (result.status === "not_found") {
      response.status(404).json({ error: "No active Taskm account was found with that email." });
      return;
    }
    if (result.status === "already_member") {
      response.status(409).json({ error: "That person is already a member of this workspace." });
      return;
    }

    response.status(201).json({ member: result.member });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      response.status(409).json({ error: "That person is already a member of this workspace." });
      return;
    }
    throw error;
  }
}

export async function createProjectController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = createProjectSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter a project name and valid color." });
    return;
  }

  const membership = await workspaceForRequest(request, response);
  if (!membership) return;

  try {
    const project = await createProject(
      membership.workspaceId,
      request.auth!.userId,
      parsed.data,
    );
    response.status(201).json({ project });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      response.status(409).json({ error: "A project with that name already exists." });
      return;
    }
    throw error;
  }
}

export async function updateProjectController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = createProjectSchema.safeParse(request.body);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!parsed.success || !id.success) {
    response.status(400).json({ error: "Enter a project name and valid color." });
    return;
  }

  const membership = await workspaceForRequest(request, response);
  if (!membership) return;

  try {
    const project = await updateProject(
      membership.workspaceId,
      id.data,
      { name: parsed.data.name, color: parsed.data.color ?? null },
    );
    if (!project) {
      response.status(404).json({ error: "Project not found." });
      return;
    }
    response.json({ project });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      response.status(409).json({ error: "A project with that name already exists." });
      return;
    }
    throw error;
  }
}

export async function deleteProjectController(
  request: Request,
  response: Response,
): Promise<void> {
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ error: "Invalid project id." });
    return;
  }

  const membership = await workspaceForRequest(request, response);
  if (!membership) return;

  if (!(await archiveProject(membership.workspaceId, id.data))) {
    response.status(404).json({ error: "Project not found." });
    return;
  }
  response.status(204).end();
}

export async function currentWorkspaceController(
  request: Request,
  response: Response,
): Promise<void> {
  const membership = await workspaceForRequest(request, response);
  if (!membership) return;

  response.json({
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    role: membership.role,
    projects: membership.workspace.projects,
    members: membership.workspace.members.map(({ role, user }) => ({
      ...user,
      role,
    })),
  });
}
