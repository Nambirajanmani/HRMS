import React, { useState, useEffect } from "react";
import { Clock, LogIn, LogOut, Calendar, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { timeAPI } from "../../services/api";
import toast from "react-hot-toast";

export default function EmployeeAttendance() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { user } = useAuth();
  const userId = user?.id;

  async function fetchAttendanceHistory() {
    if (!userId) {
      setError("User ID not available. Please log in again.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Use timeAPI with proper axios interceptor that includes auth token
      const response = await timeAPI.getHistory(userId);
      const data = response?.data?.timeEntries || response?.data || [];
      
      const formatted = data.map(entry => {
        const checkInDate = new Date(entry.checkIn);
        const checkOutDate = entry.checkOut ? new Date(entry.checkOut) : null;
        const hours = checkOutDate ? Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60)) + "h" : "---";
        return {
          id: entry.id,
          date: checkInDate.toLocaleDateString(),
          checkIn: checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          checkOut: checkOutDate ? checkOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---",
          status: checkOutDate ? "Present" : "Checked In",
          hours,
        };
      });
      setAttendanceHistory(formatted);
      setIsCheckedIn(data.length > 0 && !data[0].checkOut);
    } catch (err) {
      const errorMsg = err.message || "Failed to fetch attendance history";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error("Attendance fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAttendanceHistory();
  }, [userId]);

  async function handleCheckIn() {
    if (!userId) {
      setError("User ID not available. Please log in again.");
      return;
    }
    
    try {
      setLoading(true);
      await timeAPI.checkIn(userId);
      toast.success("Check-in successful!");
      await fetchAttendanceHistory();
    } catch (err) {
      const errorMsg = err.message || "Check-in failed";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error("Check-in error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!userId) {
      setError("User ID not available. Please log in again.");
      return;
    }
    
    try {
      setLoading(true);
      await timeAPI.checkOut(userId);
      toast.success("Check-out successful!");
      await fetchAttendanceHistory();
    } catch (err) {
      const errorMsg = err.message || "Check-out failed";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error("Check-out error:", err);
    } finally {
      setLoading(false);
    }
  }

  // If you're using Layout to wrap everything, you don't need to manually include Sidebar
  // Layout already includes the Sidebar and main content structure
  return (
    
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">Attendance & Time Tracking</h1>
          <p className="text-gray-600">Manage your daily attendance and track work hours</p>
          {error && <p className="text-red-600 mt-2">{error}</p>}
        </div>
        
        {/* Stats and check in/out UI */}
        <div className="bg-white p-6 rounded-xl mb-8 shadow-lg border border-gray-100">
          <div className="text-center mb-4">
            <p className="text-gray-600 mb-2">Current Time</p>
            <p className="text-3xl font-bold text-gray-800">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {new Date().toLocaleDateString(undefined, { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </p>
          </div>
          <div className="text-center">
            {!isCheckedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={loading}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all font-bold disabled:opacity-50"
              >
                <LogIn size={24} />
                {loading ? "Processing..." : "Check In"}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="inline-block px-6 py-3 bg-green-100 text-green-700 rounded-lg font-medium">
                  <CheckCircle className="inline mr-2" size={20} />
                  Checked In
                </div>
                <button
                  onClick={handleCheckOut}
                  disabled={loading}
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-4 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all font-bold disabled:opacity-50"
                >
                  <LogOut size={24} />
                  {loading ? "Processing..." : "Check Out"}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Attendance history table */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg mb-8 border border-gray-100 overflow-x-auto">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Attendance History</h2>
            <button 
              onClick={fetchAttendanceHistory}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              Refresh
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <th className="p-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                <th className="p-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Check-In</th>
                <th className="p-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Check-Out</th>
                <th className="p-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Hours</th>
                <th className="p-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center p-8">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : attendanceHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-8 text-gray-500">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                attendanceHistory.map((item, index) => (
                  <tr
                    key={index}
                    className={`border-b border-gray-100 transition-all duration-200 hover:bg-blue-50 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="p-4 flex items-center gap-2">
                      <Calendar size={16} className="text-gray-500" />
                      <span className="font-medium text-gray-800">{item.date}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-gray-700 font-medium">{item.checkIn}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-gray-700 font-medium">{item.checkOut}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {item.hours}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-sm font-medium ${item.status === "Present" || item.status === "Checked In" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {item.status === "Present" || item.status === "Checked In" ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    
  );
}