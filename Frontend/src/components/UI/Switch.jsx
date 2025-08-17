import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

const Switch = forwardRef(({
  className,
  label,
  description,
  error,
  checked,
  ...props
}, ref) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        {(label || description) && (
          <div className="flex-1">
            {label && (
              <label className="text-sm font-medium text-gray-700">
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-gray-500">{description}</p>
            )}
          </div>
        )}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={checked}
            ref={ref}
            {...props}
          />
          <div className={cn(
            'w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4',
            'peer-focus:ring-primary-300 rounded-full peer',
            'peer-checked:after:translate-x-full peer-checked:after:border-white',
            'after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px]',
            'after:bg-white after:border-gray-300 after:border after:rounded-full',
            'after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'peer-focus:ring-red-300 peer-checked:bg-red-600',
            className
          )} />
        </label>
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
})

Switch.displayName = 'Switch'

export default Switch