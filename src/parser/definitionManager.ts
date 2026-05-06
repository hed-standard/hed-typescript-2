/**
 * This module holds classes to encapsulate and manage HED definitions.
 * @module parser/definitionManager
 */

import type ParsedHedGroup from './parsedHedGroup'
import type ParsedHedString from './parsedHedString'
import type ParsedHedTag from './parsedHedTag'
import { parseHedString } from './parser'
import { filterByTagName } from './parseUtils'
import { generateIssue, type Issue } from '../issues/issues'
import { type HedSchemas } from '../schema/containers'
import { type ReturnTupleWithErrorsAndWarnings, type ReturnTupleWithIssues } from '../utils/types'

export class Definition {
  /**
   * The name of the definition.
   */
  name: string

  /**
   * The name of the definition.
   */
  defTag: ParsedHedTag

  /**
   * The parsed HED group representing the definition
   */
  defGroup: ParsedHedGroup

  /**
   * The definition contents group.
   */
  defContents: ParsedHedGroup | null

  /**
   * If definition, this is the second value, otherwise empty string.
   */
  placeholder: string | null

  /**
   * A single definition.
   *
   * @param definitionGroup - the parsedHedGroup representing the definition.
   */
  private constructor(definitionGroup: ParsedHedGroup) {
    this.defGroup = definitionGroup
  }

  /**
   * Return the evaluated definition contents and any issues.
   *
   * @param tag - The parsed HED tag whose details should be checked.
   * @param hedSchema - The HED schemas used to validate against.
   * @param placeholderAllowed - If true then placeholder is allowed in the def tag.
   * @returns A tuple containing the evaluated normalized definition string and any issues in the evaluation,
   */
  evaluateDefinition(
    tag: ParsedHedTag,
    hedSchema: HedSchemas,
    placeholderAllowed: boolean,
  ): ReturnTupleWithErrorsAndWarnings<string> {
    // Check that the level of the value of tag agrees with the definition
    if (!!this.defTag.splitValue !== !!tag.splitValue) {
      const errorType = tag.schemaTag.name === 'Def' ? 'missingDefinitionForDef' : 'missingDefinitionForDefExpand'
      return [null, [generateIssue(errorType, { definition: tag.value })], []]
    }
    // Check that the evaluated definition contents okay (if two-level value)
    if (!this.defContents) {
      return ['', [], []]
    }
    if (!this.defTag.splitValue || (placeholderAllowed && tag.splitValue === '#')) {
      return [this.defContents.normalized, [], []]
    }
    const evalString = this.defContents.originalTag.replace('#', tag.splitValue ?? '#')
    const [normalizedValue, errorIssues, warningIssues] = parseHedString(evalString, hedSchema, false, false, true)
    if (normalizedValue === null) {
      return [null, errorIssues, warningIssues]
    }
    return [normalizedValue.normalized, [], []]
  }

  /**
   * Return true if this definition is the same as the other.
   *
   * @param other - Another definition to compare with this one.
   * @returns True if the definitions are equivalent
   */
  equivalent(other: unknown): boolean {
    if (!(other instanceof Definition)) {
      return false
    } else if (this.name !== other.name || this.defTag.splitValue !== other.defTag.splitValue) {
      return false
    } else if (this.defContents?.normalized !== other.defContents?.normalized) {
      return false
    }
    return true
  }

  /**
   * Verify that the placeholder count is correct in the definition.
   *
   * @returns The empty string if the placeholder count is correct, otherwise an error message.
   */
  private _checkDefinitionPlaceholderCount(): string {
    const placeholderCount = this.defContents ? this.defContents.originalTag.split('#').length - 1 : 0
    if (this.placeholder && placeholderCount !== 1) {
      return `The definition should have 1 placeholder but has ${placeholderCount} #s.`
    } else if (!this.placeholder && placeholderCount !== 0) {
      return `The definition should have no placeholders but has ${placeholderCount} #s.`
    }
    return ''
  }

  /**
   * Create a list of Definition objects from a list of strings.
   *
   * @param hedString - A string representing a definition.
   * @param hedSchemas - The HED schemas to use in creation.
   * @returns A tuple with the definition and any issues.
   */
  public static createDefinition(
    hedString: string,
    hedSchemas: HedSchemas,
  ): ReturnTupleWithErrorsAndWarnings<Definition> {
    const [parsedString, errorIssues, warningIssues] = parseHedString(hedString, hedSchemas, true, true, true)
    if (parsedString === null) {
      return [null, errorIssues, warningIssues]
    }
    if (parsedString.topLevelTags.length !== 0) {
      return [
        null,
        [
          generateIssue('invalidDefinition', {
            definition: hedString,
            msg: `There are extra tags outside the definition's defining group`,
          }),
        ],
        warningIssues,
      ]
    } else if (parsedString.tagGroups.length !== 1 && parsedString.tagGroups.length !== 0) {
      return [
        null,
        [
          generateIssue('invalidDefinition', {
            definition: hedString,
            msg: `There are too many tag groups inside the definition.`,
          }),
        ],
        warningIssues,
      ]
    }
    const [def, defIssues, defWarnings] = Definition.createDefinitionFromGroup(parsedString.tagGroups[0])
    return [def, defIssues, [...defWarnings, ...warningIssues]]
  }

  /**
   * Create a definition from a ParsedHedGroup.
   *
   * @param group - The group to create a definition from.
   * @returns A tuple with the definition and any issues. (The definition will be null if issues.)
   */
  public static createDefinitionFromGroup(group: ParsedHedGroup): ReturnTupleWithErrorsAndWarnings<Definition> {
    const def = new Definition(group)
    if (group.topTags.length !== 1 || group.topTags[0].schemaTag.name !== 'Definition') {
      return [
        null,
        [generateIssue('invalidDefinition', { definition: group.originalTag, msg: `There was no Definition tag.` })],
        [],
      ]
    }
    def.defTag = group.topTags[0]
    def.name = def.defTag.value
    def.placeholder = def.defTag.splitValue
    def.defContents = group.topGroups.length > 0 ? group.topGroups[0] : null
    const countErrorMsg = def._checkDefinitionPlaceholderCount()
    if (countErrorMsg.length === 0) {
      return [def, [], []]
    }
    return [
      null,
      [generateIssue('invalidPlaceholderInDefinition', { definition: def.defGroup.originalTag, msg: countErrorMsg })],
      [],
    ]
  }
}

export class DefinitionManager {
  /**
   * Definitions for this manager.
   */
  private readonly definitions: Map<string, Definition>

  constructor() {
    this.definitions = new Map()
  }

  /**
   * Add the non-null definitions to this manager.
   * @param defs - The list of definitions to add to this manager.
   * @returns Issues encountered in adding the definitions.
   */
  addDefinitions(defs: Definition[]): Issue[] {
    const issues = []
    for (const def of defs) {
      issues.push(...this.addDefinition(def))
    }
    return issues
  }

  /**
   * Add a Definition object to this manager.
   *
   * @param definition - The definition to be added.
   * @returns Issues encountered in adding the definition.
   */
  addDefinition(definition: Definition): Issue[] {
    const lowerName = definition.name.toLowerCase()
    const existingDefinition = this.definitions.get(lowerName)
    if (existingDefinition && !existingDefinition.equivalent(definition)) {
      return [
        generateIssue('conflictingDefinitions', {
          definition1: definition.defTag.originalTag,
          definition2: existingDefinition.defGroup.originalTag,
        }),
      ]
    }
    if (!existingDefinition) {
      this.definitions.set(lowerName, definition)
    }
    return []
  }

  /**
   * Check the Def tags in a HED string for missing or incorrectly used Def tags.
   *
   * @param hedString - A parsed HED string to be checked.
   * @param hedSchemas - Schemas to validate against.
   * @param placeholderAllowed - If true then placeholder is allowed in the def tag.
   * @returns If there is no matching definition or definition applied incorrectly.
   */
  validateDefs(hedString: ParsedHedString, hedSchemas: HedSchemas, placeholderAllowed: boolean): Issue[] {
    const defTags = filterByTagName(hedString.tags, 'Def')
    const issues = []
    for (const tag of defTags) {
      const defIssues = this.evaluateTag(tag, hedSchemas, placeholderAllowed)[1]
      if (defIssues.length > 0) {
        issues.push(...defIssues)
      }
    }
    return issues
  }

  /**
   * Check the Def tags in a HED string for missing or incorrectly used Def-expand tags.
   *
   * @param hedString - A parsed HED string to be checked.
   * @param hedSchemas - Schemas to validate against.
   * @param placeholderAllowed - If true then placeholder is allowed in the def tag.
   * @returns If there is no matching definition or definition applied incorrectly.
   */
  validateDefExpands(hedString: ParsedHedString, hedSchemas: HedSchemas, placeholderAllowed: boolean): Issue[] {
    //Def-expand tags should be rare, so don't look if there aren't any Def-expand tags
    const defExpandTags = filterByTagName(hedString.tags, 'Def-expand')
    if (defExpandTags.length === 0) {
      return []
    }
    const issues = []
    for (const topGroup of hedString.tagGroups) {
      issues.push(...this._checkDefExpandGroup(topGroup, hedSchemas, placeholderAllowed))
    }
    return issues
  }

  /**
   * Evaluate the definition based on a parsed HED tag.
   *
   * @param tag - The tag to evaluate against the definitions.
   * @param hedSchemas - The schemas to be used to assist in the evaluation.
   * @param placeholderAllowed - If true then placeholder is allowed in the def tag.
   * @returns A tuple with definition contents for this tag and any issues.
   *
   * Note: If the tag is not a Def or Def-expand, this returns null for the string and [] for the issues.
   */
  evaluateTag(tag: ParsedHedTag, hedSchemas: HedSchemas, placeholderAllowed: boolean): ReturnTupleWithIssues<string> {
    const [definition, missingIssues] = this.findDefinition(tag)
    if (definition === null) {
      return [null, missingIssues]
    } else if (definition) {
      const [evaluatedDefinition, errors, warnings] = definition.evaluateDefinition(tag, hedSchemas, placeholderAllowed)
      return [evaluatedDefinition, [...errors, ...warnings]]
    }
    return [null, []]
  }

  /**
   * Recursively check for Def-expand groups in this group.
   *
   * @param topGroup - a top group in a HED string to be evaluated for Def-expand groups.
   * @param hedSchemas - The HED schemas to used in the check.
   * @param placeholderAllowed - If true then placeholder is allowed in the def tag.
   * @returns Any issues found.
   */
  private _checkDefExpandGroup(topGroup: ParsedHedGroup, hedSchemas: HedSchemas, placeholderAllowed: boolean): Issue[] {
    const issues = []
    for (const group of topGroup.subParsedGroupIterator('Def-expand')) {
      if (group.defExpandTags.length === 0) {
        continue
      }
      // There should be only one Def-expand in this group as reserved requirements have been checked at parsing time.
      const [normalizedValue, normalizedIssues] = this.evaluateTag(
        group.defExpandTags[0],
        hedSchemas,
        placeholderAllowed,
      )
      issues.push(...normalizedIssues)
      if (normalizedIssues.length > 0) {
        continue
      }
      if (group.topGroups.length === 0 && normalizedValue !== '') {
        issues.push(generateIssue('defExpandContentsInvalid', { contents: '', defContents: normalizedValue }))
      } else if (group.topGroups.length > 0 && group.topGroups[0].normalized !== normalizedValue) {
        issues.push(
          generateIssue('defExpandContentsInvalid', {
            contents: group.topGroups[0].normalized,
            defContents: normalizedValue,
          }),
        )
      }
    }
    return issues
  }

  /**
   * Find the definition associated with a tag, if any.
   *
   * @param tag - The parsed HEd tag to be checked.
   * @returns A tuple with the definition and any issues found. If no match is found, the first element is null.
   */
  findDefinition(tag: ParsedHedTag): ReturnTupleWithIssues<Definition> {
    if (tag.schemaTag.name !== 'Def' && tag.schemaTag.name !== 'Def-expand') {
      return [null, []]
    }
    const name = tag.value.toLowerCase()
    const existingDefinition = this.definitions.get(name)
    const errorType = tag.schemaTag.name === 'Def' ? 'missingDefinitionForDef' : 'missingDefinitionForDefExpand'
    if (!existingDefinition) {
      return [null, [generateIssue(errorType, { definition: name })]]
    }
    if (Boolean(existingDefinition.defTag.splitValue) !== Boolean(tag.splitValue)) {
      return [null, [generateIssue(errorType, { definition: name })]]
    }
    return [existingDefinition, []]
  }

  /**
   * Create a list of Definition objects from a list of strings.
   *
   * @param defStrings - A list of string definitions.
   * @param hedSchemas - The HED schemas to use in creation.
   * @returns A tuple with a definition list and any issues found.
   */
  static createDefinitions(defStrings: string[], hedSchemas: HedSchemas): ReturnTupleWithIssues<Definition[]> {
    const defList = []
    const issues = []
    for (const defString of defStrings) {
      const [nextDef, defErrors, defWarnings] = Definition.createDefinition(defString, hedSchemas)
      if (nextDef) {
        defList.push(nextDef)
      }
      issues.push(...defErrors)
      issues.push(...defWarnings)
    }
    return [defList, issues]
  }
}
