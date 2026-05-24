import { Injectable } from '@nestjs/common';
import { marked } from 'marked';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitize = require('sanitize-html') as (html: string, opts: object) => string;

@Injectable()
export class MarkdownRendererService {
  toHtml(markdown: string): string {
    const raw = marked.parse(markdown) as string;
    return sanitize(raw, {
      allowedTags: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'br'],
      allowedAttributes: {},
    });
  }
}
