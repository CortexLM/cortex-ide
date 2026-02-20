import { createMemo, onMount } from "solid-js";
import { marked } from "marked";
import { SafeHTML } from "./ui/SafeHTML";

interface MarkdownProps {
  content: string;
}

// ============================================================================
// Performance: Cached HTML escaper using a reusable element
// ============================================================================
let escapeElement: HTMLDivElement | null = null;

function escapeHtml(text: string): string {
  if (!escapeElement) {
    escapeElement = document.createElement("div");
  }
  escapeElement.textContent = text;
  return escapeElement.innerHTML;
}

// ============================================================================
// Performance: Singleton renderer to avoid recreation
// ============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedRenderer: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCustomRenderer(): any {
  if (cachedRenderer) {
    return cachedRenderer;
  }
  
  const renderer = new marked.Renderer();
  
  renderer.code = function(code: string | { text: string; lang?: string }, language?: string) {
    // Handle both old and new marked API
    const text = typeof code === 'object' ? code.text : code;
    const lang = typeof code === 'object' ? code.lang : language;
    
    const escapedCode = escapeHtml(text);
    const langClass = lang ? `language-${lang}` : '';
    const langLabel = lang || 'code';
    
    // Generate unique ID for this code block
    const codeId = `code-${Math.random().toString(36).slice(2, 9)}`;
    
    return `
      <div class="code-block-wrapper group relative">
        <div class="code-block-header">
          <span class="code-block-lang">${langLabel}</span>
          <button 
            class="code-block-copy" 
            data-code-id="${codeId}"
            title="Copy code"
          >
            <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <svg class="check-icon hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>
        <pre class="${langClass}"><code id="${codeId}" class="${langClass}">${escapedCode}</code></pre>
      </div>
    `;
  };
  
  cachedRenderer = renderer;
  return renderer;
}

export function Markdown(props: MarkdownProps) {
  let containerRef: HTMLDivElement | undefined;

  const html = createMemo(() => {
    try {
      const renderer = getCustomRenderer();
      const result = marked.parse(props.content, { 
        gfm: true, 
        breaks: true,
        renderer 
      });
      return typeof result === "string" ? result : "";
    } catch {
      return `<p>${escapeHtml(props.content)}</p>`;
    }
  });

  // Setup copy handlers after mount and when html changes
  const setupCopyHandlers = () => {
    if (!containerRef) return;
    
    const copyButtons = containerRef.querySelectorAll('.code-block-copy');
    copyButtons.forEach((button) => {
      // Remove old listeners by cloning
      const newButton = button.cloneNode(true) as HTMLElement;
      button.parentNode?.replaceChild(newButton, button);
      
      newButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const codeId = newButton.getAttribute('data-code-id');
        if (!codeId) return;
        
        const codeElement = containerRef?.querySelector(`#${codeId}`);
        if (!codeElement) return;
        
        const text = codeElement.textContent || '';
        
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Fallback for older browsers
          const textarea = document.createElement("textarea");
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        
        // Show check icon
        const copyIcon = newButton.querySelector('.copy-icon');
        const checkIcon = newButton.querySelector('.check-icon');
        if (copyIcon && checkIcon) {
          copyIcon.classList.add('hidden');
          checkIcon.classList.remove('hidden');
          
          setTimeout(() => {
            copyIcon.classList.remove('hidden');
            checkIcon.classList.add('hidden');
          }, 2000);
        }
      });
    });
  };

  onMount(() => {
    setupCopyHandlers();
  });

  // Re-setup handlers when content changes
  const renderedHtml = () => {
    const result = html();
    // Schedule handler setup after DOM update
    setTimeout(setupCopyHandlers, 0);
    return result;
  };

  return (
    <SafeHTML
      ref={containerRef}
      html={renderedHtml()}
      class="markdown-content prose prose-invert max-w-none"
    />
  );
}
