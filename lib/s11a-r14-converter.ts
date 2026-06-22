/**
 * CIC S11a/R14 JSON <-> SOAP XML Converter
 * 
 * Supports:
 * - Two-way conversion: JSON to XML and XML to JSON
 * - Parsing S11a SOAP wrapper and unescaping inner ns2:Data
 * - Optional xpath, faker, and pipe-to-br filters
 */

export interface ConverterOptions {
  useXpath?: boolean
  useFaker?: boolean
  convertPipe?: boolean
}

// Fields in NHOM2_12THANG where "|" should be replaced by <br/>
const PIPE_FIELDS = ["NGAYSL", "MATCTD", "TENTCTD"]

function escapeXml(str: unknown): string {
  if (str === null || str === undefined) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function isPipeField(fieldName: string): boolean {
  return PIPE_FIELDS.includes(fieldName)
}

function jsonToInnerXml(key: string, value: unknown, convertPipe: boolean): string {
  if (value === null || value === undefined) {
    return `<${key}></${key}>`
  }

  if (Array.isArray(value)) {
    return value.map((item) => jsonToInnerXml(key, item, convertPipe)).join("")
  }

  if (typeof value === "object") {
    const children = Object.entries(value)
      .map(([k, v]) => jsonToInnerXml(k, v, convertPipe))
      .join("")
    return `<${key}>${children}</${key}>`
  }

  let strVal = String(value)
  if (convertPipe && isPipeField(key)) {
    strVal = strVal.replace(/\|/g, "<br/>")
  }

  return `<${key}>${strVal}</${key}>`
}

function buildDataXml(noidungBantltin: unknown, convertPipe: boolean): string {
  const innerXml = jsonToInnerXml("NOIDUNG_BANTLTIN", noidungBantltin, convertPipe)
  return escapeXml(innerXml)
}

function buildTTPhanHoi(tt: any, indent: string): string {
  const fields = [
    ["TrangThai", tt.TrangThai],
    ["Ma", tt.Ma],
    ["MoTa", tt.MoTa],
    ["SLHoi", tt.SLHoi],
    ["SLTraLoi", tt.SLTraLoi],
    ["SLLoi", tt.SLLoi],
    ["CheckSum", tt.CheckSum],
  ]

  return fields
    .map(([name, val]) => {
      const v = val !== null && val !== undefined ? val : ""
      return `${indent}<ns2:${name}>${v}</ns2:${name}>`
    })
    .join("\n")
}

export function convertJsonToXml(jsonStr: string, options: ConverterOptions = {}): string {
  const { useXpath = true, useFaker = true, convertPipe = true } = options

  const data = JSON.parse(jsonStr)
  const envelope = data.envelope || data.Envelope
  if (!envelope) throw new Error('Không tìm thấy key "envelope" hoặc "Envelope" trong JSON')

  const body = envelope.body || envelope.Body
  if (!body) throw new Error('Không tìm thấy key "body" hoặc "Body"')

  const ph = body.PHVanTinDSPhieu
  if (!ph) throw new Error('Không tìm thấy key "PHVanTinDSPhieu"')

  const tt = ph.TTPhanHoi
  if (!tt) throw new Error('Không tìm thấy key "TTPhanHoi"')

  const dskq = ph.DSKhachHangKQ
  if (!dskq) throw new Error('Không tìm thấy key "DSKhachHangKQ"')

  const dongKQ = dskq.DongKQ
  if (!dongKQ) throw new Error('Không tìm thấy key "DongKQ"')

  const dataContent = dongKQ.Data
  if (!dataContent) throw new Error('Không tìm thấy key "Data" trong DongKQ')

  const noidungBantltin = dataContent.NOIDUNG_BANTLTIN
  if (!noidungBantltin) throw new Error('Không tìm thấy key "NOIDUNG_BANTLTIN" trong Data')

  const dataXmlEscaped = buildDataXml(noidungBantltin, convertPipe)

  const maSoPhieu = useXpath
    ? '${BODY_XPATH(expression="//*[local-name()=\'MaSoPhieu\']/text()")}'
    : dongKQ.MaSoPhieu || ""

  const fakerExpr =
    "${FAKER(api=\"new java.text.SimpleDateFormat('yyyyMMdd HH:mm:ss').format(new java.util.Date())\")}"
  const ngayHoi = useFaker ? fakerExpr : dongKQ.NgayHoi || ""
  const ngayNhanGanNhat = useFaker ? fakerExpr : dongKQ.NgayNhanGanNhat || ""

  const ttElements = buildTTPhanHoi(tt, "\t\t\t\t")
  const loaiSP = dongKQ.LoaiSP || "S11A"

  return `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
	<env:Header/>
	<env:Body>
		<ns3:PHVanTinDSPhieu xmlns:ns2="http://www.endpoint.ws.h2h.cic.org.vn/cicqaProd" xmlns:ns3="http://www.endpoint.ws.h2h.cic.org.vn/cicqa">
			<ns3:TTPhanHoi>
${ttElements}
			</ns3:TTPhanHoi>
			<ns3:DSKhachHangKQ>
				<ns2:DongKQ>
					<ns2:MaSoPhieu>${maSoPhieu}</ns2:MaSoPhieu>
					<ns2:Data>${dataXmlEscaped}</ns2:Data>
					<ns2:LoaiSP>${loaiSP}</ns2:LoaiSP>
					<ns2:NgayHoi>${ngayHoi}</ns2:NgayHoi>
					<ns2:NgayNhanGanNhat>${ngayNhanGanNhat}</ns2:NgayNhanGanNhat>
				</ns2:DongKQ>
			</ns3:DSKhachHangKQ>
		</ns3:PHVanTinDSPhieu>
	</env:Body>
</env:Envelope>`
}

function getElementByLocalName(parent: Document | Element, localName: string): Element | null {
  const elements = parent.getElementsByTagName("*")
  for (let i = 0; i < elements.length; i++) {
    const name = elements[i].tagName
    const colonIndex = name.indexOf(":")
    const actualName = colonIndex !== -1 ? name.substring(colonIndex + 1) : name
    if (actualName === localName) {
      return elements[i]
    }
  }
  return null
}

function xmlNodeToJson(element: Element): any {
  const childNodes = Array.from(element.childNodes)
  const childElements = Array.from(element.children)

  const nonBrElements = childElements.filter((el) => {
    const name = el.tagName.toLowerCase()
    const local = name.includes(":") ? name.split(":")[1] : name
    return local !== "br"
  })

  if (nonBrElements.length === 0) {
    let text = ""
    childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || ""
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element
        const name = el.tagName.toLowerCase()
        const local = name.includes(":") ? name.split(":")[1] : name
        if (local === "br") {
          text += "|"
        } else {
          text += el.textContent || ""
        }
      }
    })

    text = text.trim()
    if (!text) return null

    if (/^-?\d+$/.test(text)) {
      if (text.length > 1 && text[0] === "0") {
        return text
      } else if (text.length > 2 && text[0] === "-" && text[1] === "0") {
        return text
      } else {
        return Number(text)
      }
    }
    return text
  }

  const result: any = {}
  const childGroups: { [key: string]: Element[] } = {}

  nonBrElements.forEach((child) => {
    const name = child.tagName
    const colonIndex = name.indexOf(":")
    const localName = colonIndex !== -1 ? name.substring(colonIndex + 1) : name
    if (!childGroups[localName]) {
      childGroups[localName] = []
    }
    childGroups[localName].push(child)
  })

  const parentName = element.tagName
  const parentColonIndex = parentName.indexOf(":")
  const parentLocalName = parentColonIndex !== -1 ? parentName.substring(parentColonIndex + 1) : parentName

  const FORCE_ARRAY_PARENTS = [
    "QHTD",
    "HDTD",
    "DUNO_THETD",
    "DUNO_VAMC",
    "DUNO_12THANG",
    "NHOM2_12THANG",
    "NOXAU_60THANG",
    "LS_TRACUU_12THANG",
    "TCTD_PHATHANH_THE",
    "DUNO_THETD_12THANG",
    "THETD_CHAMTT_36THANG"
  ]
  const shouldForceArray = FORCE_ARRAY_PARENTS.includes(parentLocalName)

  Object.keys(childGroups).forEach((tagName) => {
    const elements = childGroups[tagName]
    if (elements.length === 1 && !shouldForceArray) {
      result[tagName] = xmlNodeToJson(elements[0])
    } else {
      result[tagName] = elements.map((el) => xmlNodeToJson(el))
    }
  })

  return result
}

export function convertXmlToJson(xmlStr: string): string {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlStr, "application/xml")

  const parserError = xmlDoc.querySelector("parsererror")
  if (parserError) {
    throw new Error("XML không hợp lệ")
  }

  const ttEl = getElementByLocalName(xmlDoc, "TTPhanHoi")
  if (!ttEl) throw new Error("Không tìm thấy thẻ TTPhanHoi")

  const dongKqEl = getElementByLocalName(xmlDoc, "DongKQ")
  if (!dongKqEl) throw new Error("Không tìm thấy thẻ DongKQ")

  const trangThaiEl = getElementByLocalName(ttEl, "TrangThai")
  const maEl = getElementByLocalName(ttEl, "Ma")
  const moTaEl = getElementByLocalName(ttEl, "MoTa")
  const slHoiEl = getElementByLocalName(ttEl, "SLHoi")
  const slTraLoiEl = getElementByLocalName(ttEl, "SLTraLoi")
  const slLoiEl = getElementByLocalName(ttEl, "SLLoi")
  const checkSumEl = getElementByLocalName(ttEl, "CheckSum")

  const parseNumberOrNull = (el: Element | null) => {
    if (!el) return null
    const text = el.textContent?.trim()
    if (!text) return null
    return isNaN(Number(text)) ? text : Number(text)
  }

  const ttPhanHoi = {
    TrangThai: parseNumberOrNull(trangThaiEl) ?? 0,
    Ma: maEl?.textContent?.trim() ?? "",
    MoTa: moTaEl?.textContent?.trim() ?? "",
    SLHoi: parseNumberOrNull(slHoiEl) ?? 0,
    SLTraLoi: parseNumberOrNull(slTraLoiEl) ?? 0,
    SLLoi: parseNumberOrNull(slLoiEl) ?? 0,
    CheckSum: checkSumEl?.textContent?.trim() ?? "",
  }

  const maSoPhieuEl = getElementByLocalName(dongKqEl, "MaSoPhieu")
  const dataEl = getElementByLocalName(dongKqEl, "Data")
  const loaiSPEl = getElementByLocalName(dongKqEl, "LoaiSP")
  const ngayHoiEl = getElementByLocalName(dongKqEl, "NgayHoi")
  const ngayNhanGanNhatEl = getElementByLocalName(dongKqEl, "NgayNhanGanNhat")

  let parsedData = null
  if (dataEl) {
    const rawDataXml = dataEl.textContent?.trim()
    if (rawDataXml) {
      const dataDoc = parser.parseFromString(rawDataXml, "application/xml")
      const rootNode = dataDoc.documentElement
      if (rootNode && !dataDoc.querySelector("parsererror")) {
        parsedData = xmlNodeToJson(rootNode)
      } else {
        parsedData = rawDataXml // fallback if not valid XML
      }
    }
  }

  const dongKQ = {
    MaSoPhieu: maSoPhieuEl?.textContent?.trim() ?? "",
    Data: parsedData ? { NOIDUNG_BANTLTIN: parsedData } : null,
    LoaiSP: loaiSPEl?.textContent?.trim() ?? "S11A",
    NgayHoi: ngayHoiEl?.textContent?.trim() ?? "",
    NgayNhanGanNhat: ngayNhanGanNhatEl?.textContent?.trim() ?? "",
  }

  const result = {
    envelope: {
      header: null,
      body: {
        PHVanTinDSPhieu: {
          TTPhanHoi: ttPhanHoi,
          DSKhachHangKQ: {
            DongKQ: dongKQ,
          },
        },
      },
    },
  }

  return JSON.stringify(result, null, 2)
}

export const SAMPLE_JSON_S11A_R14 = {
  envelope: {
    header: null,
    body: {
      PHVanTinDSPhieu: {
        TTPhanHoi: {
          TrangThai: 0,
          Ma: "CMM_000",
          MoTa: "Nhận thông tin thành công",
          SLHoi: 1,
          SLTraLoi: 1,
          SLLoi: 0,
          CheckSum: "abc123def456",
        },
        DSKhachHangKQ: {
          DongKQ: {
            MaSoPhieu: "88000000261893_010693723532_S11a_202605150959",
            Data: {
              NOIDUNG_BANTLTIN: {
                TT_NGUOITRACUU: {
                  DONVITRACUU: "Ngân hàng TNHH MTV CIMB Việt Nam",
                  DIACHI: "Tầng 2, Tòa nhà CornerStone",
                  TENTRUYCAP: "h01661001hoa2",
                  DTHOAI: null,
                  MSPHIEU: "59110019S11AT2026",
                  THOIGIANYC: "20260504 16:46",
                  THOIGIANTL: "20260504 16:46",
                  TT_TRALOI: 1,
                },
                NOIDUNG: {
                  TTPHAPLY: {
                    MACIC: 3331504207,
                    TENKH: "NGUYỄN VĂN A",
                    DIACHI_TRUSOCHINH: "Hà Nội",
                    CMND_HC: "033196001241",
                    GIAYTOKHAC: null,
                    DKKD: null,
                    MST: null,
                    TGD_GD: null,
                    NGUOI_DAIDIENPL: null,
                    GHICHU: null,
                    XTHSKH: 1,
                  },
                  QHTDHT: {
                    QHTD: {
                      DONG: [
                        {
                          NGAYSL: 20260421,
                          MATCTD: "01358001",
                          TENTCTD: "Ngân hàng TMCP Tiên Phong",
                          CTLOAIVAY: {
                            DONG: {
                              LOAIVAY: "01",
                              NHOMNO: "01",
                              DUNO_VND: 100,
                              DUNO_USD: 0,
                            },
                          },
                          TONG_VND: 100,
                          TONG_USD: 0,
                        },
                      ],
                    },
                    DUNO_THETD: null,
                    DUNO_VAMC: null,
                    HDTD: {
                      DONG: [
                        {
                          SOHDTD: "HD001",
                          MATCTD: "01358001",
                          TENTCTD: "Ngân hàng TMCP Tiên Phong",
                          NGAYKY_HDTD: 20260111,
                          NGAYKT_HDTD: 20310111,
                        },
                      ],
                    },
                  },
                  LSQHTD: {
                    DUNO_12THANG: {
                      DONG: [
                        {
                          THANG: 202604,
                          DUNOVAY: "-",
                          DUNOTHE: null,
                          TONGDUNO: "-",
                        },
                      ],
                    },
                    NHOM2_12THANG: null,
                    NOXAU_60THANG: null,
                    LS_CHAMTT_THETD_36THANG: {
                      TT_CHAMTT: 0,
                      SONGAY_CHAMTT_LONNHAT: 0,
                      SOLAN_CHAMTT: 0,
                    },
                  },
                  TSDB: {
                    SL_TCTD: null,
                    SL_TSDB: null,
                    MOTA_TSDB: "Không có",
                  },
                  LS_TRACUU_12THANG: {
                    DONG: [
                      {
                        MASP: "QHTD",
                        NGAYTRACUU: "20260504 16:46:05",
                        MATCTD: "01661001",
                        TENTCTD: "Ngân hàng TNHH MTV CIMB Việt Nam",
                      },
                    ],
                  },
                  DIEMTD: {
                    DIEM: 473,
                    HANG: 8,
                    NGAYCHAM: 20260423,
                    XEPHANGKH: 9,
                    MOTA_XEPHANGKH: "Điểm tín dụng cao hơn 9%",
                  },
                  TTKHAC: null,
                },
              },
            },
            LoaiSP: "S11A",
            NgayHoi: "20260515 10:27:47",
            NgayNhanGanNhat: "20260515 10:27:47",
          },
        },
      },
    },
  },
}
