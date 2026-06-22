'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, Download, Copy, Trash2, RefreshCw, Check, ArrowDownAZ, ArrowUpAZ } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { TextareaWithLineNumbers } from '@/components/textarea-with-line-numbers'
import { motion } from 'framer-motion'

import {
  NAMESPACE_MAP,
  S37_GROUPS,
  B11T_GROUPS,
  B11T_GROUP_DATA,
  PCB_NAMESPACE_MAP,
} from '@/lib/xml-json-constants'

import {
  detectType,
  formatJson,
  formatXml,
  xmlElementToJson,
  jsonToXmlElement,
  removePrefix,
  normalizeCICKey,
  normalizeCICKeysDeep,
  isB11TJson as detectB11TJson,
  isB11TXml as detectB11TXml,
  preprocessConverterJsonInput,
  hasPcbPasteStructure,
  hasCicPasteStructure,
} from '@/lib/xml-json-utils'
import { sortJsonText } from '@/lib/sort-json-keys'
import { usePersistedState } from '@/hooks/use-persisted-state'
import { CONTENT_KEYS } from '@/lib/content-persistence'
import { convertJsonToXml, convertXmlToJson, SAMPLE_JSON_S11A_R14 } from '@/lib/s11a-r14-converter'

function resolveJsonInput(inputText: string, conversionType: 'CIC' | 'PCB' | 'S11A_R14') {
  if (conversionType === 'S11A_R14') {
    const parsed = JSON.parse(inputText)
    return {
      parsed,
      preprocessed: parsed,
      workingText: inputText,
    }
  }
  const parsed = JSON.parse(inputText)
  const preprocessed = preprocessConverterJsonInput(parsed, conversionType)
  return {
    parsed,
    preprocessed,
    workingText: JSON.stringify(preprocessed),
  }
}

export default function ConverterPage() {
  const { toast } = useToast()
  const inputFileRef = useRef<HTMLInputElement>(null)

  const [input, setInput, clearInput] = usePersistedState(CONTENT_KEYS.converterInput)
  const [output, setOutput] = useState('')
  const [conversionType, setConversionType] = useState<'CIC' | 'PCB' | 'S11A_R14'>('CIC')
  const [isConverting, setIsConverting] = useState(false)
  const [conversionError, setConversionError] = useState('')
  const [autoConvertEnabled, setAutoConvertEnabled] = useState(true)
  const [copyStates, setCopyStates] = useState<{ [key: string]: boolean }>({})
  const [wordWrapEnabled, setWordWrapEnabled] = useState(false)

  // S11a/R14 options state
  const [s11aXpath, setS11aXpath] = useState(true)
  const [s11aFaker, setS11aFaker] = useState(true)
  const [s11aConvertPipe, setS11aConvertPipe] = useState(true)

  const [isAdvancedPopoverOpen, setIsAdvancedPopoverOpen] = useState(false)
  const [advancedOptions, setAdvancedOptions] = useState({
    active: false,
    cccd: '',
    cicCode: '',
    cicGroup: 'none',
  })
  const [cccdInput, setCccdInput] = useState('')
  const [cicCodeInput, setCicCodeInput] = useState('')

  const isB11TJson = (text?: string) => detectB11TJson(text ?? input)
  const isB11TXml = (text?: string) => detectB11TXml(text ?? input)

  const handleAutoConvert = async (inputText: string) => {
    if (!inputText.trim()) {
      setOutput('')
      setConversionError('')
      return
    }

    if (conversionType === 'S11A_R14') {
      setIsConverting(true)
      setConversionError('')
      try {
        const type = detectType(inputText)
        if (type === 'json') {
          const xml = convertJsonToXml(inputText, {
            useXpath: s11aXpath,
            useFaker: s11aFaker,
            convertPipe: s11aConvertPipe
          })
          setOutput(xml)
        } else if (type === 'xml') {
          const json = convertXmlToJson(inputText)
          setOutput(json)
        } else {
          throw new Error('Dữ liệu đầu vào phải là định dạng XML hoặc JSON hợp lệ.')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Lỗi chuyển đổi S11a/R14'
        setConversionError(errorMessage)
        setOutput('')
      } finally {
        setIsConverting(false)
      }
      return
    }

    let workingText = inputText
    let formatMismatchError = ''
    try {
      if (detectType(inputText) === 'json') {
        const { preprocessed, workingText: preprocessedText } =
          resolveJsonInput(inputText, conversionType)
        workingText = preprocessedText
        const hasCIC = hasCicPasteStructure(preprocessed)
        const hasPCB = hasPcbPasteStructure(preprocessed)
        if (hasCIC && conversionType === 'PCB') {
          formatMismatchError =
            'Input contains CIC structure (PHTimKiemKH, PHVanTinChung, or B11T), but PCB is selected. Please provide PCB format (must contain RI_Req_Output).'
        } else if (hasPCB && conversionType === 'CIC') {
          formatMismatchError =
            'Input contains PCB structure (RI_Req_Output), but CIC is selected. Please provide CIC format (must contain PHTimKiemKH, PHVanTinChung, or B11T).'
        }
      } else {
        const hasCIC =
          inputText.includes('<PHTimKiemKH') ||
          inputText.includes('<PHVanTinChung') ||
          inputText.includes('<PHHoiTinB11T')
        const hasPCB = inputText.includes('<RI_Req_Output')
        if (hasCIC && conversionType === 'PCB') {
          formatMismatchError =
            'Input contains CIC structure (PHTimKiemKH, PHVanTinChung, or B11T), but PCB is selected. Please provide PCB format (must contain RI_Req_Output).'
        } else if (hasPCB && conversionType === 'CIC') {
          formatMismatchError =
            'Input contains PCB structure (RI_Req_Output), but CIC is selected. Please provide CIC format (must contain PHTimKiemKH, PHVanTinChung, or B11T).'
        }
      }
    } catch (e) {
      const hasCIC =
        inputText.includes('<PHTimKiemKH') ||
        inputText.includes('<PHVanTinChung') ||
        inputText.includes('<PHHoiTinB11T')
      const hasPCB = inputText.includes('<RI_Req_Output')
      if (hasCIC && conversionType === 'PCB') {
        formatMismatchError =
          'Input contains CIC structure (PHTimKiemKH, PHVanTinChung, or B11T), but PCB is selected. Please provide PCB format (must contain RI_Req_Output).'
      } else if (hasPCB && conversionType === 'CIC') {
        formatMismatchError =
          'Input contains PCB structure (RI_Req_Output), but CIC is selected. Please provide CIC format (must contain PHTimKiemKH, PHVanTinChung, or B11T).'
      }
    }

    if (formatMismatchError) {
      setOutput('')
      setConversionError(formatMismatchError)
      return
    }

    setIsConverting(true)
    setConversionError('')

    try {
      const type = detectType(workingText)

      if (
        isB11TJson(workingText) &&
        conversionType === 'CIC' &&
        type === 'json'
      ) {
        const jsonObj = JSON.parse(workingText)
        if (jsonObj.Data) {
          jsonObj.Data.MASOPHIEU =
            '${BODY_XPATH(expression="//*[local-name()=\'MaSoPhieu\']/text()")}'
          jsonObj.Data.CCCD =
            '${BODY_XPATH(expression="//*[local-name()=\'CCCD\']/text()")}'
          jsonObj.Data.TENKH =
            '${BODY_XPATH(expression="//*[local-name()=\'TenKH\']/text()")}'
          jsonObj.Data.TL099 = ''

          if (jsonObj.Data.BC100) {
            jsonObj.Data.BC100.TTC04 =
              '${BODY_XPATH(expression="//*[local-name()=\'TenKH\']/text()")}'
            jsonObj.Data.BC100.CN008 =
              '${BODY_XPATH(expression="//*[local-name()=\'CCCD\']/text()")}'
          }

          if (
            advancedOptions.active &&
            advancedOptions.cicGroup &&
            advancedOptions.cicGroup !== 'none'
          ) {
            const selectedGroup = advancedOptions.cicGroup
            const groupInfo = B11T_GROUP_DATA[selectedGroup]

            if (groupInfo) {
              jsonObj.Data.TL100 = `GROUP ${selectedGroup}`
              if (selectedGroup === 'no_cic') {
                jsonObj.Data.TL099 = groupInfo.TL099
                jsonObj.Data.BC200 = B11T_GROUP_DATA['0'].BC200
              } else {
                jsonObj.Data.BC200 = groupInfo.BC200
                jsonObj.Data.TL099 = ''
              }
            }
          }
        }

        const doc = document.implementation.createDocument('', '', null)
        const envelope = doc.createElement('env:Envelope')
        envelope.setAttribute(
          'xmlns:env',
          'http://schemas.xmlsoap.org/soap/envelope/',
        )
        const header = doc.createElement('env:Header')
        envelope.appendChild(header)
        const body = doc.createElement('env:Body')
        const b11t = doc.createElement('ns2:PHHoiTinB11T')
        b11t.setAttribute(
          'xmlns:ns2',
          'http://www.endpoint.ws.h2h.cic.org.vn/cicqr',
        )

        Object.keys(jsonObj).forEach((key) => {
          if (key === 'Ma' || key === 'MoTa') return
          if (key === 'Data') {
            const dataEl = doc.createElement('ns2:Data')
            dataEl.textContent = JSON.stringify(jsonObj.Data, null, 2)
            b11t.appendChild(dataEl)
          } else {
            const el = doc.createElement(`ns2:${key}`)
            el.textContent =
              typeof jsonObj[key] === 'object'
                ? JSON.stringify(jsonObj[key], null, 2)
                : String(jsonObj[key])
            b11t.appendChild(el)
          }
        })

        body.appendChild(b11t)
        envelope.appendChild(body)
        doc.appendChild(envelope)
        const serializer = new XMLSerializer()
        setOutput(formatXml(serializer.serializeToString(doc)))
        setIsConverting(false)
        return
      }

      if (isB11TXml(inputText) && conversionType === 'CIC' && type === 'xml') {
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(inputText, 'application/xml')
        const b11t =
          xmlDoc.getElementsByTagName('PHHoiTinB11T')[0] ||
          xmlDoc.getElementsByTagName('ns2:PHHoiTinB11T')[0]
        if (!b11t) throw new Error('No PHHoiTinB11T tag found')
        const jsonResult = xmlElementToJson(b11t, true)
        const result = {
          TrangThai: jsonResult.TrangThai ?? '',
          Ma: jsonResult.Ma ?? '',
          MoTa: jsonResult.MoTa ?? '',
          Data: jsonResult.Data ?? {},
        }
        setOutput(JSON.stringify(result, null, 2))
        setIsConverting(false)
        return
      }

      let processedInputText = workingText
      if (
        type === 'json' &&
        conversionType === 'CIC' &&
        advancedOptions.active &&
        advancedOptions.cccd
      ) {
        try {
          const jsonObj = JSON.parse(workingText)
          let dongArr =
            jsonObj?.Envelope?.Body?.PHTimKiemKH?.TimKiemKHKQ?.Data?.KHACHHANG
              ?.DONG
          if (Array.isArray(dongArr) && dongArr.length > 0) {
            dongArr[0]['SOCMT'] =
              `\${BODY_XPATH(expression="//*[local-name()='${advancedOptions.cccd}']/text()")}`
            processedInputText = JSON.stringify(jsonObj, null, 2)
          }
        } catch (e) {
          // ignore
        }
      }

      if (type === 'xml') {
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(workingText, 'text/xml')

        const parserError = xmlDoc.querySelector('parsererror')
        if (parserError) {
          throw new Error('Invalid XML format')
        }

        if (conversionType === 'PCB') {
          const bodyElement =
            xmlDoc.querySelector('Body') || xmlDoc.querySelector('soap\\:Body')
          if (!bodyElement) throw new Error('No soap:Body found in PCB XML')

          const mgResponseElement = bodyElement.querySelector('MGResponse')
          if (!mgResponseElement)
            throw new Error('No MGResponse found in soap:Body')

          const jsonResult = xmlElementToJson(mgResponseElement, false)
          setOutput(JSON.stringify(jsonResult, null, 2))
        } else {
          const rootElement = xmlDoc.documentElement
          const rootName = removePrefix(rootElement.tagName)
          const jsonResult = {
            [rootName]: xmlElementToJson(rootElement, false),
          }
          setOutput(JSON.stringify(jsonResult, null, 2))
        }
      } else if (type === 'json') {
        let jsonObj = JSON.parse(processedInputText)

        if (conversionType === 'PCB') {
          const doc = document.implementation.createDocument('', '', null)
          const envelope = doc.createElement('soap:Envelope')
          envelope.setAttribute('xmlns:soap', PCB_NAMESPACE_MAP.soap)
          envelope.setAttribute(
            'xmlns:xsi',
            'http://www.w3.org/2001/XMLSchema-instance',
          )
          envelope.setAttribute('xmlns:xsd', 'http://www.w3.org/2001/XMLSchema')

          let header = doc.createElement('soap:Header')
          const messageResponse = doc.createElement('MessageResponse')
          messageResponse.setAttribute('xmlns', PCB_NAMESPACE_MAP.xmlns)
          messageResponse.setAttribute(
            'GId',
            'a432fac4-7192-4fe7-947e-a6813fbb7a66',
          )
          messageResponse.setAttribute(
            'MId',
            'a432fac4-7192-4fe7-947e-a6813fbb7a66',
          )
          messageResponse.setAttribute('MTs', new Date().toISOString())
          messageResponse.setAttribute('METs', new Date().toISOString())

          const pNode = doc.createElement('P')
          pNode.setAttribute('SId', 'CB')
          pNode.setAttribute('PId', 'RI_REQ')
          pNode.setAttribute('PNs', 'urn:uae-message:2014-06-01')
          const rNodeP = doc.createElement('R')
          rNodeP.setAttribute('L', 'en-US')
          rNodeP.setAttribute('C', 'S')
          rNodeP.setAttribute('D', 'Success.')
          pNode.appendChild(rNodeP)
          messageResponse.appendChild(pNode)

          const txNode = doc.createElement('Tx')
          txNode.setAttribute('TxNs', 'urn:crif-messagegateway:2006-08-23')
          const rNodeTx = doc.createElement('R')
          rNodeTx.setAttribute('L', 'en-US')
          rNodeTx.setAttribute('C', 'S')
          rNodeTx.setAttribute('D', 'Success.')
          txNode.appendChild(rNodeTx)
          messageResponse.appendChild(txNode)

          header.appendChild(messageResponse)
          envelope.appendChild(header)

          let body = doc.createElement('soap:Body')
          const mgOuter = doc.createElement('MGResponse')
          mgOuter.setAttribute('xmlns', PCB_NAMESPACE_MAP.gateway)
          const mgInner = doc.createElement('MGResponse')
          mgInner.setAttribute('xmlns', PCB_NAMESPACE_MAP.gateway)

          let riReqOutputObj = null
          if (jsonObj.RI_Req_Output) {
            riReqOutputObj = jsonObj.RI_Req_Output
          } else if (jsonObj.MGResponse && jsonObj.MGResponse.RI_Req_Output) {
            riReqOutputObj = jsonObj.MGResponse.RI_Req_Output
          } else if (jsonObj.Body && jsonObj.Body.RI_Req_Output) {
            riReqOutputObj = jsonObj.Body.RI_Req_Output
          } else {
            throw new Error(
              'JSON must contain RI_Req_Output object for PCB conversion',
            )
          }

          const riReqOutput = jsonToXmlElement(
            riReqOutputObj,
            'RI_Req_Output',
            doc,
            conversionType,
          )
          riReqOutput.setAttribute('xmlns', '')
          mgInner.appendChild(riReqOutput)

          let innerXml = ''
          for (let i = 0; i < mgInner.childNodes.length; i++) {
            innerXml += new XMLSerializer().serializeToString(
              mgInner.childNodes[i],
            )
          }
          innerXml = innerXml.replace(/</g, '&lt;').replace(/>/g, '&gt;')
          while (mgInner.firstChild) mgInner.removeChild(mgInner.firstChild)
          mgInner.appendChild(doc.createTextNode(innerXml))

          let mgInnerXml = new XMLSerializer().serializeToString(mgInner)
          mgInnerXml = mgInnerXml.replace(/</g, '&lt;').replace(/>/g, '&gt;')
          while (mgOuter.firstChild) mgOuter.removeChild(mgOuter.firstChild)
          mgOuter.appendChild(doc.createTextNode(mgInnerXml))

          body.appendChild(mgOuter)
          envelope.appendChild(body)
          doc.appendChild(envelope)

          const serializer = new XMLSerializer()
          const pcbXmlResult = formatXml(
            serializer.serializeToString(doc),
          ).replace(/&amp;/g, '&')
          setOutput(pcbXmlResult)
          return
        } else {
          jsonObj = normalizeCICKeysDeep(jsonObj)
          const doc = document.implementation.createDocument('', '', null)

          const rootKey = Object.keys(jsonObj)[0]
          const rootElement = jsonToXmlElement(
            jsonObj[rootKey],
            rootKey,
            doc,
            conversionType,
            [],
          )

          if (rootKey === 'Envelope') {
            rootElement.setAttribute('xmlns:env', NAMESPACE_MAP.env)
            const phtimKiemKHElement =
              rootElement.querySelector('ns2\\:PHTimKiemKH') ||
              rootElement.querySelector('PHTimKiemKH')
            if (phtimKiemKHElement)
              phtimKiemKHElement.setAttribute('xmlns:ns2', NAMESPACE_MAP.ns2)

            const phVanTinChungElement =
              rootElement.querySelector('ns2\\:PHVanTinChung') ||
              rootElement.querySelector('PHVanTinChung')
            if (phVanTinChungElement)
              phVanTinChungElement.setAttribute('xmlns:ns2', NAMESPACE_MAP.ns2)
          }

          doc.appendChild(rootElement)

          const serializer = new XMLSerializer()
          let xmlString = serializer.serializeToString(doc)
          xmlString = xmlString.replace(/></g, '>\n<')
          const formatted = formatXml(xmlString)

          setOutput(formatted)
        }
      } else {
        setOutput('')
        setConversionError('Input must be valid XML or JSON.')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Conversion error'
      setConversionError(errorMessage)
      setOutput('')
    } finally {
      setIsConverting(false)
    }
  }

  useEffect(() => {
    if (!autoConvertEnabled) return
    const timeoutId = setTimeout(() => {
      handleAutoConvert(input)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [input, autoConvertEnabled, s11aXpath, s11aFaker, s11aConvertPipe])

  useEffect(() => {
    if (!autoConvertEnabled || !input.trim()) return
    handleAutoConvert(input)
  }, [conversionType, s11aXpath, s11aFaker, s11aConvertPipe])

  useEffect(() => {
    if (
      detectType(input) === 'json' &&
      conversionType === 'CIC' &&
      advancedOptions.active
    ) {
      try {
        const jsonObj = JSON.parse(input)
        const normalizedObj = normalizeCICKeysDeep(jsonObj)

        if (normalizedObj?.Envelope?.Body?.PHTimKiemKH) {
          if (advancedOptions.cicCode || advancedOptions.cicGroup !== 'none') {
            setAdvancedOptions((prev) => ({
              ...prev,
              cicCode: '',
              cicGroup: 'none',
            }))
            return
          }
          const envelopeKey = Object.keys(jsonObj).find(
            (key) => normalizeCICKey(key) === 'Envelope',
          )
          const bodyKey = envelopeKey
            ? Object.keys(jsonObj[envelopeKey]).find(
                (key) => normalizeCICKey(key) === 'Body',
              )
            : null
          if (envelopeKey && bodyKey) {
            const phtimKiemKHKey = Object.keys(
              jsonObj[envelopeKey][bodyKey],
            ).find((key) => key === 'PHTimKiemKH')
            if (phtimKiemKHKey) {
              let dongArr =
                jsonObj[envelopeKey][bodyKey][phtimKiemKHKey]?.TimKiemKHKQ?.Data
                  ?.KHACHHANG?.DONG
              if (
                Array.isArray(dongArr) &&
                dongArr.length > 0 &&
                advancedOptions.cccd
              ) {
                const newSocmt = `\${BODY_XPATH(expression="//*[local-name()='${advancedOptions.cccd}']/text()")}`
                if (dongArr[0]['SOCMT'] !== newSocmt) {
                  dongArr[0]['SOCMT'] = newSocmt
                  setInput(JSON.stringify(jsonObj, null, 2))
                }
              }
            }
          }
        } else if (normalizedObj?.Envelope?.Body?.PHVanTinChung?.Data?.S37) {
          if (advancedOptions.cccd) {
            setAdvancedOptions((prev) => ({ ...prev, cccd: '' }))
            return
          }
          const envelopeKey = Object.keys(jsonObj).find(
            (key) => normalizeCICKey(key) === 'Envelope',
          )
          const bodyKey = envelopeKey
            ? Object.keys(jsonObj[envelopeKey]).find(
                (key) => normalizeCICKey(key) === 'Body',
              )
            : null
          if (envelopeKey && bodyKey) {
            const phVanTinChungKey = Object.keys(
              jsonObj[envelopeKey][bodyKey],
            ).find((key) => key === 'PHVanTinChung')
            if (phVanTinChungKey) {
              let s37 =
                jsonObj[envelopeKey][bodyKey][phVanTinChungKey]?.Data?.S37
              let changed = false
              if (
                advancedOptions.cicCode &&
                s37.MACIC !== advancedOptions.cicCode
              ) {
                s37.MACIC = advancedOptions.cicCode
                changed = true
              }
              if (
                advancedOptions.cicGroup &&
                advancedOptions.cicGroup !== 'none'
              ) {
                const groupObj = S37_GROUPS.find(
                  (g) => g.group === advancedOptions.cicGroup,
                )
                if (
                  groupObj &&
                  groupObj.pattern &&
                  s37.NOIDUNG !== groupObj.pattern
                ) {
                  s37.NOIDUNG = groupObj.pattern
                  changed = true
                }
              }
              if (changed) setInput(JSON.stringify(jsonObj, null, 2))
            }
          }
        } else if (
          detectB11TJson(
            JSON.stringify(
              preprocessConverterJsonInput(JSON.parse(input), 'CIC'),
            ),
          )
        ) {
          if (advancedOptions.cicCode) {
            setAdvancedOptions((prev) => ({ ...prev, cicCode: '' }))
            return
          }
          const b11tObj = preprocessConverterJsonInput(
            JSON.parse(input),
            'CIC',
          ) as Record<string, unknown>
          if (advancedOptions.cicGroup && advancedOptions.cicGroup !== 'none') {
            const selectedGroup = advancedOptions.cicGroup
            const groupInfo = B11T_GROUP_DATA[selectedGroup]
            const data = b11tObj.Data as Record<string, unknown> | undefined
            if (groupInfo && data) {
              let changed = false
              if (data.TL100 !== `GROUP ${selectedGroup}`) {
                data.TL100 = `GROUP ${selectedGroup}`
                changed = true
              }
              if (selectedGroup === 'no_cic') {
                if (data.TL099 !== groupInfo.TL099) {
                  data.TL099 = groupInfo.TL099
                  changed = true
                }
                if (
                  JSON.stringify(data.BC200) !==
                  JSON.stringify(B11T_GROUP_DATA['0'].BC200)
                ) {
                  data.BC200 = B11T_GROUP_DATA['0'].BC200
                  changed = true
                }
              } else {
                if (
                  JSON.stringify(data.BC200) !== JSON.stringify(groupInfo.BC200)
                ) {
                  data.BC200 = groupInfo.BC200
                  changed = true
                }
                if (data.TL099 !== '') {
                  data.TL099 = ''
                  changed = true
                }
              }
              if (changed) setInput(JSON.stringify(b11tObj, null, 2))
            }
          }
        }
      } catch (e) {}
    } else if (
      detectType(input) === 'json' &&
      conversionType === 'PCB' &&
      advancedOptions.active &&
      advancedOptions.cccd
    ) {
      try {
        const { preprocessed } = resolveJsonInput(input, conversionType)
        const jsonObj = preprocessed as Record<string, unknown>
        let riReqOutput = null
        if (jsonObj.RI_Req_Output) {
          riReqOutput = jsonObj.RI_Req_Output
        } else if (
          jsonObj.MGResponse &&
          typeof jsonObj.MGResponse === 'object' &&
          jsonObj.MGResponse !== null &&
          (jsonObj.MGResponse as Record<string, unknown>).RI_Req_Output
        ) {
          riReqOutput = (jsonObj.MGResponse as Record<string, unknown>)
            .RI_Req_Output
        } else if (
          jsonObj.Body &&
          typeof jsonObj.Body === 'object' &&
          jsonObj.Body !== null &&
          (jsonObj.Body as Record<string, unknown>).RI_Req_Output
        ) {
          riReqOutput = (jsonObj.Body as Record<string, unknown>).RI_Req_Output
        }
        if (
          riReqOutput &&
          typeof riReqOutput === 'object' &&
          riReqOutput !== null
        ) {
          const subject = (riReqOutput as Record<string, unknown>).Subject as
            | Record<string, unknown>
            | undefined
          const inquired = subject?.Inquired as
            | Record<string, unknown>
            | undefined
          const person = inquired?.Person as Record<string, unknown> | undefined
          if (person && person.IDCard !== advancedOptions.cccd) {
            person.IDCard = advancedOptions.cccd
            setInput(JSON.stringify(jsonObj, null, 2))
          }
        }
      } catch (e) {}
    }
  }, [
    advancedOptions.active,
    advancedOptions.cccd,
    advancedOptions.cicCode,
    advancedOptions.cicGroup,
  ])

  useEffect(() => {
    if (
      detectType(input) === 'json' &&
      conversionType === 'CIC' &&
      advancedOptions.active
    ) {
      try {
        const jsonObj = JSON.parse(input)
        const normalizedObj = normalizeCICKeysDeep(jsonObj)
        if (normalizedObj?.Envelope?.Body?.PHTimKiemKH) {
          if (advancedOptions.cicCode || advancedOptions.cicGroup !== 'none') {
            setAdvancedOptions((prev) => ({
              ...prev,
              cicCode: '',
              cicGroup: 'none',
            }))
          }
        } else if (normalizedObj?.Envelope?.Body?.PHVanTinChung?.Data?.S37) {
          if (advancedOptions.cccd) {
            setAdvancedOptions((prev) => ({ ...prev, cccd: '' }))
          }
        } else if (
          detectB11TJson(
            JSON.stringify(
              preprocessConverterJsonInput(JSON.parse(input), 'CIC'),
            ),
          )
        ) {
          if (advancedOptions.cicCode) {
            setAdvancedOptions((prev) => ({ ...prev, cicCode: '' }))
          }
        }
      } catch (e) {}
    } else if (
      detectType(input) === 'json' &&
      conversionType === 'PCB' &&
      advancedOptions.active
    ) {
      try {
        const { preprocessed } = resolveJsonInput(input, conversionType)
        const hasPCB = hasPcbPasteStructure(preprocessed)
        if (!hasPCB && advancedOptions.cccd) {
          setAdvancedOptions((prev) => ({ ...prev, cccd: '' }))
        }
      } catch (e) {}
    }
  }, [input, conversionType, advancedOptions.active])

  useEffect(() => {
    if (!advancedOptions.active) {
      setAdvancedOptions({
        active: false,
        cccd: '',
        cicCode: '',
        cicGroup: 'none',
      })
    }
  }, [advancedOptions.active])

  useEffect(() => {
    setAdvancedOptions({
      active: false,
      cccd: '',
      cicCode: '',
      cicGroup: 'none',
    })
  }, [conversionType])

  useEffect(() => {
    setCccdInput(advancedOptions.cccd)
    setCicCodeInput(advancedOptions.cicCode)
  }, [advancedOptions.active, conversionType])

  useEffect(() => {
    if (!advancedOptions.active) return
    const timeout = setTimeout(() => {
      if (cccdInput !== advancedOptions.cccd) {
        setAdvancedOptions((prev) => ({ ...prev, cccd: cccdInput }))
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [cccdInput, advancedOptions.active])

  useEffect(() => {
    if (!advancedOptions.active) return
    const timeout = setTimeout(() => {
      if (cicCodeInput !== advancedOptions.cicCode) {
        setAdvancedOptions((prev) => ({ ...prev, cicCode: cicCodeInput }))
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [cicCodeInput, advancedOptions.active])

  const handleFileUpload = (file: File, setter: (value: string) => void) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setter(content)
      toast({ title: 'Success', description: `Loaded file ${file.name}` })
    }
    reader.readAsText(file)
  }

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'Success', description: `Downloaded ${filename}` })
  }

  const copyToClipboard = async (text: string, buttonId = 'default') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStates((prev) => ({ ...prev, [buttonId]: true }))
      setTimeout(
        () => setCopyStates((prev) => ({ ...prev, [buttonId]: false })),
        2000,
      )
      toast({ title: 'Copied', description: 'Content copied to clipboard' })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  let inquiryLabel = ''
  if (detectType(input) === 'json' && conversionType === 'CIC') {
    try {
      const { preprocessed } = resolveJsonInput(input, conversionType)
      const normalizedObj = normalizeCICKeysDeep(preprocessed)
      if (normalizedObj?.Envelope?.Body?.PHTimKiemKH) {
        inquiryLabel = 'Customer Inquiry'
      } else if (normalizedObj?.Envelope?.Body?.PHVanTinChung?.Data?.S37) {
        inquiryLabel = 'S37 Inquiry'
      } else if (detectB11TJson(JSON.stringify(preprocessed))) {
        inquiryLabel = 'B11T Inquiry'
      }
    } catch {}
  }

  const isPCBJson = () => {
    if (conversionType !== 'PCB' || detectType(input) !== 'json') return false
    try {
      const { preprocessed } = resolveJsonInput(input, conversionType)
      return hasPcbPasteStructure(preprocessed)
    } catch {
      return false
    }
  }

  let outputXPath = ''
  if (advancedOptions.active) {
    if (conversionType === 'CIC') {
      if (inquiryLabel === 'Customer Inquiry' && advancedOptions.cccd) {
        outputXPath = `//*[local-name()='SoCMT' and text()='${advancedOptions.cccd}']`
      } else if (inquiryLabel === 'S37 Inquiry' && advancedOptions.cicCode) {
        outputXPath = `//*[local-name()='MaCIC' and text()='${advancedOptions.cicCode}']`
      } else if (inquiryLabel === 'B11T Inquiry' && advancedOptions.cccd) {
        outputXPath = `//*[local-name()='CCCD' and text()='${advancedOptions.cccd}']`
      }
    } else if (
      conversionType === 'PCB' &&
      isPCBJson() &&
      advancedOptions.cccd
    ) {
      outputXPath = `//*[local-name()='IDCard' and text()='${advancedOptions.cccd}']`
    }
  }

  let conversionTypeError = false
  if (input.trim()) {
    let hasCIC = false
    let hasPCB = false
    try {
      if (detectType(input) === 'json') {
        const { preprocessed } = resolveJsonInput(input, conversionType)
        hasCIC = hasCicPasteStructure(preprocessed)
        hasPCB = hasPcbPasteStructure(preprocessed)
      } else {
        hasCIC =
          input.includes('<PHTimKiemKH') ||
          input.includes('<PHVanTinChung') ||
          input.includes('<PHHoiTinB11T')
        hasPCB = input.includes('<RI_Req_Output')
      }
    } catch (e) {
      hasCIC =
        input.includes('<PHTimKiemKH') ||
        input.includes('<PHVanTinChung') ||
        input.includes('<PHHoiTinB11T')
      hasPCB = input.includes('<RI_Req_Output')
    }
    if (
      (hasCIC && conversionType === 'PCB') ||
      (hasPCB && conversionType === 'CIC')
    ) {
      conversionTypeError = true
    }
  }

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
          Convert Data
        </h2>
        <p className='text-muted-foreground dark:text-gray-400'>
          Transform seamlessly between XML and JSON payloads
        </p>
      </div>

      <Card className='dark:bg-gray-800 dark:border-gray-700 shadow-lg border-gray-200'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <Popover
                open={isAdvancedPopoverOpen}
                onOpenChange={setIsAdvancedPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    className='dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300'
                    disabled={
                      (conversionType !== 'CIC' || !inquiryLabel) &&
                      !isPCBJson()
                    }
                  >
                    Advanced Options
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className='w-96 dark:bg-gray-800 dark:border-gray-700'
                  side='bottom'
                  align='start'
                >
                  <div className='grid gap-4'>
                    <div className='space-y-2'>
                      <p className='text-sm text-muted-foreground'>
                        Configure advanced conversion settings.
                      </p>
                    </div>
                    <div className='grid gap-2'>
                      <div className='grid grid-cols-3 items-center gap-4'>
                        <Label
                          htmlFor='advanced-active'
                          className='dark:text-gray-300'
                        >
                          Active
                        </Label>
                        <Switch
                          id='advanced-active'
                          checked={advancedOptions.active}
                          onCheckedChange={(checked) =>
                            setAdvancedOptions((prev) => ({
                              ...prev,
                              active: checked,
                            }))
                          }
                          className='col-span-2'
                        />
                      </div>
                      <div className='grid grid-cols-3 items-center gap-4'>
                        <Label
                          htmlFor='advanced-cccd'
                          className='dark:text-gray-300'
                        >
                          Citizen ID
                        </Label>
                        <Input
                          id='advanced-cccd'
                          value={cccdInput}
                          onChange={(e) => setCccdInput(e.target.value)}
                          className='col-span-2 h-8 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'
                          disabled={
                            !advancedOptions.active ||
                            (conversionType === 'CIC' &&
                              inquiryLabel === 'S37 Inquiry')
                          }
                          placeholder='Enter Citizen ID'
                        />
                      </div>
                      {conversionType === 'CIC' && (
                        <>
                          <div className='grid grid-cols-3 items-center gap-4'>
                            <Label
                              htmlFor='advanced-cic-code'
                              className='dark:text-gray-300'
                            >
                              CIC Code
                            </Label>
                            <Input
                              id='advanced-cic-code'
                              value={cicCodeInput}
                              onChange={(e) => setCicCodeInput(e.target.value)}
                              className='col-span-2 h-8 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'
                              disabled={
                                !advancedOptions.active ||
                                inquiryLabel === 'Customer Inquiry' ||
                                inquiryLabel === 'B11T Inquiry'
                              }
                              placeholder='Enter CIC Code'
                            />
                          </div>
                          <div className='grid grid-cols-3 items-center gap-4'>
                            <Label
                              htmlFor='advanced-cic-group'
                              className='dark:text-gray-300'
                            >
                              CIC Group
                            </Label>
                            <Select
                              value={advancedOptions.cicGroup}
                              onValueChange={(value) =>
                                setAdvancedOptions((prev) => ({
                                  ...prev,
                                  cicGroup: value,
                                }))
                              }
                              disabled={
                                !advancedOptions.active ||
                                inquiryLabel === 'Customer Inquiry'
                              }
                            >
                              <SelectTrigger className='col-span-2 h-8 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className='dark:bg-gray-700 dark:border-gray-600'>
                                {(() => {
                                  if (inquiryLabel === 'B11T Inquiry') {
                                    return B11T_GROUPS.map((g) => (
                                      <SelectItem
                                        key={g.group}
                                        value={g.group}
                                        className='dark:text-gray-200 dark:hover:bg-gray-600'
                                      >
                                        {g.group === 'none'
                                          ? 'None'
                                          : g.group === 'no_cic'
                                            ? 'No CIC'
                                            : `Group ${g.group}`}
                                      </SelectItem>
                                    ))
                                  } else {
                                    return S37_GROUPS.map((g) => (
                                      <SelectItem
                                        key={g.group}
                                        value={g.group}
                                        className='dark:text-gray-200 dark:hover:bg-gray-600'
                                      >
                                        {g.group === 'none'
                                          ? 'None'
                                          : `Group ${g.group}`}
                                      </SelectItem>
                                    ))
                                  }
                                })()}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                    {outputXPath && (
                      <div className='flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700'>
                        <span className='text-xs font-semibold text-gray-700 dark:text-gray-300'>
                          XPath:
                        </span>
                        <span className='text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-gray-200 font-mono border shadow-sm truncate max-w-[200px]'>
                          {outputXPath}
                        </span>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='h-7 w-7'
                          onClick={() => copyToClipboard(outputXPath, 'xpath')}
                        >
                          {copyStates['xpath'] ? (
                            <Check className='h-4 w-4 text-green-600' />
                          ) : (
                            <Copy className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className='flex items-center gap-4'>
              <Select
                value={conversionType}
                onValueChange={(value: 'CIC' | 'PCB' | 'S11A_R14') =>
                  setConversionType(value)
                }
              >
                <SelectTrigger
                  className={`w-32 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 ${conversionTypeError ? 'border-red-500 ring-2 ring-red-400' : ''}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='dark:bg-gray-700 dark:border-gray-600'>
                  <SelectItem
                    value='CIC'
                    className='dark:text-gray-200 dark:hover:bg-gray-600'
                  >
                    CIC
                  </SelectItem>
                  <SelectItem
                    value='PCB'
                    className='dark:text-gray-200 dark:hover:bg-gray-600'
                  >
                    PCB
                  </SelectItem>
                  <SelectItem
                    value='S11A_R14'
                    className='dark:text-gray-200 dark:hover:bg-gray-600'
                  >
                    S11a/R14
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className='flex items-center space-x-2'>
                <Switch
                  id='auto-convert'
                  checked={autoConvertEnabled}
                  onCheckedChange={setAutoConvertEnabled}
                />
                <label
                  htmlFor='auto-convert'
                  className='text-sm font-medium dark:text-gray-300'
                >
                  Auto Convert
                </label>
              </div>
              <Button
                onClick={() => {
                  clearInput()
                  setOutput('')
                  setConversionError('')
                }}
                variant='outline'
                size='sm'
                className='dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300'
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className='dark:text-gray-200'>
          {conversionType === 'S11A_R14' && (
            <div className="flex flex-wrap gap-6 pb-4 mb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <Switch
                  id="s11a-xpath"
                  checked={s11aXpath}
                  onCheckedChange={setS11aXpath}
                />
                <label
                  htmlFor="s11a-xpath"
                  className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Dùng {"${BODY_XPATH}"} cho MaSoPhieu
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="s11a-faker"
                  checked={s11aFaker}
                  onCheckedChange={setS11aFaker}
                />
                <label
                  htmlFor="s11a-faker"
                  className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Dùng {"${FAKER}"} cho NgayHoi/NgayNhanGanNhat
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="s11a-br"
                  checked={s11aConvertPipe}
                  onCheckedChange={setS11aConvertPipe}
                />
                <label
                  htmlFor="s11a-br"
                  className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  {"Convert \"|\" → <br/> (trong NHOM2)"}
                </label>
              </div>
            </div>
          )}
          <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
            <div className='lg:col-span-5 space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center w-full gap-2'>
                  <h3 className='text-lg font-semibold dark:text-gray-200'>
                    Input
                  </h3>
                  <span className='text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-300'>
                    {input.trim() ? detectType(input).toUpperCase() : 'TEXT'}
                  </span>
                  {inquiryLabel && (
                    <span className='text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-300 ml-2'>
                      {inquiryLabel}
                    </span>
                  )}
                </div>
                 <div className='flex gap-2'>
                  {conversionType === 'S11A_R14' && (
                    <Button
                      onClick={() => {
                        const sampleText = JSON.stringify(SAMPLE_JSON_S11A_R14, null, 2)
                        setInput(sampleText)
                        toast({ title: 'Đã tải mẫu', description: 'Định dạng JSON mẫu S11a/R14.' })
                      }}
                      variant='outline'
                      size='sm'
                      className='dark:border-gray-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                    >
                      Sample
                    </Button>
                  )}
                  <Button
                    onClick={() => inputFileRef.current?.click()}
                    variant='outline'
                    size='sm'
                    className='dark:border-gray-600'
                  >
                    <Upload className='h-4 w-4 mr-2' /> Upload
                  </Button>
                  <Button
                    onClick={() => {
                      const type = detectType(input)
                      if (type === 'json') setInput(formatJson(input))
                      else if (type === 'xml') setInput(formatXml(input))
                    }}
                    variant='outline'
                    size='sm'
                    className='dark:border-gray-600'
                    disabled={
                      !input.trim() ||
                      !['json', 'xml'].includes(detectType(input))
                    }
                  >
                    <RefreshCw className='h-4 w-4 mr-2' /> Format
                  </Button>
                  <Button
                    onClick={() => setInput(sortJsonText(input, 'asc'))}
                    variant='outline'
                    size='sm'
                    className='dark:border-gray-600'
                    disabled={!input.trim() || detectType(input) !== 'json'}
                    title='Sort JSON keys (0-9, A-Z)'
                  >
                    <ArrowDownAZ className='h-4 w-4 mr-2' /> 0-Z
                  </Button>
                  <Button
                    onClick={() => setInput(sortJsonText(input, 'desc'))}
                    variant='outline'
                    size='sm'
                    className='dark:border-gray-600'
                    disabled={!input.trim() || detectType(input) !== 'json'}
                    title='Sort JSON keys (Z-A, 9-0)'
                  >
                    <ArrowUpAZ className='h-4 w-4 mr-2' /> Z-0
                  </Button>
                  <input
                    ref={inputFileRef}
                    type='file'
                    accept='.txt,.xml,.json'
                    className='hidden'
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, setInput)
                    }}
                  />
                </div>
              </div>
              <TextareaWithLineNumbers
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Enter input here...'
                className='min-h-[500px] text-sm'
                wordWrap={wordWrapEnabled}
              />
            </div>

            <div className='lg:col-span-2 flex items-center justify-center'>
              <div className='text-center space-y-4'>
                {!autoConvertEnabled && (
                  <Button
                    onClick={() => handleAutoConvert(input)}
                    disabled={isConverting || !input.trim()}
                    className='mb-4'
                  >
                    {isConverting ? (
                      <>
                        <RefreshCw className='h-4 w-4 animate-spin mr-2' />{' '}
                        Converting...
                      </>
                    ) : (
                      'Convert'
                    )}
                  </Button>
                )}
                {isConverting ? (
                  <div className='flex flex-col items-center gap-2'>
                    <RefreshCw className='h-8 w-8 animate-spin text-blue-500' />
                    <span className='text-sm text-muted-foreground dark:text-gray-400'>
                      Converting...
                    </span>
                  </div>
                ) : conversionError ? (
                  <div className='flex flex-col items-center gap-2'>
                    <div className='h-8 w-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center'>
                      <span className='text-red-500 text-sm'>✗</span>
                    </div>
                    <span className='text-sm text-red-500'>Error</span>
                  </div>
                ) : output ? (
                  <div className='flex flex-col items-center gap-2'>
                    <div className='h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center'>
                      <span className='text-green-500 text-sm'>✓</span>
                    </div>
                    <span className='text-sm text-green-600'>Converted</span>
                  </div>
                ) : (
                  <div className='flex flex-col items-center gap-2'>
                    <div className='h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
                      <span className='text-gray-400 text-sm'>○</span>
                    </div>
                    <span className='text-sm text-muted-foreground dark:text-gray-400'>
                      Ready
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className='lg:col-span-5 space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center w-full'>
                  <h3 className='text-lg font-semibold dark:text-gray-200'>
                    Result
                  </h3>
                  <span className='text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-300 ml-4'>
                    {output.trim()
                      ? detectType(input) === 'xml'
                        ? 'JSON'
                        : detectType(input) === 'json'
                          ? 'XML'
                          : 'TEXT'
                      : 'TEXT'}
                  </span>
                </div>
                <div className='flex gap-2'>
                  <Button
                    onClick={() => copyToClipboard(output, 'output')}
                    variant='outline'
                    size='sm'
                    className='dark:border-gray-600'
                    disabled={!output}
                  >
                    {copyStates['output'] ? (
                      <Check className='h-4 w-4 text-green-600 mr-2' />
                    ) : (
                      <Copy className='h-4 w-4 mr-2' />
                    )}{' '}
                    Copy
                  </Button>
                  <Button
                    onClick={() =>
                      downloadFile(
                        output,
                        `${conversionType.toLowerCase()}_result.${detectType(input) === 'xml' ? 'json' : detectType(input) === 'json' ? 'xml' : 'txt'}`,
                      )
                    }
                    variant='outline'
                    size='sm'
                    className='dark:border-gray-600'
                    disabled={!output}
                  >
                    <Download className='h-4 w-4 mr-2' /> Export
                  </Button>
                </div>
              </div>
              {conversionError ? (
                <div className='min-h-[500px] border rounded-md p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'>
                  <div className='text-red-600 dark:text-red-400 font-medium mb-2'>
                    Conversion Error:
                  </div>
                  <div className='text-red-500 dark:text-red-300 text-sm font-mono'>
                    {conversionError}
                  </div>
                </div>
              ) : (
                <TextareaWithLineNumbers
                  value={output}
                  placeholder='Result will appear here automatically...'
                  className='min-h-[500px] text-sm bg-muted dark:bg-gray-700'
                  readOnly={true}
                  wordWrap={wordWrapEnabled}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
