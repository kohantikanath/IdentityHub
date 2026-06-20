interface PaginationProps {
  page: number
  totalPages: number
  total: number
  size: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, total, size, onPageChange }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, total)

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
      <p className="text-sm text-gray-600">
        Showing{' '}
        <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span>{' '}
        of <span className="font-medium">{total}</span> users
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-600 font-medium">
          {page} / {totalPages || 1}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
