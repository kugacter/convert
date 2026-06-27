'use client'

import { motion } from 'framer-motion'
import { CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiRunnerSection } from '@/components/json-compare/api-runner-section'
import { CompareWorkspaceSection } from '@/components/json-compare/compare-workspace-section'
import { JsonlConverterPanel } from '@/components/json-compare/jsonl-converter-panel'
import { VariablesPanel } from '@/components/json-compare/variables-panel'
import { useJsonCompare } from '@/hooks/use-json-compare'

export default function JsonComparePage() {
  const {
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
  } = useJsonCompare()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className='space-y-6'
    >
      <div className='text-center mb-8'>
        <h2 className='text-2xl font-bold text-gray-900 dark:text-white mb-2'>
          JSON Compare Tool
        </h2>
        <p className='text-muted-foreground dark:text-gray-400'>
          Compare JSON manually or call two APIs with Postman-like variables,
          then diff the responses.
        </p>
      </div>

      <Tabs defaultValue='manual' className='space-y-4'>
        <TabsList className='grid w-full max-w-md grid-cols-2 mx-auto'>
          <TabsTrigger value='manual'>Manual Compare</TabsTrigger>
          <TabsTrigger value='api'>API Compare</TabsTrigger>
        </TabsList>

        <TabsContent value='manual' className='space-y-4'>
          <CompareWorkspaceSection
            workspace={manual}
            editor1Ref={manualEditor1Ref}
            editor2Ref={manualEditor2Ref}
            options={options}
            onJson1Change={(value) => updateManual({ json1: value })}
            onJson2Change={(value) => updateManual({ json2: value })}
            onFilterChange={(value) => updateManual({ filter: value })}
            onSortChange={(sort) => updateManual({ sort })}
            onViewModeChange={(viewMode) => updateManual({ viewMode })}
            onOptionsChange={setOptions}
            onCompare={handleManualCompare}
            onFormatBoth={handleManualFormatBoth}
            onMinifyBoth={handleManualMinifyBoth}
            onSortBothAsc={handleManualSortBothAsc}
            onSortBothDesc={handleManualSortBothDesc}
            onLoadExample={handleManualLoadExample}
            onClear={handleManualClear}
            onSelectPath={(path) =>
              handleSelectDiffPath(
                'manual',
                path,
                manual.json1,
                manual.json2,
                manualEditor1Ref,
                manualEditor2Ref
              )
            }
            onCopy={handleCopyResult}
            onDownloadCsv={handleDownloadCsv}
          />
        </TabsContent>

        <TabsContent value='api' className='space-y-4'>
          <div className='flex justify-end sticky top-2 z-10 -mb-2'>
            <Button variant='outline' size='sm' className='gap-1.5 shadow-sm bg-background' asChild>
              <a
                href='/docs/huong-dan-api-compare.html'
                target='_blank'
                rel='noopener noreferrer'
              >
                <CircleHelp className='h-4 w-4' />
                Hướng dẫn API Compare
              </a>
            </Button>
          </div>
          <JsonlConverterPanel
            variables={variables}
            onApplyToVariable={handleApplyVariable}
            onError={handleError}
            onSuccess={handleSuccess}
          />
          <VariablesPanel
            variables={variables}
            onChange={setVariables}
            onClearAll={handleClearVariables}
            onError={handleError}
          />
          <ApiRunnerSection
            endpoint1={endpoint1}
            endpoint2={endpoint2}
            variables={variables}
            arrayCompare={arrayCompare}
            batchStats={apiBatchStats}
            batchMode={apiBatchMode}
            batchCount={apiBatchCount}
            progress={apiProgress}
            isCalling={isCalling}
            isComparePending={isComparePending}
            onEndpoint1Change={setEndpoint1}
            onEndpoint2Change={setEndpoint2}
            onArrayCompareChange={setArrayCompare}
            onCallBoth={handleCallBothAndCompare}
            onCallWithVariable={handleCallCompareWithVariable}
            onError={handleError}
          />
          <CompareWorkspaceSection
            workspace={apiWorkspace}
            editor1Ref={apiEditor1Ref}
            editor2Ref={apiEditor2Ref}
            options={options}
            onJson1Change={(value) => updateApiWorkspace({ json1: value })}
            onJson2Change={(value) => updateApiWorkspace({ json2: value })}
            onFilterChange={(value) => updateApiWorkspace({ filter: value })}
            onSortChange={(sort) => updateApiWorkspace({ sort })}
            onViewModeChange={(viewMode) => updateApiWorkspace({ viewMode })}
            onOptionsChange={setOptions}
            onCompare={handleApiCompare}
            onFormatBoth={handleApiFormatBoth}
            onMinifyBoth={handleApiMinifyBoth}
            onSortBothAsc={handleApiSortBothAsc}
            onSortBothDesc={handleApiSortBothDesc}
            onClear={handleApiClear}
            onSelectPath={(path) =>
              handleSelectDiffPath(
                'api',
                path,
                apiWorkspace.json1,
                apiWorkspace.json2,
                apiEditor1Ref,
                apiEditor2Ref
              )
            }
            onCopy={handleCopyResult}
            onDownloadCsv={handleDownloadCsv}
          />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
