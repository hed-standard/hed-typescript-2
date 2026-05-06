/**
 * General utility types.
 * @module utils/types
 */

import isPlainObject from 'lodash/isPlainObject'

import type { Issue } from '../issues/issues'

/**
 * A generic constructor type.
 */
export type Constructor<Type> = {
  new (...args: unknown[]): Type
}

/**
 * Determine whether an object is an instance of a given constructor.
 *
 * @param object - An object.
 * @param constructor - A constructor.
 * @returns Whether the object is an instance of the constructor.
 */
export function instanceOfConstructor<Type>(object: unknown, constructor: Constructor<Type>): object is Type {
  return object instanceof constructor
}

/**
 * A generic recursive array type.
 */
export type RecursiveArray<Type> = Array<Type | RecursiveArray<Type>>

/**
 * A value returned alongside an Issue array.
 */
export type ReturnTupleWithIssues<Type> = [Type | null, Issue[]]

/**
 * A value returned alongside Issue arrays representing separated errors and warnings.
 */
export type ReturnTupleWithErrorsAndWarnings<Type> = [Type | null, Issue[], Issue[]]

/**
 * A pair of numbers used as substring bounds.
 */
export type Bounds = [number, number]

/**
 * Type guard for an ordered pair of numbers (e.g. bounds).
 *
 * @param value - A possible ordered pair of numbers.
 * @returns Whether the value is an ordered pair of number.
 */
export function isNumberPair(value: unknown): value is Bounds {
  return Array.isArray(value) && value.length === 2 && value.every((bound) => typeof bound === 'number')
}

/**
 * An arbitrary object parsed from JSON.
 */
export type JsonObject = Record<string, unknown>

/**
 * Type guard for a plain object (presumably parsed from a JSON string).
 *
 * @param value - A possible plain object.
 * @returns Whether the value is a plain JSON object.
 */
export function isJsonObject(value: unknown): value is JsonObject {
  return isPlainObject(value) && Object.getOwnPropertySymbols(value).length === 0
}

/**
 * Type guard for a plain string record.
 *
 * @param value - A possible plain object.
 * @returns Whether the value is a plain string record.
 */
export function isStringRecord(value: unknown): value is Record<string, string> {
  return isJsonObject(value) && Object.values(value).every((objectValue) => typeof objectValue === 'string')
}

/**
 * Exception with an errno field.
 *
 * Borrowed from {@link https://www.npmjs.com/package/@types/node \@types/node} for compatibility reasons.
 */
export interface ErrnoException extends Error {
  errno?: number
  code?: string
  path?: string
  syscall?: string
}
