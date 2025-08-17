import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { cn } from '../../utils/cn'

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  showInfo = true,
  className
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  if (totalPages <= 1) return null

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {showInfo && (
        <div className="text-sm text-gray-700">
          Showing {startItem} to {endItem} of {totalItems} results
        </div>
      )}
      
      <nav className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            'inline-flex items-center px-2 py-2 text-sm font-medium rounded-md',
            'border border-gray-300 bg-white text-gray-500',
            'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
          )}
        >
          <ChevronLeftIcon className="h-5 w-5" />
          <span className="sr-only">Previous</span>
        </button>

        {getVisiblePages().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={cn(
              'inline-flex items-center px-4 py-2 text-sm font-medium rounded-md',
              'border focus:outline-none focus:ring-2 focus:ring-primary-500',
              page === currentPage
                ? 'border-primary-500 bg-primary-50 text-primary-600'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              page === '...' && 'cursor-default hover:bg-white'
            )}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            'inline-flex items-center px-2 py-2 text-sm font-medium rounded-md',
            'border border-gray-300 bg-white text-gray-500',
            'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
          )}
        >
          <ChevronRightIcon className="h-5 w-5" />
          <span className="sr-only">Next</span>
        </button>
      </nav>
    </div>
  )
}

export default Pagination