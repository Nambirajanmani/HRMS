import React from 'react';
import { Link } from 'react-router-dom';
import bgImage from '../assets/landingpage.jpg'; // adjust path if needed

const LandingPage = () => {
  return (
    <div 
      className="min-h-screen bg-gray-50 bg-cover bg-center" 
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Overlay for readability */}
      <div className="min-h-screen bg-black bg-opacity-50">
        {/* Navigation */}
        <nav className="bg-transparent shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <svg className="h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="ml-2 text-2xl font-bold text-white">HR Pro</span>
              </div>
              <div className="flex items-center">
                <Link to="/login" className="text-gray-200 hover:text-white text-sm font-medium">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
            <span className="block">Modern HR Management</span>
            <span className="block text-indigo-300">Made Simple</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-200 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Streamline your HR processes with our all-in-one HRMS solution.
          </p>
          <div className="mt-8 flex justify-center">
            <Link 
              to="/login" 
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Get Started
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-transparent">
          <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
            <p className="text-center text-base text-gray-300">
              &copy; {new Date().getFullYear()} HR Pro, Inc. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
