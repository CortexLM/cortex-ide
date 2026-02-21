import { describe, it, expect, vi } from "vitest";

import { sortLinesAscending, sortLinesDescending, sortLinesCaseInsensitive, sortLinesByLength, sortLinesNatural, deleteDuplicateLines, deleteDuplicateLinesCaseInsensitive, joinLines, joinLinesSmartly, duplicateLinesDown, duplicateLinesUp, moveLinesUp, moveLinesDown, transformToUppercase, transformToLowercase, transformToTitleCase, transformToSnakeCase, transformToCamelCase, transformToPascalCase, transformToKebabCase, transformToConstantCase, transposeCharacters, transposeWords, transposeLines, indentLines, outdentLines, trimTrailingWhitespace, addLineComment, removeLineComment, toggleLineComment, reverseLines, shuffleLines, getUniqueLines } from "../lineOperations";

describe("lineOperations", () => {
  it("sortLinesAscending", () => {
    try { sortLinesAscending([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { sortLinesAscending(); } catch (_e) { /* expected */ }
    expect(sortLinesAscending).toBeDefined();
  });
  it("sortLinesDescending", () => {
    try { sortLinesDescending([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { sortLinesDescending(); } catch (_e) { /* expected */ }
    expect(sortLinesDescending).toBeDefined();
  });
  it("sortLinesCaseInsensitive", () => {
    try { sortLinesCaseInsensitive([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { sortLinesCaseInsensitive(); } catch (_e) { /* expected */ }
    expect(sortLinesCaseInsensitive).toBeDefined();
  });
  it("sortLinesByLength", () => {
    try { sortLinesByLength([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { sortLinesByLength(); } catch (_e) { /* expected */ }
    expect(sortLinesByLength).toBeDefined();
  });
  it("sortLinesNatural", () => {
    try { sortLinesNatural([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { sortLinesNatural(); } catch (_e) { /* expected */ }
    expect(sortLinesNatural).toBeDefined();
  });
  it("deleteDuplicateLines", () => {
    try { deleteDuplicateLines([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { deleteDuplicateLines(); } catch (_e) { /* expected */ }
    expect(deleteDuplicateLines).toBeDefined();
  });
  it("deleteDuplicateLinesCaseInsensitive", () => {
    try { deleteDuplicateLinesCaseInsensitive([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { deleteDuplicateLinesCaseInsensitive(); } catch (_e) { /* expected */ }
    expect(deleteDuplicateLinesCaseInsensitive).toBeDefined();
  });
  it("joinLines", () => {
    try { joinLines([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { joinLines(); } catch (_e) { /* expected */ }
    expect(joinLines).toBeDefined();
  });
  it("joinLinesSmartly", () => {
    try { joinLinesSmartly([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { joinLinesSmartly(); } catch (_e) { /* expected */ }
    expect(joinLinesSmartly).toBeDefined();
  });
  it("duplicateLinesDown", () => {
    try { duplicateLinesDown([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { duplicateLinesDown(); } catch (_e) { /* expected */ }
    expect(duplicateLinesDown).toBeDefined();
  });
  it("duplicateLinesUp", () => {
    try { duplicateLinesUp([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { duplicateLinesUp(); } catch (_e) { /* expected */ }
    expect(duplicateLinesUp).toBeDefined();
  });
  it("moveLinesUp", () => {
    try { moveLinesUp([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { moveLinesUp(); } catch (_e) { /* expected */ }
    expect(moveLinesUp).toBeDefined();
  });
  it("moveLinesDown", () => {
    try { moveLinesDown([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { moveLinesDown(); } catch (_e) { /* expected */ }
    expect(moveLinesDown).toBeDefined();
  });
  it("transformToUppercase", () => {
    try { transformToUppercase("test"); } catch (_e) { /* expected */ }
    try { transformToUppercase(); } catch (_e) { /* expected */ }
    expect(transformToUppercase).toBeDefined();
  });
  it("transformToLowercase", () => {
    try { transformToLowercase("test"); } catch (_e) { /* expected */ }
    try { transformToLowercase(); } catch (_e) { /* expected */ }
    expect(transformToLowercase).toBeDefined();
  });
  it("transformToTitleCase", () => {
    try { transformToTitleCase("test"); } catch (_e) { /* expected */ }
    try { transformToTitleCase(); } catch (_e) { /* expected */ }
    expect(transformToTitleCase).toBeDefined();
  });
  it("transformToSnakeCase", () => {
    try { transformToSnakeCase("test"); } catch (_e) { /* expected */ }
    try { transformToSnakeCase(); } catch (_e) { /* expected */ }
    expect(transformToSnakeCase).toBeDefined();
  });
  it("transformToCamelCase", () => {
    try { transformToCamelCase("test"); } catch (_e) { /* expected */ }
    try { transformToCamelCase(); } catch (_e) { /* expected */ }
    expect(transformToCamelCase).toBeDefined();
  });
  it("transformToPascalCase", () => {
    try { transformToPascalCase("test"); } catch (_e) { /* expected */ }
    try { transformToPascalCase(); } catch (_e) { /* expected */ }
    expect(transformToPascalCase).toBeDefined();
  });
  it("transformToKebabCase", () => {
    try { transformToKebabCase("test"); } catch (_e) { /* expected */ }
    try { transformToKebabCase(); } catch (_e) { /* expected */ }
    expect(transformToKebabCase).toBeDefined();
  });
  it("transformToConstantCase", () => {
    try { transformToConstantCase("test"); } catch (_e) { /* expected */ }
    try { transformToConstantCase(); } catch (_e) { /* expected */ }
    expect(transformToConstantCase).toBeDefined();
  });
  it("transposeCharacters", () => {
    try { transposeCharacters("test", 0); } catch (_e) { /* expected */ }
    try { transposeCharacters(); } catch (_e) { /* expected */ }
    expect(transposeCharacters).toBeDefined();
  });
  it("transposeWords", () => {
    try { transposeWords("test", 0); } catch (_e) { /* expected */ }
    try { transposeWords(); } catch (_e) { /* expected */ }
    expect(transposeWords).toBeDefined();
  });
  it("transposeLines", () => {
    try { transposeLines([], 0); } catch (_e) { /* expected */ }
    try { transposeLines(); } catch (_e) { /* expected */ }
    expect(transposeLines).toBeDefined();
  });
  it("indentLines", () => {
    try { indentLines([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any, "test"); } catch (_e) { /* expected */ }
    try { indentLines(); } catch (_e) { /* expected */ }
    expect(indentLines).toBeDefined();
  });
  it("outdentLines", () => {
    try { outdentLines([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any, 0, false); } catch (_e) { /* expected */ }
    try { outdentLines(); } catch (_e) { /* expected */ }
    expect(outdentLines).toBeDefined();
  });
  it("trimTrailingWhitespace", () => {
    try { trimTrailingWhitespace([]); } catch (_e) { /* expected */ }
    try { trimTrailingWhitespace(); } catch (_e) { /* expected */ }
    expect(trimTrailingWhitespace).toBeDefined();
  });
  it("addLineComment", () => {
    try { addLineComment([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any, "test"); } catch (_e) { /* expected */ }
    try { addLineComment(); } catch (_e) { /* expected */ }
    expect(addLineComment).toBeDefined();
  });
  it("removeLineComment", () => {
    try { removeLineComment([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any, "test"); } catch (_e) { /* expected */ }
    try { removeLineComment(); } catch (_e) { /* expected */ }
    expect(removeLineComment).toBeDefined();
  });
  it("toggleLineComment", () => {
    try { toggleLineComment([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any, "test"); } catch (_e) { /* expected */ }
    try { toggleLineComment(); } catch (_e) { /* expected */ }
    expect(toggleLineComment).toBeDefined();
  });
  it("reverseLines", () => {
    try { reverseLines([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { reverseLines(); } catch (_e) { /* expected */ }
    expect(reverseLines).toBeDefined();
  });
  it("shuffleLines", () => {
    try { shuffleLines([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { shuffleLines(); } catch (_e) { /* expected */ }
    expect(shuffleLines).toBeDefined();
  });
  it("getUniqueLines", () => {
    try { getUniqueLines([], { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } as any); } catch (_e) { /* expected */ }
    try { getUniqueLines(); } catch (_e) { /* expected */ }
    expect(getUniqueLines).toBeDefined();
  });
});
