import prisma from "../config/prisma.js";

async function createTimeEntryCheckIn(employeeId) {
  return await prisma.timeEntry.create({
    data: {
      employeeId,
      checkIn: new Date(),
    },
  });
}

async function createTimeEntryCheckOut(employeeId) {
  const lastEntry = await prisma.timeEntry.findFirst({
    where: {
      employeeId,
      checkOut: null,
    },
    orderBy: {
      checkIn: "desc",
    },
  });
  if (!lastEntry) {
    throw new Error("No active check-in found for the user");
  }
  return await prisma.timeEntry.update({
    where: { id: lastEntry.id },
    data: {
      checkOut: new Date(),
    },
  });
}

async function getTimeEntriesByUser(employeeId) {
  return await prisma.timeEntry.findMany({
    where: { employeeId },
    orderBy: { checkIn: "desc" },
  });
}

export default {
  createTimeEntryCheckIn,
  createTimeEntryCheckOut,
  getTimeEntriesByUser,
};
