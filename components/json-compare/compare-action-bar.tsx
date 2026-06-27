"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Play, RefreshCw, Trash2, ArrowDownAZ, ArrowUpAZ, Minimize2 } from "lucide-react"

interface CompareActionBarProps {
  onCompare: () => void
  onFormatBoth?: () => void
  onMinifyBoth?: () => void
  onSortBothAsc?: () => void
  onSortBothDesc?: () => void
  onLoadExample?: () => void
  onClearAll: () => void
}

export function CompareActionBar({
  onCompare,
  onFormatBoth,
  onMinifyBoth,
  onSortBothAsc,
  onSortBothDesc,
  onLoadExample,
  onClearAll,
}: CompareActionBarProps) {
  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700 shadow-sm border-gray-200">
      <CardContent className="p-4 flex flex-wrap items-center gap-2">
        <Button onClick={onCompare} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Play className="w-4 h-4" /> Compare
        </Button>
        {onFormatBoth && (
          <Button onClick={onFormatBoth} variant="outline" className="gap-2 dark:border-gray-600 dark:hover:bg-gray-700">
            <RefreshCw className="w-4 h-4" /> Format Both
          </Button>
        )}
        {onMinifyBoth && (
          <Button
            onClick={() => void onMinifyBoth()}
            variant="outline"
            className="gap-2 dark:border-gray-600 dark:hover:bg-gray-700"
            title="Copy minified JSON to clipboard"
          >
            <Minimize2 className="w-4 h-4" /> Minify Both
          </Button>
        )}
        {onSortBothAsc && (
          <Button onClick={onSortBothAsc} variant="outline" className="gap-2 dark:border-gray-600 dark:hover:bg-gray-700">
            <ArrowDownAZ className="w-4 h-4" /> 0-Z
          </Button>
        )}
        {onSortBothDesc && (
          <Button onClick={onSortBothDesc} variant="outline" className="gap-2 dark:border-gray-600 dark:hover:bg-gray-700">
            <ArrowUpAZ className="w-4 h-4" /> Z-0
          </Button>
        )}
        {onLoadExample && (
          <Button onClick={onLoadExample} variant="outline" className="dark:border-gray-600 dark:hover:bg-gray-700">
            Example
          </Button>
        )}
        <Button
          onClick={onClearAll}
          variant="ghost"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 gap-2"
        >
          <Trash2 className="w-4 h-4" /> Clear
        </Button>
      </CardContent>
    </Card>
  )
}
