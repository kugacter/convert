"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createDiff, DiffLine } from "@/lib/diff"
import { detectType, formatJson, formatXml } from "@/lib/xml-json-utils"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { CONTENT_KEYS } from "@/lib/content-persistence"
import { EditorToolbar } from "@/components/editor-toolbar"
import { TextareaWithLineNumbers } from "@/components/textarea-with-line-numbers"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"

export default function ComparePage() {
  const { toast } = useToast()

  const [compareLeft, setCompareLeft, clearCompareLeft] = usePersistedState(CONTENT_KEYS.compareLeft)
  const [compareRight, setCompareRight, clearCompareRight] = usePersistedState(CONTENT_KEYS.compareRight)
  const [compareWordWrapEnabled, setCompareWordWrapEnabled] = useState(false)

  const renderDiff = (diff: DiffLine[]) => {
    const hasChanges = diff.some((line) => line.type !== "unchanged")

    if (!hasChanges) {
      return <div className="text-center py-8 text-green-600 font-medium">✓ Files are identical</div>
    }

    const groupedDiff: (DiffLine | { type: "context"; count: number })[] = []
    let unchangedCount = 0
    const CONTEXT_LINES = 3

    diff.forEach((line, index) => {
      if (line.type === "unchanged") {
        unchangedCount++
        const prevLine = diff[index - 1]
        const nextLine = diff[index + 1]
        const isNearChange = (prevLine && prevLine.type !== "unchanged") || (nextLine && nextLine.type !== "unchanged")

        if (index < CONTEXT_LINES || index >= diff.length - CONTEXT_LINES || isNearChange) {
            if (unchangedCount > 1 && !isNearChange && index >= CONTEXT_LINES) {
                const hiddenCount = unchangedCount - (index > diff.length - CONTEXT_LINES ? 0 : CONTEXT_LINES)
                if(hiddenCount > 0) groupedDiff.push({ type: "context", count: hiddenCount })
            }
            groupedDiff.push(line)
            unchangedCount = 0
        }
      } else {
        if (unchangedCount > CONTEXT_LINES * 2 + 1) {
            for (let i = index - unchangedCount; i < index - unchangedCount + CONTEXT_LINES; i++) {
                groupedDiff.push(diff[i])
            }
            groupedDiff.push({ type: "context", count: unchangedCount - CONTEXT_LINES * 2 })
            for (let i = index - CONTEXT_LINES; i < index; i++) {
                groupedDiff.push(diff[i])
            }
        } else {
            for (let i = index - unchangedCount; i < index; i++) {
                groupedDiff.push(diff[i])
            }
        }
        unchangedCount = 0
        groupedDiff.push(line)
      }
    })

     if (unchangedCount > 0) {
        if(unchangedCount > CONTEXT_LINES) {
            for (let i = diff.length - unchangedCount; i < diff.length - unchangedCount + CONTEXT_LINES; i++) {
                groupedDiff.push(diff[i])
            }
            groupedDiff.push({ type: "context", count: unchangedCount - CONTEXT_LINES })
        } else {
            for (let i = diff.length - unchangedCount; i < diff.length; i++) {
                groupedDiff.push(diff[i])
            }
        }
    }

    return (
      <div className="font-mono text-sm space-y-1">
        {groupedDiff.map((item, index) => {
          if ("count" in item) {
            return (
              <div
                key={index}
                className="px-2 py-2 text-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-y border-gray-300 dark:border-gray-600"
              >
                <span className="text-xs">... {item.count} unchanged lines ...</span>
              </div>
            )
          }

          const line = item as DiffLine
          return (
            <div
              key={index}
              className={`px-2 py-1 ${
                line.type === "added"
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-l-4 border-green-500"
                  : line.type === "removed"
                  ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-l-4 border-red-500"
                  : "text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800"
              }`}
            >
              <span className="inline-block w-8 text-gray-400 text-xs mr-2">{line.lineNumber}</span>
              <span className="inline-block w-4 mr-2">
                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
              </span>
              {line.content}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Compare Tool</h2>
        <p className="text-muted-foreground dark:text-gray-400">
          Find differences between two XML, JSON, or Text files
        </p>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700 shadow-lg border-gray-200">
        <CardContent className="pt-6 dark:text-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold dark:text-gray-200">File 1</h3>
              <EditorToolbar
                value={compareLeft}
                onChange={setCompareLeft}
                onClear={clearCompareLeft}
                showTypeBadge
                onUploaded={(filename) =>
                  toast({ title: "Success", description: `Loaded file ${filename}` })
                }
                onAction={(action) => {
                  if (action === "format") toast({ title: "Formatted", description: "File 1 formatted." })
                  if (action === "minify") toast({ title: "Copied", description: "Minified content copied to clipboard." })
                }}
              />
              <TextareaWithLineNumbers
                value={compareLeft}
                onChange={(e) => setCompareLeft(e.target.value)}
                placeholder="Enter first file (XML, JSON, or Text)..."
                className="min-h-[400px] text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                wordWrap={compareWordWrapEnabled}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold dark:text-gray-200">File 2</h3>
              <EditorToolbar
                value={compareRight}
                onChange={setCompareRight}
                onClear={clearCompareRight}
                showTypeBadge
                onUploaded={(filename) =>
                  toast({ title: "Success", description: `Loaded file ${filename}` })
                }
                onAction={(action) => {
                  if (action === "format") toast({ title: "Formatted", description: "File 2 formatted." })
                  if (action === "minify") toast({ title: "Copied", description: "Minified content copied to clipboard." })
                }}
              />
              <TextareaWithLineNumbers
                value={compareRight}
                onChange={(e) => setCompareRight(e.target.value)}
                placeholder="Enter second file (XML, JSON, or Text)..."
                className="min-h-[400px] text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                wordWrap={compareWordWrapEnabled}
              />
            </div>
          </div>

          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareWordWrapEnabled((prev) => !prev)}
              className="dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Word Wrap: {compareWordWrapEnabled ? "On" : "Off"}
            </Button>
          </div>

          {compareLeft && compareRight && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold dark:text-gray-200">Differences</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span className="dark:text-gray-300">Removed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="dark:text-gray-300">Added</span>
                  </div>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted dark:bg-gray-700 dark:border-gray-600 max-h-[500px] overflow-auto shadow-inner">
                {(() => {
                  const typeLeft = detectType(compareLeft)
                  const typeRight = detectType(compareRight)
                  try {
                    let left = compareLeft
                    let right = compareRight

                    if (typeLeft === "json" && typeRight === "json") {
                      left = formatJson(compareLeft)
                      right = formatJson(compareRight)
                    } else if (typeLeft === "xml" && typeRight === "xml") {
                      left = formatXml(compareLeft)
                      right = formatXml(compareRight)
                    }

                    const diff = createDiff(left, right)
                    return renderDiff(diff)
                  } catch {
                    return (
                      <div className="text-center py-8 text-yellow-600 font-medium">
                        ⚠ Error during comparison. One of the inputs might have an invalid format.
                      </div>
                    )
                  }
                })()}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
