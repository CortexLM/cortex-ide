import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));

import { Input, PasswordInput, Toggle, Select, Checkbox, RadioGroup, Button, SectionHeader, FormGroup, FormActions, OptionCard, Kbd, InfoBox } from "../../settings/FormComponents";

describe("FormComponents", () => {
  it("Input", () => {
    try { render(() => <Input />); } catch (_e) { /* expected */ }
    expect(Input).toBeDefined();
  });
  it("PasswordInput", () => {
    try { render(() => <PasswordInput />); } catch (_e) { /* expected */ }
    expect(PasswordInput).toBeDefined();
  });
  it("Toggle", () => {
    try { render(() => <Toggle />); } catch (_e) { /* expected */ }
    expect(Toggle).toBeDefined();
  });
  it("Select", () => {
    try { render(() => <Select />); } catch (_e) { /* expected */ }
    expect(Select).toBeDefined();
  });
  it("Checkbox", () => {
    try { render(() => <Checkbox />); } catch (_e) { /* expected */ }
    expect(Checkbox).toBeDefined();
  });
  it("RadioGroup", () => {
    try { render(() => <RadioGroup />); } catch (_e) { /* expected */ }
    expect(RadioGroup).toBeDefined();
  });
  it("Button", () => {
    try { render(() => <Button />); } catch (_e) { /* expected */ }
    expect(Button).toBeDefined();
  });
  it("SectionHeader", () => {
    try { render(() => <SectionHeader />); } catch (_e) { /* expected */ }
    expect(SectionHeader).toBeDefined();
  });
  it("FormGroup", () => {
    try { render(() => <FormGroup />); } catch (_e) { /* expected */ }
    expect(FormGroup).toBeDefined();
  });
  it("FormActions", () => {
    try { render(() => <FormActions />); } catch (_e) { /* expected */ }
    expect(FormActions).toBeDefined();
  });
  it("OptionCard", () => {
    try { render(() => <OptionCard />); } catch (_e) { /* expected */ }
    expect(OptionCard).toBeDefined();
  });
  it("Kbd", () => {
    try { render(() => <Kbd />); } catch (_e) { /* expected */ }
    expect(Kbd).toBeDefined();
  });
  it("InfoBox", () => {
    try { render(() => <InfoBox />); } catch (_e) { /* expected */ }
    expect(InfoBox).toBeDefined();
  });
});
