import { useEffect, useState } from "react"

import { PageShell } from "@/components/dashboard/page-shell"
import { StateMessage } from "@/components/dashboard/state-message"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiClient } from "../api/client"
import { HealthStatus, MongoDetails } from "../types/api"

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [mongoDetails, setMongoDetails] = useState<MongoDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true)
        const [healthData, mongoData] = await Promise.all([
          apiClient.getHealth(),
          apiClient.getMongoDetails().catch(() => null),
        ])
        setHealth(healthData)
        if (mongoData) setMongoDetails(mongoData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load health status")
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
  }, [])

  const statusBadgeVariant = (status: string): "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "ok":
      case "up":
        return "secondary"
      case "down":
        return "destructive"
      default:
        return "outline"
    }
  }

  if (loading) {
    return (
      <PageShell
        title="Health & Diagnostics"
        description="Track service uptime, dependency health, and database diagnostics."
      >
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell
        title="Health & Diagnostics"
        description="Track service uptime, dependency health, and database diagnostics."
      >
        <StateMessage variant="destructive" title="Health check failed" message={error} />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Health & Diagnostics"
      description="Track service uptime, dependency health, and database diagnostics."
    >
      {health ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Service Status</CardTitle>
            <Badge variant={statusBadgeVariant(health.status)}>{health.status.toUpperCase()}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Uptime</p>
                <p>{Math.floor(health.uptime / 1000)}s</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Last Check</p>
                <p>{new Date(health.timestamp).toLocaleString()}</p>
              </div>
            </div>

            {health.services ? (
              <div className="grid gap-2 md:grid-cols-2">
                {Object.entries(health.services).map(([service, status]) => (
                  <div key={service} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                    <span className="font-medium">{service}</span>
                    <Badge variant={statusBadgeVariant(status)}>{status.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <StateMessage message="No health status available." />
      )}

      {mongoDetails ? (
        <Card>
          <CardHeader>
            <CardTitle>Database Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {Object.entries(mongoDetails.collections).map(([collectionName, collection]) => (
                <div key={collectionName} className="rounded-lg border p-3">
                  <p className="font-medium">{collectionName}</p>
                  <p className="text-sm text-muted-foreground">Documents: {collection.count}</p>

                  {collection.sample ? (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                      {JSON.stringify(collection.sample, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>

            {mongoDetails.costRecords?.length ? (
              <div className="space-y-2">
                <p className="font-medium">Recent Cost Records</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mongoDetails.costRecords.slice(0, 10).map((record, idx) => (
                      <TableRow key={`${record.jobId}-${idx}`}>
                        <TableCell className="font-mono text-xs">{record.jobId}</TableCell>
                        <TableCell>{record.provider}</TableCell>
                        <TableCell>${record.cost.toFixed(2)}</TableCell>
                        <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  )
}
