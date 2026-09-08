import React, { useEffect, useRef } from 'react'
import { renderBarcodeSvg } from '../../lib/barcode'
import { BRAND_EN } from '../../lib/brand'
import { formatCurrency } from '../../lib/retail'

export interface BarcodeLabelProps {
  productName: string
  variantName?: string
  barcodeValue: string
  price: number
  mrp?: number | null
  storeName?: string
  widthMm?: number
  heightMm?: number
}

export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
  productName,
  variantName,
  barcodeValue,
  price,
  mrp,
  storeName = BRAND_EN,
  widthMm = 50,
  heightMm = 30,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const isSmall = heightMm <= 25
  const isLarge = heightMm >= 40

  useEffect(() => {
    if (svgRef.current && barcodeValue) {
      renderBarcodeSvg(svgRef.current, barcodeValue, {
        width: widthMm <= 38 ? 0.85 : widthMm >= 80 ? 1.35 : 1.0,
        height: isSmall ? 13 : isLarge ? 26 : 16,
        fontSize: isSmall ? 7.5 : isLarge ? 10 : 8,
        font: 'Arial, sans-serif',
        margin: 0,
        textMargin: 1,
        displayValue: true,
      })
    }
  }, [barcodeValue, widthMm, heightMm, isSmall, isLarge])

  const fullTitle = `${productName}${variantName ? ` (${variantName})` : ''}`

  return (
    <div
      className="barcode-sticker-box bg-white text-black border border-gray-300 rounded flex flex-col justify-between items-center text-center shadow-sm select-none transition-all"
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        maxWidth: `${widthMm}mm`,
        maxHeight: `${heightMm}mm`,
        padding: isSmall ? '0.8mm 1.2mm' : isLarge ? '1.8mm 2.5mm' : '1.2mm 1.8mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Brand & Product Header */}
      <div className="w-full flex flex-col items-center leading-none">
        <div
          className="font-black tracking-wider text-[#0A0A0A] uppercase truncate max-w-full"
          style={{ fontSize: isSmall ? '8px' : isLarge ? '12px' : '9.5px' }}
        >
          {storeName}
        </div>
        <div
          className="font-bold text-gray-900 truncate max-w-full leading-tight"
          style={{
            fontSize: isSmall ? '7.5px' : isLarge ? '11px' : '8.5px',
            marginTop: isSmall ? '0.2mm' : '0.5mm',
          }}
        >
          {fullTitle}
        </div>
      </div>

      {/* Barcode Graphic Box */}
      <div
        className="w-full flex-1 flex justify-center items-center overflow-hidden"
        style={{ margin: isSmall ? '0.2mm 0' : '0.6mm 0', maxHeight: `${heightMm * 0.48}mm` }}
      >
        <svg ref={svgRef} className="max-w-[96%] max-h-full h-auto" />
      </div>

      {/* Pricing Footer */}
      <div
        className="w-full flex items-center justify-between px-0.5 border-t border-black leading-none"
        style={{
          fontSize: isSmall ? '7.5px' : isLarge ? '10.5px' : '8.5px',
          paddingTop: isSmall ? '0.3mm' : '0.6mm',
        }}
      >
        {mrp && mrp > price ? (
          <span className="text-gray-500 line-through" style={{ fontSize: isSmall ? '7px' : isLarge ? '9.5px' : '8px' }}>
            MRP {formatCurrency(mrp)}
          </span>
        ) : (
          <span className="text-gray-600 font-bold" style={{ fontSize: isSmall ? '6.5px' : isLarge ? '9px' : '7.5px' }}>
            CLAD RETAIL
          </span>
        )}
        <span
          className="font-black text-black"
          style={{ fontSize: isSmall ? '9px' : isLarge ? '13px' : '10.5px' }}
        >
          {formatCurrency(price)}
        </span>
      </div>
    </div>
  )
}
