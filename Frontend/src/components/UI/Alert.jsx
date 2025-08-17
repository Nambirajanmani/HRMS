import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  XCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline'
import { cn } from '../../utils/cn'

const Alert = ({ 
  variant = 'info', 
  title, 
  children, 
  onClose, 
  className 
}) => {
  const variants = {
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: CheckCircleIcon,
      iconColor: 'text-green-400',
    },
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: XCircleIcon,
      iconColor: 'text-red-400',
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: ExclamationTriangleIcon,
      iconColor: 'text-yellow-400',
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: InformationCircleIcon,
      iconColor: 'text-blue-400',
    },
  }

  const config = variants[variant]
  const Icon = config.icon

  return (
    <div className={cn(
      'rounded-md border p-4',
      config.container,
      className
    )}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={cn('h-5 w-5', config.iconColor)} />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">
              {title}
            </h3>
          )}
          <div className="text-sm">
            {children}
          </div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  variant === 'success' && 'text-green-500 hover:bg-green-100 focus:ring-green-600',
                  variant === 'error' && 'text-red-500 hover:bg-red-100 focus:ring-red-600',
                  variant === 'warning' && 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600',
                  variant === 'info' && 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600'
                )}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Alert