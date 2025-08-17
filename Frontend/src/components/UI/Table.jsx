import { cn } from '../../utils/cn'

const Table = ({ children, className }) => (
  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
    <table className={cn('table', className)}>
      {children}
    </table>
  </div>
)

const TableHeader = ({ children, className }) => (
  <thead className={cn('table-header bg-gray-50', className)}>
    {children}
  </thead>
)

const TableBody = ({ children, className }) => (
  <tbody className={cn('divide-y divide-gray-200 bg-white', className)}>
    {children}
  </tbody>
)

const TableRow = ({ children, className, ...props }) => (
  <tr className={cn('table-row', className)} {...props}>
    {children}
  </tr>
)

const TableHead = ({ children, className, ...props }) => (
  <th className={cn('table-head', className)} {...props}>
    {children}
  </th>
)

const TableCell = ({ children, className, ...props }) => (
  <td className={cn('table-cell', className)} {...props}>
    {children}
  </td>
)

Table.Header = TableHeader
Table.Body = TableBody
Table.Row = TableRow
Table.Head = TableHead
Table.Cell = TableCell

export default Table