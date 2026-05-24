import { MarkdownRendererService } from '../markdown-renderer.service';

describe('MarkdownRendererService', () => {
  let service: MarkdownRendererService;

  beforeEach(() => {
    service = new MarkdownRendererService();
  });

  it('renders markdown to HTML', () => {
    const html = service.toHtml('# Título\n\nParágrafo **negrito**.');
    expect(html).toContain('<h1>');
    expect(html).toContain('<strong>');
  });

  it('strips disallowed tags', () => {
    const html = service.toHtml('texto <script>alert(1)</script> fim');
    expect(html).not.toContain('<script>');
  });

  it('strips anchor tags', () => {
    const html = service.toHtml('[link](http://evil.com)');
    expect(html).not.toContain('<a ');
  });

  it('preserves allowed tags', () => {
    const html = service.toHtml('- item um\n- item dois');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
  });
});
