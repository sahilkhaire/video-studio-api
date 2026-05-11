import { useMemo, useState } from "react"

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

const VIDEO_STYLES = ["cartoon", "realistic", "animated", "minimal", "cinematic"]
const VIDEO_PLATFORMS = ["youtube", "instagram_reels", "tiktok"]
const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"]
const VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1"]
const SCRIPT_PROVIDERS = ["openai", "claude", "ollama", "together-ai", "groq"]
const IMAGE_PROVIDERS = ["dalle", "stable-diffusion", "leonardo", "together-ai"]

export default function GenerateVideoPage() {
  const [activeTab, setActiveTab] = useState<GenerationType>("standard")

  const [standardRequest, setStandardRequest] = useState<GenerateVideoRequest>({
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

  const [musicRequest, setMusicRequest] = useState<GenerateMusicVideoRequest>({
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

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<VideoJob | null>(null)
  const [lastMode, setLastMode] = useState<GenerationType | null>(null)

  const updateStandard = <K extends keyof GenerateVideoRequest>(
    key: K,
    value: GenerateVideoRequest[K]
  ) => {
    setStandardRequest((prev) => ({ ...prev, [key]: value }))
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
    return standardRequest.topic.trim().length >= 10 && standardRequest.targetDuration >= 15
  }, [standardRequest.topic, standardRequest.targetDuration])

  const canSubmitContentImages = useMemo(() => {
    return contentImagesRequest.data.length > 0
  }, [contentImagesRequest.data.length])

  const canSubmitMusic = useMemo(() => {
    const hasSource =
      !!musicRequest.musicFile ||
      !!musicRequest.musicPath?.trim() ||
      !!musicRequest.musicUrl?.trim()
    return musicRequest.topic.trim().length >= 10 && hasSource
  }, [musicRequest.musicFile, musicRequest.musicPath, musicRequest.musicUrl, musicRequest.topic])

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setLastMode("standard")

    try {
      const result = await apiClient.generateVideo({
        ...standardRequest,
        targetAudience: standardRequest.targetAudience?.trim() || undefined,
        additionalContext: standardRequest.additionalContext?.trim() || undefined,
        voice: standardRequest.voice?.trim() || undefined,
        callbackUrl: standardRequest.callbackUrl?.trim() || undefined,
      })
      setJob(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate video")
    } finally {
      setLoading(false)
    }
  }

  const handleContentImagesSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setLastMode("content-images")

    try {
      const result = await apiClient.generateFromContentImages({
        ...contentImagesRequest,
        voice: contentImagesRequest.voice?.trim() || undefined,
        callbackUrl: contentImagesRequest.callbackUrl?.trim() || undefined,
      })
      setJob(result)
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
    setError(null)
    setLoading(true)
    setLastMode("music-story")

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
                  <Label htmlFor="standard-topic">Topic *</Label>
                  <Textarea
                    id="standard-topic"
                    value={standardRequest.topic}
                    onChange={(e) => updateStandard("topic", e.target.value)}
                    placeholder="10-500 characters"
                    className="min-h-24"
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
                    <Label htmlFor="standard-target-duration">Target Duration (s) *</Label>
                    <Input
                      id="standard-target-duration"
                      type="number"
                      min={15}
                      max={600}
                      value={standardRequest.targetDuration}
                      onChange={(e) => updateStandard("targetDuration", Number(e.target.value))}
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
                    <Label htmlFor="standard-fps">FPS</Label>
                    <Input
                      id="standard-fps"
                      type="number"
                      min={24}
                      max={60}
                      value={standardRequest.fps ?? 30}
                      onChange={(e) => updateStandard("fps", Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="standard-target-audience">Target Audience</Label>
                    <Input
                      id="standard-target-audience"
                      maxLength={200}
                      value={standardRequest.targetAudience}
                      onChange={(e) => updateStandard("targetAudience", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="standard-voice">Voice</Label>
                    <Input
                      id="standard-voice"
                      maxLength={100}
                      value={standardRequest.voice}
                      onChange={(e) => updateStandard("voice", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="standard-context">Additional Context</Label>
                  <Textarea
                    id="standard-context"
                    maxLength={500}
                    value={standardRequest.additionalContext}
                    onChange={(e) => updateStandard("additionalContext", e.target.value)}
                    className="min-h-20"
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
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
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
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading || !canSubmitStandard}>
                  {loading && lastMode === "standard" ? "Submitting..." : "Generate Standard Video"}
                </Button>
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
                          placeholder="Narration content"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`segment-images-${index}`}>
                          Image URLs #{index + 1} (comma/new-line separated)
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
                          placeholder="https://example.com/image-1.jpg"
                          className="min-h-20"
                        />
                      </div>

                      {contentImageSegments.length > 1 ? (
                        <Button
                          type="button"
                          variant="destructive"
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
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
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
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="content-voice">Voice</Label>
                    <Input
                      id="content-voice"
                      value={contentImagesRequest.voice}
                      onChange={(e) => updateContentImages("voice", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content-callback">Callback URL</Label>
                    <Input
                      id="content-callback"
                      type="url"
                      value={contentImagesRequest.callbackUrl}
                      onChange={(e) => updateContentImages("callbackUrl", e.target.value)}
                    />
                  </div>
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
                  <Label htmlFor="music-topic">Topic *</Label>
                  <Textarea
                    id="music-topic"
                    value={musicRequest.topic}
                    onChange={(e) => updateMusic("topic", e.target.value)}
                    placeholder="10-500 characters"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="music-lyrics">Lyrics</Label>
                  <Textarea
                    id="music-lyrics"
                    value={musicRequest.lyrics}
                    onChange={(e) => updateMusic("lyrics", e.target.value)}
                    className="min-h-20"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="music-file">musicFile</Label>
                    <Input
                      id="music-file"
                      type="file"
                      accept="audio/mp3,audio/wav,.mp3,.wav"
                      onChange={(e) => updateMusic("musicFile", e.target.files?.[0])}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="music-path">musicPath</Label>
                    <Input
                      id="music-path"
                      value={musicRequest.musicPath}
                      onChange={(e) => updateMusic("musicPath", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="music-url">musicUrl</Label>
                    <Input
                      id="music-url"
                      type="url"
                      value={musicRequest.musicUrl}
                      onChange={(e) => updateMusic("musicUrl", e.target.value)}
                    />
                  </div>
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
                    <Label htmlFor="music-script-provider">scriptProvider</Label>
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
                    <Label htmlFor="music-image-provider">imageProvider</Label>
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

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="music-image-model">imageModel</Label>
                    <Input
                      id="music-image-model"
                      value={musicRequest.imageModel}
                      onChange={(e) => updateMusic("imageModel", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="music-youtube-resolution">youtubeResolution</Label>
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
                    <Label htmlFor="music-reels-resolution">reelsResolution</Label>
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

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="music-fps">FPS</Label>
                    <Input
                      id="music-fps"
                      type="number"
                      min={24}
                      max={60}
                      value={musicRequest.fps ?? 30}
                      onChange={(e) => updateMusic("fps", Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="music-callback">Callback URL</Label>
                    <Input
                      id="music-callback"
                      type="url"
                      value={musicRequest.callbackUrl}
                      onChange={(e) => updateMusic("callbackUrl", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="music-additional-context">additionalContext</Label>
                  <Textarea
                    id="music-additional-context"
                    value={musicRequest.additionalContext}
                    onChange={(e) => updateMusic("additionalContext", e.target.value)}
                    className="min-h-20"
                  />
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
        <StateMessage
          variant="success"
          title="Generation request accepted"
          message={`Mode: ${lastMode ?? activeTab} · Job ID: ${job.jobId} · Status: ${job.status.toUpperCase()}${
            job.result?.videoUrl ? ` · Output: ${job.result.videoUrl}` : ""
          }`}
        />
      ) : null}
    </PageShell>
  )
}
