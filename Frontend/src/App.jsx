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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route 
            path="/employees" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'MANAGER']}>
                <Employees />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/employees/create" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR']}>
                <CreateEmployee />
              </ProtectedRoute>
            } 
          />
          <Route path="/employees/:id" element={<EmployeeDetail />} />
          <Route 
            path="/departments" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'MANAGER']}>
                <Departments />
              </ProtectedRoute>
            } 
          />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave" element={<LeaveRequests />} />
          <Route 
            path="/payroll" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'EMPLOYEE']}>
                <Payroll />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/performance" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']}>
                <Performance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'MANAGER']}>
                <Reports />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/analytics" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'MANAGER']}>
                <Analytics />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <Settings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/job-postings" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR']}>
                <JobPostings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/job-applications" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR']}>
                <JobApplications />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/interviews" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR']}>
                <Interviews />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/training" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']}>
                <TrainingPrograms />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/training-records" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']}>
                <TrainingRecords />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'EMPLOYEE']}>
                <OnboardingTasks />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/documents" 
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']}>
                <Documents />
              </ProtectedRoute>
            } 
          />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;