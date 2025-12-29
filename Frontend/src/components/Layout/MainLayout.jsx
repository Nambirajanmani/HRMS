import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Simple className concatenation without cn
  const mainContentClass = sidebarCollapsed 
    ? "lg:flex-1 transition-all duration-300 lg:ml-20" 
    : "lg:flex-1 transition-all duration-300 lg:ml-72";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Only one Sidebar component */}
      <Sidebar 
        open={sidebarOpen} 
        setOpen={setSidebarOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      
      {/* Main content area */}
      <div className={mainContentClass}>
        {/* Only one Header component */}
        <Header 
          setSidebarOpen={setSidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
        />
        
        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;