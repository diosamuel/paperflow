import { Link } from 'react-router-dom'

const REPO_URL = 'https://github.com/diosamuel/paperflow'

const DECOR = [
  'left-[5%] top-[18%] h-5 w-5 rounded-full bg-brand-pink',
  'right-[8%] top-[14%] h-6 w-6 rotate-12 rounded-sm bg-brand-yellow',
  'left-[12%] bottom-[16%] h-4 w-4 rounded-full bg-brand-teal',
  'right-[14%] bottom-[20%] h-5 w-5 -rotate-6 rounded-sm bg-brand-orange',
  'left-[24%] top-[10%] h-3 w-3 rounded-full bg-brand-purple',
  'right-[26%] top-[26%] h-3.5 w-3.5 rounded-full bg-brand-green',
  'left-[8%] top-[48%] h-3 w-3 rounded-full bg-brand-purple-300',
  'right-[6%] top-[52%] h-5 w-5 rotate-6 rounded-sm bg-brand-pink',
  'left-[16%] bottom-[42%] h-2.5 w-2.5 rounded-full bg-brand-orange',
  'right-[18%] bottom-[48%] h-4 w-4 rounded-full bg-brand-yellow',
  'left-[42%] top-[7%] h-4 w-4 rotate-3 rounded-sm bg-brand-teal',
  'right-[42%] bottom-[9%] h-3 w-3 rounded-full bg-brand-purple',
]

export function Landing() {
  return (
    <section className="relative min-h-dvh overflow-hidden bg-brand-navy text-on-dark">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden md:block"
      >
        {DECOR.map((className) => (
          <span
            key={className}
            className={`absolute opacity-90 ${className}`}
          />
        ))}
      </div>

      <a
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        <span className="text-lg font-semibold">PaperFlow</span>
      </a>

      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 py-30 text-center">
        <span className="rounded-full bg-primary px-2.5 py-1 text-[13px] font-semibold">
          Alpha
        </span>

        <h1 className="mt-8 text-[36px] leading-[1.05] font-semibold tracking-[-0.5px] min-[480px]:text-[48px] md:text-[56px] xl:text-[80px] xl:tracking-[-2px]">
          Draw it. Airflow runs it.
          <br />
          The physical world responds.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-on-dark-muted">
          PaperFlow is a fun way for kids to learn how workflow orchestration
          works — drag sensors and lights onto the canvas, connect them into a
          flow, and watch Apache Airflow make a real Raspberry Pi respond.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            to="/builder"
            className="inline-flex items-center justify-center rounded-md bg-primary px-[18px] py-2.5 text-sm font-medium text-on-dark transition-colors hover:bg-primary-pressed"
          >
            Start building
          </Link>
          <a
            href={REPO_URL}
            className="inline-flex items-center justify-center rounded-md border border-on-dark-muted px-[18px] py-2.5 text-sm font-medium text-on-dark transition-colors hover:bg-white/10"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
