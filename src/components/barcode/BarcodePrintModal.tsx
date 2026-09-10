import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Copy, Check } from 'lucide-react'
import { BarcodeLabel } from './BarcodeLabel'
import { BRAND_EN } from '../../lib/brand'
import { getAllLabelSizes } from '../../lib/barcode'

export interface BarcodePrintModalProps {
  isOpen: boolean
  onClose: () => void
  productName: string
  variantName?: string
  barcodeValue: string
  price: number
  mrp?: number | null
  defaultQuantity?: number
}

type LabelSizePreset = {
  name: string
  widthMm: number
  heightMm: number
}

const getAvailablePresets = (): LabelSizePreset[] => {
  const sizes = getAllLabelSizes()
  return sizes.map((s) => ({
    name: `${s.name} (${s.widthMm}mm × ${s.heightMm}mm)`,
    widthMm: s.widthMm,
    heightMm: s.heightMm,
  }))
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  productName,
  variantName,
  barcodeValue,
  price,
  mrp,
  defaultQuantity = 1,
}) => {
  const presets = getAvailablePresets()
  const [quantity, setQuantity] = useState(defaultQuantity)
  const [selectedPreset, setSelectedPreset] = useState<LabelSizePreset>(presets[0] || { name: 'Thermal Standard', widthMm: 50, heightMm: 25 })
  const [copied, setCopied] = useState(false)

  // Close on Escape key & lock body scrolling when open
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcodeValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    try {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.setAttribute('tabindex', '-1')
      iframe.setAttribute('data-gramm', 'false')
      iframe.setAttribute('data-gramm_editor', 'false')
      iframe.setAttribute('data-enable-grammarly', 'false')
      iframe.setAttribute('spellcheck', 'false')
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
        return
      }

    const fullTitle = `${productName}${variantName ? ` (${variantName})` : ''}`

    const isSmall = selectedPreset.heightMm <= 25
    const isLarge = selectedPreset.heightMm >= 40

    // Exact mathematical calculation for thermal barcode size
    // 1mm = 3.7795px at standard 96 DPI CSS print
    // Barcode occupies ~50% of the total label sticker height
    const barcodeHeightPx = Math.max(22, Math.round(selectedPreset.heightMm * 0.50 * 3.7795))
    const printableWidthPx = Math.max(30, (selectedPreset.widthMm - 3) * 3.7795)
    const barcodeBarWidth = Math.max(0.80, Math.min(1.85, Math.round((printableWidthPx / 115) * 100) / 100))

    const barcodeFontSize = Math.max(6.5, Math.min(11, Math.round(selectedPreset.heightMm * 0.28 * 10) / 10))
    const headerFontSize = Math.max(6, Math.min(12, Math.round(selectedPreset.heightMm * 0.30 * 10) / 10)) + 'pt'
    const titleFontSize = Math.max(5.5, Math.min(10, Math.round(selectedPreset.heightMm * 0.25 * 10) / 10)) + 'pt'
    const tagFontSize = Math.max(5, Math.min(8.5, Math.round(selectedPreset.heightMm * 0.22 * 10) / 10)) + 'pt'
    const priceFontSize = Math.max(7, Math.min(13.5, Math.round(selectedPreset.heightMm * 0.35 * 10) / 10)) + 'pt'
    const paddingY = Math.max(0.4, Math.round(selectedPreset.heightMm * 0.03 * 10) / 10) + 'mm'
    const paddingX = Math.max(0.8, Math.round(selectedPreset.widthMm * 0.03 * 10) / 10) + 'mm'
    const stickerPadding = `${paddingY} ${paddingX}`
    const barcodeBoxHeightMm = (selectedPreset.heightMm * 0.50).toFixed(1) + 'mm'

    // Build standalone HTML for the printed stickers with strict thermal proportions
    const stickersHtml = Array.from({ length: Math.max(1, quantity) })
      .map(
        () => `
        <div class="sticker">
          <div class="header">
            <div class="brand">${BRAND_EN}</div>
            <div class="prod-title">${fullTitle}</div>
          </div>
          <div class="barcode-box">
            <svg class="barcode-svg" jsbarcode-value="${barcodeValue}"></svg>
          </div>
          <div class="footer">
            <span>${mrp && mrp > price ? `<span class="mrp">MRP ₹${mrp}</span>` : '<span class="retail-tag">CLAD RETAIL</span>'}</span>
            <span class="price">₹${price}</span>
          </div>
        </div>
      `
      )
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode - ${barcodeValue}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: ${selectedPreset.widthMm}mm ${selectedPreset.heightMm}mm;
              margin: 0mm !important;
              marks: none !important;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${selectedPreset.widthMm}mm !important;
              height: ${selectedPreset.heightMm}mm !important;
              overflow: hidden !important;
              background: #fff !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sticker {
              width: ${selectedPreset.widthMm}mm;
              height: ${selectedPreset.heightMm}mm;
              max-width: ${selectedPreset.widthMm}mm;
              max-height: ${selectedPreset.heightMm}mm;
              padding: ${stickerPadding};
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden;
              box-sizing: border-box;
            }
            .sticker:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .header {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              line-height: 1;
              padding-bottom: 0.2mm;
            }
            .brand {
              font-size: ${headerFontSize};
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #000;
              line-height: 1;
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
              margin: 0;
              overflow: hidden;
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
            .retail-tag {
              font-size: ${tagFontSize};
              font-weight: 800;
              color: #444;
            }
            .mrp {
              text-decoration: line-through;
              color: #555;
              font-size: ${tagFontSize};
              font-weight: 600;
            }
            .price {
              font-size: ${priceFontSize};
              font-weight: 900;
              color: #000;
            }
          </style>
        </head>
        <body data-gramm="false">
          ${stickersHtml}
          <script>
            window.onload = function() {
              JsBarcode(".barcode-svg").init({
                format: "CODE128",
                width: ${barcodeBarWidth},
                height: ${barcodeHeightPx},
                fontSize: ${barcodeFontSize},
                font: "Arial, sans-serif",
                margin: 0,
                textMargin: 1,
                displayValue: true
              });
              setTimeout(function() {
                try {
                  window.focus();
                  window.print();
                } catch (e) {}
              }, 300);
            }
          </script>
        </body>
      </html>
    `

    doc.open()
    doc.write(html)
    doc.close()

    const cleanup = () => {
      try {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe)
        }
      } catch {}
    }

    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.onbeforeunload = null
        iframe.contentWindow.onunload = null
        iframe.contentWindow.onafterprint = cleanup
      }
    } catch {}

    setTimeout(cleanup, 2500)
  } catch (err) {
    console.warn('[BarcodePrintModal] Failed to execute print:', err)
  }
}

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen h-[100dvh] z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-hidden animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-none sm:rounded-3xl max-w-2xl w-full h-screen h-[100dvh] sm:h-auto sm:max-h-[92vh] border-0 sm:border border-[#E8D399] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0A0A0A] px-4 py-3 sm:px-6 sm:py-4 border-b border-[#D4AF37]/30 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1A1A1A] border border-[#D4AF37] flex items-center justify-center text-[#D4AF37]">
              <Printer size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wide text-white">
                Print Barcode Labels ({BRAND_EN})
              </h2>
              <p className="text-[11px] text-[#D4AF37] font-semibold">
                Generate physical retail stickers for this SKU
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body - Scrollable within max-h-[90vh] */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 min-h-0 hide-scrollbar">
          {/* Barcode Info Card */}
          <div className="bg-[#FBFAF6] border border-[#E8D399] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#B48811]">
                Product / SKU
              </span>
              <h3 className="text-lg font-black text-[#0A0A0A]">{productName}</h3>
              {variantName && (
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                  Variant: {variantName}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
              <span className="font-mono text-sm font-black text-black">
                {barcodeValue}
              </span>
              <button
                type="button"
                onClick={handleCopyBarcode}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 cursor-pointer"
                title="Copy Barcode Value"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                Number of Labels to Print
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-black font-black text-lg flex items-center justify-center border border-gray-300 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center font-black text-lg py-2 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] focus:border-[#0A0A0A] focus:bg-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-black font-black text-lg flex items-center justify-center border border-gray-300 cursor-pointer"
                >
                  +
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Prints {quantity} physical stickers with identical barcode identifier.
              </p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                Label Sizing Preset
              </label>
              <select
                value={selectedPreset.name}
                onChange={(e) => {
                  const preset = presets.find((p) => p.name === e.target.value)
                  if (preset) setSelectedPreset(preset)
                }}
                className="w-full py-2.5 px-3 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] font-bold text-sm text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white cursor-pointer"
              >
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-2">
              Sticker Print Preview (1 of {quantity})
            </label>
            <div className="bg-[#FBFAF6] border-2 border-dashed border-[#E8D399] rounded-2xl p-6 flex items-center justify-center">
              <BarcodeLabel
                productName={productName}
                variantName={variantName}
                barcodeValue={barcodeValue}
                price={price}
                mrp={mrp}
                storeName={BRAND_EN}
                widthMm={selectedPreset.widthMm}
                heightMm={selectedPreset.heightMm}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#FBFAF6] px-4 py-3 sm:px-6 sm:py-3.5 border-t border-[#E8D399] flex items-center justify-between shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 sm:gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] font-black hover:bg-[#1A1A1A] transition-all shadow-md cursor-pointer hover:scale-[1.02] text-xs sm:text-sm shrink-0"
          >
            <Printer size={16} />
            Print {quantity} {quantity === 1 ? 'Sticker' : 'Stickers'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
