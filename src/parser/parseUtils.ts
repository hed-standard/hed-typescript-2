/**
 * This module holds utilities for parsing HED strings.
 * @module parser/parseUtils
 */

import ParsedHedTag from './parsedHedTag'
import { type Constructor, instanceOfConstructor } from '../utils/types'

/**
 * Extract the items of a specified subtype from a list of ParsedHedSubstring.
 *
 * @param items - Objects to be filtered by class type.
 * @param classType - The class type to filter by.
 * @returns A list of objects of the specified subclass of ParsedHedSubstring.
 */
export function filterByClass<C>(items: unknown[], classType: Constructor<C>): C[] {
  return items?.filter((item) => instanceOfConstructor(item, classType)) ?? []
}

/**
 * Extract the ParsedHedTag tags with a specified tag name
 *
 * @param tags - to be filtered by name
 * @param tagName - name of the tag to filter by
 * @returns A list of tags with the name {}
 */
export function filterByTagName(tags: ParsedHedTag[], tagName: string): ParsedHedTag[] {
  return tags?.filter((tag) => tag.schemaTag?.name === tagName) ?? []
}

/**
 * Extract the ParsedHedTag tags with a specified tag name.
 *
 * @param tagMap - The Map of parsed HED tags for extraction (must be defined).
 * @param tagNames - The names to use as keys for the filter.
 * @returns A list of temporal tags.
 */
export function filterTagMapByNames(tagMap: Map<string, ParsedHedTag[]>, tagNames: string[]): ParsedHedTag[] {
  if (!tagNames || tagMap.size === 0) {
    return []
  }

  const keys = tagNames.filter((name) => tagMap.has(name))
  if (keys.length === 0) {
    return []
  }

  return keys.flatMap((key) => tagMap.get(key) ?? [])
}

/**
 * Convert a list of ParsedHedTag objects into a comma-separated string of their string representations.
 *
 * @param tagList - The HED tags whose string representations should be put in a comma-separated list.
 * @returns A comma separated list of original tag names for tags in tagList.
 */
export function getTagListString(tagList: ParsedHedTag[]): string {
  return tagList.map((tag) => tag.toString()).join(', ')
}

/**
 * Create a map of the ParsedHedTags by type.
 *
 * @param tagList - The HED tags to be categorized.
 * @param tagNames - The tag names to use as categories.
 * @returns A map of tag name to a list of tags with that name.
 */
export function categorizeTagsByName(
  tagList: ParsedHedTag[],
  tagNames: Set<string> | null = null,
): Map<string, ParsedHedTag[]> {
  // Initialize the map with keys from tagNames and an "other" key
  const resultMap = new Map<string, ParsedHedTag[]>()

  // Iterate through A and categorize
  for (const tag of tagList) {
    if (!tagNames || tagNames.has(tag.schemaTag.name)) {
      const tagList = resultMap.get(tag.schemaTag.name) ?? []
      tagList.push(tag)
      resultMap.set(tag.schemaTag.name, tagList) // Add to matching key list
    }
  }

  return resultMap
}

/**
 * Return a list of duplicates.
 *
 * @param itemList - A list of items in which to look for duplicates.
 * @returns A list of unique duplicates (multiple copies not repeated).
 */
export function getDuplicates<T>(itemList: T[]): T[] {
  const checkSet = new Set<T>()
  const dupSet = new Set<T>()

  for (const item of itemList) {
    if (!checkSet.has(item)) {
      checkSet.add(item)
    } else {
      dupSet.add(item)
    }
  }

  return [...dupSet]
}

/**
 * Clean up a string and remove redundant commas and parentheses.
 *
 * @param stringIn - The input string to be cleaned up.
 * @return The cleaned-up string with redundant commas and parentheses removed.
 */
export function cleanupEmpties(stringIn: string): string {
  const leadingCommaRegEx = /^\s*,+/g // Remove leading commas
  const trailingCommaRegEx = /,\s*$/g // Remove trailing commas
  const innerCommaRegEx = /,\s*,+/g // Collapse multiple commas inside
  const emptyParensRegEx = /\(\s*\)/g // Remove completely empty parentheses
  // const redundantParensRegEx = /\(\s*([,\s]*)\s*\)/g // Remove redundant empty-like parens
  const trailingInnerCommaRegEx = /[\s,]+\)/g // Remove trailing commas and spaces inside parentheses

  let result = stringIn
  let previousResult: string

  do {
    previousResult = result

    // Step 1: Remove empty parentheses
    result = result.replace(emptyParensRegEx, '')

    // Step 2: Remove redundant parentheses containing only commas/spaces
    // TODO: Does this step do anything?
    /* result = result.replace(redundantParensRegEx, (match, group1: string) => {
      return /^[,\s()]*$/.test(group1) ? '' : `(${group1.replace(/^\s*,|,\s*$/g, '').trim()})`
    }) */

    // Step 3: Remove leading and trailing commas
    result = result.replace(leadingCommaRegEx, '')
    result = result.replace(trailingCommaRegEx, '')

    // Step 4: Collapse multiple commas inside
    result = result.replace(innerCommaRegEx, ',')

    // Step 5: Remove trailing commas inside parentheses
    result = result.replace(trailingInnerCommaRegEx, ')')
  } while (result !== previousResult) // Keep looping until no more changes

  result = result.replace(/\(\s*,+/g, '(')
  return result.trim()
}
