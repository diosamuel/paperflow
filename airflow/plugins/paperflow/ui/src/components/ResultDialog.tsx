import { useEffect, useState } from 'react'

const CHECK_DELAY = 1000

export type ValidationCheck = {
  id: string
  text: string
  ok: boolean
}

type ResultDialogProps = {
  open: boolean
  checks: ValidationCheck[]
  onClose: () => void
  onGenerate: () => void
}

export function ResultDialog({
  open,
  checks,
  onClose,
  onGenerate,
}: ResultDialogProps) {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (!open) return

    setRevealed(0)
    if (checks.length === 0) return

    let index = 0
    let timer = 0
    const step = () => {
      index += 1
      setRevealed(index)
      if (index < checks.length) timer = window.setTimeout(step, CHECK_DELAY)
    }

    timer = window.setTimeout(step, CHECK_DELAY)
    return () => window.clearTimeout(timer)
  }, [open, checks])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const done = revealed >= checks.length
  const allOk = checks.every((check) => check.ok)
  const visible = checks.slice(0, revealed)

  const title = !done
    ? 'Validating connections'
    : allOk
      ? 'Success validated'
      : 'Validation failed'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      onPointerDown={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-gray-300 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <h2
          className={`text-sm font-semibold ${
            done
              ? allOk
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
              : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {title}
        </h2>

        <ul className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-auto text-sm text-gray-600 dark:text-gray-300">
          {visible.map((check) => (
            <li key={check.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className={`w-4 text-center font-bold ${
                  check.ok
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {check.ok ? '✓' : '✕'}
              </span>
              <span>{check.text}</span>
            </li>
          ))}

          {!done && (
            <li className="flex items-center gap-2">
              <span className="flex w-4 justify-center">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent dark:border-gray-500 dark:border-t-transparent" />
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                Checking components...
              </span>
            </li>
          )}
        </ul>

        <div className="mt-4 flex justify-end gap-2">
          {done && allOk ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onGenerate}
                className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-indigo-400 active:bg-indigo-600"
              >
                Generate DAGs
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              disabled={!done}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
