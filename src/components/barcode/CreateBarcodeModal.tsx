import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Settings,
  Plus,
  Trash2,
  Printer,
  Sparkles,
  Info,
  CheckCircle,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import {
  type BarcodeQueueItem,
  type BarcodeSettings,
  type LabelSizeConfig,
  getStoredBarcodeSettings,
  getAllLabelSizes,
  renderBarcodeSvg,
} from '../../lib/barcode'
import { BRAND_EN } from '../../lib/brand'
import { barcodeService } from '../../services/barcodeService'
import { fetchVariantsByProduct, type ProductVariant } from '../../services/variantService'
import { BarcodeSettingsDrawer } from './BarcodeSettingsDrawer'
import { BarcodeSheetPreviewModal } from './BarcodeSheetPreviewModal'

interface ProductOption {
  id: number
  name: string
  price: number
  cost_price?: number
  barcode?: string
  stock_quantity?: number
  category?: string
  has_variants?: boolean
}

export interface CreateBarcodeModalProps {
  isOpen: boolean
  onClose: () => void
  products: ProductOption[]
  preselectedProductId?: number
  preselectedVariantId?: string | null
  onSuccess?: () => void
}

export const CreateBarcodeModal: React.FC<CreateBarcodeModalProps> = ({
  isOpen,
  onClose,
  products,
  preselectedProductId,
  preselectedVariantId,
  onSuccess,
}) => {
  // Settings
  const [settings, setSettings] = useState<BarcodeSettings>(getStoredBarcodeSettings())
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  const [showSheetPreviewModal, setShowSheetPreviewModal] = useState(false)

  // Current Form State (Left Column)
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

  const [itemCode, setItemCode] = useState('')
  const [noOfLabels, setNoOfLabels] = useState<number>(2)
  const [header, setHeader] = useState(BRAND_EN)
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [line3, setLine3] = useState('Discount: 0%')
  const [line4, setLine4] = useState('')

  // Queue of items to generate (Bottom Table)
  const [queue, setQueue] = useState<BarcodeQueueItem[]>([])

  // Submission & Status
  const [generating, setGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Preview SVG Ref
  const previewSvgRef = useRef<SVGSVGElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allSizes = getAllLabelSizes()
  const currentSizeConfig: LabelSizeConfig =
    allSizes.find((s) => s.id === settings.selectedSizeId) || allSizes[0]

  const isSmall = currentSizeConfig.heightMm <= 25
  const isLarge = currentSizeConfig.heightMm >= 40

  const selectProductItem = useCallback(async (prod: ProductOption, targetVariantId?: string | null) => {
    setSelectedProduct(prod)
    setProductSearch(prod.name)
    setDropdownOpen(false)

    // Set default item code (product barcode or generate new code)
    const code = prod.barcode || `CLAD${Math.floor(1000000 + Math.random() * 9000000)}`
    setItemCode(code)
    setLine1(prod.name)
    setLine2(prod.category || '')
    setLine3(settings.showDiscount ? 'Discount: 0%' : `Price: ₹${prod.price}`)

    // Fetch variants if applicable
    if (prod.has_variants) {
      try {
        const vars = await fetchVariantsByProduct(String(prod.id))
        setVariants(vars)
        if (vars.length > 0) {
          const matched = targetVariantId ? vars.find(v => v.id === targetVariantId) : vars[0]
          const chosen = matched || vars[0]
          setSelectedVariant(chosen)
          if (chosen.barcode) setItemCode(chosen.barcode)
          setLine2(`Size: ${chosen.variantName}`)
          if (chosen.price) {
            setLine3(settings.showDiscount ? 'Discount: 0%' : `Price: ₹${chosen.price}`)
          }
        }
      } catch (err) {
        console.error('Failed to load variants:', err)
      }
    } else {
      setVariants([])
      setSelectedVariant(null)
    }
  }, [settings.showDiscount])

  // Initialize with preselected product if passed
  useEffect(() => {
    if (preselectedProductId) {
      const found = products.find((p) => p.id === preselectedProductId)
      if (found) {
        void selectProductItem(found, preselectedVariantId)
      }
    }
  }, [preselectedProductId, preselectedVariantId, products, selectProductItem])

  // Handle clicking outside the dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update live preview SVG with dynamic dimension calculations
  useEffect(() => {
    if (!itemCode) return

    // Proportional preview dimensions: fit comfortably within preview box
    const previewScale = Math.min(220 / currentSizeConfig.widthMm, 150 / currentSizeConfig.heightMm)
    const previewWidth = Math.round(currentSizeConfig.widthMm * previewScale)
    const previewHeight = Math.round(currentSizeConfig.heightMm * previewScale)
    const previewBarcodeHeight = Math.max(22, Math.round(previewHeight * 0.48))
    const previewBarcodeWidth = Math.max(0.82, Math.min(1.85, Math.round(((previewWidth * 0.85) / 115) * 100) / 100))

    if (previewSvgRef.current) {
      renderBarcodeSvg(previewSvgRef.current, itemCode, {
        width: previewBarcodeWidth,
        height: previewBarcodeHeight,
        fontSize: Math.max(7, Math.round(previewHeight * 0.08)),
        displayValue: false,
        margin: 0,
      })
    }
  }, [
    itemCode,
    header,
    line1,
    line2,
    line3,
    line4,
    currentSizeConfig.id,
    currentSizeConfig.widthMm,
    currentSizeConfig.heightMm,
  ])

  // Determine if currently selected item / variant already has a barcode assigned
  const assignedBarcode = selectedVariant
    ? (selectedVariant.barcode && selectedVariant.barcode.trim().length > 0 ? selectedVariant.barcode.trim() : null)
    : (selectedProduct?.has_variants ? null : (selectedProduct?.barcode && selectedProduct.barcode.trim().length > 0 ? selectedProduct.barcode.trim() : null))

  const isBarcodeAlreadyAssigned = Boolean(assignedBarcode)

  const handleSelectVariant = (varId: string) => {
    const v = variants.find((item) => item.id === varId)
    if (!v) return
    setSelectedVariant(v)
    if (v.barcode) setItemCode(v.barcode)
    setLine2(`Size: ${v.variantName}`)
    if (v.price) {
      setLine3(settings.showDiscount ? 'Discount: 0%' : `Price: ₹${v.price}`)
    }
  }

  const handleAssignCode = () => {
    const generated = 'CLAD' + Math.floor(1000000 + Math.random() * 9000000)
    setItemCode(generated)
  }

  const handleAddToQueue = () => {
    if (!selectedProduct) {
      setStatusMessage({ type: 'error', text: 'Please select an item first' })
      return
    }

    // Check if item already has a barcode assigned in stock management
    if (isBarcodeAlreadyAssigned) {
      setStatusMessage({
        type: 'error',
        text: `Barcode already exists for this item (${assignedBarcode}). Please check in Stock Management.`,
      })
      return
    }

    if (!itemCode.trim()) {
      setStatusMessage({ type: 'error', text: 'Item Code / Barcode is required' })
      return
    }

    if (noOfLabels <= 0) {
      setStatusMessage({ type: 'error', text: 'Number of labels must be at least 1' })
      return
    }

    // Check if already present in the current queue
    const alreadyInQueue = queue.some(
      (it) => it.productId === selectedProduct.id && (selectedVariant ? it.variantId === selectedVariant.id : !it.variantId)
    )
    if (alreadyInQueue) {
      setStatusMessage({
        type: 'error',
        text: `This item (${selectedProduct.name}${selectedVariant ? ` - ${selectedVariant.variantName}` : ''}) is already added in the queue.`,
      })
      return
    }

    const newItem: BarcodeQueueItem = {
      id: `queue_${Date.now()}_${Math.random()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      variantId: selectedVariant?.id || null,
      variantName: selectedVariant?.variantName || undefined,
      barcodeValue: itemCode.trim(),
      price: selectedVariant?.price || selectedProduct.price,
      costPrice: selectedProduct.cost_price || 0,
      noOfLabels,
      header: header.trim(),
      line1: line1.trim(),
      line2: line2.trim(),
      line3: line3.trim(),
      line4: line4.trim(),
      selected: true,
    }

    setQueue((prev) => [...prev, newItem])
    setStatusMessage(null)

    // Reset some inputs for rapid entry
    setNoOfLabels(2)
  }

  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((it) => it.id !== id))
  }

  const handleUpdateQueueItem = (
    id: string,
    field: keyof BarcodeQueueItem,
    value: string | number | boolean
  ) => {
    setQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    )
  }

  const handleToggleSelectAll = (checked: boolean) => {
    setQueue((prev) => prev.map((it) => ({ ...it, selected: checked })))
  }

  const totalLabelsNeeded = queue
    .filter((it) => it.selected)
    .reduce((sum, it) => sum + (it.noOfLabels || 0), 0)

  const handleGenerateAndCommitStock = async () => {
    const selectedItems = queue.filter((it) => it.selected)
    if (selectedItems.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please add and select at least one item to generate barcodes' })
      return
    }

    setGenerating(true)
    setStatusMessage(null)

    try {
      // Process all queued items sequentially or in parallel
      for (const item of selectedItems) {
        await barcodeService.receiveStockWithBarcode({
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity_received: item.noOfLabels,
          unit_cost: item.costPrice || null,
          custom_barcode: item.barcodeValue,
          note: `Received via Barcode Generator (${item.noOfLabels} labels)`,
          created_by_name: 'Admin',
        })
      }

      setStatusMessage({
        type: 'success',
        text: `Successfully generated barcodes & added stock for ${selectedItems.length} items (${totalLabelsNeeded} total units)!`,
      })

      onSuccess?.()
      setShowSheetPreviewModal(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to receive stock with barcodes'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setGenerating(false)
    }
  }

  // Filter products for searchable dropdown
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase()))
  )

  const printQueueDirectly = () => {
    const selectedItems = queue.filter((it) => it.selected)
    if (selectedItems.length === 0) return

    // Build printable HTML sheet for thermal / regular printer
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return

    const isThermal = settings.printerType === 'label'

    // Exact mathematical calculation for thermal barcode size
    // 1mm = 3.7795px at standard 96 DPI CSS print
    // Barcode occupies ~50% of the total label sticker height
    const barcodeHeightPx = Math.max(22, Math.round(currentSizeConfig.heightMm * 0.50 * 3.7795))

    // Printable width inside sticker (minus side padding ~3mm)
    const printableWidthPx = Math.max(30, (currentSizeConfig.widthMm - 3) * 3.7795)
    // Dynamic bar thickness based on width (CODE128 ~115 modules)
    const barcodeBarWidth = Math.max(0.80, Math.min(1.85, Math.round((printableWidthPx / 115) * 100) / 100))

    // Dynamic typography scaled strictly from heightMm
    const barcodeFontSize = Math.max(6.5, Math.min(11, Math.round(currentSizeConfig.heightMm * 0.28 * 10) / 10))
    const headerFontSize = Math.max(6, Math.min(12, Math.round(currentSizeConfig.heightMm * 0.30 * 10) / 10)) + 'pt'
    const titleFontSize = Math.max(5.5, Math.min(10, Math.round(currentSizeConfig.heightMm * 0.25 * 10) / 10)) + 'pt'
    const tagFontSize = Math.max(5, Math.min(8.5, Math.round(currentSizeConfig.heightMm * 0.22 * 10) / 10)) + 'pt'
    const priceFontSize = Math.max(7, Math.min(13.5, Math.round(currentSizeConfig.heightMm * 0.35 * 10) / 10)) + 'pt'
    const paddingY = Math.max(0.4, Math.round(currentSizeConfig.heightMm * 0.03 * 10) / 10) + 'mm'
    const paddingX = Math.max(0.8, Math.round(currentSizeConfig.widthMm * 0.03 * 10) / 10) + 'mm'
    const stickerPadding = `${paddingY} ${paddingX}`
    const barcodeBoxHeightMm = (currentSizeConfig.heightMm * 0.50).toFixed(1) + 'mm'

    // Generate individual sticker cards HTML
    const allStickers: string[] = []
    selectedItems.forEach((item) => {
      const count = Math.max(1, item.noOfLabels)
      const fullTitle = `${item.productName}${item.variantName ? ` (${item.variantName})` : ''}`
      for (let i = 0; i < count; i++) {
        allStickers.push(`
          <div class="label-sticker">
            ${settings.showCompanyName ? `<div class="header">${item.header || BRAND_EN}</div>` : ''}
            ${settings.showItemName ? `<div class="prod-title">${fullTitle}</div>` : ''}
            <div class="barcode-box">
              <svg class="barcode-svg" data-code="${item.barcodeValue}"></svg>
            </div>
            <div class="footer">
              <span>${item.line2 ? `<span class="tag">${item.line2}</span>` : '<span class="tag">CLAD RETAIL</span>'}</span>
              ${settings.showSalePrice ? `<span class="price">₹${item.price}</span>` : ''}
            </div>
          </div>
        `)
      }
    })

    let bodyContent = ''
    if (isThermal) {
      // 1 barcode per page! Every label is strictly an individual page
      bodyContent = allStickers.join('')
    } else {
      // Regular A4 printer
      bodyContent = `
        <div class="a4-container">
          ${allStickers.join('')}
        </div>
      `
    }

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CLAD Barcode Labels</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              ${
                isThermal
                  ? `size: ${currentSizeConfig.widthMm}mm ${currentSizeConfig.heightMm}mm; margin: 0mm !important;`
                  : `size: A4 portrait; margin: 10mm !important;`
              }
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              ${isThermal ? `width: ${currentSizeConfig.widthMm}mm !important;` : ''}
              background: #fff;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .a4-container {
              display: flex;
              flex-wrap: wrap;
              align-content: flex-start;
              gap: 2mm 3mm;
            }
            .label-sticker {
              width: ${currentSizeConfig.widthMm}mm !important;
              height: ${currentSizeConfig.heightMm}mm !important;
              max-width: ${currentSizeConfig.widthMm}mm !important;
              max-height: ${currentSizeConfig.heightMm}mm !important;
              box-sizing: border-box;
              padding: ${stickerPadding};
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              overflow: hidden;
              ${
                isThermal
                  ? 'page-break-after: always !important; break-after: page !important; page-break-inside: avoid !important; break-inside: avoid !important;'
                  : 'page-break-inside: avoid; break-inside: avoid; border: 0.15mm dashed #ccc;'
              }
            }
            .label-sticker:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .header {
              font-size: ${headerFontSize};
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              line-height: 1;
              color: #000;
            }
            .prod-title {
              font-size: ${titleFontSize};
              font-weight: 700;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 96%;
              margin-top: 0.2mm;
              color: #111;
              line-height: 1;
            }
            .barcode-box {
              width: 100%;
              height: ${barcodeBoxHeightMm};
              max-height: ${barcodeBoxHeightMm};
              display: flex;
              justify-content: center;
              align-items: center;
              overflow: hidden;
              margin: 0;
            }
            .barcode-svg {
              display: block;
              margin: 0 auto;
              max-width: 98%;
              max-height: 100%;
            }
            .footer {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-top: 0.5pt solid #000;
              padding-top: 0.3mm;
              line-height: 1;
              margin-top: 0.1mm;
            }
            .tag {
              font-size: ${tagFontSize};
              font-weight: 700;
              color: #444;
            }
            .price {
              font-size: ${priceFontSize};
              font-weight: 900;
              color: #000;
            }
          </style>
        </head>
        <body>
          ${bodyContent}
          <script>
            window.onload = function() {
              var svgs = document.querySelectorAll('.barcode-svg');
              svgs.forEach(function(svg) {
                var code = svg.getAttribute('data-code');
                if (code && window.JsBarcode) {
                  window.JsBarcode(svg, code, {
                    format: 'CODE128',
                    width: ${barcodeBarWidth},
                    height: ${barcodeHeightPx},
                    fontSize: ${barcodeFontSize},
                    font: 'Arial, sans-serif',
                    margin: 0,
                    textMargin: 1,
                    displayValue: true
                  });
                }
              });
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `)
    doc.close()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl max-w-6xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]">
          {/* TOP BAR matching Screenshot 195106 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#0A0A0A] text-white">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-wide text-white flex items-center gap-1.5">
                Barcode Generator
              </h2>
              <Info size={14} className="text-[#D4AF37] opacity-80" />
            </div>

            {/* Right side: Printer / Size info & Settings gear */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-gray-300">
                <span>
                  Printer <strong className="text-white">{settings.printerType === 'label' ? 'Label Printer' : 'Regular Printer'}</strong>
                </span>
                <span className="text-gray-500">|</span>
                <span>
                  Size <strong className="text-[#D4AF37]">{currentSizeConfig.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsDrawer(true)}
                title="Barcode Settings"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#D4AF37] hover:text-[#0A0A0A] flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <Settings size={16} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`px-6 py-2.5 flex items-center justify-between text-xs font-bold ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                  : 'bg-red-50 text-red-800 border-b border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-gray-500 hover:text-black font-black cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* MAIN WORKSPACE BODY (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* TOP CARD: 2-COLUMN INTAKE FORM */}
            <div className="bg-[#FBFAF6] border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
                {/* LEFT SECTION: Form Inputs */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-black uppercase tracking-wider text-gray-800">
                      Enter item details to add for barcode
                    </span>
                    {selectedProduct && (
                      <span className="text-[11px] font-bold text-gray-500">
                        Selected: <strong className="text-gray-900">{selectedProduct.name}</strong>
                      </span>
                    )}
                  </div>

                  {/* Duplicate Barcode Alert Warning Banner */}
                  {isBarcodeAlreadyAssigned && (
                    <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-2.5 text-xs text-red-900 font-bold animate-in fade-in duration-150">
                      <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>Barcode already exists for this item:</span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-red-300 text-red-950 font-black">
                            {assignedBarcode}
                          </span>
                        </div>
                        <p className="text-[11px] text-red-700 font-semibold mt-1">
                          Barcode already exists. Please check in Stock Management to view, print, or manage this SKU.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Row 1: Item Name & Item Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Item Name Dropdown / Combobox with markers */}
                    <div className="relative" ref={dropdownRef}>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                        Item Name <span className="text-red-500">*</span>
                      </label>
                      <div
                        onClick={() => setDropdownOpen(true)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white flex items-center justify-between cursor-pointer focus-within:border-[#0A0A0A]"
                      >
                        <input
                          type="text"
                          placeholder="Enter / Select Item Name"
                          value={productSearch}
                          onChange={(e) => {
                            setProductSearch(e.target.value)
                            setDropdownOpen(true)
                          }}
                          className="w-full text-xs font-bold text-gray-900 bg-transparent outline-none"
                        />
                        <ChevronDown size={14} className="text-gray-400 shrink-0" />
                      </div>

                      {/* Dropdown Menu with Visual Markers */}
                      {dropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 w-full sm:w-[420px] bg-white rounded-2xl border border-gray-300 shadow-2xl z-50 overflow-hidden animate-in fade-in duration-100">
                          {/* Product Items List */}
                          <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                            {filteredProducts.length === 0 ? (
                              <div className="p-4 text-xs text-gray-400 text-center font-bold">
                                No matching products found.
                              </div>
                            ) : (
                              filteredProducts.map((p) => {
                                const hasExistingBarcode = Boolean(p.barcode && p.barcode.trim().length > 0)
                                return (
                                  <div
                                    key={p.id}
                                    onClick={() => selectProductItem(p)}
                                    className="p-2.5 hover:bg-[#FBFAF6] cursor-pointer flex items-center justify-between text-xs transition-colors"
                                  >
                                    <div className="min-w-0 pr-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-gray-900 truncate">
                                          {p.name}
                                        </p>
                                        {p.has_variants ? (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                            Variants
                                          </span>
                                        ) : hasExistingBarcode ? (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                            Barcode: {p.barcode}
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            No Barcode
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                        {p.category || 'General'}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="font-black text-gray-900">₹{p.price}</span>
                                      <span className="block text-[10px] text-gray-500 font-semibold">
                                        Stock: {p.stock_quantity ?? 0}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Item Code (with Assign Code button) */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                        Item Code <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Enter Item Code"
                          value={itemCode}
                          onChange={(e) => setItemCode(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-mono font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                        />
                        <button
                          type="button"
                          onClick={handleAssignCode}
                          className="shrink-0 px-3 h-10 rounded-xl bg-gray-100 border border-gray-300 text-[11px] font-black text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          Assign Code
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* If product has variants, show variant picker & Add All Variants button */}
                  {variants.length > 0 && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                          Select Variant / Size ({variants.length} available)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedProduct) return
                            const unassignedVariants = variants.filter(
                              (v) => !v.barcode || !v.barcode.trim()
                            )

                            if (unassignedVariants.length === 0) {
                              setStatusMessage({
                                type: 'error',
                                text: `All variants for "${selectedProduct.name}" already have barcodes assigned. Please check in Stock Management.`,
                              })
                              return
                            }

                            const itemsToAdd: BarcodeQueueItem[] = unassignedVariants.map((v) => ({
                              id: `queue_${Date.now()}_${v.id}_${Math.random()}`,
                              productId: selectedProduct.id,
                              productName: selectedProduct.name,
                              variantId: v.id,
                              variantName: v.variantName,
                              barcodeValue: `CLAD${Math.floor(1000000 + Math.random() * 9000000)}`,
                              price: v.price || selectedProduct.price,
                              costPrice: selectedProduct.cost_price || 0,
                              noOfLabels: noOfLabels || 2,
                              header: header || BRAND_EN,
                              line1: selectedProduct.name,
                              line2: `Size: ${v.variantName}`,
                              line3: settings.showDiscount ? 'Discount: 0%' : `Price: ₹${v.price || selectedProduct.price}`,
                              line4: line4.trim(),
                              selected: true,
                            }))

                            setQueue((prev) => [...prev, ...itemsToAdd])

                            if (unassignedVariants.length < variants.length) {
                              const skipped = variants.length - unassignedVariants.length
                              setStatusMessage({
                                type: 'success',
                                text: `Added ${unassignedVariants.length} new variants to queue. Skipped ${skipped} variant(s) that already have barcodes.`,
                              })
                            } else {
                              setStatusMessage({
                                type: 'success',
                                text: `Added all ${variants.length} variants for "${selectedProduct.name}" to the queue!`,
                              })
                            }
                          }}
                          className="px-2.5 py-1 rounded-md bg-[#0A0A0A] text-[#D4AF37] border border-[#D4AF37] text-[10px] font-black uppercase tracking-wider hover:bg-[#1A1A1A] transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Plus size={11} /> Add Unassigned Variants ({variants.filter(v => !v.barcode?.trim()).length})
                        </button>
                      </div>
                      <select
                        value={selectedVariant?.id || ''}
                        onChange={(e) => handleSelectVariant(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-amber-300 bg-white text-xs font-bold text-gray-900 outline-none"
                      >
                        {variants.map((v) => {
                          const hasVarBarcode = Boolean(v.barcode && v.barcode.trim())
                          return (
                            <option key={v.id} value={v.id}>
                              {v.variantName} {hasVarBarcode ? `— [Barcode: ${v.barcode}] (Already Assigned)` : '— [No Barcode]'} — ₹{v.price} — Stock: {v.stock}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )}

                  {/* Row 2: No of Labels, Header, Line 1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                        No of Labels <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={noOfLabels}
                        onChange={(e) => setNoOfLabels(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-black text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                        Header
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Header"
                        value={header}
                        onChange={(e) => setHeader(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                        Line 1
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Line 1"
                        value={line1}
                        onChange={(e) => setLine1(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>

                  {/* Row 3: Line 2, Line 3, Line 4 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                        Line 2
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Line 2"
                        value={line2}
                        onChange={(e) => setLine2(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                        Line 3
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Line 3"
                        value={line3}
                        onChange={(e) => setLine3(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                        Line 4
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Line 4"
                        value={line4}
                        onChange={(e) => setLine4(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT SECTION: Live Sticker Preview dynamically adapting to selected size */}
                <div className="flex flex-col items-center">
                  <div className="w-full flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                        Live Preview
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#0A0A0A] text-[#D4AF37]">
                        {currentSizeConfig.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500">
                      {currentSizeConfig.widthMm} × {currentSizeConfig.heightMm} mm
                    </span>
                  </div>

                  {/* Canvas backing representing paper roll / sheet */}
                  <div className="w-full rounded-2xl bg-[#F4F5F7] border border-gray-300 p-3 shadow-inner flex flex-col items-center justify-center relative min-h-[220px] overflow-hidden">
                    {(() => {
                      const previewScale = Math.min(220 / currentSizeConfig.widthMm, 150 / currentSizeConfig.heightMm)
                      const previewWidthPx = Math.max(130, Math.round(currentSizeConfig.widthMm * previewScale))
                      const previewHeightPx = Math.max(85, Math.round(currentSizeConfig.heightMm * previewScale))
                      const previewBarcodeHeightPx = Math.max(22, Math.round(previewHeightPx * 0.48))

                      return (
                        <div
                          className="bg-white border border-gray-300 rounded-xl p-2 shadow-sm flex flex-col justify-between items-center text-center relative transition-all"
                          style={{
                            width: `${previewWidthPx}px`,
                            height: `${previewHeightPx}px`,
                            boxSizing: 'border-box',
                          }}
                        >
                          {/* Corner dimension tag */}
                          <span className="absolute top-1 right-1.5 text-[7.5px] font-bold text-gray-400 select-none">
                            {currentSizeConfig.widthMm}×{currentSizeConfig.heightMm}mm
                          </span>

                          {/* Company / Brand */}
                          {settings.showCompanyName && (
                            <span
                              className="font-black uppercase tracking-wider text-gray-900 leading-none truncate max-w-[80%]"
                              style={{ fontSize: `${Math.max(7.5, Math.round(previewHeightPx * 0.09))}px` }}
                            >
                              {header || BRAND_EN}
                            </span>
                          )}

                          {/* Barcode Graphic Box (takes ~48% height) */}
                          <div
                            className="w-full flex items-center justify-center overflow-hidden my-0.5"
                            style={{ height: `${previewBarcodeHeightPx}px` }}
                          >
                            <svg ref={previewSvgRef} className="max-w-[98%] max-h-full h-auto" />
                          </div>

                          {/* Barcode number text */}
                          <span
                            className="font-mono font-bold text-gray-800 tracking-wider leading-none"
                            style={{ fontSize: `${Math.max(7, Math.round(previewHeightPx * 0.075))}px` }}
                          >
                            {itemCode || 'CLAD0000000'}
                          </span>

                          {/* Product Title */}
                          {settings.showItemName && (
                            <span
                              className="font-bold text-gray-800 truncate max-w-full leading-tight"
                              style={{ fontSize: `${Math.max(7, Math.round(previewHeightPx * 0.075))}px` }}
                            >
                              {line1 || selectedProduct?.name || 'Item Name'}
                            </span>
                          )}

                          {/* Variant / Category */}
                          {line2 && (
                            <span
                              className="font-semibold text-gray-600 truncate max-w-full leading-tight"
                              style={{ fontSize: `${Math.max(6.5, Math.round(previewHeightPx * 0.07))}px` }}
                            >
                              {line2}
                            </span>
                          )}

                          {/* Price */}
                          {settings.showSalePrice && (
                            <span
                              className="font-black text-black truncate max-w-full leading-none"
                              style={{ fontSize: `${Math.max(8, Math.round(previewHeightPx * 0.095))}px` }}
                            >
                              {line3 || 'Price: ₹0'}
                            </span>
                          )}

                          {/* Extra line */}
                          {line4 && (
                            <span
                              className="text-gray-500 truncate max-w-full leading-none"
                              style={{ fontSize: `${Math.max(6, Math.round(previewHeightPx * 0.065))}px` }}
                            >
                              {line4}
                            </span>
                          )}
                        </div>
                      )
                    })()}

                    <div className="mt-2 text-[10px] font-bold text-gray-500">
                      {settings.printerType === 'label'
                        ? `Thermal Roll • 1 barcode per page (${currentSizeConfig.widthMm} × ${currentSizeConfig.heightMm} mm)`
                        : 'Regular Printer (A4 Sheet Layout)'}
                    </div>
                  </div>

                  {/* Add for Barcode Button */}
                  <button
                    type="button"
                    onClick={handleAddToQueue}
                    className={`w-full mt-3 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                      isBarcodeAlreadyAssigned
                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-[#0A0A0A] border-[#D4AF37] text-[#D4AF37] hover:bg-[#1A1A1A]'
                    }`}
                  >
                    <Plus size={14} /> {isBarcodeAlreadyAssigned ? 'Barcode Already Exists' : 'Add for Barcode'}
                  </button>
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION: QUEUE TABLE (`Item Details`) matching Screenshot 195637 */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-[#FAFAFA] flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                  Item Details ({queue.length})
                </h3>
              </div>

              {queue.length === 0 ? (
                /* Empty queue state matching Screenshot 195106 */
                <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-3">
                    <Sparkles size={28} className="text-gray-400" />
                  </div>
                  <p className="text-xs font-bold text-gray-600">
                    Added items for Barcode generation will appear here.
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Select an item above, set quantity of labels, and click "Add for Barcode".
                  </p>
                </div>
              ) : (
                /* Queue Table with inline editable cells */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FBFAF6] border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-600">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={queue.every((it) => it.selected)}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            className="accent-[#0A0A0A] w-4 h-4 rounded cursor-pointer"
                          />
                        </th>
                        <th className="p-3">Item Name</th>
                        <th className="p-3 w-28">No of Labels</th>
                        <th className="p-3">Header</th>
                        <th className="p-3">Line 1</th>
                        <th className="p-3">Line 2</th>
                        <th className="p-3">Line 3</th>
                        <th className="p-3">Line 4</th>
                        <th className="p-3 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {queue.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FBFAF6] transition-colors">
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) =>
                                handleUpdateQueueItem(item.id, 'selected', e.target.checked)
                              }
                              className="accent-[#0A0A0A] w-4 h-4 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-bold text-gray-900">
                            <div>{item.productName}</div>
                            <div className="text-[10px] font-mono text-gray-400">
                              {item.barcodeValue} {item.variantName ? `(${item.variantName})` : ''}
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="1"
                              value={item.noOfLabels}
                              onChange={(e) =>
                                handleUpdateQueueItem(
                                  item.id,
                                  'noOfLabels',
                                  Math.max(1, parseInt(e.target.value) || 1)
                                )
                              }
                              className="w-20 h-8 px-2 rounded-lg border border-gray-300 font-black text-center text-xs outline-none focus:border-[#0A0A0A]"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.header}
                              onChange={(e) =>
                                handleUpdateQueueItem(item.id, 'header', e.target.value)
                              }
                              className="w-28 h-8 px-2 rounded-lg border border-gray-300 text-xs font-bold outline-none focus:border-[#0A0A0A]"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.line1}
                              onChange={(e) =>
                                handleUpdateQueueItem(item.id, 'line1', e.target.value)
                              }
                              className="w-28 h-8 px-2 rounded-lg border border-gray-300 text-xs outline-none focus:border-[#0A0A0A]"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.line2}
                              onChange={(e) =>
                                handleUpdateQueueItem(item.id, 'line2', e.target.value)
                              }
                              className="w-28 h-8 px-2 rounded-lg border border-gray-300 text-xs outline-none focus:border-[#0A0A0A]"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.line3}
                              onChange={(e) =>
                                handleUpdateQueueItem(item.id, 'line3', e.target.value)
                              }
                              className="w-28 h-8 px-2 rounded-lg border border-gray-300 text-xs outline-none focus:border-[#0A0A0A]"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.line4}
                              onChange={(e) =>
                                handleUpdateQueueItem(item.id, 'line4', e.target.value)
                              }
                              className="w-28 h-8 px-2 rounded-lg border border-gray-300 text-xs outline-none focus:border-[#0A0A0A]"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveQueueItem(item.id)}
                              className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer mx-auto"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Status Banner at table bottom matching Screenshot 195637 */}
              {queue.length > 0 && (
                <div className="p-3 bg-blue-50/70 border-t border-blue-200 text-xs text-blue-900 font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info size={15} className="text-blue-600" />
                    <span>You will need {totalLabelsNeeded} labels for printing.</span>
                  </div>
                  <span className="text-[11px] text-gray-600">
                    {queue.filter((i) => i.selected).length} items selected
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* MODAL FOOTER matching Screenshot 195637 */}
          <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Close
            </button>

            <div className="flex items-center gap-3">
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSheetPreviewModal(true)}
                  className="px-5 py-2.5 rounded-xl border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] text-xs font-black uppercase tracking-wider hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Preview
                </button>
              )}

              <button
                type="button"
                onClick={handleGenerateAndCommitStock}
                disabled={generating || queue.filter((it) => it.selected).length === 0}
                className="px-6 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] text-xs font-black uppercase tracking-wider hover:bg-[#1A1A1A] transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin inline-block" />
                    Receiving Stock &amp; Generating...
                  </>
                ) : (
                  <>
                    <Printer size={15} /> Generate &amp; Add to Stock ({totalLabelsNeeded} Labels)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Settings Drawer */}
      {showSettingsDrawer && (
        <BarcodeSettingsDrawer
          isOpen={showSettingsDrawer}
          onClose={() => setShowSettingsDrawer(false)}
          settings={settings}
          onUpdateSettings={(newSettings) => setSettings(newSettings)}
        />
      )}

      {/* Multi-Label Sheet Preview Modal */}
      {showSheetPreviewModal && (
        <BarcodeSheetPreviewModal
          isOpen={showSheetPreviewModal}
          onClose={() => setShowSheetPreviewModal(false)}
          items={queue}
          sizeConfig={currentSizeConfig}
          onPrint={printQueueDirectly}
        />
      )}
    </>
  )
}
