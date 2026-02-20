import { For, Show, Switch, Match, JSX } from "solid-js";
import { Message, ToolCall, Attachment } from "@/context/SDKContext";
import { Markdown } from "../Markdown";
import { AgentStep } from "./AgentStep";
import { Icon } from "../ui/Icon";
import { QuestionsCard } from "../tools/QuestionsCard";

// ============================================================================
// CSS Variable-based Color Palette
// ============================================================================
const palette = {
  canvas: "var(--surface-base)",
  panel: "var(--surface-card)",
  inputCard: "var(--surface-input)",
  border: "var(--border-default)",
  borderSubtle: "var(--border-default)",
  textTitle: "var(--text-title)",
  textBody: "var(--text-primary)",
  textMuted: "var(--text-muted)",
  accent: "var(--text-placeholder)",
};

// ============================================================================
// NeonGridLoader Component - 3x3 Neon Grid with Snake Animation
// ============================================================================
function getSnakeDelay(index: number): number {
  const snakeOrder = [0, 1, 2, 5, 4, 3, 6, 7, 8];
  return snakeOrder.indexOf(index) * 100;
}

function NeonGridLoader() {
  // Simple white/gray loader - subtle and minimal
  const dotColor = "var(--text-muted, var(--cortex-text-secondary))";
  const dotColorActive = "var(--text-secondary, var(--cortex-text-primary))";
  
  return (
    <div style={{
      display: "grid",
      "grid-template-columns": "repeat(3, 1fr)",
      gap: "2px",
      width: "18px",
      height: "18px",
    }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          style={{
            width: "4px",
            height: "4px",
            "border-radius": "var(--cortex-radius-sm)",
            background: dotColor,
            opacity: "0.4",
            animation: `gridPulse 1.2s ease-in-out infinite`,
            "animation-delay": `${getSnakeDelay(i)}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes gridPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.9; background: ${dotColorActive}; }
        }
      `}</style>
    </div>
  );
}

// Try to parse JSON content that might be questions
function tryParseQuestionsJson(content: string): { isQuestions: boolean; data?: any; remainingText?: string } {
  // Look for JSON blocks that might contain questions
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.type === "questions" || (parsed.questions && Array.isArray(parsed.questions))) {
        const remainingText = content.replace(jsonMatch[0], "").trim();
        return { 
          isQuestions: true, 
          data: { ...parsed, type: "questions", status: parsed.status || "pending_answers" },
          remainingText 
        };
      }
    } catch (err) { console.debug("Question block parsing failed:", err); }
  }
  
  // Also check for raw JSON (not in code block)
  try {
    // Check if the entire content or a significant part is JSON
    const trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.includes('"questions"')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === "questions" || (parsed.questions && Array.isArray(parsed.questions))) {
        return { 
          isQuestions: true, 
          data: { ...parsed, type: "questions", status: parsed.status || "pending_answers" }
        };
      }
    }
  } catch (err) { console.debug("Raw JSON parsing failed:", err); }
  
  return { isQuestions: false };
}

interface AgentMessageProps {
  message: Message;
}

// User message style
const userMessageStyle: JSX.CSSProperties = {
  background: palette.inputCard,
  "border-radius": "var(--cortex-radius-lg)",
  padding: "12px 16px",
  color: palette.textBody,
  "max-width": "80%",
  "align-self": "flex-end",
};

// Assistant message style
const assistantMessageStyle: JSX.CSSProperties = {
  background: "transparent",
  "border-left": `2px solid ${palette.border}`,
  "padding-left": "16px",
  color: palette.textBody,
};

// Message content style
const contentStyle: JSX.CSSProperties = {
  "font-size": "14px",
  "line-height": "1.6",
  color: palette.textBody,
};

export function AgentMessage(props: AgentMessageProps) {
  const hasContent = () => props.message.parts.length > 0;
  const isUserMessage = () => props.message.role === "user";

  return (
    <div class="space-y-2 py-2">
      <Show when={!hasContent() && !props.message.reasoning}>
        {/* Use NeonGridLoader instead of skeleton when loading */}
        <div class="flex items-center gap-3 opacity-70">
          <NeonGridLoader />
          <span style={{ color: palette.textMuted, "font-size": "13px" }}>Thinking...</span>
        </div>
      </Show>

      <For each={props.message.parts}>
        {(part, index) => (
          <Switch>
            <Match when={part.type === "text"}>
              {(() => {
                const content = (part as { type: "text"; content: string }).content;
                const questionsResult = tryParseQuestionsJson(content);
                
                if (questionsResult.isQuestions && questionsResult.data) {
                  return (
                    <>
                      <Show when={questionsResult.remainingText}>
                        <div 
                          class="font-mono text-[13px] leading-relaxed max-w-full mb-4"
                          style={isUserMessage() ? userMessageStyle : assistantMessageStyle}
                        >
                          <Markdown content={questionsResult.remainingText!} />
                        </div>
                      </Show>
                      <QuestionsCard data={questionsResult.data} />
                    </>
                  );
                }
                
                return (
                  <div 
                    class="font-mono text-[13px] leading-relaxed max-w-full"
                    style={isUserMessage() ? userMessageStyle : { ...assistantMessageStyle, ...contentStyle }}
                  >
                    <Markdown content={content} />
                  </div>
                );
              })()}
            </Match>
            <Match when={part.type === "tool"}>
              <AgentStep 
                tool={(part as { type: "tool"; tool: ToolCall }).tool} 
                isLatest={index() === props.message.parts.length - 1}
              />
            </Match>
            <Match when={part.type === "attachment"}>
              <div class="my-2 flex flex-col gap-2">
                <div 
                  class="inline-flex items-center gap-2 px-3 py-2 rounded-lg max-w-sm"
                  style={{
                    border: `1px solid ${palette.borderSubtle}`,
                    background: palette.panel,
                  }}
                >
                  <Show 
                    when={(part as { type: "attachment"; attachment: Attachment }).attachment.type === "image"} 
                    fallback={<Icon name="file" class="w-4 h-4" style={{ color: palette.textMuted }} />}
                  >
                    <div class="w-12 h-12 rounded overflow-hidden bg-black/20 shrink-0">
                      <img 
                        src={(part as { type: "attachment"; attachment: Attachment }).attachment.content} 
                        class="w-full h-full object-cover" 
                      />
                    </div>
                  </Show>
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-medium truncate" style={{ color: palette.textBody }}>
                      {(part as { type: "attachment"; attachment: Attachment }).attachment.name}
                    </span>
                    <span class="text-[10px] truncate" style={{ color: palette.textMuted }}>
                      {(part as { type: "attachment"; attachment: Attachment }).attachment.path}
                    </span>
                  </div>
                </div>
                
                {/* Large image preview for user images */}
                <Show when={(part as { type: "attachment"; attachment: Attachment }).attachment.type === "image"}>
                  <div 
                    class="mt-2 rounded-lg overflow-hidden max-w-xl"
                    style={{
                      border: `1px solid ${palette.borderSubtle}`,
                      background: palette.panel,
                    }}
                  >
                    <img 
                      src={(part as { type: "attachment"; attachment: Attachment }).attachment.content} 
                      class="w-full h-auto max-h-[400px] object-contain" 
                    />
                  </div>
                </Show>
              </div>
            </Match>
          </Switch>
        )}
      </For>
      
      {/* Reasoning / Thinking block if present */}
      <Show when={props.message.reasoning}>
        <div 
          class="pl-4 my-4 py-1"
          style={{
            "border-left": "2px solid var(--state-warning-muted, rgba(245, 158, 11, 0.3))",
          }}
        >
          <div class="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "var(--state-warning-muted, rgba(245, 158, 11, 0.5))" }}>Thought Process</div>
          <div class="font-mono text-xs italic leading-relaxed" style={{ color: "var(--state-warning, rgba(245, 158, 11, 0.7))" }}>
            {props.message.reasoning}
          </div>
          {/* If thinking is happening but no output yet, show NeonGridLoader */}
          <Show when={!hasContent()}>
            <div class="mt-4">
              <NeonGridLoader />
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

