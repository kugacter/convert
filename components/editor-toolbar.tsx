"use client"

import { useRef, useState } from "react"
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  Copy,
  Download,
  Minimize2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  canFormatContent,
  canMinifyContent,
  canSortJsonContent,
  copyToClipboard,
  defaultExportFilename,
  downloadTextContent,
  formatContent,
  getContentType,
  minifyContent,
  readTextFile,
  sortJsonContent,
} from "@/lib/content-actions"
import { cn } from "@/lib/utils"

export type EditorToolbarFeature =
  | "upload"
  | "format"
  | "minify"
  | "sortAsc"
  | "sortDesc"
  | "copy"
  | "export"
  | "clear"

const DEFAULT_EDITABLE_FEATURES: EditorToolbarFeature[] = [
  "upload",
  "format",
  "minify",
  "sortAsc",
  "sortDesc",
  "clear",
]

interface EditorToolbarProps {
  value: string
  onChange?: (value: string) => void
  features?: EditorToolbarFeature[]
  variant?: "labeled" | "icon"
  accept?: string
  exportFilename?: string
  onClear?: () => void
  onUploaded?: (filename: string) => void
  onCopied?: () => void
  onExported?: (filename: string) => void
  onAction?: (action: EditorToolbarFeature) => void
  className?: string
  buttonClassName?: string
  showTypeBadge?: boolean
}

export function EditorToolbar({
  value,
  onChange,
  features = DEFAULT_EDITABLE_FEATURES,
  variant = "icon",
  accept = ".txt,.xml,.json",
  exportFilename,
  onClear,
  onUploaded,
  onCopied,
  onExported,
  onAction,
  className,
  buttonClassName,
  showTypeBadge = false,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const [minified, setMinified] = useState(false)
  const labeled = variant === "labeled"
  const contentType = getContentType(value)
  const outlineBtn = cn(
    "h-8 shrink-0 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300",
    labeled ? "px-2.5" : "w-8 px-0",
    buttonClassName
  )

  const has = (feature: EditorToolbarFeature) => features.includes(feature)

  const applyChange = (next: string, action: EditorToolbarFeature) => {
    if (!onChange) return
    onChange(next)
    onAction?.(action)
  }

  const handleUpload = async (file: File) => {
    if (!onChange) return
    const content = await readTextFile(file)
    onChange(content)
    onUploaded?.(file.name)
    onAction?.("upload")
  }

  const handleMinify = async () => {
    if (!value.trim() || !canMinifyContent(value)) return
    await copyToClipboard(minifyContent(value))
    setMinified(true)
    window.setTimeout(() => setMinified(false), 2000)
    onAction?.("minify")
  }

  const handleCopy = async () => {
    if (!value.trim()) return
    await copyToClipboard(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
    onCopied?.()
    onAction?.("copy")
  }

  const handleExport = () => {
    if (!value.trim()) return
    const filename = exportFilename ?? defaultExportFilename(value)
    downloadTextContent(value, filename)
    onExported?.(filename)
    onAction?.("export")
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {showTypeBadge && (
        <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-300 shrink-0">
          {contentType.toUpperCase()}
        </span>
      )}

      {has("upload") && onChange && (
        <>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="sm"
            className={outlineBtn}
            title="Upload file"
          >
            <Upload className="h-4 w-4" />
            {labeled && <span className="ml-1.5">Upload</span>}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleUpload(file)
              event.target.value = ""
            }}
          />
        </>
      )}

      {has("format") && onChange && (
        <Button
          type="button"
          onClick={() => applyChange(formatContent(value), "format")}
          variant="outline"
          size="sm"
          className={outlineBtn}
          disabled={!value.trim() || !canFormatContent(value)}
          title="Format JSON/XML"
        >
          <RefreshCw className="h-4 w-4" />
          {labeled && <span className="ml-1.5">Format</span>}
        </Button>
      )}

      {has("minify") && (
        <Button
          type="button"
          onClick={() => void handleMinify()}
          variant="outline"
          size="sm"
          className={outlineBtn}
          disabled={!value.trim() || !canMinifyContent(value)}
          title="Copy minified content to clipboard"
        >
          {minified ? <Check className="h-4 w-4 text-green-600" /> : <Minimize2 className="h-4 w-4" />}
          {labeled && <span className="ml-1.5">Minify</span>}
        </Button>
      )}

      {has("sortAsc") && onChange && (
        <Button
          type="button"
          onClick={() => applyChange(sortJsonContent(value, "asc"), "sortAsc")}
          variant="outline"
          size="sm"
          className={outlineBtn}
          disabled={!value.trim() || !canSortJsonContent(value)}
          title="Sort JSON keys (0-9, A-Z)"
        >
          <ArrowDownAZ className="h-4 w-4" />
          {labeled && <span className="ml-1.5">0-Z</span>}
        </Button>
      )}

      {has("sortDesc") && onChange && (
        <Button
          type="button"
          onClick={() => applyChange(sortJsonContent(value, "desc"), "sortDesc")}
          variant="outline"
          size="sm"
          className={outlineBtn}
          disabled={!value.trim() || !canSortJsonContent(value)}
          title="Sort JSON keys (Z-A, 9-0)"
        >
          <ArrowUpAZ className="h-4 w-4" />
          {labeled && <span className="ml-1.5">Z-0</span>}
        </Button>
      )}

      {has("copy") && (
        <Button
          type="button"
          onClick={() => void handleCopy()}
          variant="outline"
          size="sm"
          className={outlineBtn}
          disabled={!value.trim()}
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {labeled && <span className="ml-1.5">Copy</span>}
        </Button>
      )}

      {has("export") && (
        <Button
          type="button"
          onClick={handleExport}
          variant="outline"
          size="sm"
          className={outlineBtn}
          disabled={!value.trim()}
          title="Download file"
        >
          <Download className="h-4 w-4" />
          {labeled && <span className="ml-1.5">Export</span>}
        </Button>
      )}

      {has("clear") && onClear && (
        <Button
          type="button"
          onClick={onClear}
          variant="outline"
          size="sm"
          className={outlineBtn}
          title="Clear"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
