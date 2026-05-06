/**
 * This module holds contains the classes for basic HED parsing.
 * @module parser/parser
 */

import { DefinitionChecker } from './definitionChecker'
import { type DefinitionManager } from './definitionManager'
import ParsedHedString from './parsedHedString'
import { ReservedChecker } from './reservedChecker'
import HedStringSplitter from './splitter'
import { generateIssue, type Issue } from '../issues/issues'
import { type HedSchemas } from '../schema/containers'
import { type ReturnTupleWithErrorsAndWarnings } from '../utils/types'

/**
 * A parser for HED strings.
 */
class HedStringParser {
  /**
   * The HED string being parsed.
   */
  readonly hedString: string | ParsedHedString

  /**
   * The collection of HED schemas.
   */
  readonly hedSchemas: HedSchemas

  /**
   * True if definitions are allowed in this string.
   */
  readonly definitionsAllowed: boolean

  /**
   * True if placeholders are allowed in this string.
   */
  readonly placeholdersAllowed: boolean

  /**
   * Constructor.
   *
   * @param hedString - The HED string to be parsed.
   * @param hedSchemas - The collection of HED schemas.
   * @param definitionsAllowed - True if definitions are allowed
   * @param placeholdersAllowed - True if placeholders are allowed
   */
  public constructor(
    hedString: string | ParsedHedString,
    hedSchemas: HedSchemas,
    definitionsAllowed: boolean,
    placeholdersAllowed: boolean,
  ) {
    this.hedString = hedString
    this.hedSchemas = hedSchemas
    this.definitionsAllowed = definitionsAllowed
    this.placeholdersAllowed = placeholdersAllowed
  }

  /**
   * Parse a full HED string.
   *
   * @param fullValidation - True if full validation should be performed -- with assembly
   *
   * @remarks Now separates errors and warnings for easier handling.
   *
   * @returns A tuple representing the parsed HED string and any parsing issues.
   */
  public parse(fullValidation: boolean): ReturnTupleWithErrorsAndWarnings<ParsedHedString> {
    if (this.hedString === null || this.hedString === undefined) {
      return [null, [generateIssue('invalidTagString', {})], []]
    }

    const placeholderIssues = this._getPlaceholderCountIssues()
    if (placeholderIssues.length > 0) {
      return [null, placeholderIssues, []]
    }
    if (this.hedString instanceof ParsedHedString) {
      return [this.hedString, [], []]
    }
    if (!this.hedSchemas) {
      return [null, [generateIssue('missingSchemaSpecification', {})], []]
    }

    // This assumes that splitter errors are only errors and not warnings
    const [parsedTags, parsingIssues] = new HedStringSplitter(this.hedString, this.hedSchemas).splitHedString()
    if (parsedTags === null || parsingIssues.length > 0) {
      return [null, parsingIssues, []]
    }

    // Returns a parsed HED string unless empty
    const parsedString = new ParsedHedString(this.hedString, parsedTags)
    if (!parsedString) {
      return [null, [], []]
    }

    // Check the definition syntax issues
    const definitionIssues = new DefinitionChecker(parsedString).check(this.definitionsAllowed)
    if (definitionIssues.length > 0) {
      return [null, definitionIssues, []]
    }

    // Check the other reserved tags requirements
    const checkIssues = ReservedChecker.getInstance().checkHedString(parsedString, fullValidation)
    if (checkIssues.length > 0) {
      return [null, checkIssues, []]
    }

    // Warnings are only checked when there are no fatal errors
    return [parsedString, [], this._getWarnings(parsedString)]
  }

  /**
   * Parse a full HED string in a standalone context, such as in the HED column of a BIDS tabular file.
   *
   * @param defManager - The definition manager to use for parsing definitions.
   * @returns A tuple representing the parsed HED string and any parsing issues.
   */
  public parseStandalone(
    defManager: DefinitionManager | null = null,
  ): ReturnTupleWithErrorsAndWarnings<ParsedHedString> {
    // Find basic parsing issues and return if unable to parse the string. (Warnings are okay.)
    const [parsedString, errorIssues, warningIssues] = this.parse(true)

    if (parsedString !== null && parsedString.columnSplices.length > 0) {
      errorIssues.push(generateIssue('curlyBracesInHedColumn', { string: parsedString.hedString }))
    }
    if (errorIssues.length === 0 && parsedString && defManager) {
      errorIssues.push(...defManager.validateDefs(parsedString, this.hedSchemas, false))
      errorIssues.push(...defManager.validateDefExpands(parsedString, this.hedSchemas, false))
    }
    if (errorIssues.length > 0) {
      return [null, errorIssues, warningIssues]
    }
    return [parsedString, errorIssues, warningIssues]
  }

  /**
   * Get warnings applicable for a parsed HED string.
   *
   * @param parsedString - HED string object to check for warnings.
   * @returns Warnings for the parsed HED string
   */
  private _getWarnings(parsedString: ParsedHedString): Issue[] {
    const warnings = []
    // Check for deprecated
    const deprecatedTags = parsedString.tags.filter((tag) => tag.isDeprecated)
    if (deprecatedTags.length > 0) {
      const deprecated = deprecatedTags.map((tag) => tag.toString())
      warnings.push(
        generateIssue('deprecatedTag', { tags: '[' + deprecated.join(', ') + ']', string: parsedString.hedString }),
      )
    }
    // Check for tag extensions
    const extendedTags = parsedString.tags.filter((tag) => tag.isExtended)
    if (extendedTags.length > 0) {
      const extended = extendedTags.map((tag) => tag.toString())
      warnings.push(
        generateIssue('extendedTag', { tags: '[' + extended.join(', ') + ']', string: parsedString.hedString }),
      )
    }
    return warnings
  }

  /**
   * If placeholders are not allowed and the string has placeholders, return an issue.
   *
   * @returns Issues due to unwanted placeholders.
   */
  private _getPlaceholderCountIssues(): Issue[] {
    if (this.placeholdersAllowed) {
      return []
    }
    const checkString = this.hedString instanceof ParsedHedString ? this.hedString.hedString : this.hedString
    if (checkString.split('#').length > 1) {
      return [generateIssue('invalidPlaceholderContext', { string: checkString })]
    }
    return []
  }

  /**
   * Parse a list of HED strings.
   *
   * @param hedStrings - A list of HED strings.
   * @param hedSchemas - The collection of HED schemas.
   * @param definitionsAllowed - True if definitions are allowed
   * @param placeholdersAllowed - True if placeholders are allowed
   * @param fullValidation - True if full validation is required.
   * @returns A tuple representing the parsed HED strings and any errors and warnings.
   */
  public static parseHedStrings(
    hedStrings: string[] | ParsedHedString[],
    hedSchemas: HedSchemas,
    definitionsAllowed: boolean,
    placeholdersAllowed: boolean,
    fullValidation: boolean,
  ): ReturnTupleWithErrorsAndWarnings<ParsedHedString[]> {
    if (!hedSchemas) {
      return [null, [generateIssue('missingSchemaSpecification', {})], []]
    }
    const parsedStrings = []
    const errors = []
    const warnings = []
    for (const hedString of hedStrings) {
      const [parsedString, errorIssues, warningIssues] = new HedStringParser(
        hedString,
        hedSchemas,
        definitionsAllowed,
        placeholdersAllowed,
      ).parse(fullValidation)
      parsedStrings.push(parsedString)
      errors.push(...errorIssues)
      warnings.push(...warningIssues)
    }

    if (parsedStrings.every((parsedString) => parsedString !== null)) {
      return [parsedStrings, errors, warnings]
    } else {
      return [null, errors, warnings]
    }
  }
}

/**
 * Parse a HED string.
 *
 * @remarks
 * Note: now separates errors and warnings for easier handling.
 *
 * @param hedString - A (possibly already parsed) HED string.
 * @param hedSchemas - The collection of HED schemas.
 * @param definitionsAllowed - True if definitions are allowed.
 * @param placeholdersAllowed - True if placeholders are allowed.
 * @param fullValidation - True if full validation is required.
 * @returns A tuple representing the parsed HED string and any issues found.
 */
export function parseHedString(
  hedString: string | ParsedHedString,
  hedSchemas: HedSchemas,
  definitionsAllowed: boolean,
  placeholdersAllowed: boolean,
  fullValidation: boolean,
): ReturnTupleWithErrorsAndWarnings<ParsedHedString> {
  return new HedStringParser(hedString, hedSchemas, definitionsAllowed, placeholdersAllowed).parse(fullValidation)
}

/**
 * Parse a HED string in a standalone context.
 *
 * @param hedString - A (possibly already parsed) HED string.
 * @param hedSchemas - The collection of HED schemas.
 * @param defManager - The definition manager to use for parsing definitions.
 * @returns A tuple representing the parsed HED string and any issues found.
 */
export function parseStandaloneString(
  hedString: string | ParsedHedString,
  hedSchemas: HedSchemas,
  defManager: DefinitionManager | null = null,
): ReturnTupleWithErrorsAndWarnings<ParsedHedString> {
  return new HedStringParser(hedString, hedSchemas, false, false).parseStandalone(defManager)
}

/**
 * Parse a list of HED strings.
 *
 * @remarks Now separates errors and warnings for easier handling.
 *
 * @param hedStrings - A list of HED strings.
 * @param hedSchemas - The collection of HED schemas.
 * @param definitionsAllowed - True if definitions are allowed
 * @param placeholdersAllowed - True if placeholders are allowed
 * @param fullValidation - True if full validation is required.
 * @returns A tuple representing the parsed HED strings and any issues found.
 */
export function parseHedStrings(
  hedStrings: string[] | ParsedHedString[],
  hedSchemas: HedSchemas,
  definitionsAllowed: boolean,
  placeholdersAllowed: boolean,
  fullValidation: boolean,
): ReturnTupleWithErrorsAndWarnings<ParsedHedString[] | null> {
  return HedStringParser.parseHedStrings(
    hedStrings,
    hedSchemas,
    definitionsAllowed,
    placeholdersAllowed,
    fullValidation,
  )
}
