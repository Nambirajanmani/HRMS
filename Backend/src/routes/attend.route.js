const express = require("express");
const router = express.Router();

const employeeService = require("./employee.service");

// Add timeRoutes import and middleware use
const timeRoutes = require("./time.route");
router.use("/time", timeRoutes);

router.get("/", async (req, res) => {
  try {
    const employees = await employeeService.getAllEmployees();
    res.status(200).json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error.message || error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const employee = await employeeService.getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.status(200).json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error.message || error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const user = await employeeService.createEmployee(req.body);
    res.status(201).json({ message: "Employee created successfully", userId: user.id });
  } catch (error) {
    console.error("Error creating employee:", error.message || error);
    if (error.message === "Email already registered") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updatedEmployee = await employeeService.updateEmployee(id, req.body);
    res.status(200).json({ message: "Employee updated successfully", employee: updatedEmployee });
  } catch (error) {
    console.error("Error updating employee:", error.message || error);
    if (error.message === "Employee not found" || error.message === "Email already registered") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await employeeService.deleteEmployee(id);
    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error.message || error);
    if (error.message === "Employee not found") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
