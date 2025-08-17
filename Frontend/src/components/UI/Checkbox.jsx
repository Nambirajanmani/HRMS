import { forwardRef } from 'react'
import { cn } from '../../utils/cn'
import { CheckIcon } from '@heroicons/react/24/outline'

const Checkbox = forwardRef(({
  className,
  label,
  description,
  error,
  ...props
}, ref) => {
  return (
    <div className="space-y-1">
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            type="checkbox"
            className={cn(
              'h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-300 focus:ring-red-500',
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="ml-3 text-sm">
            {label && (
              <label className="font-medium text-gray-700">
                {label}
              </label>
            )}
            {description && (
              <p className="text-gray-500">{description}</p>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
})

Checkbox.displayName = 'Checkbox'

export default Checkbox