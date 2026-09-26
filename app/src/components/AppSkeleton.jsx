import { Skeleton } from './ui'

const NAV_ITEMS = 7

/**
 * The app shell in grey blocks: sidebar, header and a page. Shown once, until the vehicles and records have
 * both loaded, in place of the old full-screen "Loading…".
 */
export default function AppSkeleton() {
  return (
    <div role="progressbar" aria-label="Loading" aria-busy="true" className="flex h-screen bg-page">
      <div className="w-[236px] flex-none bg-slate p-[26px] flex flex-col gap-[30px]">
        <div className="flex items-center gap-[10px]">
          <Skeleton tone="dark" className="w-[26px] h-[26px]" />
          <Skeleton tone="dark" className="w-24 h-4" />
        </div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: NAV_ITEMS }, (_, i) => (
            <Skeleton key={i} tone="dark" className="h-9" />
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-[18px] border-t border-white/12">
          <Skeleton tone="dark" className="w-24 h-3" />
          <Skeleton tone="dark" className="w-32 h-7" />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-[14px] px-10 py-[34px] border-b border-ink/12">
          <Skeleton className="w-[240px] h-14" />
          <div className="ml-auto flex items-center gap-2.5">
            <Skeleton className="w-[150px] h-9" />
            <Skeleton className="w-[150px] h-11" />
            <Skeleton className="w-[150px] h-11" />
          </div>
        </div>

        <div className="px-10 py-8 max-w-[1180px] w-full flex flex-col gap-5.5">
          <div className="flex flex-col gap-3">
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-[360px] h-8" />
          </div>
          <div className="grid grid-cols-4 gap-3.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            <Skeleton className="col-span-2 h-72" />
            <Skeleton className="h-72" />
          </div>
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  )
}
