export interface ExportColumn<T> {
  key: string
  label: string
  value: (row: T) => string | number
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function exportTableToExcel<T>(filename: string, title: string, rows: T[], columns: ExportColumn<T>[]) {
  const header = columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')
  const body = rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`).join('')
  const html = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <table border="1">
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `${filename}.xls`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportTableToPdf<T>(title: string, rows: T[], columns: ExportColumn<T>[]) {
  const header = columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')
  const body = rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`).join('')
  const printWindow = window.open('', '_blank')

  if (!printWindow) return

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d4d4d8; padding: 8px; text-align: left; }
          th { background: #f4f4f5; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <table>
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
