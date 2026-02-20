import { Component, JSX, splitProps } from "solid-js";

// Dangerous tags that should be completely removed
const DANGEROUS_TAGS = ['script', 'iframe', 'embed', 'object', 'style', 'link', 'meta', 'base', 'form'];

/**
 * Robust HTML sanitizer using DOM parsing for accurate sanitization.
 * Removes dangerous elements, event handlers, and malicious URLs.
 */
function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  // Create a temporary element for parsing
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Remove dangerous elements
  DANGEROUS_TAGS.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });
  
  // Remove event handlers and dangerous attributes from all elements
  doc.querySelectorAll('*').forEach(el => {
    // Remove all on* attributes (event handlers)
    Array.from(el.attributes).forEach(attr => {
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value.toLowerCase().trim();
      
      // Remove event handlers
      if (attrName.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      
      // Remove javascript: protocol in any attribute
      if (attrValue.includes('javascript:')) {
        el.removeAttribute(attr.name);
        return;
      }
      
      // Remove data: URLs except for images
      if (attrValue.startsWith('data:') && !attrValue.startsWith('data:image/')) {
        el.removeAttribute(attr.name);
        return;
      }
    });
    
    // Additional sanitization for href, src, and xlink:href
    ['href', 'src', 'xlink:href'].forEach(attr => {
      const val = el.getAttribute(attr);
      if (val) {
        const trimmedVal = val.trim().toLowerCase();
        if (trimmedVal.startsWith('javascript:') || 
            trimmedVal.startsWith('vbscript:') ||
            (trimmedVal.startsWith('data:') && !trimmedVal.startsWith('data:image/'))) {
          el.removeAttribute(attr);
        }
      }
    });
    
    // Remove expression() from style attributes (IE-specific XSS vector)
    const style = el.getAttribute('style');
    if (style && /expression\s*\(/i.test(style)) {
      el.setAttribute('style', style.replace(/expression\s*\([^)]*\)/gi, ''));
    }
  });
  
  return doc.body.innerHTML;
}

export interface SafeHTMLProps extends JSX.HTMLAttributes<HTMLDivElement> {
  html: string;
  tag?: 'div' | 'span' | 'p';
}

export const SafeHTML: Component<SafeHTMLProps> = (props) => {
  const [local, others] = splitProps(props, ['html', 'tag']);
  const tag = () => local.tag || 'div';
  const sanitizedHtml = () => sanitizeHTML(local.html);
  
  return (
    <div
      {...others}
      innerHTML={sanitizedHtml()}
      style={{
        display: tag() === 'span' ? 'inline' : 'block',
        ...((others as { style?: JSX.CSSProperties }).style || {}),
      }}
    />
  );
};

export default SafeHTML;
