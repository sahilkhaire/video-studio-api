import { useEffect, useState } from "react"

import { PageShell } from "@/components/dashboard/page-shell"
import { StateMessage } from "@/components/dashboard/state-message"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "../api/client"
import { Provider, TTSVoice } from "../types/api"

function extractArray<T>(value: unknown, nestedKeys: string[]): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (!value || typeof value !== "object") {
    return []
  }

  const source = value as Record<string, unknown>
  for (const key of nestedKeys) {
    if (Array.isArray(source[key])) {
      return source[key] as T[]
    }
  }

  return []
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [voices, setVoices] = useState<TTSVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [providersData, voicesData] = await Promise.all([
          apiClient.getProviders(),
          apiClient.getTTSVoices(),
        ])

        const normalizedProviders = extractArray<Provider>(providersData, [
          "providers",
          "items",
          "data",
          "results",
        ])
        const normalizedVoices = extractArray<TTSVoice>(voicesData, [
          "voices",
          "items",
          "data",
          "results",
        ])

        setProviders(normalizedProviders)
        setVoices(normalizedVoices)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load providers")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <PageShell
        title="Providers"
        description="Inspect currently connected AI and TTS providers."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell title="Providers" description="Inspect currently connected AI and TTS providers.">
        <StateMessage variant="destructive" title="Provider fetch failed" message={error} />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Providers"
      description="Inspect currently connected AI providers and available voices."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI Providers</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {providers.length === 0 ? (
              <StateMessage message="No providers configured yet." />
            ) : (
              providers.map((provider) => (
                <div key={provider.id} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">{provider.type}</p>
                    </div>
                    <Badge variant={provider.active ? "secondary" : "outline"}>
                      {provider.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {provider.models?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {provider.models.map((model) => (
                        <Badge key={model} variant="outline">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No model metadata available.</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TTS Voices</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {voices.length === 0 ? (
              <StateMessage message="No TTS voices available." />
            ) : (
              voices.map((voice) => (
                <div key={voice.id} className="rounded-xl border p-3">
                  <p className="mb-2 font-medium">{voice.name}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Language: {voice.language}</Badge>
                    <Badge variant="outline">Gender: {voice.gender}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
