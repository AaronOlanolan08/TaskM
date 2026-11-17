import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createProject, getWorkspaceForUser } from "./workspace.service.js";

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

export async function createProjectController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = createProjectSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter a project name and valid color." });
    return;
  }

  const membership = await getWorkspaceForUser(request.auth!.userId);
  if (!membership) {
    response.status(404).json({ error: "No workspace is available for this account." });
    return;
  }

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

export async function currentWorkspaceController(
  request: Request,
  response: Response,
): Promise<void> {
  const membership = await getWorkspaceForUser(request.auth!.userId);
  if (!membership) {
    response.status(404).json({ error: "No workspace is available for this account." });
    return;
  }

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
