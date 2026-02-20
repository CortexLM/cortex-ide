import { JSX } from "solid-js";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import type { SessionFilters as SessionFiltersType, SessionStatus } from "@/types/admin";

interface SessionFiltersProps {
  filters: SessionFiltersType;
  onChange: (filters: SessionFiltersType) => void;
}

export function SessionFilters(props: SessionFiltersProps) {
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-wrap": "wrap",
    gap: "12px",
    padding: "16px",
    background: "var(--surface-card)",
    "border-radius": "var(--jb-radius-lg)",
    border: "1px solid var(--border-default)",
    "margin-bottom": "16px",
  };

  const searchContainerStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "200px",
    position: "relative",
  };

  const searchIconStyle: JSX.CSSProperties = {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--text-muted)",
    "pointer-events": "none",
  };

  const searchInputStyle: JSX.CSSProperties = {
    "padding-left": "36px",
    width: "100%",
  };

  const selectContainerStyle: JSX.CSSProperties = {
    "min-width": "140px",
  };

  const handleSearchChange = (value: string) => {
    props.onChange({ ...props.filters, search: value, page: 1 });
  };

  const handleDateRangeChange = (value: string) => {
    props.onChange({
      ...props.filters,
      dateRange: value as SessionFiltersType["dateRange"],
      page: 1,
    });
  };

  const handleStatusChange = (value: string) => {
    props.onChange({
      ...props.filters,
      status: value as SessionStatus | "all",
      page: 1,
    });
  };

  const handleSortByChange = (value: string) => {
    props.onChange({
      ...props.filters,
      sortBy: value as SessionFiltersType["sortBy"],
    });
  };

  const handleSortOrderChange = (value: string) => {
    props.onChange({
      ...props.filters,
      sortOrder: value as "asc" | "desc",
    });
  };

  const dateRangeOptions = [
    { value: "all", label: "All time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
    { value: "custom", label: "Custom range" },
  ];

  const statusOptions = [
    { value: "all", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
    { value: "deleted", label: "Deleted" },
  ];

  const sortByOptions = [
    { value: "createdAt", label: "Created" },
    { value: "updatedAt", label: "Updated" },
    { value: "messageCount", label: "Messages" },
    { value: "totalTokens", label: "Tokens" },
  ];

  const sortOrderOptions = [
    { value: "desc", label: "Newest first" },
    { value: "asc", label: "Oldest first" },
  ];

  return (
    <div style={containerStyle}>
      <div style={searchContainerStyle}>
        <div style={searchIconStyle}>
          <Icon name="magnifying-glass" size={14} />
        </div>
        <Input
          type="text"
          placeholder="Search sessions..."
          value={props.filters.search}
          onInput={(e) => handleSearchChange(e.currentTarget.value)}
          style={searchInputStyle}
        />
      </div>
      
      <div style={selectContainerStyle}>
        <Select
          options={dateRangeOptions}
          value={props.filters.dateRange}
          onChange={handleDateRangeChange}
          placeholder="Date range"
        />
      </div>
      
      <div style={selectContainerStyle}>
        <Select
          options={statusOptions}
          value={props.filters.status}
          onChange={handleStatusChange}
          placeholder="Status"
        />
      </div>
      
      <div style={selectContainerStyle}>
        <Select
          options={sortByOptions}
          value={props.filters.sortBy}
          onChange={handleSortByChange}
          placeholder="Sort by"
        />
      </div>
      
      <div style={selectContainerStyle}>
        <Select
          options={sortOrderOptions}
          value={props.filters.sortOrder}
          onChange={handleSortOrderChange}
          placeholder="Order"
        />
      </div>
    </div>
  );
}
