/**
 * =============================================================================
 * SETTINGS VALIDATION - JSON Schema Validation for Cortex IDE Settings
 * =============================================================================
 * 
 * Provides comprehensive JSON Schema validation and type coercion for settings.
 * Supports:
 * - Full JSON Schema draft-07 validation
 * - Type coercion (string to number, string to boolean, etc.)
 * - Detailed error reporting with paths
 * - Deprecation warnings
 * - Settings JSON parsing with error recovery
 * 
 * =============================================================================
 */

// ============================================================================
// JSON Schema Types
// ============================================================================

/** JSON Schema definition (draft-07 compatible) */
export interface JSONSchema {
  /** Type constraint */
  type?: string | string[];
  /** Enumeration of allowed values */
  enum?: unknown[];
  /** Exact value match */
  const?: unknown;
  /** Minimum value (inclusive) for numbers */
  minimum?: number;
  /** Maximum value (inclusive) for numbers */
  maximum?: number;
  /** Minimum value (exclusive) for numbers */
  exclusiveMinimum?: number;
  /** Maximum value (exclusive) for numbers */
  exclusiveMaximum?: number;
  /** Number must be divisible by this value */
  multipleOf?: number;
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;
  /** Regex pattern for strings */
  pattern?: string;
  /** Format validation (e.g., 'email', 'uri', 'date') */
  format?: string;
  /** Schema for array items */
  items?: JSONSchema | JSONSchema[];
  /** Minimum array length */
  minItems?: number;
  /** Maximum array length */
  maxItems?: number;
  /** Array items must be unique */
  uniqueItems?: boolean;
  /** Object property schemas */
  properties?: Record<string, JSONSchema>;
  /** Required property names */
  required?: string[];
  /** Allow additional properties */
  additionalProperties?: boolean | JSONSchema;
  /** Pattern-based property schemas */
  patternProperties?: Record<string, JSONSchema>;
  /** Value must match any of these schemas */
  anyOf?: JSONSchema[];
  /** Value must match exactly one of these schemas */
  oneOf?: JSONSchema[];
  /** Value must match all of these schemas */
  allOf?: JSONSchema[];
  /** Value must NOT match this schema */
  not?: JSONSchema;
  /** Conditional schema - if condition */
  if?: JSONSchema;
  /** Conditional schema - then clause */
  then?: JSONSchema;
  /** Conditional schema - else clause */
  else?: JSONSchema;
  /** Default value */
  default?: unknown;
  /** Human-readable description */
  description?: string;
  /** Deprecation message */
  deprecationMessage?: string;
  /** Custom error message */
  errorMessage?: string;
  /** Markdown description for documentation */
  markdownDescription?: string;
}

// ============================================================================
// Validation Result Types
// ============================================================================

/** Result of validating a value against a schema */
export interface ValidationResult {
  /** Whether the value is valid */
  valid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
  /** List of warnings (deprecation, coercion info) */
  warnings: ValidationWarning[];
  /** The value after type coercion (if applicable) */
  coercedValue?: unknown;
}

/** A validation error */
export interface ValidationError {
  /** JSON path to the invalid value (e.g., "editor.tabSize") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** The schema that was violated */
  schema: JSONSchema;
  /** The actual value that failed validation */
  value: unknown;
}

/** A validation warning */
export interface ValidationWarning {
  /** JSON path to the value */
  path: string;
  /** Warning message */
  message: string;
  /** Type of warning */
  type: 'deprecation' | 'coercion' | 'info';
}

// ============================================================================
// Format Validators
// ============================================================================

/** Built-in format validators */
const FORMAT_VALIDATORS: Record<string, (value: string) => boolean> = {
  'email': (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  'uri': (v) => {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  },
  'uri-reference': (v) => {
    try {
      new URL(v, 'http://example.com');
      return true;
    } catch {
      return false;
    }
  },
  'date': (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)),
  'date-time': (v) => !isNaN(Date.parse(v)),
  'time': (v) => /^\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(v),
  'hostname': (v) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(v),
  'ipv4': (v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) && v.split('.').every(n => parseInt(n) <= 255),
  'ipv6': (v) => /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v) || /^(([0-9a-fA-F]{1,4}:)*)?::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/.test(v),
  'uuid': (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
  'color': (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v),
  'regex': (v) => {
    try {
      new RegExp(v);
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the JavaScript type name for a value
 */
function getTypeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Create an empty validation result
 */
function createEmptyResult(): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}

/**
 * Create an error result
 */
function createErrorResult(
  path: string,
  message: string,
  schema: JSONSchema,
  value: unknown
): ValidationResult {
  return {
    valid: false,
    errors: [{ path, message, schema, value }],
    warnings: [],
  };
}

/**
 * Merge multiple validation results into one
 */
function mergeResults(...results: ValidationResult[]): ValidationResult {
  const merged: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  for (const result of results) {
    if (!result.valid) {
      merged.valid = false;
    }
    merged.errors.push(...result.errors);
    merged.warnings.push(...result.warnings);
  }

  return merged;
}

/**
 * Build a path string from parent path and key
 */
function buildPath(parent: string, key: string | number): string {
  if (parent === '') {
    return typeof key === 'number' ? `[${key}]` : key;
  }
  return typeof key === 'number' ? `${parent}[${key}]` : `${parent}.${key}`;
}

// ============================================================================
// Type Validation
// ============================================================================

/**
 * Validate that a value matches the expected type(s)
 */
function validateType(value: unknown, type: string | string[]): boolean {
  const types = Array.isArray(type) ? type : [type];
  const actualType = getTypeName(value);

  for (const t of types) {
    switch (t) {
      case 'string':
        if (typeof value === 'string') return true;
        break;
      case 'number':
        if (typeof value === 'number' && !isNaN(value)) return true;
        break;
      case 'integer':
        if (typeof value === 'number' && Number.isInteger(value)) return true;
        break;
      case 'boolean':
        if (typeof value === 'boolean') return true;
        break;
      case 'array':
        if (Array.isArray(value)) return true;
        break;
      case 'object':
        if (actualType === 'object') return true;
        break;
      case 'null':
        if (value === null) return true;
        break;
    }
  }

  return false;
}

// ============================================================================
// Number Validation
// ============================================================================

/**
 * Validate number constraints (minimum, maximum, multipleOf, etc.)
 */
function validateNumber(value: number, schema: JSONSchema, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push({
      path,
      message: `Value ${value} is less than minimum ${schema.minimum}`,
      schema,
      value,
    });
  }

  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push({
      path,
      message: `Value ${value} is greater than maximum ${schema.maximum}`,
      schema,
      value,
    });
  }

  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    errors.push({
      path,
      message: `Value ${value} must be greater than ${schema.exclusiveMinimum}`,
      schema,
      value,
    });
  }

  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    errors.push({
      path,
      message: `Value ${value} must be less than ${schema.exclusiveMaximum}`,
      schema,
      value,
    });
  }

  if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
    errors.push({
      path,
      message: `Value ${value} is not a multiple of ${schema.multipleOf}`,
      schema,
      value,
    });
  }

  return errors;
}

// ============================================================================
// String Validation
// ============================================================================

/**
 * Validate string constraints (minLength, maxLength, pattern, format)
 */
function validateString(value: string, schema: JSONSchema, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push({
      path,
      message: `String length ${value.length} is less than minimum ${schema.minLength}`,
      schema,
      value,
    });
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push({
      path,
      message: `String length ${value.length} is greater than maximum ${schema.maxLength}`,
      schema,
      value,
    });
  }

  if (schema.pattern !== undefined) {
    try {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String does not match pattern "${schema.pattern}"`,
          schema,
          value,
        });
      }
    } catch {
      errors.push({
        path,
        message: `Invalid regex pattern in schema: "${schema.pattern}"`,
        schema,
        value,
      });
    }
  }

  if (schema.format !== undefined) {
    const validator = FORMAT_VALIDATORS[schema.format];
    if (validator && !validator(value)) {
      errors.push({
        path,
        message: `String does not match format "${schema.format}"`,
        schema,
        value,
      });
    }
  }

  return errors;
}

// ============================================================================
// Array Validation
// ============================================================================

/**
 * Validate array constraints and items
 */
function validateArray(
  value: unknown[],
  schema: JSONSchema,
  path: string
): ValidationResult {
  const result = createEmptyResult();

  // Check minItems
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    result.valid = false;
    result.errors.push({
      path,
      message: `Array length ${value.length} is less than minimum ${schema.minItems}`,
      schema,
      value,
    });
  }

  // Check maxItems
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    result.valid = false;
    result.errors.push({
      path,
      message: `Array length ${value.length} is greater than maximum ${schema.maxItems}`,
      schema,
      value,
    });
  }

  // Check uniqueItems
  if (schema.uniqueItems) {
    const seen = new Set<string>();
    for (let i = 0; i < value.length; i++) {
      const serialized = JSON.stringify(value[i]);
      if (seen.has(serialized)) {
        result.valid = false;
        result.errors.push({
          path: buildPath(path, i),
          message: `Duplicate item found at index ${i}`,
          schema,
          value: value[i],
        });
        break;
      }
      seen.add(serialized);
    }
  }

  // Validate items
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      // Tuple validation
      for (let i = 0; i < Math.min(value.length, schema.items.length); i++) {
        const itemResult = validateSetting(value[i], schema.items[i], buildPath(path, i));
        const merged = mergeResults(result, itemResult);
        result.valid = merged.valid;
        result.errors = merged.errors;
        result.warnings = merged.warnings;
      }
    } else {
      // All items must match the same schema
      for (let i = 0; i < value.length; i++) {
        const itemResult = validateSetting(value[i], schema.items, buildPath(path, i));
        const merged = mergeResults(result, itemResult);
        result.valid = merged.valid;
        result.errors = merged.errors;
        result.warnings = merged.warnings;
      }
    }
  }

  return result;
}

// ============================================================================
// Object Validation
// ============================================================================

/**
 * Validate object constraints and properties
 */
function validateObject(
  value: Record<string, unknown>,
  schema: JSONSchema,
  path: string
): ValidationResult {
  const result = createEmptyResult();

  // Check required properties
  if (schema.required) {
    for (const requiredProp of schema.required) {
      if (!(requiredProp in value)) {
        result.valid = false;
        result.errors.push({
          path: buildPath(path, requiredProp),
          message: `Missing required property "${requiredProp}"`,
          schema,
          value,
        });
      }
    }
  }

  // Validate known properties
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (propName in value) {
        const propResult = validateSetting(
          value[propName],
          propSchema,
          buildPath(path, propName)
        );
        const merged = mergeResults(result, propResult);
        result.valid = merged.valid;
        result.errors = merged.errors;
        result.warnings = merged.warnings;
      }
    }
  }

  // Validate pattern properties
  if (schema.patternProperties) {
    for (const [pattern, patternSchema] of Object.entries(schema.patternProperties)) {
      try {
        const regex = new RegExp(pattern);
        for (const propName of Object.keys(value)) {
          if (regex.test(propName)) {
            const propResult = validateSetting(
              value[propName],
              patternSchema,
              buildPath(path, propName)
            );
            const merged = mergeResults(result, propResult);
            result.valid = merged.valid;
            result.errors = merged.errors;
            result.warnings = merged.warnings;
          }
        }
      } catch {
        // Invalid pattern, skip
      }
    }
  }

  // Check additional properties
  if (schema.additionalProperties !== undefined) {
    const knownProps = new Set(Object.keys(schema.properties ?? {}));
    const patternRegexes = Object.keys(schema.patternProperties ?? {}).map(p => {
      try {
        return new RegExp(p);
      } catch {
        return null;
      }
    }).filter(Boolean) as RegExp[];

    for (const propName of Object.keys(value)) {
      // Skip known properties
      if (knownProps.has(propName)) continue;

      // Skip pattern-matched properties
      if (patternRegexes.some(r => r.test(propName))) continue;

      // This is an additional property
      if (schema.additionalProperties === false) {
        result.valid = false;
        result.errors.push({
          path: buildPath(path, propName),
          message: `Additional property "${propName}" is not allowed`,
          schema,
          value: value[propName],
        });
      } else if (typeof schema.additionalProperties === 'object') {
        const propResult = validateSetting(
          value[propName],
          schema.additionalProperties,
          buildPath(path, propName)
        );
        const merged = mergeResults(result, propResult);
        result.valid = merged.valid;
        result.errors = merged.errors;
        result.warnings = merged.warnings;
      }
    }
  }

  return result;
}

// ============================================================================
// Enum Validation
// ============================================================================

/**
 * Validate that a value is one of the allowed enum values
 */
function validateEnum(value: unknown, enumValues: unknown[]): boolean {
  for (const enumVal of enumValues) {
    if (value === enumVal) return true;
    // Deep equality check for objects/arrays
    if (typeof value === 'object' && typeof enumVal === 'object') {
      if (JSON.stringify(value) === JSON.stringify(enumVal)) return true;
    }
  }
  return false;
}

// ============================================================================
// Combinators (anyOf, oneOf, allOf, not)
// ============================================================================

/**
 * Validate anyOf - value must match at least one schema
 */
function validateAnyOf(
  value: unknown,
  schemas: JSONSchema[],
  path: string
): ValidationResult {
  for (const subSchema of schemas) {
    const result = validateSetting(value, subSchema, path);
    if (result.valid) {
      return result;
    }
  }

  return createErrorResult(
    path,
    'Value does not match any of the allowed schemas',
    { anyOf: schemas },
    value
  );
}

/**
 * Validate oneOf - value must match exactly one schema
 */
function validateOneOf(
  value: unknown,
  schemas: JSONSchema[],
  path: string
): ValidationResult {
  let matchCount = 0;
  let lastValidResult: ValidationResult | null = null;

  for (const subSchema of schemas) {
    const result = validateSetting(value, subSchema, path);
    if (result.valid) {
      matchCount++;
      lastValidResult = result;
    }
  }

  if (matchCount === 0) {
    return createErrorResult(
      path,
      'Value does not match any of the allowed schemas',
      { oneOf: schemas },
      value
    );
  }

  if (matchCount > 1) {
    return createErrorResult(
      path,
      `Value matches ${matchCount} schemas but should match exactly one`,
      { oneOf: schemas },
      value
    );
  }

  return lastValidResult!;
}

/**
 * Validate allOf - value must match all schemas
 */
function validateAllOf(
  value: unknown,
  schemas: JSONSchema[],
  path: string
): ValidationResult {
  const results: ValidationResult[] = [];

  for (const subSchema of schemas) {
    results.push(validateSetting(value, subSchema, path));
  }

  return mergeResults(...results);
}

/**
 * Validate not - value must NOT match the schema
 */
function validateNot(
  value: unknown,
  schema: JSONSchema,
  path: string
): ValidationResult {
  const result = validateSetting(value, schema, path);

  if (result.valid) {
    return createErrorResult(
      path,
      'Value should not match the specified schema',
      { not: schema },
      value
    );
  }

  return createEmptyResult();
}

// ============================================================================
// Conditional Validation (if/then/else)
// ============================================================================

/**
 * Validate conditional schemas (if/then/else)
 */
function validateConditional(
  value: unknown,
  schema: JSONSchema,
  path: string
): ValidationResult {
  if (!schema.if) {
    return createEmptyResult();
  }

  const ifResult = validateSetting(value, schema.if, path);

  if (ifResult.valid) {
    // If condition matched, validate against "then" schema
    if (schema.then) {
      return validateSetting(value, schema.then, path);
    }
  } else {
    // If condition didn't match, validate against "else" schema
    if (schema.else) {
      return validateSetting(value, schema.else, path);
    }
  }

  return createEmptyResult();
}

// ============================================================================
// Type Coercion
// ============================================================================

/**
 * Attempt to coerce a string to a number
 */
function coerceToNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const num = Number(trimmed);
  if (!isNaN(num)) return num;

  return undefined;
}

/**
 * Attempt to coerce a string to a boolean
 */
function coerceToBoolean(value: string): boolean | undefined {
  const lower = value.toLowerCase().trim();

  if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') {
    return false;
  }

  return undefined;
}

/**
 * Coerce a value to match the expected type in the schema
 */
export function coerceValue(
  value: unknown,
  schema: JSONSchema
): { success: boolean; value: unknown } {
  // If no type specified, no coercion needed
  if (!schema.type) {
    return { success: true, value };
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];

  // Check if value already matches
  if (validateType(value, schema.type)) {
    return { success: true, value };
  }

  // Try to coerce string to other types
  if (typeof value === 'string') {
    // String to number
    if (types.includes('number') || types.includes('integer')) {
      const num = coerceToNumber(value);
      if (num !== undefined) {
        if (types.includes('integer') && !Number.isInteger(num)) {
          return { success: false, value };
        }
        return { success: true, value: num };
      }
    }

    // String to boolean
    if (types.includes('boolean')) {
      const bool = coerceToBoolean(value);
      if (bool !== undefined) {
        return { success: true, value: bool };
      }
    }

    // String to null
    if (types.includes('null') && value.toLowerCase().trim() === 'null') {
      return { success: true, value: null };
    }

    // String to array (JSON parse)
    if (types.includes('array')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return { success: true, value: parsed };
        }
      } catch {
        // Not valid JSON
      }
    }

    // String to object (JSON parse)
    if (types.includes('object')) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return { success: true, value: parsed };
        }
      } catch {
        // Not valid JSON
      }
    }
  }

  // Try to coerce number to string
  if (typeof value === 'number' && types.includes('string')) {
    return { success: true, value: String(value) };
  }

  // Try to coerce boolean to string
  if (typeof value === 'boolean' && types.includes('string')) {
    return { success: true, value: String(value) };
  }

  // Try to coerce number to boolean
  if (typeof value === 'number' && types.includes('boolean')) {
    return { success: true, value: value !== 0 };
  }

  // No coercion possible
  return { success: false, value };
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a value against a JSON Schema
 * 
 * @param value - The value to validate
 * @param schema - The JSON Schema to validate against
 * @param path - The path to the value (for error messages), defaults to empty string
 * @returns Validation result with errors, warnings, and optionally a coerced value
 */
export function validateSetting(
  value: unknown,
  schema: JSONSchema,
  path: string = ''
): ValidationResult {
  const result = createEmptyResult();
  let currentValue = value;

  // Check for deprecation
  if (schema.deprecationMessage) {
    result.warnings.push({
      path,
      message: schema.deprecationMessage,
      type: 'deprecation',
    });
  }

  // Handle const
  if (schema.const !== undefined) {
    if (currentValue !== schema.const && JSON.stringify(currentValue) !== JSON.stringify(schema.const)) {
      const message = schema.errorMessage ?? `Value must be ${JSON.stringify(schema.const)}`;
      return mergeResults(result, createErrorResult(path, message, schema, currentValue));
    }
  }

  // Handle enum
  if (schema.enum !== undefined) {
    if (!validateEnum(currentValue, schema.enum)) {
      const message = schema.errorMessage ?? `Value must be one of: ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`;
      return mergeResults(result, createErrorResult(path, message, schema, currentValue));
    }
  }

  // Handle type validation with coercion
  if (schema.type !== undefined) {
    if (!validateType(currentValue, schema.type)) {
      // Try coercion
      const coerced = coerceValue(currentValue, schema);
      if (coerced.success) {
        currentValue = coerced.value;
        result.coercedValue = coerced.value;
        result.warnings.push({
          path,
          message: `Value coerced from ${getTypeName(value)} to ${getTypeName(coerced.value)}`,
          type: 'coercion',
        });
      } else {
        const expectedTypes = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
        const message = schema.errorMessage ?? `Expected ${expectedTypes} but got ${getTypeName(currentValue)}`;
        return mergeResults(result, createErrorResult(path, message, schema, currentValue));
      }
    }
  }

  // Type-specific validation
  const actualType = getTypeName(currentValue);

  if ((actualType === 'number' || (schema.type && (schema.type === 'integer' || (Array.isArray(schema.type) && schema.type.includes('integer'))))) && typeof currentValue === 'number') {
    const numberErrors = validateNumber(currentValue, schema, path);
    for (const err of numberErrors) {
      result.valid = false;
      result.errors.push(err);
    }
  }

  if (actualType === 'string' && typeof currentValue === 'string') {
    const stringErrors = validateString(currentValue, schema, path);
    for (const err of stringErrors) {
      result.valid = false;
      result.errors.push(err);
    }
  }

  if (actualType === 'array' && Array.isArray(currentValue)) {
    const arrayResult = validateArray(currentValue, schema, path);
    const merged = mergeResults(result, arrayResult);
    result.valid = merged.valid;
    result.errors = merged.errors;
    result.warnings.push(...arrayResult.warnings);
  }

  if (actualType === 'object' && typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)) {
    const objectResult = validateObject(currentValue as Record<string, unknown>, schema, path);
    const merged = mergeResults(result, objectResult);
    result.valid = merged.valid;
    result.errors = merged.errors;
    result.warnings.push(...objectResult.warnings);
  }

  // Combinators
  if (schema.anyOf) {
    const anyOfResult = validateAnyOf(currentValue, schema.anyOf, path);
    const merged = mergeResults(result, anyOfResult);
    result.valid = merged.valid;
    result.errors = merged.errors;
    result.warnings.push(...anyOfResult.warnings);
  }

  if (schema.oneOf) {
    const oneOfResult = validateOneOf(currentValue, schema.oneOf, path);
    const merged = mergeResults(result, oneOfResult);
    result.valid = merged.valid;
    result.errors = merged.errors;
    result.warnings.push(...oneOfResult.warnings);
  }

  if (schema.allOf) {
    const allOfResult = validateAllOf(currentValue, schema.allOf, path);
    const merged = mergeResults(result, allOfResult);
    result.valid = merged.valid;
    result.errors = merged.errors;
    result.warnings.push(...allOfResult.warnings);
  }

  if (schema.not) {
    const notResult = validateNot(currentValue, schema.not, path);
    const merged = mergeResults(result, notResult);
    result.valid = merged.valid;
    result.errors = merged.errors;
    result.warnings.push(...notResult.warnings);
  }

  // Conditional
  if (schema.if) {
    const conditionalResult = validateConditional(currentValue, schema, path);
    const merged = mergeResults(result, conditionalResult);
    result.valid = merged.valid;
    result.errors = merged.errors;
    result.warnings.push(...conditionalResult.warnings);
  }

  // Set coerced value if we have one and the result is valid
  if (result.valid && result.coercedValue === undefined && currentValue !== value) {
    result.coercedValue = currentValue;
  }

  return result;
}

// ============================================================================
// Settings JSON Formatting
// ============================================================================

/**
 * Format a settings object as pretty-printed JSON
 * 
 * @param settings - The settings object to format
 * @param indent - Number of spaces for indentation (default: 2)
 * @returns Formatted JSON string
 */
export function formatSettingsJSON(
  settings: Record<string, unknown>,
  indent: number = 2
): string {
  return JSON.stringify(settings, null, indent);
}

// ============================================================================
// Settings JSON Parsing with Error Recovery
// ============================================================================

/** JSON parse error with position information */
interface JSONParseError {
  line: number;
  column: number;
  message: string;
}

/**
 * Parse a JSON string with detailed error reporting and recovery attempts
 * 
 * @param json - The JSON string to parse
 * @returns Parse result with value or detailed errors
 */
export function parseSettingsJSON(json: string): {
  success: boolean;
  value?: Record<string, unknown>;
  errors?: JSONParseError[];
} {
  // Try standard JSON parse first
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return { success: true, value: parsed };
    }
    return {
      success: false,
      errors: [{ line: 1, column: 1, message: 'Settings must be a JSON object' }],
    };
  } catch (e) {
    // Parse the error to extract position
    const errorMessage = e instanceof Error ? e.message : String(e);
    const positionInfo = extractErrorPosition(json, errorMessage);

    // Try to recover by stripping comments
    const stripped = stripJSONComments(json);
    if (stripped !== json) {
      try {
        const parsed = JSON.parse(stripped);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return { success: true, value: parsed };
        }
      } catch {
        // Continue to error reporting
      }
    }

    // Try to recover by fixing trailing commas
    const fixedTrailing = fixTrailingCommas(stripped);
    if (fixedTrailing !== stripped) {
      try {
        const parsed = JSON.parse(fixedTrailing);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return { success: true, value: parsed };
        }
      } catch {
        // Continue to error reporting
      }
    }

    return {
      success: false,
      errors: [positionInfo],
    };
  }
}

/**
 * Extract line and column from a JSON parse error message
 */
function extractErrorPosition(json: string, errorMessage: string): JSONParseError {
  // Try to extract position from error message
  // Common format: "... at position 123"
  const positionMatch = errorMessage.match(/position\s+(\d+)/i);
  
  if (positionMatch) {
    const position = parseInt(positionMatch[1], 10);
    const { line, column } = getLineAndColumn(json, position);
    return { line, column, message: errorMessage };
  }

  // Common format: "... at line 5 column 10"
  const lineColMatch = errorMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
      message: errorMessage,
    };
  }

  // Default to beginning of document
  return { line: 1, column: 1, message: errorMessage };
}

/**
 * Convert a character position to line and column numbers
 */
function getLineAndColumn(text: string, position: number): { line: number; column: number } {
  let line = 1;
  let column = 1;

  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
}

/**
 * Strip JavaScript-style comments from JSON (for JSONC support)
 */
function stripJSONComments(json: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < json.length) {
    const char = json[i];
    const nextChar = json[i + 1];

    // Handle string boundaries
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      result += char;
      i++;
      continue;
    }

    if (inString && char === stringChar && json[i - 1] !== '\\') {
      inString = false;
      result += char;
      i++;
      continue;
    }

    // Pass through string content
    if (inString) {
      result += char;
      i++;
      continue;
    }

    // Handle // comments
    if (char === '/' && nextChar === '/') {
      // Skip to end of line
      while (i < json.length && json[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Handle /* */ comments
    if (char === '/' && nextChar === '*') {
      i += 2;
      while (i < json.length - 1 && !(json[i] === '*' && json[i + 1] === '/')) {
        i++;
      }
      i += 2; // Skip */
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Fix trailing commas in JSON (common mistake)
 */
function fixTrailingCommas(json: string): string {
  // Remove trailing commas before ] or }
  return json.replace(/,(\s*[}\]])/g, '$1');
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate multiple settings against their schemas
 */
export function validateSettings(
  settings: Record<string, unknown>,
  schemas: Record<string, JSONSchema>
): ValidationResult {
  const results: ValidationResult[] = [];

  for (const [key, value] of Object.entries(settings)) {
    const schema = schemas[key];
    if (schema) {
      results.push(validateSetting(value, schema, key));
    }
  }

  return mergeResults(...results);
}

/**
 * Get default value from schema, with recursive handling for objects
 */
export function getSchemaDefault(schema: JSONSchema): unknown {
  if (schema.default !== undefined) {
    return schema.default;
  }

  // For objects, build default from property defaults
  if (schema.type === 'object' && schema.properties) {
    const defaults: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propDefault = getSchemaDefault(propSchema);
      if (propDefault !== undefined) {
        defaults[key] = propDefault;
      }
    }
    return Object.keys(defaults).length > 0 ? defaults : undefined;
  }

  // For arrays, return empty array if no default
  if (schema.type === 'array') {
    return [];
  }

  return undefined;
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  validateSetting,
  validateSettings,
  coerceValue,
  formatSettingsJSON,
  parseSettingsJSON,
  getSchemaDefault,
};
