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

export async function getWorkspaceForUser(userId: string) {
  return prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
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
