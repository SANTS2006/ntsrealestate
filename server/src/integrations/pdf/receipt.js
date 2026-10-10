import PDFDocument from 'pdfkit';

const BRAND = { navy: '#002956', blue: '#00529B', slate: '#334155', muted: '#64748B', border: '#E2E8F0', bg: '#F8FAFC' };

function formatCurrency(amount) {
  const value = Number(amount ?? 0);
  return `Sle ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

// Receipts have no dedicated sequence of their own — the payment id already
// is one, so a short, readable slice of it doubles as the receipt number
// rather than adding a schema column just for this.
function receiptNumber(paymentId) {
  return `RCP-${paymentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

// Streams a one-page PDF receipt directly to `res` (a writable stream) —
// callers pipe it straight into the HTTP response rather than buffering the
// whole document in memory first.
export function streamPaymentReceipt(res, { organization, payment }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  doc.pipe(res);

  // Header band
  doc.rect(0, 0, doc.page.width, 90).fill(BRAND.navy);
  doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text(organization.name, 50, 30);
  doc.fontSize(9).font('Helvetica').fillColor('#A8C6E0').text('PROPERTY MANAGEMENT', 50, 54, { characterSpacing: 1 });
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF').text('PAYMENT RECEIPT', 0, 38, { align: 'right', width: doc.page.width - 50 });

  let y = 130;
  doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica').text('RECEIPT NUMBER', 50, y);
  doc.fillColor(BRAND.slate).fontSize(12).font('Helvetica-Bold').text(receiptNumber(payment.id), 50, y + 14);

  doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica').text('PAYMENT DATE', 300, y);
  doc.fillColor(BRAND.slate).fontSize(12).font('Helvetica-Bold').text(dateFmt.format(new Date(payment.paymentDate)), 300, y + 14);

  y += 55;
  doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica').text('RECEIVED FROM', 50, y);
  doc.fillColor(BRAND.slate).fontSize(12).font('Helvetica-Bold').text(`${payment.tenant.firstName} ${payment.tenant.lastName}`, 50, y + 14);
  if (payment.tenant.email) {
    doc.fillColor(BRAND.muted).fontSize(10).font('Helvetica').text(payment.tenant.email, 50, y + 32);
  }

  // Details table
  y += 70;
  const tableX = 50;
  const tableWidth = doc.page.width - 100;
  doc.rect(tableX, y, tableWidth, 28).fill(BRAND.bg);
  doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica-Bold');
  doc.text('DESCRIPTION', tableX + 12, y + 9);
  doc.text('METHOD', tableX + 260, y + 9);
  doc.text('REFERENCE', tableX + 360, y + 9);
  doc.text('AMOUNT', tableX + 12, y + 9, { width: tableWidth - 24, align: 'right' });

  y += 28;
  const description = payment.invoice ? `Payment for invoice ${payment.invoice.invoiceNumber}` : 'Payment';
  doc.rect(tableX, y, tableWidth, 36).strokeColor(BRAND.border).lineWidth(1).stroke();
  doc.fillColor(BRAND.slate).fontSize(10).font('Helvetica');
  doc.text(description, tableX + 12, y + 12, { width: 230 });
  doc.text((payment.paymentMethod ?? '').replace(/_/g, ' '), tableX + 260, y + 12, { width: 90 });
  doc.text(payment.reference || '—', tableX + 360, y + 12, { width: tableWidth - 372 });
  doc.font('Helvetica-Bold').text(formatCurrency(payment.amount), tableX + 12, y + 12, { width: tableWidth - 24, align: 'right' });

  // Total + status
  y += 60;
  doc.moveTo(tableX, y).lineTo(tableX + tableWidth, y).strokeColor(BRAND.border).stroke();
  y += 16;
  doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica').text('STATUS', tableX, y);
  doc.fillColor(payment.status === 'refunded' ? '#DC2626' : '#16A34A').fontSize(12).font('Helvetica-Bold').text(
    payment.status === 'refunded' ? 'Refunded' : 'Paid in full', tableX, y + 14, { width: tableWidth / 2 - 12 }
  );
  doc.fillColor(BRAND.muted).font('Helvetica').fontSize(9).text('TOTAL AMOUNT PAID', tableX, y, { width: tableWidth, align: 'right' });
  doc.fillColor(BRAND.navy).font('Helvetica-Bold').fontSize(16).text(formatCurrency(payment.amount), tableX, y + 14, { width: tableWidth, align: 'right' });

  // Footer
  const footerY = doc.page.height - 90;
  doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor(BRAND.border).stroke();
  doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica').text(
    'This receipt was generated automatically and is valid without a signature.',
    50, footerY + 14, { width: doc.page.width - 100, align: 'center' }
  );
  doc.text(`${organization.name} · Generated ${dateFmt.format(new Date())}`, 50, footerY + 28, { width: doc.page.width - 100, align: 'center' });

  doc.end();
}

export { receiptNumber };
