import { createSignal, Show, For, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { Icon } from "../ui/Icon";
import { useSDK } from "@/context/SDKContext";
import { Button, Text, Badge, Input } from "@/components/ui";

interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  selected?: boolean;
}

interface Question {
  id: string;
  question: string;
  type: "single" | "multiple" | "text" | "number";
  options?: QuestionOption[];
  placeholder?: string;
  required?: boolean;
}

interface QuestionsData {
  type: "questions";
  title: string;
  description?: string;
  questions: Question[];
  status: "pending_answers" | "submitted";
}

interface QuestionsCardProps {
  data: QuestionsData;
}

type Answer = string | string[] | number;

export function QuestionsCard(props: QuestionsCardProps) {
  const { sendMessage } = useSDK();
  const [collapsed, setCollapsed] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);
  const [answers, setAnswers] = createStore<Record<string, Answer>>({});

  onMount(() => {
    for (const q of props.data.questions) {
      if (q.options) {
        const selected = q.options.find(opt => opt.selected);
        if (selected) {
          if (q.type === "single") {
            setAnswers(q.id, selected.value);
          } else if (q.type === "multiple") {
            setAnswers(q.id, q.options.filter(opt => opt.selected).map(opt => opt.value));
          }
        }
      }
    }
  });

  const isValid = () => {
    for (const q of props.data.questions) {
      if (q.required) {
        const answer = answers[q.id];
        if (q.type === "multiple") {
          if (!Array.isArray(answer) || answer.length === 0) return false;
        } else if (!answer || (typeof answer === "string" && !answer.trim())) {
          return false;
        }
      }
    }
    return true;
  };

  const handleSingleSelect = (questionId: string, value: string) => {
    setAnswers(questionId, value);
  };

  const handleMultipleToggle = (questionId: string, value: string) => {
    const current = (answers[questionId] as string[]) || [];
    if (current.includes(value)) {
      setAnswers(questionId, current.filter(v => v !== value));
    } else {
      setAnswers(questionId, [...current, value]);
    }
  };

  const handleTextInput = (questionId: string, value: string) => {
    setAnswers(questionId, value);
  };

  const handleSubmit = async () => {
    if (!isValid()) return;
    setSubmitted(true);

    const formattedAnswers = props.data.questions.map(q => {
      let answer = answers[q.id];
      if (Array.isArray(answer)) {
        answer = answer.join(", ");
      }
      return `**${q.question}**\n${answer || "Not answered"}`;
    }).join("\n\n");

    await sendMessage(`Here are my answers:\n\n${formattedAnswers}\n\nNow use the Plan tool to create a formal implementation plan that I can approve or reject.`);
  };

  return (
    <div class="my-1 font-mono">
      {/* Header */}
      <div 
        class="flex items-center gap-2 py-1 cursor-pointer rounded px-2 -ml-2 transition-colors"
        onClick={() => setCollapsed(!collapsed())}
        style={{ background: "transparent" }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <div class="w-4 flex justify-center" style={{ color: "var(--jb-text-muted-color)" }}>
          <Show when={collapsed()} fallback={<Icon name="chevron-down" class="w-3 h-3" />}>
            <Icon name="chevron-right" class="w-3 h-3" />
          </Show>
        </div>
        <Text size="sm" style={{ color: "var(--cortex-warning)", "font-family": "var(--jb-font-mono, monospace)" }}>
          {props.data.title}
        </Text>
        <Show when={submitted()}>
          <Badge variant="success" size="sm">submitted</Badge>
        </Show>
        <Show when={!submitted()}>
          <Text variant="muted" size="xs">{props.data.questions.length} questions</Text>
        </Show>
      </div>

      <Show when={!collapsed()}>
        <div class="ml-4 border-l pl-3 mt-1" style={{ "border-color": "var(--jb-border-default)" }}>
          {/* Description */}
          <Show when={props.data.description}>
            <Text variant="muted" size="xs" style={{ display: "block", "margin-bottom": "8px" }}>
              {props.data.description}
            </Text>
          </Show>

          {/* Questions */}
          <For each={props.data.questions}>
            {(question) => (
              <div class="mb-3">
                <Text size="sm" style={{ display: "block", "margin-bottom": "6px" }}>
                  {question.question}
                  <Show when={question.required}>
                    <span style={{ color: "var(--cortex-error)", "margin-left": "2px" }}>*</span>
                  </Show>
                </Text>

                {/* Single choice */}
                <Show when={question.type === "single" && question.options}>
                  <div class="space-y-1">
                    <For each={question.options}>
                      {(option) => (
                        <button
                          class="flex items-center gap-2 w-full text-left py-0.5 px-1 rounded transition-colors"
                          onClick={() => handleSingleSelect(question.id, option.value)}
                          disabled={submitted()}
                          style={{ background: "transparent" }}
                          onMouseEnter={(e) => !submitted() && (e.currentTarget.style.background = "var(--jb-surface-hover)")}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <div 
                            class="w-3 h-3 rounded-full border flex items-center justify-center shrink-0"
                            style={{ 
                              "border-color": answers[question.id] === option.value ? "var(--jb-border-focus)" : "var(--jb-border-default)",
                              background: answers[question.id] === option.value ? "var(--jb-border-focus)" : "transparent"
                            }}
                          >
                            <Show when={answers[question.id] === option.value}>
                              <div class="w-1.5 h-1.5 rounded-full bg-white" />
                            </Show>
                          </div>
                          <Text size="xs">{option.label}</Text>
                          <Show when={option.selected}>
                            <Badge variant="warning" size="sm">recommended</Badge>
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Multiple choice */}
                <Show when={question.type === "multiple" && question.options}>
                  <div class="space-y-1">
                    <For each={question.options}>
                      {(option) => {
                        const isSelected = () => ((answers[question.id] as string[]) || []).includes(option.value);
                        return (
                          <button
                            class="flex items-center gap-2 w-full text-left py-0.5 px-1 rounded transition-colors"
                            onClick={() => handleMultipleToggle(question.id, option.value)}
                            disabled={submitted()}
                            style={{ background: "transparent" }}
                            onMouseEnter={(e) => !submitted() && (e.currentTarget.style.background = "var(--jb-surface-hover)")}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <div 
                              class="w-3 h-3 rounded-sm border flex items-center justify-center shrink-0"
                              style={{ 
                                "border-color": isSelected() ? "var(--jb-border-focus)" : "var(--jb-border-default)",
                                background: isSelected() ? "var(--jb-border-focus)" : "transparent"
                              }}
                            >
                              <Show when={isSelected()}>
                                <Icon name="check" class="w-2 h-2 text-white" />
                              </Show>
                            </div>
                            <Text size="xs">{option.label}</Text>
                            <Show when={option.selected}>
                              <Badge variant="warning" size="sm">recommended</Badge>
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>

                {/* Text input */}
                <Show when={question.type === "text"}>
                  <Input
                    placeholder={question.placeholder || "Type here..."}
                    value={(answers[question.id] as string) || ""}
                    onInput={(e) => handleTextInput(question.id, e.currentTarget.value)}
                    disabled={submitted()}
                    style={{ "font-size": "12px" }}
                  />
                </Show>

                {/* Number input */}
                <Show when={question.type === "number"}>
                  <Input
                    type="number"
                    placeholder={question.placeholder || "0"}
                    value={(answers[question.id] as number) || ""}
                    onInput={(e) => handleTextInput(question.id, e.currentTarget.value)}
                    disabled={submitted()}
                    style={{ width: "100px", "font-size": "12px" }}
                  />
                </Show>
              </div>
            )}
          </For>

          {/* Submit button */}
          <Show when={!submitted()}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!isValid()}
              icon={<Icon name="check" class="w-3 h-3" />}
            >
              Submit
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
