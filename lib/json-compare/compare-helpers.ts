import { compareJsonObjects, type CompareOptions, type JsonDiffResult } from "@/lib/json-compare"
import { formatContent, minifyContent, sortJsonContent } from "@/lib/content-actions"
import type { CompareSummary } from "./types"

export { sortJsonContent as sortJsonText }

export function parseJsonInput(text: string, label: string): unknown {
  const raw = text.trim()
  if (!raw) throw new Error(`${label} is empty`)
  try {
    return JSON.parse(raw)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    throw new Error(`Failed to parse ${label}: ${message}`)
  }
}

export function formatJsonText(text: string): string {
  if (!text.trim()) return text
  return formatContent(text)
}

export function minifyJsonText(text: string): string {
  if (!text.trim()) return text
  return minifyContent(text)
}

export function runCompare(
  json1: string,
  json2: string,
  options: CompareOptions
): { diffs: JsonDiffResult[]; summary: CompareSummary } {
  const obj1 = parseJsonInput(json1, "JSON 1")
  const obj2 = parseJsonInput(json2, "JSON 2")
  const diffs = compareJsonObjects(obj1, obj2, options)

  if (diffs.length === 0) {
    return {
      diffs,
      summary: {
        type: "ok",
        message: "The 2 JSONs are identical based on the current options.",
      },
    }
  }

  const missing = diffs.filter((d) => d.type === "MISSING_FIELD").length
  const typeMismatch = diffs.filter((d) => d.type === "TYPE_MISMATCH").length
  const valueMismatch = diffs.filter((d) => d.type === "VALUE_MISMATCH").length

  return {
    diffs,
    summary: {
      type: "warn",
      message: `Found ${diffs.length} differences: ${missing} missing field(s), ${typeMismatch} type mismatch(es), ${valueMismatch} value mismatch(es).`,
    },
  }
}

export function buildDiffCsv(diffs: JsonDiffResult[]): string {
  const headers = ["index", "type", "path", "json1Type", "json1", "json2Type", "json2"]
  const lines = [headers.join(",")]

  const csvEscape = (value: unknown) => {
    const text = String(value ?? "")
    return `"${text.replace(/"/g, '""')}"`
  }

  diffs.forEach((diff, index) => {
    lines.push(
      [index + 1, diff.type, diff.path, diff.json1Type, diff.json1, diff.json2Type, diff.json2]
        .map(csvEscape)
        .join(",")
    )
  })

  return lines.join("\n")
}

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
