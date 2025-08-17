import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const refreshTokenService = {
  async createRefreshToken(data) {
    const { token, userId, expiresAt } = data;
    return prisma.refresh_tokens.create({
      data: { token, userId, expiresAt: new Date(expiresAt) },
    });
  },

  async getRefreshToken(id) {
    return prisma.refresh_tokens.findUnique({
      where: { id },
      select: { id: true, token: true, userId: true, expiresAt: true, createdAt: true },
    });
  },

  async deleteRefreshToken(id) {
    return prisma.refresh_tokens.delete({ where: { id } });
  },
};
