import { detectType, formatJson, formatXml } from "@/lib/xml-json-utils"
import { sortJsonText, type JsonKeySortDirection } from "@/lib/sort-json-keys"

export type ContentType = "json" | "xml" | "text"

export function getContentType(text: string): ContentType {
  return detectType(text)
}

export function canFormatContent(text: string): boolean {
  const type = detectType(text)
  return type === "json" || type === "xml"
}

export function canMinifyContent(text: string): boolean {
  return text.trim().length > 0
}

export function canSortJsonContent(text: string): boolean {
  return detectType(text) === "json"
}

export function formatContent(text: string): string {
  const type = detectType(text)
  if (type === "json") return formatJson(text)
  if (type === "xml") return formatXml(text)
  return text
}

export function minifyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text))
  } catch {
    return text
  }
}

export function minifyXml(text: string): string {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(text, "application/xml")
    if (xmlDoc.getElementsByTagName("parsererror").length) return text

    return text
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s+</g, "><")
      .trim()
  } catch {
    return text
  }
}

export function minifyText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

export function minifyContent(text: string): string {
  const type = detectType(text)
  if (type === "json") return minifyJson(text)
  if (type === "xml") return minifyXml(text)
  return minifyText(text)
}

export function sortJsonContent(text: string, direction: JsonKeySortDirection = "asc"): string {
  return sortJsonText(text, direction)
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function downloadTextContent(content: string, filename: string, mimeType = "text/plain") {
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

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve((event.target?.result as string) ?? "")
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })
}

export function defaultExportFilename(text: string, fallback = "content.txt"): string {
  const type = detectType(text)
  if (type === "json") return "content.json"
  if (type === "xml") return "content.xml"
  return fallback
}
