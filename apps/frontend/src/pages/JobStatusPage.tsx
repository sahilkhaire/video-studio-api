import { useEffect, useMemo, useState } from "react"

import { PageShell } from "@/components/dashboard/page-shell"
import { StateMessage } from "@/components/dashboard/state-message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "../api/client"
import { usePolling } from "../hooks/useAsync"
import { VideoJob } from "../types/api"

export default function JobStatusPage() {
  const [jobId, setJobId] = useState("")
  const [isPolling, setIsPolling] = useState(false)
  const [currentJob, setCurrentJob] = useState<VideoJob | null>(null)

  const { data, error, startPolling, stopPolling } = usePolling(
    () => apiClient.getJobStatus(jobId),
    3000,
    false
  )

  const handleStartPolling = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobId.trim()) return

    try {
      setIsPolling(true)
      startPolling()
    } catch (err) {
      console.error(err)
    }
  }

  const handleStop = () => {
    stopPolling()
    setIsPolling(false)
  }

  useEffect(() => {
    if (data) {
      setCurrentJob(data)
    }
  }, [data])

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  useEffect(() => {
    if (currentJob?.status === "completed" || currentJob?.status === "failed") {
      setIsPolling(false)
      stopPolling()
    }
  }, [currentJob?.status, stopPolling])

  const statusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "secondary"
      case "failed":
        return "destructive"
      case "processing":
        return "default"
      default:
        return "outline"
    }
  }

  const progress = useMemo(() => {
    if (typeof currentJob?.progress === "number") {
      return Math.min(100, Math.max(0, currentJob.progress))
    }
    return null
  }, [currentJob?.progress])

  return (
    <PageShell
      title="Job Status"
      description="Track rendering jobs in near real-time with polling updates every three seconds."
    >
      <Card>
        <CardHeader>
          <CardTitle>Track by Job ID</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleStartPolling} className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="w-full space-y-2 md:max-w-md">
              <Label htmlFor="job-id">Job ID</Label>
              <Input
                id="job-id"
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="Enter job ID to track..."
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={!jobId.trim() || isPolling}>
                Track Job
              </Button>
              {isPolling ? (
                <Button type="button" variant="outline" onClick={handleStop}>
                  Stop Polling
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {isPolling ? (
        <StateMessage message="Polling every 3 seconds..." />
      ) : null}

      {error ? (
        <StateMessage variant="destructive" title="Unable to fetch job status" message={error.message} />
      ) : null}

      {currentJob ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Job Details</CardTitle>
            <Badge variant={statusVariant(currentJob.status)}>{currentJob.status.toUpperCase()}</Badge>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Job ID</p>
                <p className="font-mono text-xs break-all">{currentJob.jobId}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Created</p>
                <p>{new Date(currentJob.createdAt).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p>{new Date(currentJob.updatedAt).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Polling</p>
                <p>{isPolling ? "Active" : "Stopped"}</p>
              </div>
            </div>

            {progress !== null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {currentJob.error ? (
              <StateMessage variant="destructive" title="Job Error" message={currentJob.error} />
            ) : null}

            {currentJob.result?.videoUrl ? (
              <Button asChild variant="secondary">
                <a href={currentJob.result.videoUrl} target="_blank" rel="noreferrer">
                  Download Video
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  )
}
