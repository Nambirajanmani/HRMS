const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function getAllEmployees() {
  return await prisma.user.findMany({
    where: { role: "employee" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function getEmployeeById(id) {
  return await prisma.user.findFirst({
    where: { id, role: "employee" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function createEmployee(data) {
  const { firstName, lastName, email, phone, password } = data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user with role employee
  return await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      role: "employee",
    },
  });
}

async function updateEmployee(id, data) {
  const { firstName, lastName, email, phone } = data;

  // Verify employee exists
  const employee = await prisma.user.findFirst({ where: { id, role: "employee" } });
  if (!employee) {
    throw new Error("Employee not found");
  }

  // If email is changed, check for duplicates
  if (email && email !== employee.email) {
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      throw new Error("Email already registered");
    }
  }

  // Update employee
  return await prisma.user.update({
    where: { id },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(email && { email }),
      ...(phone && { phone }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function deleteEmployee(id) {
  // Check if employee exists
  const employee = await prisma.user.findFirst({ where: { id, role: "employee" } });
  if (!employee) {
    throw new Error("Employee not found");
  }

  // Delete employee
  return await prisma.user.delete({ where: { id } });
}

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
