import { useEffect, useMemo, useState } from "react"

import { PageShell } from "@/components/dashboard/page-shell"
import { StateMessage } from "@/components/dashboard/state-message"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "../api/client"
import { CostSummary } from "../types/api"

export default function CostSummaryPage() {
  const [costs, setCosts] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCosts = async () => {
      try {
        setLoading(true)
        const data = await apiClient.getCostSummary()
        setCosts(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load costs")
      } finally {
        setLoading(false)
      }
    }

    fetchCosts()
  }, [])

  const breakdownEntries = useMemo(() => {
    if (!costs || !costs.breakdown) {
      return []
    }

    return Object.entries(costs.breakdown)
      .filter(([, cost]) => Number.isFinite(cost))
      .sort((a, b) => b[1] - a[1])
  }, [costs])

  const maxBreakdownCost = useMemo(() => {
    if (breakdownEntries.length === 0) {
      return 1
    }

    return Math.max(...breakdownEntries.map(([, cost]) => cost), 1)
  }, [breakdownEntries])

  if (loading) {
    return (
      <PageShell title="Cost Summary" description="Monitor spend by provider and job volume.">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell title="Cost Summary" description="Monitor spend by provider and job volume.">
        <StateMessage variant="destructive" title="Cost summary unavailable" message={error} />
      </PageShell>
    )
  }

  if (!costs) {
    return (
      <PageShell title="Cost Summary" description="Monitor spend by provider and job volume.">
        <StateMessage message="No cost data available yet." />
      </PageShell>
    )
  }

  const totalCost = Number.isFinite(costs.totalCost) ? costs.totalCost : 0
  const jobCount = Number.isFinite(costs.jobCount) ? costs.jobCount : 0
  const totalCostFormatted = totalCost.toFixed(2)
  const averageCost = jobCount > 0 ? (totalCost / jobCount).toFixed(2) : "0.00"

  return (
    <PageShell
      title="Cost Summary"
      description="Track total spend and provider-level contribution across generated jobs."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {costs.currency} {totalCostFormatted}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-semibold tracking-tight">{jobCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Cost / Job</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {costs.currency} {averageCost}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown by Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {breakdownEntries.length === 0 ? (
            <StateMessage message="No provider breakdown available." />
          ) : (
            breakdownEntries.map(([provider, cost]) => {
              const percentage = (cost / maxBreakdownCost) * 100

              return (
                <div key={provider} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{provider}</span>
                    <span className="text-muted-foreground">
                      {costs.currency} {cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
