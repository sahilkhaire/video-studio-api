import * as React from "react"

import { AppSidebar, type AppView } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const DashboardOverview = React.lazy(() => import("@/components/dashboard-overview"))
const GenerateVideoPage = React.lazy(() => import("@/pages/GenerateVideoPage"))
const JobStatusPage = React.lazy(() => import("@/pages/JobStatusPage"))
const ProvidersPage = React.lazy(() => import("@/pages/ProvidersPage"))
const CostSummaryPage = React.lazy(() => import("@/pages/CostSummaryPage"))
const HealthPage = React.lazy(() => import("@/pages/HealthPage"))

const VALID_VIEWS: AppView[] = [
  "overview",
  "generate",
  "jobs",
  "providers",
  "costs",
  "health",
]

const isAppView = (value: string): value is AppView => {
  return VALID_VIEWS.includes(value as AppView)
}

const getViewFromHash = (hash: string): AppView => {
  const candidate = hash.replace(/^#/, "")
  return isAppView(candidate) ? candidate : "overview"
}

function App() {
  const [currentView, setCurrentView] = React.useState<AppView>(() => {
    if (typeof window === "undefined") {
      return "overview"
    }

    return getViewFromHash(window.location.hash)
  })

  const layoutStyle = {
    "--sidebar-width": "22rem",
    "--header-height": "3.75rem",
  } as React.CSSProperties

  const titleByView: Record<AppView, string> = {
    overview: "Overview",
    generate: "Generate Video",
    jobs: "Job Status",
    providers: "Providers",
    costs: "Cost Summary",
    health: "Health",
  }

  React.useEffect(() => {
    const syncViewWithHash = () => {
      setCurrentView(getViewFromHash(window.location.hash))
    }

    syncViewWithHash()
    window.addEventListener("hashchange", syncViewWithHash)

    return () => {
      window.removeEventListener("hashchange", syncViewWithHash)
    }
  }, [])

  const handleViewChange = React.useCallback((view: AppView) => {
    setCurrentView(view)

    const nextHash = `#${view}`
    if (window.location.hash !== nextHash) {
      window.location.hash = view
    }
  }, [])

  return (
    <TooltipProvider>
      <SidebarProvider style={layoutStyle}>
        <AppSidebar
          variant="inset"
          currentView={currentView}
          onViewChange={handleViewChange}
        />
        <SidebarInset>
          <SiteHeader title={titleByView[currentView]} />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col py-4 md:py-6">
              <React.Suspense
                fallback={
                  <div className="px-4 lg:px-6">
                    <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                      Loading view...
                    </div>
                  </div>
                }
              >
                {currentView === "overview" && <DashboardOverview />}
                {currentView === "generate" && (
                  <div className="px-4 lg:px-6">
                    <GenerateVideoPage />
                  </div>
                )}
                {currentView === "jobs" && (
                  <div className="px-4 lg:px-6">
                    <JobStatusPage />
                  </div>
                )}
                {currentView === "providers" && (
                  <div className="px-4 lg:px-6">
                    <ProvidersPage />
                  </div>
                )}
                {currentView === "costs" && (
                  <div className="px-4 lg:px-6">
                    <CostSummaryPage />
                  </div>
                )}
                {currentView === "health" && (
                  <div className="px-4 lg:px-6">
                    <HealthPage />
                  </div>
                )}
              </React.Suspense>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export default App
