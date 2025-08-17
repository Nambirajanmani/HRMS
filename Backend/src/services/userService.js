
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../utils/errors.js';

const prisma = new PrismaClient();

const userService = {
  async getAllUsers({ page, limit, search, role, isActive }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      AND: [
        search ? { 
          OR: [
            { email: { contains: search, mode: 'insensitive' } }, 
            { employee: { 
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } }, 
                { lastName: { contains: search, mode: 'insensitive' } }
              ] 
            } }
          ] 
        } : {},
        role ? { role } : {},
        isActive !== undefined ? { isActive: isActive === 'true' } : {},
      ],
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          employee: { 
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              employeeId: true, 
              department: { select: { id: true, name: true } }, 
              position: { select: { id: true, title: true } } 
            } 
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { 
      users, 
      pagination: { 
        page: parseInt(page), 
        limit: parseInt(limit), 
        total, 
        pages: Math.ceil(total / parseInt(limit)) 
      } 
    };
  },

  async getUser(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        employee: { 
          include: { 
            department: true, 
            position: true, 
            manager: { select: { id: true, firstName: true, lastName: true } } 
          } 
        },
        auditLogs: { 
          take: 10, 
          orderBy: { timestamp: 'desc' }, 
          select: { 
            id: true, 
            action: true, 
            resource: true, 
            timestamp: true, 
            ipAddress: true 
          } 
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  },

  async createUser({ email, password, role, employeeId, createdById }, req) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('User already exists with this email', 409);
    }

    if (employeeId) {
      const employee = await prisma.employee.findUnique({ 
        where: { id: employeeId }, 
        include: { user: true } 
      });
      if (!employee) {
        throw new AppError('Employee not found', 400);
      }
      if (employee.user) {
        throw new AppError('Employee already has a user account', 400);
      }
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, password: hashedPassword, role },
        select: { id: true, email: true, role: true, isActive: true, createdAt: true },
      });

      if (employeeId) {
        await tx.employee.update({ 
          where: { id: employeeId }, 
          data: { userId: newUser.id } 
        });
      }

      return newUser;
    });

    await createAuditLog(createdById, 'CREATE', 'users', user.id, null, user, req);
    
    return user;
  },

  async updateUser(id, data, req) {
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({ where: { email: data.email } });
      if (emailExists) {
        throw new AppError('Email already exists', 409);
      }
    }

    if (data.employeeId) {
      const employee = await prisma.employee.findUnique({ 
        where: { id: data.employeeId }, 
        include: { user: true } 
      });
      if (!employee) {
        throw new AppError('Employee not found', 400);
      }
      if (employee.user && employee.user.id !== id) {
        throw new AppError('Employee already linked to another user', 400);
      }
    }

    const updateData = { ...data };
    delete updateData.employeeId; // Remove from user update data

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
        select: { 
          id: true, 
          email: true, 
          role: true, 
          isActive: true, 
          lastLoginAt: true, 
          createdAt: true, 
          updatedAt: true 
        },
      });

      // Update employee-user relationship if needed
      if (data.employeeId) {
        await tx.employee.update({
          where: { id: data.employeeId },
          data: { userId: id }
        });
      }

      return updatedUser;
    });

    // If user is deactivated, remove all refresh tokens
    if (data.isActive === false) {
      await prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    await createAuditLog(req.user.id, 'UPDATE', 'users', id, existingUser, user, req);
    
    return user;
  },

  async changePassword(userId, { currentPassword, newPassword }, req) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    
    await prisma.$transaction([
      prisma.user.update({ 
        where: { id: userId }, 
        data: { password: hashedPassword } 
      }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    await createAuditLog(userId, 'PASSWORD_CHANGE', 'users', userId, null, null, req);
  },

  async requestPasswordReset(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const resetToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({ 
      where: { id: user.id }, 
      data: { 
        passwordResetToken: resetToken, 
        passwordResetExpires: expires 
      } 
    });

    // TODO: Implement email sending logic here
    return { resetToken }; // Return for testing purposes
  },

  async resetPassword({ token, newPassword }, req) {
    const user = await prisma.user.findFirst({ 
      where: { 
        passwordResetToken: token, 
        passwordResetExpires: { gt: new Date() } 
      } 
    });
    
    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    
    await prisma.$transaction([
      prisma.user.update({ 
        where: { id: user.id }, 
        data: { 
          password: hashedPassword, 
          passwordResetToken: null, 
          passwordResetExpires: null 
        } 
      }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    await createAuditLog(null, 'PASSWORD_RESET', 'users', user.id, null, null, req);
  },

  async deleteUser(id, req) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await prisma.$transaction([
      prisma.user.update({ 
        where: { id }, 
        data: { isActive: false } 
      }),
      prisma.refreshToken.deleteMany({ where: { userId: id } }),
    ]);

    await createAuditLog(req.user.id, 'DELETE', 'users', id, user, null, req);
  },

  async getUserActivity(id, { page, limit }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const [activities, total] = await Promise.all([
      prisma.auditLog.findMany({ 
        where: { userId: id }, 
        skip, 
        take: parseInt(limit), 
        orderBy: { timestamp: 'desc' } 
      }),
      prisma.auditLog.count({ where: { userId: id } }),
    ]);

    return { 
      activities, 
      pagination: { 
        page: parseInt(page), 
        limit: parseInt(limit), 
        total, 
        pages: Math.ceil(total / parseInt(limit)) 
      } 
    };
  },
};

export { userService };
