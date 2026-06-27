'use client'

import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, type RefObject } from 'react'
import type { CompareOptions, JsonDiffResult } from '@/lib/json-compare'
import type { DiffSortState } from '@/lib/json-compare/types'
import type { CompareWorkspace } from '@/lib/json-compare/compare-workspace'
import type { TextareaWithLineNumbersHandle } from '@/components/textarea-with-line-numbers'
import { CompareActionBar } from './compare-action-bar'
import { CompareOptionsPanel } from './compare-options-panel'
import { DiffViewer } from './diff-viewer'
import { JsonEditorPanel } from './json-editor-panel'
import { SummaryBanner } from './summary-banner'

interface CompareWorkspaceSectionProps {
  workspace: CompareWorkspace
  editor1Ref: RefObject<TextareaWithLineNumbersHandle | null>
  editor2Ref: RefObject<TextareaWithLineNumbersHandle | null>
  options: CompareOptions
  onJson1Change: (value: string) => void
  onJson2Change: (value: string) => void
  onFilterChange: (value: string) => void
  onSortChange: (sort: DiffSortState) => void
  onViewModeChange: (mode: CompareWorkspace['viewMode']) => void
  onOptionsChange: (options: CompareOptions) => void
  onCompare: () => void
  onFormatBoth?: () => void
  onMinifyBoth?: () => void
  onSortBothAsc?: () => void
  onSortBothDesc?: () => void
  onLoadExample?: () => void
  onClear: () => void
  onSelectPath: (path: string | null) => void
  onCopy: (diffs: JsonDiffResult[]) => void
  onDownloadCsv: (diffs: JsonDiffResult[]) => void
}

export function CompareWorkspaceSection({
  workspace,
  editor1Ref,
  editor2Ref,
  options,
  onJson1Change,
  onJson2Change,
  onFilterChange,
  onSortChange,
  onViewModeChange,
  onOptionsChange,
  onCompare,
  onFormatBoth,
  onMinifyBoth,
  onSortBothAsc,
  onSortBothDesc,
  onLoadExample,
  onClear,
  onSelectPath,
  onCopy,
  onDownloadCsv,
}: CompareWorkspaceSectionProps) {
  const editorsSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!workspace.activeDiffPath) return
    editorsSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [workspace.activeDiffPath])

  return (
    <div className='space-y-6'>
      <div
        ref={editorsSectionRef}
        className='grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-4'
      >
        <JsonEditorPanel
          ref={editor1Ref}
          title='JSON 1'
          iconColor='text-blue-500'
          value={workspace.json1}
          placeholder='Paste JSON 1 here...'
          onChange={onJson1Change}
          diffs={workspace.diffs}
          activePath={workspace.activeDiffPath ?? undefined}
        />
        <JsonEditorPanel
          ref={editor2Ref}
          title='JSON 2'
          iconColor='text-purple-500'
          value={workspace.json2}
          placeholder='Paste JSON 2 here...'
          onChange={onJson2Change}
          diffs={workspace.diffs}
          activePath={workspace.activeDiffPath ?? undefined}
        />
      </div>

      <div className='flex gap-4'>
        <CompareActionBar
          onCompare={onCompare}
          onFormatBoth={onFormatBoth}
          onMinifyBoth={onMinifyBoth}
          onSortBothAsc={onSortBothAsc}
          onSortBothDesc={onSortBothDesc}
          onLoadExample={onLoadExample}
          onClearAll={onClear}
        />

        <CompareOptionsPanel options={options} onChange={onOptionsChange} />
      </div>

      <AnimatePresence>
        {workspace.summary && <SummaryBanner summary={workspace.summary} />}
      </AnimatePresence>

      {workspace.hasCompared && (
        <DiffViewer
          diffs={workspace.diffs}
          filter={workspace.filter}
          sort={workspace.sort}
          viewMode={workspace.viewMode}
          activePath={workspace.activeDiffPath}
          onFilterChange={onFilterChange}
          onSortChange={onSortChange}
          onViewModeChange={onViewModeChange}
          onSelectPath={onSelectPath}
          onCopy={() => onCopy(workspace.diffs)}
          onDownloadCsv={() => onDownloadCsv(workspace.diffs)}
        />
      )}
    </div>
  )
}
