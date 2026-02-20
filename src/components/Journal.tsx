import { createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { useJournal, type JournalEntry } from "@/context/JournalContext";
import { Icon } from "./ui/Icon";
import { SafeHTML } from "./ui/SafeHTML";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEntry: boolean;
}

function getCalendarDays(year: number, month: number, entryDates: Set<string>): CalendarDay[] {
  const days: CalendarDay[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  
  const startDayOfWeek = firstDay.getDay();
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      hasEntry: entryDates.has(formatDateKey(date)),
    });
  }
  
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      hasEntry: entryDates.has(formatDateKey(date)),
    });
  }
  
  const remainingDays = 42 - days.length;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      hasEntry: entryDates.has(formatDateKey(date)),
    });
  }
  
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function highlightSearchTerm(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(regex, "<mark class=\"bg-yellow-500/30\">$1</mark>");
}

function getExcerpt(content: string, query: string, maxLength: number = 150): string {
  if (!query) {
    return content.slice(0, maxLength) + (content.length > maxLength ? "..." : "");
  }
  
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);
  
  if (index === -1) {
    return content.slice(0, maxLength) + (content.length > maxLength ? "..." : "");
  }
  
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + query.length + 100);
  let excerpt = content.slice(start, end);
  
  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt = excerpt + "...";
  
  return highlightSearchTerm(excerpt, query);
}

export function JournalPanel() {
  const journal = useJournal();
  const [activeTab, setActiveTab] = createSignal<"calendar" | "search">("calendar");
  const [searchInput, setSearchInput] = createSignal("");
  const [entryDatesForMonth, setEntryDatesForMonth] = createSignal<Set<string>>(new Set());
  const [showTemplateMenu, setShowTemplateMenu] = createSignal(false);
  let searchInputRef: HTMLInputElement | undefined;
  let editorRef: HTMLTextAreaElement | undefined;

  createEffect(async () => {
    const date = journal.state.selectedDate;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    const dates = await journal.getEntriesForMonth(year, month);
    const dateSet = new Set(dates.map(formatDateKey));
    setEntryDatesForMonth(dateSet);
  });

  const calendarDays = () => {
    const date = journal.state.selectedDate;
    return getCalendarDays(date.getFullYear(), date.getMonth(), entryDatesForMonth());
  };

  const handleDayClick = async (day: CalendarDay) => {
    await journal.openEntry(day.date);
  };

  const handleSearch = async () => {
    const query = searchInput();
    if (query.trim()) {
      await journal.searchEntries(query);
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    } else if (e.key === "Escape") {
      journal.clearSearch();
      setSearchInput("");
    }
  };

  const handleSave = async () => {
    if (journal.state.currentEntry) {
      await journal.saveEntry(journal.state.currentEntry);
    }
  };

  const handleDelete = async () => {
    if (journal.state.currentEntry) {
      if (confirm("Are you sure you want to delete this journal entry?")) {
        await journal.deleteEntry(journal.state.currentEntry);
      }
    }
  };

  const handleEditorKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  };

  const handleNewEntry = async (templateId?: string) => {
    setShowTemplateMenu(false);
    await journal.createEntry(journal.state.selectedDate, templateId);
    journal.setShowJournalPanel(true);
  };

  const handleOpenResult = async (entry: JournalEntry) => {
    await journal.openEntry(entry.date);
    setActiveTab("calendar");
  };

  const appendTimeHeading = () => {
    if (!journal.state.currentEntry || !editorRef) return;
    
    const content = journal.state.currentEntry.content;
    const heading = `\n\n# ${journal.formatTime(new Date())}\n\n`;
    
    const cursorPos = editorRef.selectionStart;
    const newContent = content.slice(0, cursorPos) + heading + content.slice(cursorPos);
    
    journal.updateEntryContent(newContent);
    
    setTimeout(() => {
      if (editorRef) {
        editorRef.selectionStart = editorRef.selectionEnd = cursorPos + heading.length;
        editorRef.focus();
      }
    }, 0);
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        journal.openTodayEntry();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={journal.state.showJournalPanel}>
      <div
        class="fixed inset-0 z-[90] flex items-center justify-center"
        onClick={() => journal.setShowJournalPanel(false)}
      >
        <div class="absolute inset-0 bg-black/50" />
        
        <div
          class="relative flex w-[900px] max-w-[90vw] h-[700px] max-h-[85vh] rounded-lg shadow-2xl overflow-hidden"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left sidebar - Calendar/Search */}
          <div
            class="w-[320px] flex flex-col border-r shrink-0"
            style={{ "border-color": "var(--border-weak)" }}
          >
            {/* Tabs */}
            <div
              class="flex border-b"
              style={{ "border-color": "var(--border-weak)" }}
            >
              <button
                class="flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                style={{
                  color: activeTab() === "calendar" ? "var(--text-base)" : "var(--text-weak)",
                  "border-bottom": activeTab() === "calendar" ? "2px solid var(--accent-primary)" : "2px solid transparent",
                }}
                onClick={() => setActiveTab("calendar")}
              >
                <Icon name="calendar" class="w-4 h-4" />
                Calendar
              </button>
              <button
                class="flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                style={{
                  color: activeTab() === "search" ? "var(--text-base)" : "var(--text-weak)",
                  "border-bottom": activeTab() === "search" ? "2px solid var(--accent-primary)" : "2px solid transparent",
                }}
                onClick={() => setActiveTab("search")}
              >
                <Icon name="magnifying-glass" class="w-4 h-4" />
                Search
              </button>
            </div>

            <Show when={activeTab() === "calendar"}>
              {/* Calendar header */}
              <div class="p-3 flex items-center justify-between">
                <button
                  class="p-1.5 rounded hover:bg-white/10 transition-colors"
                  onClick={() => journal.navigateMonth(-1)}
                >
                  <Icon name="chevron-left" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
                </button>
                
                <div class="text-center">
                  <span class="font-medium" style={{ color: "var(--text-base)" }}>
                    {MONTHS[journal.state.selectedDate.getMonth()]} {journal.state.selectedDate.getFullYear()}
                  </span>
                </div>
                
                <button
                  class="p-1.5 rounded hover:bg-white/10 transition-colors"
                  onClick={() => journal.navigateMonth(1)}
                >
                  <Icon name="chevron-right" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
                </button>
              </div>

              {/* Quick navigation */}
              <div class="px-3 pb-2 flex justify-center">
                <button
                  class="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                  style={{ color: "var(--accent-primary)" }}
                  onClick={() => {
                    journal.goToToday();
                    journal.openTodayEntry();
                  }}
                >
                  Today
                </button>
              </div>

              {/* Calendar grid */}
              <div class="px-3">
                <div class="grid grid-cols-7 gap-1 mb-1">
                  <For each={DAYS_OF_WEEK}>
                    {(day) => (
                      <div
                        class="text-center text-xs py-1"
                        style={{ color: "var(--text-weak)" }}
                      >
                        {day}
                      </div>
                    )}
                  </For>
                </div>
                
                <div class="grid grid-cols-7 gap-1">
                  <For each={calendarDays()}>
                    {(day) => (
                      <button
                        class="relative aspect-square rounded-md text-sm transition-colors flex items-center justify-center"
                        style={{
                          color: day.isCurrentMonth ? "var(--text-base)" : "var(--text-weak)",
                          background: day.isToday
                            ? "var(--accent-primary)"
                            : isSameDay(day.date, journal.state.selectedDate)
                            ? "var(--surface-active)"
                            : "transparent",
                        }}
                        classList={{
                          "hover:bg-white/10": !day.isToday && !isSameDay(day.date, journal.state.selectedDate),
                        }}
                        onClick={() => handleDayClick(day)}
                      >
                        {day.date.getDate()}
                        <Show when={day.hasEntry}>
                          <div
                            class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                            style={{ background: day.isToday ? "white" : "var(--accent-primary)" }}
                          />
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* New entry button */}
              <div class="p-3 mt-auto">
                <div class="relative">
                  <button
                    class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    style={{
                      background: "var(--accent-primary)",
                      color: "white",
                    }}
                    onClick={() => setShowTemplateMenu(!showTemplateMenu())}
                  >
                    <Icon name="plus" class="w-4 h-4" />
                    New Entry
                    <Icon name="chevron-down" class="w-4 h-4" />
                  </button>
                  
                  <Show when={showTemplateMenu()}>
                    <div
                      class="absolute bottom-full left-0 right-0 mb-1 rounded-md shadow-lg overflow-hidden"
                      style={{ background: "var(--surface-raised)" }}
                    >
                      <For each={journal.state.templates}>
                        {(template) => (
                          <button
                            class="w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors"
                            style={{ color: "var(--text-base)" }}
                            onClick={() => handleNewEntry(template.id)}
                          >
                            {template.name}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            <Show when={activeTab() === "search"}>
              {/* Search input */}
              <div class="p-3">
                <div
                  class="flex items-center gap-2 px-3 py-2 rounded-md"
                  style={{ background: "var(--background-base)" }}
                >
                  <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search journal entries..."
                    class="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: "var(--text-base)" }}
                    value={searchInput()}
                    onInput={(e) => setSearchInput(e.currentTarget.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  <Show when={searchInput()}>
                    <button
                      class="p-0.5 rounded hover:bg-white/10"
                      onClick={() => {
                        setSearchInput("");
                        journal.clearSearch();
                      }}
                    >
                      <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    </button>
                  </Show>
                </div>
              </div>

              {/* Search results */}
              <div class="flex-1 overflow-y-auto">
                <Show when={journal.state.isSearching}>
                  <div class="p-4 text-center">
                    <div class="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full mx-auto" style={{ color: "var(--accent-primary)" }} />
                    <p class="text-sm mt-2" style={{ color: "var(--text-weak)" }}>Searching...</p>
                  </div>
                </Show>
                
                <Show when={!journal.state.isSearching && journal.state.searchQuery && journal.state.searchResults.length === 0}>
                  <div class="p-4 text-center">
                    <p class="text-sm" style={{ color: "var(--text-weak)" }}>No entries found</p>
                  </div>
                </Show>
                
                <Show when={!journal.state.isSearching && journal.state.searchResults.length > 0}>
                  <div class="p-2">
                    <p class="text-xs px-2 py-1 mb-1" style={{ color: "var(--text-weak)" }}>
                      {journal.state.searchResults.length} result{journal.state.searchResults.length !== 1 ? "s" : ""}
                    </p>
                    <For each={journal.state.searchResults}>
                      {(entry) => (
                        <button
                          class="w-full p-2 rounded-md text-left hover:bg-white/5 transition-colors"
                          onClick={() => handleOpenResult(entry)}
                        >
                          <div class="flex items-center gap-2 mb-1">
                            <Icon name="file-lines" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                            <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                              {formatDisplayDate(entry.date)}
                            </span>
                          </div>
                          <SafeHTML
                            html={getExcerpt(entry.content, journal.state.searchQuery)}
                            tag="p"
                            class="text-xs line-clamp-2 pl-6"
                            style={{ color: "var(--text-weak)" }}
                          />
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Right side - Editor */}
          <div class="flex-1 flex flex-col min-w-0">
            {/* Editor header */}
            <div
              class="flex items-center justify-between px-4 py-3 border-b"
              style={{ "border-color": "var(--border-weak)" }}
            >
              <div class="flex items-center gap-3 min-w-0">
                <Show when={journal.state.currentEntry}>
                  <Icon name="file-lines" class="w-5 h-5 shrink-0" style={{ color: "var(--text-weak)" }} />
                  <div class="min-w-0">
                    <h2
                      class="font-medium truncate"
                      style={{ color: "var(--text-base)" }}
                    >
                      {formatDisplayDate(journal.state.currentEntry!.date)}
                    </h2>
                    <p class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                      {journal.state.currentEntry!.path}
                    </p>
                  </div>
                  <Show when={journal.state.currentEntry?.modified}>
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}
                    >
                      Modified
                    </span>
                  </Show>
                </Show>
              </div>
              
              <div class="flex items-center gap-1">
                <button
                  class="p-2 rounded hover:bg-white/10 transition-colors"
                  title="Add time heading"
                  onClick={appendTimeHeading}
                  disabled={!journal.state.currentEntry}
                >
                  <Icon name="clock" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                </button>
                <button
                  class="p-2 rounded hover:bg-white/10 transition-colors"
                  title="Save (Ctrl+S)"
                  onClick={handleSave}
                  disabled={!journal.state.currentEntry}
                >
                  <Icon name="floppy-disk" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                </button>
                <button
                  class="p-2 rounded hover:bg-white/10 transition-colors"
                  title="Delete entry"
                  onClick={handleDelete}
                  disabled={!journal.state.currentEntry}
                >
                  <Icon name="trash" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                </button>
                <button
                  class="p-2 rounded hover:bg-white/10 transition-colors ml-2"
                  title="Close"
                  onClick={() => journal.setShowJournalPanel(false)}
                >
                  <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
                </button>
              </div>
            </div>

            {/* Editor content */}
            <div class="flex-1 overflow-hidden">
              <Show
                when={journal.state.currentEntry}
                fallback={
                  <div class="h-full flex items-center justify-center">
                    <div class="text-center">
                      <Icon name="calendar" class="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-weak)" }} />
                      <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                        Select a date or create a new entry
                      </p>
                    </div>
                  </div>
                }
              >
                <Show
                  when={journal.state.isLoading}
                  fallback={
                    <textarea
                      ref={editorRef}
                      class="w-full h-full p-4 resize-none outline-none font-mono text-sm"
                      style={{
                        background: "transparent",
                        color: "var(--text-base)",
                      }}
                      value={journal.state.currentEntry?.content || ""}
                      onInput={(e) => journal.updateEntryContent(e.currentTarget.value)}
                      onKeyDown={handleEditorKeyDown}
                      placeholder="Start writing..."
                    />
                  }
                >
                  <div class="h-full flex items-center justify-center">
                    <div class="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" style={{ color: "var(--accent-primary)" }} />
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

export function JournalQuickOpen() {
  const journal = useJournal();

  return (
    <button
      class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors hover:bg-white/10"
      style={{ color: "var(--text-weak)" }}
      onClick={() => journal.openTodayEntry()}
      title="Open Today's Journal (Ctrl+Alt+J)"
    >
      <Icon name="calendar" class="w-4 h-4" />
      <span class="hidden lg:inline">Journal</span>
    </button>
  );
}
