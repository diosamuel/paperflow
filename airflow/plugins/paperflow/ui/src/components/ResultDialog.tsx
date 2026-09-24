import { useEffect, useState } from 'react'

const CHECK_DELAY = 300

const AIRFLOW_DAGS_URL = 'http://localhost:8080/dags'

export type ValidationCheck = {
  id: string
  task: string
  text: string
  ok: boolean
}

export type SaveState = {
  status: 'saving' | 'saved' | 'error'
  message: string
}

type ResultDialogProps = {
  open: boolean
  checks: ValidationCheck[]
  save?: SaveState | null
  onClose: () => void
  onGenerate: () => void
}

type Row =
  | { kind: 'heading'; key: string; task: string }
  | { kind: 'check'; key: string; text: string; ok: boolean }
  | { kind: 'pending'; key: string }

export function ResultDialog({
  open,
  checks,
  save,
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
  const saving = save?.status === 'saving'
  const generated = save?.status === 'saved'
  const visible = checks.slice(0, revealed)
  const pending = done ? null : checks[revealed]

  const title = !done
    ? 'Validating connections'
    : allOk
      ? 'Success validated'
      : 'Validation failed'

  const rows: Row[] = []
  let lastTask: string | null = null

  visible.forEach((check, index) => {
    if (check.task !== lastTask) {
      rows.push({ kind: 'heading', key: `h-${index}`, task: check.task })
      lastTask = check.task
    }
    rows.push({
      kind: 'check',
      key: check.id,
      text: check.text,
      ok: check.ok,
    })
  })

  if (pending) {
    if (pending.task !== lastTask) {
      rows.push({ kind: 'heading', key: 'h-pending', task: pending.task })
    }
    rows.push({ kind: 'pending', key: 'pending' })
  }

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
          {rows.map((row) => {
            if (row.kind === 'heading') {
              return (
                <li
                  key={row.key}
                  className="mt-2 text-xs font-semibold tracking-wide text-gray-500 uppercase first:mt-0 dark:text-gray-400"
                >
                  {row.task}
                </li>
              )
            }

            if (row.kind === 'pending') {
              return (
                <li key={row.key} className="flex items-center gap-2">
                  <span className="flex w-4 justify-center">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent dark:border-gray-500 dark:border-t-transparent" />
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    Checking components...
                  </span>
                </li>
              )
            }

            return (
              <li key={row.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`w-4 text-center font-bold ${
                    row.ok
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {row.ok ? '✓' : '✕'}
                </span>
                <span>{row.text}</span>
              </li>
            )
          })}
        </ul>

        {save && !saving && (
          <p
            className={`mt-3 text-xs ${
              save.status === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {save.message}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {done && allOk ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <a
                href={AIRFLOW_DAGS_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Open DAG
              </a>
              <button
                type="button"
                onClick={onGenerate}
                disabled={saving || generated}
                className="flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-indigo-400 active:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && (
                  <span
                    aria-hidden
                    className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
                  />
                )}
                {saving ? 'Generating...' : generated ? 'Generated' : 'Generate DAG'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={!done}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
