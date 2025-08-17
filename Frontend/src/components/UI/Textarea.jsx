import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

const Textarea = forwardRef(({
  className,
  error,
  label,
  helperText,
  required,
  rows = 3,
  ...props
}, ref) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-gray-500 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-300 focus-visible:ring-red-500',
          className
        )}
        rows={rows}
        ref={ref}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

export default Textarea