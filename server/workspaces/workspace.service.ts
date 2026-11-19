import { prisma } from "../db/prisma.js";

export async function createProject(
  workspaceId: string,
  userId: string,
  input: { name: string; color?: string | null },
) {
  return prisma.project.create({
    data: {
      workspaceId,
      createdById: userId,
      name: input.name,
      color: input.color ?? null,
    },
    select: { id: true, name: true, color: true },
  });
}

export async function addWorkspaceMember(workspaceId: string, email: string) {
  const user = await prisma.user.findFirst({
    where: { email, disabledAt: null },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { status: "not_found" as const };

  const existingMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { userId: true },
  });
  if (existingMembership) return { status: "already_member" as const };

  const membership = await prisma.workspaceMember.create({
    data: { workspaceId, userId: user.id },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });

  return {
    status: "added" as const,
    member: { ...membership.user, role: membership.role },
  };
}

export async function getWorkspaceForUser(userId: string, workspaceId?: string) {
  return prisma.workspaceMember.findFirst({
    where: { userId, ...(workspaceId ? { workspaceId } : {}) },
    orderBy: { joinedAt: "desc" },
    include: {
      workspace: {
        include: {
          projects: {
            where: { archivedAt: null },
            orderBy: { name: "asc" },
            select: { id: true, name: true, color: true },
          },
          members: {
            orderBy: { joinedAt: "asc" },
            select: {
              role: true,
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });
}

export async function listWorkspacesForUser(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    select: {
      role: true,
      workspace: { select: { id: true, name: true } },
    },
  });
  return memberships.map(({ role, workspace }) => ({
    ...workspace,
    role,
  }));
}
