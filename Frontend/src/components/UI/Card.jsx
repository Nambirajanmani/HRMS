import { cn } from '../../utils/cn'

const Card = ({ className, children, ...props }) => (
  <div
    className={cn(
      'rounded-lg border border-gray-200 bg-white text-gray-950 shadow-sm',
      className
    )}
    {...props}
  >
    {children}
  </div>
)

const CardHeader = ({ className, children, ...props }) => (
  <div
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  >
    {children}
  </div>
)

const CardTitle = ({ className, children, ...props }) => (
  <h3
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  >
    {children}
  </h3>
)

const CardDescription = ({ className, children, ...props }) => (
  <p
    className={cn('text-sm text-gray-500', className)}
    {...props}
  >
    {children}
  </p>
)

const CardContent = ({ className, children, ...props }) => (
  <div className={cn('p-6 pt-0', className)} {...props}>
    {children}
  </div>
)

const CardFooter = ({ className, children, ...props }) => (
  <div
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  >
    {children}
  </div>
)

Card.Header = CardHeader
Card.Title = CardTitle
Card.Description = CardDescription
Card.Content = CardContent
Card.Footer = CardFooter

export default Card