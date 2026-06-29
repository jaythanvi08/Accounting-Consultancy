import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { CompanyService } from './company.service';

/** Centralised export utilities: PDF (jsPDF + html2canvas), Excel (SheetJS), print. */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly company = inject(CompanyService);

  /** Render a DOM element to a multi-page A4 PDF with company watermark and trigger download. */
  async toPdf(element: HTMLElement, fileName = 'ledgerai-report'): Promise<void> {
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    let pageNum = 1;

    pdf.addImage(img, 'PNG', 0, position, pageWidth, imgHeight);
    this.addWatermark(pdf, pageNum);
    pageNum++;
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(img, 'PNG', 0, position, pageWidth, imgHeight);
      this.addWatermark(pdf, pageNum);
      pageNum++;
      heightLeft -= pageHeight;
    }

    pdf.save(`${fileName}.pdf`);
  }

  /** Add company name watermark and page number to PDF. */
  private addWatermark(pdf: jsPDF, pageNum: number): void {
    const company = this.company.activeCompany();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Company watermark at bottom center
    pdf.setFont('Helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(150, 150, 150);
    const text = company?.name ?? 'LedgerAI';
    const textWidth = pdf.getTextWidth(text);
    pdf.text(text, (pageWidth - textWidth) / 2, pageHeight - 8);

    // Page number
    pdf.setFontSize(9);
    pdf.text(`Page ${pageNum}`, pageWidth - 20, pageHeight - 8);
  }

  /** Export an array of plain objects to an .xlsx workbook. */
  toExcel<T extends Record<string, unknown>>(
    rows: T[],
    fileName = 'ledgerai-export',
    sheetName = 'Sheet1'
  ): void {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }

  /** Open the browser print dialog (CSS @media print controls the layout). */
  print(): void {
    window.print();
  }
}
