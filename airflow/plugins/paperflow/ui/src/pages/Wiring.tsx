import { useNavigate } from 'react-router-dom'

export default function Wiring() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="fixed top-4 left-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        Back to Builder
      </button>
      <p className="text-lg text-gray-500 dark:text-gray-400">
        Raspberry PI Wiring — coming soon
      </p>
    </div>
  )
}
