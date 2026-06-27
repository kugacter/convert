"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type { CompareOptions, JsonDiffResult } from "@/lib/json-compare"
import { callBothEndpointsWithArrayMapping, callBothEndpointsWithBatch } from "@/lib/json-compare/api-client"
import {
  buildDiffCsv,
  downloadTextFile,
  formatJsonText,
  minifyJsonText,
  runCompare,
  sortJsonText,
} from "@/lib/json-compare/compare-helpers"
import {
  createEmptyWorkspace,
  patchWorkspace,
  type CompareWorkspace,
} from "@/lib/json-compare/compare-workspace"
import { EXAMPLE_JSON_1, EXAMPLE_JSON_2 } from "@/lib/json-compare/constants"
import { findLineForPath } from "@/lib/json-compare/diff-operations"
import {
  arrayCompareMappingsEqual,
  resolveArrayCompareDefaults,
} from "@/lib/json-compare/array-batch"
import { extractBodyVariableRefs } from "@/lib/json-compare/body-field-utils"
import { loadJsonCompareSettings, saveJsonCompareSettings } from "@/lib/json-compare/settings-client"
import { copyToClipboard } from "@/lib/content-actions"
import {
  clearPersistedContent,
  CONTENT_KEYS,
  loadPersistedContent,
  savePersistedContent,
} from "@/lib/content-persistence"
import { normalizeVariableValue } from "@/lib/json-compare/variable-resolver"
import {
  DEFAULT_COMPARE_OPTIONS,
  DEFAULT_ENDPOINT,
  DEFAULT_ARRAY_COMPARE_CONFIG,
  type ApiBatchProgress,
  type ApiBatchRunResult,
  type ApiBatchStats,
  type ApiCallResult,
  type ArrayCompareConfig,
  type EndpointConfig,
  type Variable,
} from "@/lib/json-compare/types"
import type { TextareaWithLineNumbersHandle } from "@/components/textarea-with-line-numbers"
import { useToast } from "@/hooks/use-toast"

export type CompareMode = "manual" | "api"
export type { DiffViewMode } from "@/lib/json-compare/compare-workspace"

export function useJsonCompare() {
  const { toast } = useToast()
  const manualEditor1Ref = useRef<TextareaWithLineNumbersHandle>(null)
  const manualEditor2Ref = useRef<TextareaWithLineNumbersHandle>(null)
  const apiEditor1Ref = useRef<TextareaWithLineNumbersHandle>(null)
  const apiEditor2Ref = useRef<TextareaWithLineNumbersHandle>(null)

  const [manual, setManual] = useState<CompareWorkspace>(createEmptyWorkspace)
  const [apiWorkspace, setApiWorkspace] = useState<CompareWorkspace>(createEmptyWorkspace)
  const [options, setOptions] = useState<CompareOptions>(DEFAULT_COMPARE_OPTIONS)
  const [variables, setVariables] = useState<Variable[]>([])
  const [endpoint1, setEndpoint1] = useState<EndpointConfig>(DEFAULT_ENDPOINT)
  const [endpoint2, setEndpoint2] = useState<EndpointConfig>(DEFAULT_ENDPOINT)
  const [arrayCompare, setArrayCompare] = useState<ArrayCompareConfig>(DEFAULT_ARRAY_COMPARE_CONFIG)
  const [apiResponses, setApiResponses] = useState<ApiCallResult[]>([])
  const [apiBatchStats, setApiBatchStats] = useState<ApiBatchStats | null>(null)
  const [apiBatchMode, setApiBatchMode] = useState<"single" | "array" | null>(null)
  const [apiBatchCount, setApiBatchCount] = useState(0)
  const [apiProgress, setApiProgress] = useState<ApiBatchProgress | null>(null)
  const [isCalling, setIsCalling] = useState(false)
  const [isComparePending, startCompareTransition] = useTransition()
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [contentLoaded, setContentLoaded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadJsonCompareSettings().then((settings) => {
      setVariables(settings.variables)
      setEndpoint1(settings.endpoint1)
      setEndpoint2(settings.endpoint2)
      setArrayCompare(settings.arrayCompare)
      setSettingsLoaded(true)
    })
  }, [])

  useEffect(() => {
    const json1 = loadPersistedContent(CONTENT_KEYS.jsonCompareManual1)
    const json2 = loadPersistedContent(CONTENT_KEYS.jsonCompareManual2)
    if (json1 || json2) {
      setManual((prev) => ({
        ...prev,
        json1: json1 || prev.json1,
        json2: json2 || prev.json2,
      }))
    }
    setContentLoaded(true)
  }, [])

  useEffect(() => {
    if (!contentLoaded) return

    if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current)
    contentSaveTimerRef.current = setTimeout(() => {
      savePersistedContent(CONTENT_KEYS.jsonCompareManual1, manual.json1)
      savePersistedContent(CONTENT_KEYS.jsonCompareManual2, manual.json2)
    }, 300)

    return () => {
      if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current)
    }
  }, [manual.json1, manual.json2, contentLoaded])

  useEffect(() => {
    if (!settingsLoaded) return

    const bodyRefs = extractBodyVariableRefs(endpoint1.body)
    const keys = variables.map((v) => v.key.trim()).filter(Boolean)
    const bodyFieldOptions = Array.from(new Set([...bodyRefs, ...keys]))

    setArrayCompare((prev) => {
      const next = resolveArrayCompareDefaults(variables, bodyFieldOptions, prev)
      if (arrayCompareMappingsEqual(next, prev)) return prev
      return next
    })
  }, [variables, endpoint1.body, settingsLoaded])

  useEffect(() => {
    if (!settingsLoaded) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveJsonCompareSettings({ variables, endpoint1, endpoint2, arrayCompare }).catch(() => {})
    }, 500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [variables, endpoint1, endpoint2, arrayCompare, settingsLoaded])

  const updateManual = useCallback((patch: Partial<CompareWorkspace>) => {
    setManual((prev) => patchWorkspace(prev, patch))
  }, [])

  const updateApiWorkspace = useCallback((patch: Partial<CompareWorkspace>) => {
    setApiWorkspace((prev) => patchWorkspace(prev, patch))
  }, [])

  const runWorkspaceCompare = useCallback(
    (mode: CompareMode, json1: string, json2: string) => {
      const updater = mode === "manual" ? updateManual : updateApiWorkspace
      updater({ summary: null, hasCompared: true, activeDiffPath: null })

      try {
        const result = runCompare(json1, json2, options)
        updater({
          diffs: result.diffs,
          summary: result.summary,
          hasCompared: true,
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Compare failed"
        updater({ diffs: [], summary: { type: "error", message }, hasCompared: true })
      }
    },
    [options, updateManual, updateApiWorkspace]
  )

  const handleManualCompare = useCallback(() => {
    runWorkspaceCompare("manual", manual.json1, manual.json2)
  }, [manual.json1, manual.json2, runWorkspaceCompare])

  const handleApiCompare = useCallback(() => {
    runWorkspaceCompare("api", apiWorkspace.json1, apiWorkspace.json2)
  }, [apiWorkspace.json1, apiWorkspace.json2, runWorkspaceCompare])

  const applyWorkspaceContentAction = useCallback(
    (
      mode: CompareMode,
      transform: (text: string) => string,
      successMessage: string,
      errorLabel: string
    ) => {
      const json1 = mode === "manual" ? manual.json1 : apiWorkspace.json1
      const json2 = mode === "manual" ? manual.json2 : apiWorkspace.json2
      const updater = mode === "manual" ? updateManual : updateApiWorkspace

      try {
        const patch: Partial<CompareWorkspace> = {}
        if (json1.trim()) patch.json1 = transform(json1)
        if (json2.trim()) patch.json2 = transform(json2)
        updater({ ...patch, summary: { type: "ok", message: successMessage } })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : `${errorLabel} failed`
        updater({ summary: { type: "error", message } })
      }
    },
    [manual.json1, manual.json2, apiWorkspace.json1, apiWorkspace.json2, updateManual, updateApiWorkspace]
  )

  const createWorkspaceBothHandlers = useCallback(
    (mode: CompareMode) => ({
      formatBoth: () =>
        applyWorkspaceContentAction(mode, formatJsonText, "Formatted both JSONs successfully.", "Format"),
      minifyBoth: async () => {
        const json1 = mode === "manual" ? manual.json1 : apiWorkspace.json1
        const json2 = mode === "manual" ? manual.json2 : apiWorkspace.json2
        const updater = mode === "manual" ? updateManual : updateApiWorkspace

        try {
          const parts: string[] = []
          if (json1.trim()) parts.push(minifyJsonText(json1))
          if (json2.trim()) parts.push(minifyJsonText(json2))
          if (parts.length === 0) throw new Error("Nothing to minify")

          await copyToClipboard(parts.join("\n\n"))
          updater({ summary: { type: "ok", message: "Copied minified JSON to clipboard." } })
          toast({ title: "Copied", description: "Minified content copied to clipboard." })
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Minify failed"
          updater({ summary: { type: "error", message } })
        }
      },
      sortBothAsc: () =>
        applyWorkspaceContentAction(
          mode,
          (text) => sortJsonText(text, "asc"),
          "Sorted JSON keys (0-9, A-Z) in both panels.",
          "Sort"
        ),
      sortBothDesc: () =>
        applyWorkspaceContentAction(
          mode,
          (text) => sortJsonText(text, "desc"),
          "Sorted JSON keys (Z-A, 9-0) in both panels.",
          "Sort"
        ),
    }),
    [applyWorkspaceContentAction, manual.json1, manual.json2, apiWorkspace.json1, apiWorkspace.json2, updateManual, updateApiWorkspace, toast]
  )

  const manualWorkspaceHandlers = createWorkspaceBothHandlers("manual")
  const apiWorkspaceHandlers = createWorkspaceBothHandlers("api")

  const handleManualFormatBoth = manualWorkspaceHandlers.formatBoth
  const handleManualMinifyBoth = manualWorkspaceHandlers.minifyBoth
  const handleManualSortBothAsc = manualWorkspaceHandlers.sortBothAsc
  const handleManualSortBothDesc = manualWorkspaceHandlers.sortBothDesc

  const handleApiFormatBoth = apiWorkspaceHandlers.formatBoth
  const handleApiMinifyBoth = apiWorkspaceHandlers.minifyBoth
  const handleApiSortBothAsc = apiWorkspaceHandlers.sortBothAsc
  const handleApiSortBothDesc = apiWorkspaceHandlers.sortBothDesc

  const handleManualClear = useCallback(() => {
    setManual(createEmptyWorkspace())
    clearPersistedContent(CONTENT_KEYS.jsonCompareManual1)
    clearPersistedContent(CONTENT_KEYS.jsonCompareManual2)
  }, [])

  const handleManualLoadExample = useCallback(() => {
    const ex1 = JSON.stringify(EXAMPLE_JSON_1, null, 2)
    const ex2 = JSON.stringify(EXAMPLE_JSON_2, null, 2)
    updateManual({ json1: ex1, json2: ex2 })
    setTimeout(() => runWorkspaceCompare("manual", ex1, ex2), 100)
  }, [updateManual, runWorkspaceCompare])

  const handleApiClear = useCallback(() => {
    setApiWorkspace(createEmptyWorkspace())
    setApiResponses([])
    setApiBatchStats(null)
    setApiBatchMode(null)
    setApiBatchCount(0)
    setApiProgress(null)
  }, [])

  const applyBatchResult = useCallback(
    (batchResult: ApiBatchRunResult) => {
      const formatted1 = batchResult.combinedJson1
      const formatted2 = batchResult.combinedJson2
      const batchLabel =
        batchResult.mode === "array"
          ? ` (${batchResult.batchCount} batches from ${batchResult.loopVariable})`
          : ""

      startCompareTransition(() => {
        setApiResponses(batchResult.responses)
        setApiBatchStats(batchResult.stats ?? null)
        setApiBatchMode(batchResult.mode)
        setApiBatchCount(batchResult.batchCount)
        setApiProgress(null)

        if (!formatted1.trim() || !formatted2.trim()) {
          const errors =
            batchResult.stats?.failures.map((f) => `Batch ${f.batchNumber} EP${f.slot}: ${f.error}`).join("; ") ||
            batchResult.stats?.sampleErrors.join("; ") ||
            batchResult.responses.map((r) => r.error).filter(Boolean).join("; ")
          updateApiWorkspace({
            diffs: [],
            hasCompared: true,
            summary: {
              type: "error",
              message: errors || "One or both API responses are empty.",
            },
          })
          return
        }

        updateApiWorkspace({
          json1: formatted1,
          json2: formatted2,
          diffs: [],
          hasCompared: true,
          activeDiffPath: null,
          summary: {
            type: "ok",
            message: `Loaded API responses${batchLabel}. Comparing…`,
          },
        })
      })

      window.setTimeout(() => {
        try {
          const result = runCompare(formatted1, formatted2, options)
          startCompareTransition(() => {
            updateApiWorkspace({
              diffs: result.diffs,
              summary: {
                type: result.summary.type,
                message: `${result.summary.message} (Loaded from API responses${batchLabel})`,
              },
              hasCompared: true,
            })
          })
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Compare failed"
          startCompareTransition(() => {
            updateApiWorkspace({ summary: { type: "error", message } })
          })
        }
      }, 0)
    },
    [options, updateApiWorkspace]
  )

  const handleCallBothAndCompare = useCallback(async () => {
    setIsCalling(true)
    updateApiWorkspace({ summary: null })
    setApiResponses([])
    setApiBatchStats(null)
    setApiBatchMode(null)
    setApiBatchCount(0)
    setApiProgress(null)

    try {
      const batchResult = await callBothEndpointsWithBatch(endpoint1, endpoint2, variables, {
        onProgress: setApiProgress,
      })
      applyBatchResult(batchResult)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "API call failed"
      updateApiWorkspace({ summary: { type: "error", message } })
    } finally {
      setIsCalling(false)
    }
  }, [endpoint1, endpoint2, variables, applyBatchResult, updateApiWorkspace])

  const handleCallCompareWithVariable = useCallback(async () => {
    setIsCalling(true)
    updateApiWorkspace({ summary: null })
    setApiResponses([])
    setApiBatchStats(null)
    setApiBatchMode(null)
    setApiBatchCount(0)
    setApiProgress(null)

    try {
      const batchResult = await callBothEndpointsWithArrayMapping(
        endpoint1,
        endpoint2,
        variables,
        arrayCompare,
        { onProgress: setApiProgress }
      )
      applyBatchResult(batchResult)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "API call failed"
      updateApiWorkspace({ summary: { type: "error", message } })
    } finally {
      setIsCalling(false)
    }
  }, [endpoint1, endpoint2, variables, arrayCompare, applyBatchResult, updateApiWorkspace])

  const handleCopyResult = useCallback(
    async (diffs: JsonDiffResult[]) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(diffs, null, 2))
        toast({ title: "Success", description: "Copied result JSON to clipboard." })
      } catch {
        toast({ title: "Error", description: "Failed to copy to clipboard.", variant: "destructive" })
      }
    },
    [toast]
  )

  const handleDownloadCsv = useCallback((diffs: JsonDiffResult[]) => {
    downloadTextFile(buildDiffCsv(diffs), "json-diff.csv", "text/csv;charset=utf-8;")
  }, [])

  const handleSelectDiffPath = useCallback(
    (
      mode: CompareMode,
      path: string | null,
      json1: string,
      json2: string,
      editor1Ref: React.RefObject<TextareaWithLineNumbersHandle | null>,
      editor2Ref: React.RefObject<TextareaWithLineNumbersHandle | null>
    ) => {
      const updater = mode === "manual" ? updateManual : updateApiWorkspace
      updater({ activeDiffPath: path })
      if (!path) return

      const line1 = findLineForPath(json1, path)
      const line2 = findLineForPath(json2, path)

      requestAnimationFrame(() => {
        editor1Ref.current?.scrollToLine(line1)
        editor2Ref.current?.scrollToLine(line2)
      })
    },
    [updateManual, updateApiWorkspace]
  )

  const handleError = useCallback(
    (message: string, mode: CompareMode = "api") => {
      if (mode === "manual") updateManual({ summary: { type: "error", message } })
      else updateApiWorkspace({ summary: { type: "error", message } })
    },
    [updateManual, updateApiWorkspace]
  )

  const handleSuccess = useCallback(
    (message: string) => {
      updateApiWorkspace({ summary: { type: "ok", message } })
      toast({ title: "Success", description: message })
    },
    [toast, updateApiWorkspace]
  )

  const handleClearVariables = useCallback(() => {
    setVariables([])
  }, [])

  const handleApplyVariable = useCallback(
    (key: string, value: string) => {
      const trimmedKey = key.trim()
      const normalizedValue = normalizeVariableValue(value)
      setVariables((prev) => {
        const index = prev.findIndex((v) => v.key.trim() === trimmedKey)
        const next =
          index >= 0
            ? prev.map((v, i) =>
                i === index ? { ...v, key: trimmedKey, value: normalizedValue } : v
              )
            : [...prev, { key: trimmedKey, value: normalizedValue }]

        if (settingsLoaded) {
          saveJsonCompareSettings({
            variables: next,
            endpoint1,
            endpoint2,
            arrayCompare,
          }).catch(() => {})
        }

        return next
      })
    },
    [endpoint1, endpoint2, arrayCompare, settingsLoaded]
  )

  return {
    manual,
    apiWorkspace,
    manualEditor1Ref,
    manualEditor2Ref,
    apiEditor1Ref,
    apiEditor2Ref,
    options,
    variables,
    endpoint1,
    endpoint2,
    arrayCompare,
    apiResponses,
    apiBatchStats,
    apiBatchMode,
    apiBatchCount,
    apiProgress,
    isCalling,
    isComparePending,
    setOptions,
    setVariables,
    setEndpoint1,
    setEndpoint2,
    setArrayCompare,
    updateManual,
    updateApiWorkspace,
    handleManualCompare,
    handleApiCompare,
    handleManualFormatBoth,
    handleManualMinifyBoth,
    handleManualSortBothAsc,
    handleManualSortBothDesc,
    handleManualClear,
    handleManualLoadExample,
    handleApiFormatBoth,
    handleApiMinifyBoth,
    handleApiSortBothAsc,
    handleApiSortBothDesc,
    handleApiClear,
    handleCallBothAndCompare,
    handleCallCompareWithVariable,
    handleCopyResult,
    handleDownloadCsv,
    handleSelectDiffPath,
    handleError,
    handleSuccess,
    handleClearVariables,
    handleApplyVariable,
  }
}
