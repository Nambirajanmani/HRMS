import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import ErrorBoundary from './components/Layout/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Employees from './pages/Employees/Employees';
import EmployeeDetail from './pages/Employees/EmployeeDetail';
import CreateEmployee from './pages/Employees/CreateEmployee';
import EditEmployee from './pages/Employees/EditEmployee';
import Departments from './pages/Departments/Departments';
import Attendance from './pages/Attendance/Attendance';
import LeaveRequests from './pages/Leave/LeaveRequests';
import Payroll from './pages/Payroll/Payroll';
import Performance from './pages/Performance/Performance';
import Reports from './pages/Reports/Reports';
import Settings from './pages/Settings/Settings';
import Profile from './pages/Profile/Profile';
import JobPostings from './pages/JobPostings/JobPostings';
import JobApplications from './pages/JobApplications/JobApplications';
import Interviews from './pages/Interviews/Interviews';
import TrainingPrograms from './pages/Training/TrainingPrograms';
import TrainingRecords from './pages/Training/TrainingRecords';
import OnboardingTasks from './pages/Onboarding/OnboardingTasks';
import Documents from './pages/Documents/Documents';
import Analytics from './pages/Analytics/Analytics';
import LoadingSpinner from './components/UI/LoadingSpinner';
import UserDashboard from './pages/user/dashboard';
import EmployeeLeaveRequest from './pages/user/leaverequest';
import Time from './pages/user/time'; // Changed to uppercase 'Time'

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          {/* Default redirect based on user role */}
          <Route 
            path="/" 
            element={
              (user?.role || '').toLowerCase() === 'employee' 
                ? <Navigate to="/user/dashboard" replace /> 
                : <Navigate to="/dashboard" replace />
            } 
          />
          
          {/* Admin Dashboard - Only for non-employee roles */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager']}>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Employee Dashboard - Only for employee role */}
          <Route 
            path="/user/dashboard" 
            element={
              <ProtectedRoute requiredRoles={['employee']}>
                <UserDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/employees" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager']}>
                <Employees />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/employees/create" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr']}>
                <CreateEmployee />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/employees/:id" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager', 'employee']}>
                <EmployeeDetail />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/employees/:id/edit"
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr']}>
                <EditEmployee />
              </ProtectedRoute>
            }
          />
          <Route
            path="/departments"
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager']}>
                <Departments />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/user/time"
            element={ 
              <ProtectedRoute requiredRoles={['employee']}>
                <Time />
              </ProtectedRoute>
            } 
          />
          
          {/* Common routes accessible to both admin and employee */}
          <Route 
            path="/attendance" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager', 'employee']}>
                <Attendance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/leave" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager', 'employee']}>
                <LeaveRequests />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/payroll" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr']}>
                <Payroll />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/performance" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager', 'employee']}>
                <Performance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager']}>
                <Reports />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/analytics" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager']}>
                <Analytics />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/job-postings" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr']}>
                <JobPostings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/job-applications" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr']}>
                <JobApplications />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/interviews" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr']}>
                <Interviews />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/training" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager', 'employee']}>
                <TrainingPrograms />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/training-records" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager', 'employee']}>
                <TrainingRecords />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'employee']}>
                <OnboardingTasks />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/documents" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'hr', 'manager', 'employee']}>
                <Documents />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/user/leave" 
            element={  
              <ProtectedRoute requiredRoles={['employee']}>
                <EmployeeLeaveRequest />
              </ProtectedRoute>
            } 
          />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          
          {/* Catch all route - redirect based on role */}
          <Route 
            path="*" 
            element={
              (user?.role || '').toLowerCase() === 'employee' 
                ? <Navigate to="/user/dashboard" replace /> 
                : <Navigate to="/dashboard" replace />
            } 
          />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;