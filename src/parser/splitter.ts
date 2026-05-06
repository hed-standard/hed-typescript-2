/**
 * This module holds the classes for basic splitting of HED strings.
 * @module parser/splitter
 */

import ParsedHedColumnSplice from './parsedHedColumnSplice'
import ParsedHedGroup from './parsedHedGroup'
import type ParsedHedSubstring from './parsedHedSubstring'
import ParsedHedTag from './parsedHedTag'
import { type GroupSpec, HedStringTokenizer, type NonGroupSubstringSpec, TagSpec } from './tokenizer'
import { generateIssue, type Issue, IssueError } from '../issues/issues'
import { type HedSchemas } from '../schema/containers'
import { recursiveMap } from '../utils/array'
import { type RecursiveArray, type ReturnTupleWithIssues } from '../utils/types'

export default class HedStringSplitter {
  /**
   * The HED string being split.
   */
  private readonly hedString: string

  /**
   * The collection of HED schemas.
   */
  private readonly hedSchemas: HedSchemas

  /**
   * Any issues found.
   */
  private readonly issues: Issue[]

  /**
   * The parsed HED substrings.
   */
  private parsedTags: ParsedHedSubstring[] | null | undefined

  /**
   * Constructor.
   *
   * @param hedString - The HED string to be split and parsed.
   * @param hedSchemas - The collection of HED schemas.
   */
  public constructor(hedString: string, hedSchemas: HedSchemas) {
    this.hedString = hedString
    this.hedSchemas = hedSchemas
    this.issues = []
    this.parsedTags = undefined
  }

  /**
   * Split and parse a HED string into tags and groups.
   *
   * This method is idempotent. If called repeatedly, it will simply return the already-parsed substrings and issues.
   *
   * @returns A tuple representing the parsed HED string data and any issues found.
   */
  public splitHedString(): ReturnTupleWithIssues<ParsedHedSubstring[]> {
    if (this.parsedTags === undefined) {
      this._splitHedString() // This should set the field to something defined.
    }
    if (this.parsedTags === undefined) {
      IssueError.generateAndThrowInternalError('parsedTags should have been set by now')
    }
    return [this.parsedTags, this.issues]
  }

  /**
   * Split and parse a HED string into tags and groups.
   *
   * @returns A tuple representing the parsed HED string data and any issues found.
   */
  private _splitHedString(): void {
    if (this.hedString === '') {
      this.parsedTags = []
      return
    }
    const [tagSpecs, groupBounds, issues] = new HedStringTokenizer(this.hedString).tokenize()
    if (groupBounds === null) {
      this.parsedTags = null
      this.issues.push(...issues)
      return
    }
    this.parsedTags = this._createParsedTags(tagSpecs, groupBounds)
  }

  /**
   * Create parsed HED tags and groups from specifications.
   *
   * @param tagSpecs - The tag specifications.
   * @param groupSpecs - The group specifications.
   * @returns A tuple representing the parsed HED tags and any issues found.
   */
  private _createParsedTags(
    tagSpecs: RecursiveArray<NonGroupSubstringSpec>,
    groupSpecs: GroupSpec,
  ): ParsedHedSubstring[] {
    // Create tags from specifications
    const parsedTags = recursiveMap(tagSpecs, (tagSpec) => this._createParsedTag(tagSpec))

    // Create groups from the parsed tags
    return this._createParsedGroups(parsedTags, groupSpecs.children)
  }

  /**
   * Create a parsed HED tag or column splice from a specification.
   *
   * @param tagSpec - The tag or column splice specification.
   * @returns The parsed tag or column splice spec, or null if the tag parsing generated an error.
   */
  private _createParsedTag(tagSpec: NonGroupSubstringSpec): ParsedHedTag | ParsedHedColumnSplice | null {
    if (tagSpec instanceof TagSpec) {
      try {
        return new ParsedHedTag(tagSpec, this.hedSchemas)
      } catch (issueError) {
        this.issues.push(this._handleIssueError(issueError))
        return null
      }
    } else {
      return new ParsedHedColumnSplice(tagSpec.columnName, tagSpec.bounds)
    }
  }

  /**
   * Handle any issue encountered during tag parsing.
   *
   * @param issueError - The error encountered.
   */
  private _handleIssueError(issueError: unknown): Issue {
    if (issueError instanceof IssueError) {
      return issueError.issue
    } else if (issueError instanceof Error) {
      return generateIssue('internalError', { message: issueError.message })
    } else {
      return generateIssue('internalError', { message: 'Unknown error type' })
    }
  }

  /**
   * Create parsed HED groups from parsed tags and group specifications.
   *
   * @param tags - The parsed HED tags.
   * @param groupSpecs - The group specifications.
   * @returns The parsed HED groups.
   */
  private _createParsedGroups(
    tags: RecursiveArray<ParsedHedSubstring | null>,
    groupSpecs: GroupSpec[],
  ): ParsedHedSubstring[] {
    const tagGroups: ParsedHedSubstring[] = []
    let index = 0

    for (const tag of tags) {
      if (Array.isArray(tag)) {
        const groupSpec = groupSpecs[index]
        tagGroups.push(
          new ParsedHedGroup(this._createParsedGroups(tag, groupSpec.children), this.hedString, groupSpec.bounds),
        )
        index++
      } else if (tag !== null) {
        tagGroups.push(tag)
      }
    }

    return tagGroups
  }
}
