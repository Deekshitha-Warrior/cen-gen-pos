import React, { useEffect, useRef } from 'react'
import { X, Printer } from 'lucide-react'
import {
  type BarcodeQueueItem,
  type LabelSizeConfig,
  renderBarcodeSvg,
} from '../../lib/barcode'

interface BarcodeSheetPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  items: BarcodeQueueItem[]
  sizeConfig: LabelSizeConfig
  onPrint: () => void
}

export const BarcodeSheetPreviewModal: React.FC<BarcodeSheetPreviewModalProps> = ({
  isOpen,
  onClose,
  items,
  sizeConfig,
  onPrint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Expand all selected queue items into individual labels based on `noOfLabels`
  const individualLabels: BarcodeQueueItem[] = []
  items
    .filter((it) => it.selected)
    .forEach((it) => {
      const count = Math.max(1, it.noOfLabels || 1)
      for (let i = 0; i < count; i++) {
        individualLabels.push(it)
      }
    })

  const isSmall = sizeConfig.heightMm <= 25
  const isLarge = sizeConfig.heightMm >= 40

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    const previewWidth =
      sizeConfig.widthMm <= 38 ? 0.95 : sizeConfig.widthMm >= 80 ? 1.5 : 1.25
    const previewHeight = isSmall ? 22 : isLarge ? 44 : 30

    // Render SVG barcode for each label
    const svgs = containerRef.current.querySelectorAll<SVGSVGElement>('svg.preview-barcode-svg')
    svgs.forEach((svg) => {
      const code = svg.getAttribute('data-barcode')
      if (code) {
        renderBarcodeSvg(svg, code, {
          width: previewWidth,
          height: previewHeight,
          fontSize: 8,
          displayValue: false,
          margin: 0,
        })
      }
    })
  }, [isOpen, individualLabels.length, sizeConfig.id, sizeConfig.widthMm, sizeConfig.heightMm, isSmall, isLarge])

  if (!isOpen) return null

  const gridColsClass =
    sizeConfig.labelsPerRow === 1
      ? 'grid-cols-1 max-w-sm'
      : sizeConfig.labelsPerRow === 3
      ? 'grid-cols-1 sm:grid-cols-3 max-w-4xl'
      : 'grid-cols-1 sm:grid-cols-2 max-w-2xl'

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#0A0A0A] text-white">
          <div>
            <h3 className="text-base font-black tracking-wide text-white">Print Sheet Preview</h3>
            <p className="text-xs text-[#D4AF37] font-semibold">
              {individualLabels.length} Labels ({sizeConfig.name} • {sizeConfig.widthMm} × {sizeConfig.heightMm} mm)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview Sheet Body */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-6 bg-gray-100/70 flex justify-center"
        >
          <div className={`grid gap-4 w-full ${gridColsClass}`}>
            {individualLabels.map((label, idx) => (
              <div
                key={`${label.id}-${idx}`}
                className="bg-white rounded-xl border border-gray-300 p-2.5 shadow-sm flex flex-col justify-between items-center text-center relative transition-all"
                style={{
                  aspectRatio: `${sizeConfig.widthMm} / ${sizeConfig.heightMm}`,
                  minHeight: isSmall ? '88px' : isLarge ? '150px' : '115px',
                  boxSizing: 'border-box',
                }}
              >
                {/* Size badge */}
                <span className="absolute top-1 right-2 text-[8px] font-bold text-gray-400 select-none">
                  {sizeConfig.widthMm}×{sizeConfig.heightMm}mm
                </span>

                {/* Header */}
                {label.header && (
                  <span
                    className="font-black uppercase tracking-wider text-gray-900 leading-none truncate max-w-[85%]"
                    style={{ fontSize: isSmall ? '7.5px' : isLarge ? '11px' : '9px' }}
                  >
                    {label.header}
                  </span>
                )}

                {/* Barcode SVG */}
                <div className="my-0.5 flex items-center justify-center max-w-full overflow-hidden">
                  <svg
                    className="preview-barcode-svg max-w-full h-auto"
                    data-barcode={label.barcodeValue}
                  />
                </div>

                {/* Item Code Number */}
                <span
                  className="font-mono font-bold text-gray-800 tracking-wider leading-none"
                  style={{ fontSize: isSmall ? '7px' : isLarge ? '9.5px' : '8px' }}
                >
                  {label.barcodeValue}
                </span>

                {/* Lines */}
                {label.line1 && (
                  <span
                    className="font-bold text-gray-700 truncate max-w-full leading-tight"
                    style={{ fontSize: isSmall ? '7px' : isLarge ? '9.5px' : '8px' }}
                  >
                    {label.line1}
                  </span>
                )}
                {label.line2 && (
                  <span
                    className="font-semibold text-gray-600 truncate max-w-full leading-tight"
                    style={{ fontSize: isSmall ? '6.5px' : isLarge ? '8.5px' : '7.5px' }}
                  >
                    {label.line2}
                  </span>
                )}
                {label.line3 && (
                  <span
                    className="font-black text-[#0A0A0A] truncate max-w-full leading-none"
                    style={{ fontSize: isSmall ? '8px' : isLarge ? '12px' : '9.5px' }}
                  >
                    {label.line3}
                  </span>
                )}
                {label.line4 && (
                  <span
                    className="text-gray-500 truncate max-w-full leading-none"
                    style={{ fontSize: isSmall ? '6px' : isLarge ? '8px' : '7px' }}
                  >
                    {label.line4}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white">
          <span className="text-xs font-bold text-gray-600">
            Total {individualLabels.length} physical stickers ready to print
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onPrint()
              }}
              className="px-6 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] text-xs font-black uppercase tracking-wider hover:bg-[#1A1A1A] transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Printer size={15} /> Print Labels
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
