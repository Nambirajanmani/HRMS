import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '../../utils/cn'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <div className={cn(
        "lg:pl-72 transition-all duration-300 ease-in-out",
      )}>
        <Header setSidebarOpen={setSidebarOpen} />
        
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout