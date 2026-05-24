import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import { PlanContract } from '../entities/plan-contract.entity';

@Injectable()
export class PdfGeneratorService {
  constructor(private readonly config: ConfigService) {}

  generate(contract: PlanContract): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 60 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const studioName = this.config.get<string>('STUDIO_NAME') ?? 'Studio';
      const isPreview = contract.status !== 'signed';

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text(studioName, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(new Date().toLocaleDateString('pt-BR'), { align: 'center' });
      doc.moveDown(1.5);

      if (isPreview) {
        this.addWatermark(doc);
      }

      // Body — parse HTML
      this.renderHtmlBody(doc, contract.renderedHtml ?? '');

      // Signature footer (only for signed contracts)
      if (!isPreview && contract.signatureImage && contract.signedAt) {
        this.addSignatureFooter(doc, contract);
      }

      doc.end();
    });
  }

  private renderHtmlBody(doc: PDFKit.PDFDocument, html: string): void {
    const fontStack: string[] = [];
    const currentFont = () => fontStack[fontStack.length - 1] ?? 'Helvetica';

    // Flatten tags to text with formatting
    const stripped = html.replace(/<[^>]+>/g, (tag) => {
      const m = tag.match(/^<(\/?)(h[1-3]|p|strong|em|li|ul|ol|br)\b/i);
      return m ? `\x00${tag}\x00` : '';
    });

    const parts = stripped.split('\x00').filter(Boolean);
    let listDepth = 0;

    for (const part of parts) {
      if (!part.startsWith('<')) {
        const text = part.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
        if (text) {
          doc.font(currentFont()).text(text, { continued: false });
        }
        continue;
      }

      const tag = part.replace(/<\/?([a-z0-9]+)[^>]*>/i, (_, t: string) => t.toLowerCase());
      const isClose = part.startsWith('</');

      if (!isClose) {
        if (tag === 'h1') { doc.moveDown(0.5); doc.fontSize(18).font('Helvetica-Bold'); fontStack.push('Helvetica-Bold'); }
        else if (tag === 'h2') { doc.moveDown(0.5); doc.fontSize(15).font('Helvetica-Bold'); fontStack.push('Helvetica-Bold'); }
        else if (tag === 'h3') { doc.moveDown(0.3); doc.fontSize(13).font('Helvetica-Bold'); fontStack.push('Helvetica-Bold'); }
        else if (tag === 'p') { doc.fontSize(11).font(currentFont()); }
        else if (tag === 'strong') { fontStack.push('Helvetica-Bold'); doc.font('Helvetica-Bold'); }
        else if (tag === 'em') { fontStack.push('Helvetica-Oblique'); doc.font('Helvetica-Oblique'); }
        else if (tag === 'ul' || tag === 'ol') { listDepth++; }
        else if (tag === 'li') { doc.fontSize(11).text('• ', { continued: true, indent: listDepth * 12 }); }
        else if (tag === 'br') { doc.moveDown(0.3); }
      } else {
        if (['h1', 'h2', 'h3', 'strong', 'em'].includes(tag)) {
          fontStack.pop();
          doc.fontSize(11).font(currentFont());
          doc.moveDown(0.5);
        } else if (tag === 'p') {
          doc.moveDown(0.5);
        } else if (tag === 'ul' || tag === 'ol') {
          listDepth = Math.max(0, listDepth - 1);
        }
      }
    }
  }

  private addSignatureFooter(doc: PDFKit.PDFDocument, contract: PlanContract): void {
    doc.moveDown(2);
    doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).stroke();
    doc.moveDown(1);

    // Signature image
    try {
      const base64 = contract.signatureImage!.replace(/^data:image\/png;base64,/, '');
      const imgBuf = Buffer.from(base64, 'base64');
      doc.image(imgBuf, { width: 200, height: 80 });
    } catch {
      // skip if image decode fails
    }

    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    const signedAt = contract.signedAt!.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    doc.text(`Assinado em: ${signedAt}`);

    if (contract.signerIp) doc.text(`IP: ${contract.signerIp}`);
    if (contract.signerGeoCity) doc.text(`Local: ${contract.signerGeoCity}${contract.signerGeoRegion ? `, ${contract.signerGeoRegion}` : ''}`);

    doc.fontSize(8).fillColor('gray');
    doc.text(`Hash SHA-256: ${contract.contentHash ?? ''}`);
    doc.fillColor('black');
  }

  private addWatermark(doc: PDFKit.PDFDocument): void {
    doc.save();
    doc.opacity(0.15);
    doc.fontSize(80).font('Helvetica-Bold').fillColor('gray');
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    doc.rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] });
    doc.text('PRÉVIA', pageWidth / 2 - 180, pageHeight / 2 - 50);
    doc.restore();
    doc.opacity(1).fillColor('black').font('Helvetica').fontSize(11);
  }
}
