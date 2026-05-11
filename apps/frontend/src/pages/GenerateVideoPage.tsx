import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Download, Play, RotateCw, AlertCircle } from "lucide-react"

import { PageShell } from "@/components/dashboard/page-shell"
import { StateMessage } from "@/components/dashboard/state-message"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "../api/client"
import {
  GenerateFromImagesRequest,
  GenerateMusicVideoRequest,
  GenerateVideoRequest,
  VideoJob,
} from "../types/api"

type GenerationType = "standard" | "content-images" | "music-story"

type ContentSegmentForm = {
  content: string
  imagesText: string
}

type MusicInputType = "file" | "path" | "url"

const VIDEO_STYLES = ["cartoon", "realistic", "animated", "minimal", "cinematic"]
const VIDEO_PLATFORMS = ["youtube", "instagram_reels", "tiktok"]
const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"]
const VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1"]
const SCRIPT_PROVIDERS = ["openai", "claude", "ollama", "together-ai", "groq"]
const IMAGE_PROVIDERS = ["dalle", "stable-diffusion", "leonardo", "together-ai"]

// Cost estimation (USD)
const PROVIDER_COSTS = {
  script: {
    openai: 0.05,
    claude: 0.02,
    ollama: 0.0,
    "together-ai": 0.002,
    groq: 0.001,
  },
  image: {
    dalle: 0.04,
    "stable-diffusion": 0.002,
    leonardo: 0.01,
    "together-ai": 0.003,
  },
  tts: {
    openai: 0.015,
    elevenlabs: 0.03,
    "google-tts": 0.004,
    coqui: 0.0,
    groq: 0.008,
  },
}

// Validation helpers
const ValidationErrors = {
  topicLength: (len: number) => `Topic must be 10-500 characters (current: ${len})`,
  durationRange: () => "Duration must be 15-600 seconds",
  fpsRange: () => "FPS must be 24-60",
  voiceLength: () => "Voice must be max 100 characters",
  audienceLength: () => "Target audience must be max 200 characters",
  contextLength: () => "Additional context must be max 500 characters",
}

export default function GenerateVideoPage() {
  const [activeTab, setActiveTab] = useState<GenerationType>("standard")
  const [expandAdvanced, setExpandAdvanced] = useState<Record<GenerationType, boolean>>({
    standard: false,
    "content-images": false,
    "music-story": false,
  })

  const [standardRequest, setStandardRequest] = useState<GenerateVideoRequest & {
    targetAudience: string;
    additionalContext: string;
    voice: string;
  }>({
    topic: "",
    platform: "youtube",
    style: "cinematic",
    targetDuration: 30,
    targetAudience: "",
    additionalContext: "",
    resolution: "720p",
    aspectRatio: "16:9",
    fps: 30,
    voice: "",
    showCaptions: true,
    callbackUrl: "",
  })

  const [contentImagesRequest, setContentImagesRequest] =
    useState<GenerateFromImagesRequest>({
      data: [
        {
          content: "",
          images: [],
        },
      ],
      showCaptions: true,
      showCaption: true,
      voice: "",
      style: "cinematic",
      resolution: "720p",
      aspectRatio: "16:9",
      fps: 30,
      callbackUrl: "",
    })

  const [contentImageSegments, setContentImageSegments] = useState<ContentSegmentForm[]>([
    { content: "", imagesText: "" },
  ])

  const [musicRequest, setMusicRequest] = useState<GenerateMusicVideoRequest & {
    additionalContext: string;
  }>({
    topic: "",
    lyrics: "",
    additionalContext: "",
    musicPath: "",
    musicUrl: "",
    style: "cartoon",
    scriptProvider: "openai",
    imageProvider: "dalle",
    imageModel: "",
    youtubeResolution: "1080p",
    reelsResolution: "1080p",
    fps: 30,
    callbackUrl: "",
  })

  const [musicInputType, setMusicInputType] = useState<MusicInputType>("url")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<VideoJob | null>(null)
  const [lastMode, setLastMode] = useState<GenerationType | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Auto-poll job status
  useEffect(() => {
    if (!autoRefresh || !job) return

    const interval = setInterval(async () => {
      try {
        const updated = await apiClient.getJobStatus(job.jobId)
        setJob(updated)
        if (updated.status === "completed" || updated.status === "failed") {
          setAutoRefresh(false)
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh, job])

  const updateStandard = <K extends keyof GenerateVideoRequest>(
    key: K,
    value: GenerateVideoRequest[K]
  ) => {
    setStandardRequest((prev) => ({ ...prev, [key]: value }))
    validateStandardForm({ ...standardRequest, [key]: value })
  }

  const updateContentImages = <K extends keyof GenerateFromImagesRequest>(
    key: K,
    value: GenerateFromImagesRequest[K]
  ) => {
    setContentImagesRequest((prev) => ({ ...prev, [key]: value }))
  }

  const updateMusic = <K extends keyof GenerateMusicVideoRequest>(
    key: K,
    value: GenerateMusicVideoRequest[K]
  ) => {
    setMusicRequest((prev) => ({ ...prev, [key]: value }))
    validateMusicForm({ ...musicRequest, [key]: value })
  }

  const validateStandardForm = (data: GenerateVideoRequest) => {
    const errors: Record<string, string> = {}
    const topicLen = data.topic.trim().length
    if (topicLen < 10 || topicLen > 500) {
      errors.topic = ValidationErrors.topicLength(topicLen)
    }
    if (data.targetDuration < 15 || data.targetDuration > 600) {
      errors.duration = ValidationErrors.durationRange()
    }
    if (data.fps && (data.fps < 24 || data.fps > 60)) {
      errors.fps = ValidationErrors.fpsRange()
    }
    if (data.voice && data.voice.length > 100) {
      errors.voice = ValidationErrors.voiceLength()
    }
    if (data.targetAudience && data.targetAudience.length > 200) {
      errors.audience = ValidationErrors.audienceLength()
    }
    if (data.additionalContext && data.additionalContext.length > 500) {
      errors.context = ValidationErrors.contextLength()
    }
    setValidationErrors(errors)
  }

  const validateMusicForm = (data: GenerateMusicVideoRequest) => {
    const errors: Record<string, string> = {}
    const topicLen = data.topic.trim().length
    if (topicLen < 10 || topicLen > 500) {
      errors.topic = ValidationErrors.topicLength(topicLen)
    }
    if (data.fps && (data.fps < 24 || data.fps > 60)) {
      errors.fps = ValidationErrors.fpsRange()
    }
    setValidationErrors(errors)
  }

  const estimateCost = (scriptProvider?: string, imageProvider?: string): number => {
    let cost = 0
    if (scriptProvider && scriptProvider in PROVIDER_COSTS.script) {
      cost += PROVIDER_COSTS.script[scriptProvider as keyof typeof PROVIDER_COSTS.script]
    }
    if (imageProvider && imageProvider in PROVIDER_COSTS.image) {
      cost += PROVIDER_COSTS.image[imageProvider as keyof typeof PROVIDER_COSTS.image]
    }
    return cost
  }

  const syncContentDataPayload = (segments: ContentSegmentForm[]) => {
    const normalized = segments
      .filter((segment) => segment.content.trim())
      .map((segment) => ({
        content: segment.content.trim(),
        images: segment.imagesText
          .split(/\n|,/)
          .map((url) => url.trim())
          .filter(Boolean),
      }))
      .filter((segment) => segment.images.length > 0)

    updateContentImages("data", normalized)
  }

  const canSubmitStandard = useMemo(() => {
    return (
      standardRequest.topic.trim().length >= 10 &&
      standardRequest.topic.trim().length <= 500 &&
      standardRequest.targetDuration >= 15 &&
      standardRequest.targetDuration <= 600 &&
      (!standardRequest.fps || (standardRequest.fps >= 24 && standardRequest.fps <= 60)) &&
      (!standardRequest.voice || standardRequest.voice.length <= 100) &&
      (!standardRequest.targetAudience || standardRequest.targetAudience.length <= 200) &&
      (!standardRequest.additionalContext || standardRequest.additionalContext.length <= 500)
    )
  }, [standardRequest])

  const canSubmitContentImages = useMemo(() => {
    return contentImagesRequest.data.length > 0
  }, [contentImagesRequest.data.length])

  const canSubmitMusic = useMemo(() => {
    const hasSource =
      !!musicRequest.musicFile ||
      !!musicRequest.musicPath?.trim() ||
      !!musicRequest.musicUrl?.trim()
    const topicValid = musicRequest.topic.trim().length >= 10 && musicRequest.topic.trim().length <= 500
    const fpsValid = !musicRequest.fps || (musicRequest.fps >= 24 && musicRequest.fps <= 60)
    return topicValid && hasSource && fpsValid
  }, [musicRequest.musicFile, musicRequest.musicPath, musicRequest.musicUrl, musicRequest.topic, musicRequest.fps])

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitStandard) return
    setError(null)
    setValidationErrors({})
    setLoading(true)
    setLastMode("standard")
    setAutoRefresh(false)

    try {
      const result = await apiClient.generateVideo({
        ...standardRequest,
        targetAudience: standardRequest.targetAudience?.trim() || undefined,
        additionalContext: standardRequest.additionalContext?.trim() || undefined,
        voice: standardRequest.voice?.trim() || undefined,
        callbackUrl: standardRequest.callbackUrl?.trim() || undefined,
      })
      setJob(result)
      setAutoRefresh(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate video")
    } finally {
      setLoading(false)
    }
  }

  const handleContentImagesSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitContentImages) return
    setError(null)
    setLoading(true)
    setLastMode("content-images")
    setAutoRefresh(false)

    try {
      const result = await apiClient.generateFromContentImages({
        ...contentImagesRequest,
        voice: contentImagesRequest.voice?.trim() || undefined,
        callbackUrl: contentImagesRequest.callbackUrl?.trim() || undefined,
      })
      setJob(result)
      setAutoRefresh(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate video from content and images"
      )
    } finally {
      setLoading(false)
    }
  }

  const handleMusicSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitMusic) return
    setError(null)
    setValidationErrors({})
    setLoading(true)
    setLastMode("music-story")
    setAutoRefresh(false)

    try {
      const result = await apiClient.generateMusicVideo({
        ...musicRequest,
        lyrics: musicRequest.lyrics?.trim() || undefined,
        musicPath: musicRequest.musicPath?.trim() || undefined,
        musicUrl: musicRequest.musicUrl?.trim() || undefined,
        additionalContext: musicRequest.additionalContext?.trim() || undefined,
        imageModel: musicRequest.imageModel?.trim() || undefined,
        callbackUrl: musicRequest.callbackUrl?.trim() || undefined,
      })
      setJob(result)
      setAutoRefresh(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate music visual-story video"
      )
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshJob = async () => {
    if (!job) return
    setLoading(true)
    try {
      const updated = await apiClient.getJobStatus(job.jobId)
      setJob(updated)
    } catch (err) {
      setError("Failed to refresh job status")
    } finally {
      setLoading(false)
    }
  }

  const handleClearJob = () => {
    setJob(null)
    setAutoRefresh(false)
    setError(null)
  }

  return (
    <PageShell
      title="Generate Video"
      description="Choose a generation mode and submit all API fields directly from the UI."
    >
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GenerationType)}>
        <TabsList>
          <TabsTrigger value="standard">Standard</TabsTrigger>
          <TabsTrigger value="content-images">Content + Images</TabsTrigger>
          <TabsTrigger value="music-story">Music Story</TabsTrigger>
        </TabsList>

        <TabsContent value="standard">
          <Card>
            <CardHeader>
              <CardTitle>Standard Scripted Generation (POST /videos/generate)</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStandardSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="standard-topic">Topic * {standardRequest.topic.length}/500</Label>
                    {validationErrors.topic && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="w-3 h-3" /> {validationErrors.topic}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="standard-topic"
                    value={standardRequest.topic}
                    onChange={(e) => updateStandard("topic", e.target.value)}
                    placeholder="10-500 characters, describe your video concept"
                    className={`min-h-24 ${validationErrors.topic ? "border-destructive" : ""}`}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="standard-platform">Platform *</Label>
                    <Select
                      value={standardRequest.platform}
                      onValueChange={(value) =>
                        updateStandard("platform", value as GenerateVideoRequest["platform"])
                      }
                    >
                      <SelectTrigger id="standard-platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_PLATFORMS.map((platform) => (
                          <SelectItem key={platform} value={platform}>
                            {platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="standard-target-duration">Duration (s) *</Label>
                      {validationErrors.duration && (
                        <span className="text-xs text-destructive">{validationErrors.duration}</span>
                      )}
                    </div>
                    <Input
                      id="standard-target-duration"
                      type="number"
                      min={15}
                      max={600}
                      value={standardRequest.targetDuration}
                      onChange={(e) => updateStandard("targetDuration", Number(e.target.value))}
                      className={validationErrors.duration ? "border-destructive" : ""}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="standard-style">Style</Label>
                    <Select
                      value={standardRequest.style}
                      onValueChange={(value) => updateStandard("style", value)}
                    >
                      <SelectTrigger id="standard-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_STYLES.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="standard-resolution">Resolution</Label>
                    <Select
                      value={standardRequest.resolution}
                      onValueChange={(value) =>
                        updateStandard(
                          "resolution",
                          value as GenerateVideoRequest["resolution"]
                        )
                      }
                    >
                      <SelectTrigger id="standard-resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_RESOLUTIONS.map((resolution) => (
                          <SelectItem key={resolution} value={resolution}>
                            {resolution}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="standard-aspect-ratio">Aspect Ratio</Label>
                    <Select
                      value={standardRequest.aspectRatio}
                      onValueChange={(value) =>
                        updateStandard(
                          "aspectRatio",
                          value as GenerateVideoRequest["aspectRatio"]
                        )
                      }
                    >
                      <SelectTrigger id="standard-aspect-ratio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_ASPECT_RATIOS.map((ratio) => (
                          <SelectItem key={ratio} value={ratio}>
                            {ratio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="standard-fps">FPS</Label>
                      {validationErrors.fps && (
                        <span className="text-xs text-destructive">{validationErrors.fps}</span>
                      )}
                    </div>
                    <Input
                      id="standard-fps"
                      type="number"
                      min={24}
                      max={60}
                      value={standardRequest.fps ?? 30}
                      onChange={(e) => updateStandard("fps", Number(e.target.value))}
                      className={validationErrors.fps ? "border-destructive" : ""}
                    />
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setExpandAdvanced((p) => ({ ...p, standard: !p.standard }))}
                    className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                  >
                    {expandAdvanced.standard ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    Advanced Options
                  </button>

                  {expandAdvanced.standard && (
                    <div className="space-y-4 mt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="standard-target-audience">Target Audience {standardRequest.targetAudience.length}/200</Label>
                            {validationErrors.audience && (
                              <span className="text-xs text-destructive">{validationErrors.audience}</span>
                            )}
                          </div>
                          <Input
                            id="standard-target-audience"
                            maxLength={200}
                            value={standardRequest.targetAudience}
                            onChange={(e) => updateStandard("targetAudience", e.target.value)}
                            placeholder="e.g., tech enthusiasts, kids 8-12"
                            className={validationErrors.audience ? "border-destructive" : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="standard-voice">Voice {standardRequest.voice.length}/100</Label>
                            {validationErrors.voice && (
                              <span className="text-xs text-destructive">{validationErrors.voice}</span>
                            )}
                          </div>
                          <Input
                            id="standard-voice"
                            maxLength={100}
                            value={standardRequest.voice}
                            onChange={(e) => updateStandard("voice", e.target.value)}
                            placeholder="e.g., en-IN-NeerjaNeural"
                            className={validationErrors.voice ? "border-destructive" : ""}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="standard-context">Additional Context {standardRequest.additionalContext.length}/500</Label>
                          {validationErrors.context && (
                            <span className="text-xs text-destructive">{validationErrors.context}</span>
                          )}
                        </div>
                        <Textarea
                          id="standard-context"
                          maxLength={500}
                          value={standardRequest.additionalContext}
                          onChange={(e) => updateStandard("additionalContext", e.target.value)}
                          placeholder="Special instructions, tone, mood, etc."
                          className={`min-h-20 ${validationErrors.context ? "border-destructive" : ""}`}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="standard-show-captions">Show Captions</Label>
                          <Select
                            value={String(standardRequest.showCaptions ?? true)}
                            onValueChange={(value) => updateStandard("showCaptions", value === "true")}
                          >
                            <SelectTrigger id="standard-show-captions">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Yes</SelectItem>
                              <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="standard-callback">Callback URL</Label>
                          <Input
                            id="standard-callback"
                            type="url"
                            value={standardRequest.callbackUrl}
                            onChange={(e) => updateStandard("callbackUrl", e.target.value)}
                            placeholder="https://example.com/webhook"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading || !canSubmitStandard}>
                    {loading && lastMode === "standard" ? "Submitting..." : "Generate Standard Video"}
                  </Button>
                  {!canSubmitStandard && (
                    <p className="text-xs text-muted-foreground self-center">Fix validation errors above</p>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content-images">
          <Card>
            <CardHeader>
              <CardTitle>Content + Images (POST /videos/generate-from-content-images)</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleContentImagesSubmit} className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Segments (content + image URLs) *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const next = [...contentImageSegments, { content: "", imagesText: "" }]
                        setContentImageSegments(next)
                        syncContentDataPayload(next)
                      }}
                    >
                      Add Segment
                    </Button>
                  </div>

                  {contentImageSegments.map((segment, index) => (
                    <div key={`segment-${index}`} className="rounded-lg border p-3 space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor={`segment-content-${index}`}>Content #{index + 1}</Label>
                        <Textarea
                          id={`segment-content-${index}`}
                          value={segment.content}
                          onChange={(e) => {
                            const next = contentImageSegments.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, content: e.target.value } : item
                            )
                            setContentImageSegments(next)
                            syncContentDataPayload(next)
                          }}
                          placeholder="Narration content for this segment"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`segment-images-${index}`}>
                          Image URLs #{index + 1} (comma or newline separated)
                        </Label>
                        <Textarea
                          id={`segment-images-${index}`}
                          value={segment.imagesText}
                          onChange={(e) => {
                            const next = contentImageSegments.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, imagesText: e.target.value } : item
                            )
                            setContentImageSegments(next)
                            syncContentDataPayload(next)
                          }}
                          placeholder={"https://example.com/image-1.jpg\nhttps://example.com/image-2.jpg"}
                          className="min-h-20"
                        />
                        <p className="text-xs text-muted-foreground">
                          Parsed URLs: {segment.imagesText.split(/\n|,/).filter(Boolean).length}
                        </p>
                      </div>

                      {contentImageSegments.length > 1 ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const next = contentImageSegments.filter((_, itemIndex) => itemIndex !== index)
                            setContentImageSegments(next)
                            syncContentDataPayload(next)
                          }}
                        >
                          Remove Segment
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="content-style">Style</Label>
                    <Select
                      value={contentImagesRequest.style}
                      onValueChange={(value) => updateContentImages("style", value)}
                    >
                      <SelectTrigger id="content-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_STYLES.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content-resolution">Resolution</Label>
                    <Select
                      value={contentImagesRequest.resolution}
                      onValueChange={(value) =>
                        updateContentImages(
                          "resolution",
                          value as GenerateFromImagesRequest["resolution"]
                        )
                      }
                    >
                      <SelectTrigger id="content-resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_RESOLUTIONS.map((resolution) => (
                          <SelectItem key={resolution} value={resolution}>
                            {resolution}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content-aspect-ratio">Aspect Ratio</Label>
                    <Select
                      value={contentImagesRequest.aspectRatio}
                      onValueChange={(value) =>
                        updateContentImages(
                          "aspectRatio",
                          value as GenerateFromImagesRequest["aspectRatio"]
                        )
                      }
                    >
                      <SelectTrigger id="content-aspect-ratio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_ASPECT_RATIOS.map((ratio) => (
                          <SelectItem key={ratio} value={ratio}>
                            {ratio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="content-fps">FPS</Label>
                    <Input
                      id="content-fps"
                      type="number"
                      min={24}
                      max={60}
                      value={contentImagesRequest.fps ?? 30}
                      onChange={(e) => updateContentImages("fps", Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content-show-captions">showCaptions</Label>
                    <Select
                      value={String(contentImagesRequest.showCaptions ?? true)}
                      onValueChange={(value) =>
                        updateContentImages("showCaptions", value === "true")
                      }
                    >
                      <SelectTrigger id="content-show-captions">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content-show-caption">showCaption</Label>
                    <Select
                      value={String(contentImagesRequest.showCaption ?? true)}
                      onValueChange={(value) => updateContentImages("showCaption", value === "true")}
                    >
                      <SelectTrigger id="content-show-caption">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setExpandAdvanced((p) => ({ ...p, "content-images": !p["content-images"] }))}
                    className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                  >
                    {expandAdvanced["content-images"] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    Advanced Options
                  </button>

                  {expandAdvanced["content-images"] && (
                    <div className="space-y-4 mt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="content-voice">Voice</Label>
                          <Input
                            id="content-voice"
                            value={contentImagesRequest.voice}
                            onChange={(e) => updateContentImages("voice", e.target.value)}
                            placeholder="e.g., en-IN-NeerjaNeural"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="content-callback">Callback URL</Label>
                          <Input
                            id="content-callback"
                            type="url"
                            value={contentImagesRequest.callbackUrl}
                            onChange={(e) => updateContentImages("callbackUrl", e.target.value)}
                            placeholder="https://example.com/webhook"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={loading || !canSubmitContentImages}>
                  {loading && lastMode === "content-images"
                    ? "Submitting..."
                    : "Generate From Content + Images"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="music-story">
          <Card>
            <CardHeader>
              <CardTitle>Music Visual Story (POST /videos/generate-music-story)</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMusicSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="music-topic">Topic * {musicRequest.topic.length}/500</Label>
                    {validationErrors.topic && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="w-3 h-3" /> {validationErrors.topic}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="music-topic"
                    value={musicRequest.topic}
                    onChange={(e) => updateMusic("topic", e.target.value)}
                    placeholder="10-500 characters, describe your music visual story"
                    className={`min-h-24 ${validationErrors.topic ? "border-destructive" : ""}`}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="music-lyrics">Lyrics</Label>
                  <Textarea
                    id="music-lyrics"
                    value={musicRequest.lyrics}
                    onChange={(e) => updateMusic("lyrics", e.target.value)}
                    placeholder="Optional: lyrics for the music"
                    className="min-h-20"
                  />
                </div>

                {/* Music Input Selection */}
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-base">Music Source *</Label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {["file", "path", "url"].map((type) => (
                      <div
                        key={type}
                        onClick={() => {
                          setMusicInputType(type as MusicInputType)
                          updateMusic("musicFile", undefined)
                          updateMusic("musicPath", "")
                          updateMusic("musicUrl", "")
                        }}
                        className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                          musicInputType === type
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="music-input-type"
                          value={type}
                          checked={musicInputType === type}
                          onChange={() => {}}
                          className="cursor-pointer"
                        />
                        <label className="ml-2 cursor-pointer font-medium capitalize text-sm">
                          {type === "file" ? "Upload File" : type === "path" ? "Local Path" : "Remote URL"}
                        </label>
                      </div>
                    ))}
                  </div>

                  {musicInputType === "file" && (
                    <div className="space-y-2">
                      <Label htmlFor="music-file">Upload Audio File (.mp3, .wav)</Label>
                      <Input
                        id="music-file"
                        type="file"
                        accept="audio/mp3,audio/wav,.mp3,.wav"
                        onChange={(e) => updateMusic("musicFile", e.target.files?.[0])}
                        className="cursor-pointer"
                      />
                      {musicRequest.musicFile && (
                        <p className="text-xs text-muted-foreground">{musicRequest.musicFile.name}</p>
                      )}
                    </div>
                  )}

                  {musicInputType === "path" && (
                    <div className="space-y-2">
                      <Label htmlFor="music-path">Local File Path</Label>
                      <Input
                        id="music-path"
                        value={musicRequest.musicPath}
                        onChange={(e) => updateMusic("musicPath", e.target.value)}
                        placeholder="/path/to/music.mp3"
                      />
                    </div>
                  )}

                  {musicInputType === "url" && (
                    <div className="space-y-2">
                      <Label htmlFor="music-url">Remote URL</Label>
                      <Input
                        id="music-url"
                        type="url"
                        value={musicRequest.musicUrl}
                        onChange={(e) => updateMusic("musicUrl", e.target.value)}
                        placeholder="https://example.com/music.mp3"
                      />
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="music-style">Style</Label>
                    <Select
                      value={musicRequest.style}
                      onValueChange={(value) => updateMusic("style", value)}
                    >
                      <SelectTrigger id="music-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_STYLES.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="music-script-provider">Script Provider</Label>
                    <Select
                      value={musicRequest.scriptProvider}
                      onValueChange={(value) => updateMusic("scriptProvider", value)}
                    >
                      <SelectTrigger id="music-script-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCRIPT_PROVIDERS.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {provider}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="music-image-provider">Image Provider</Label>
                    <Select
                      value={musicRequest.imageProvider}
                      onValueChange={(value) => updateMusic("imageProvider", value)}
                    >
                      <SelectTrigger id="music-image-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMAGE_PROVIDERS.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {provider}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Cost Estimation */}
                {estimateCost(musicRequest.scriptProvider, musicRequest.imageProvider) > 0 && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3">
                    <p className="text-sm">
                      <span className="font-semibold">Estimated Cost:</span> ${estimateCost(
                        musicRequest.scriptProvider,
                        musicRequest.imageProvider
                      ).toFixed(3)}{" "}
                      ({musicRequest.scriptProvider} script + {musicRequest.imageProvider} images)
                    </p>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="music-image-model">Image Model</Label>
                    <Input
                      id="music-image-model"
                      value={musicRequest.imageModel}
                      onChange={(e) => updateMusic("imageModel", e.target.value)}
                      placeholder="e.g., dall-e-3, sd-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="music-youtube-resolution">YouTube Resolution</Label>
                    <Select
                      value={musicRequest.youtubeResolution}
                      onValueChange={(value) =>
                        updateMusic(
                          "youtubeResolution",
                          value as GenerateMusicVideoRequest["youtubeResolution"]
                        )
                      }
                    >
                      <SelectTrigger id="music-youtube-resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_RESOLUTIONS.map((resolution) => (
                          <SelectItem key={resolution} value={resolution}>
                            {resolution}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="music-reels-resolution">Instagram Reels Resolution</Label>
                    <Select
                      value={musicRequest.reelsResolution}
                      onValueChange={(value) =>
                        updateMusic(
                          "reelsResolution",
                          value as GenerateMusicVideoRequest["reelsResolution"]
                        )
                      }
                    >
                      <SelectTrigger id="music-reels-resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_RESOLUTIONS.map((resolution) => (
                          <SelectItem key={resolution} value={resolution}>
                            {resolution}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setExpandAdvanced((p) => ({ ...p, "music-story": !p["music-story"] }))}
                    className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                  >
                    {expandAdvanced["music-story"] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    Advanced Options
                  </button>

                  {expandAdvanced["music-story"] && (
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="music-additional-context">Additional Context {musicRequest.additionalContext.length}/500</Label>
                          {validationErrors.context && (
                            <span className="text-xs text-destructive">{validationErrors.context}</span>
                          )}
                        </div>
                        <Textarea
                          id="music-additional-context"
                          value={musicRequest.additionalContext}
                          onChange={(e) => updateMusic("additionalContext", e.target.value)}
                          placeholder="Special instructions, mood, tempo, etc."
                          className={`min-h-20 ${validationErrors.context ? "border-destructive" : ""}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="music-fps">FPS</Label>
                          {validationErrors.fps && (
                            <span className="text-xs text-destructive">{validationErrors.fps}</span>
                          )}
                        </div>
                        <Input
                          id="music-fps"
                          type="number"
                          min={24}
                          max={60}
                          value={musicRequest.fps ?? 30}
                          onChange={(e) => updateMusic("fps", Number(e.target.value))}
                          className={validationErrors.fps ? "border-destructive" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="music-callback">Callback URL</Label>
                        <Input
                          id="music-callback"
                          type="url"
                          value={musicRequest.callbackUrl}
                          onChange={(e) => updateMusic("callbackUrl", e.target.value)}
                          placeholder="https://example.com/webhook"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={loading || !canSubmitMusic}>
                  {loading && lastMode === "music-story" ? "Submitting..." : "Generate Music Story"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error ? (
        <StateMessage variant="destructive" title="Generation failed" message={error} />
      ) : null}

      {job ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" /> Job Status
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearJob}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Job ID</Label>
                <p className="font-mono text-sm mt-1">{job.jobId}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    job.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" :
                    job.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" :
                    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                  }`}>
                    {job.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {job.result?.videoUrl && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 space-y-2">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Video Generated Successfully!
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={job.result.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-700 dark:text-green-200 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" /> Download Video
                  </a>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 break-all font-mono">
                  {job.result.videoUrl}
                </p>
              </div>
            )}

            {job.result?.error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">Error</p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">{job.result.error}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshJob}
                disabled={loading || job.status === "completed" || job.status === "failed"}
                className="flex items-center gap-2"
              >
                <RotateCw className="w-4 h-4" /> Refresh Status
              </Button>

              <label className="flex items-center gap-2 px-3 py-1 text-sm border rounded hover:bg-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  disabled={job.status === "completed" || job.status === "failed"}
                  className="cursor-pointer"
                />
                Auto-refresh (every 5s)
              </label>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  )
}
