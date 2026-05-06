/**
 * This module holds the class for representing a HED group.
 * @module parser/parsedHedGroup
 */

import differenceWith from 'lodash/differenceWith'

import ParsedHedColumnSplice from './parsedHedColumnSplice'
import ParsedHedSubstring from './parsedHedSubstring'
import ParsedHedTag from './parsedHedTag'
import { ReservedChecker } from './reservedChecker'
import { categorizeTagsByName, filterByClass, filterByTagName, getDuplicates } from './parseUtils'
import { IssueError } from '../issues/issues'

/**
 * A parsed HED tag group.
 */
export default class ParsedHedGroup extends ParsedHedSubstring {
  /**
   * The parsed HED tags, groups, or splices in the HED tag group at the top level.
   */
  readonly tags: ParsedHedSubstring[]

  /**
   * The top-level parsed HED tags in this string.
   */
  readonly topTags: ParsedHedTag[]

  /**
   * The top-level parsed HED groups in this string.
   */
  readonly topGroups: ParsedHedGroup[]

  /**
   * The top-level column splices in this string.
   */
  readonly topSplices: ParsedHedColumnSplice[]

  /**
   * All the parsed HED tags in this string.
   */
  readonly allTags: ParsedHedTag[]

  /**
   * Reserved HED group tags. This only covers top group tags in the group.
   */
  readonly reservedTags: Map<string, ParsedHedTag[]>

  /**
   * The top-level child subgroups containing Def-expand tags.
   */
  readonly defExpandChildren: ParsedHedGroup[]

  /**
   * The top-level Def tags.
   */
  readonly defTags: ParsedHedTag[]

  /**
   * The top-level Def-expand tags.
   */
  readonly defExpandTags: ParsedHedTag[]

  /**
   * The top-level Definition tags.
   */
  readonly definitionTags: ParsedHedTag[]

  /**
   * True if this group has a Definition tag at the top level.
   */
  readonly isDefinitionGroup: boolean

  /**
   * The total number of top-level Def tags and top-level Def-expand groups.
   */
  readonly defCount: number

  /**
   * The unique top-level tag requiring a Def or Def-expand group, if any.
   */
  readonly requiresDefTag: ParsedHedTag[]

  /**
   * The normalized string representation of this column splice.
   */
  #normalized: string | undefined

  /**
   * Constructor.
   *
   * @param parsedHedTags - The parsed HED tags, groups or column splices in the HED tag group.
   * @param hedString - The original HED string.
   * @param originalBounds - The bounds of the HED tag in the original HED string.
   */
  public constructor(parsedHedTags: ParsedHedSubstring[], hedString: string, originalBounds: [number, number]) {
    const originalTag = hedString.substring(originalBounds[0], originalBounds[1])
    super(originalTag, originalBounds)
    this.tags = parsedHedTags
    this.topGroups = filterByClass(parsedHedTags, ParsedHedGroup)
    this.topTags = filterByClass(parsedHedTags, ParsedHedTag)
    this.topSplices = filterByClass(parsedHedTags, ParsedHedColumnSplice)
    this.allTags = this._getAllTags()
    this.#normalized = undefined

    // Initialize groups.
    const reserved = ReservedChecker.getInstance()
    this.reservedTags = categorizeTagsByName(this.topTags, reserved.reservedNames)
    this.defExpandTags = this._filterTopTagsByTagName('Def-expand')
    this.definitionTags = this._filterTopTagsByTagName('Definition')
    this.defExpandChildren = this._filterSubgroupsByTagName('Def-expand')
    this.defTags = this._filterTopTagsByTagName('Def')
    this.defCount = this.defTags.length + this.defExpandChildren.length
    this.isDefinitionGroup = this.definitionTags.length > 0
    this.requiresDefTag = [...this.reservedTags.entries()]
      .filter((pair) => reserved.requiresDefTags.has(pair[0]))
      .flatMap((pair) => pair[1]) // Flatten the values into a single list
  }

  /**
   * Recursively create a list of all the tags in this group.
   *
   * @returns A list of all the tags in this group.
   */
  private _getAllTags(): ParsedHedTag[] {
    const subgroupTags = this.topGroups.flatMap((tagGroup) => tagGroup.allTags)
    return this.topTags.concat(subgroupTags)
  }

  /**
   * Filter top tags by tag name.
   *
   * @param tagName - The schemaTag name to filter by.
   * @returns An array of top-level tags with the given name.
   */
  private _filterTopTagsByTagName(tagName: string): ParsedHedTag[] {
    return this.topTags.filter((tag) => tag.schemaTag.name === tagName)
  }

  /**
   * Filter top subgroups that include a tag at the top-level of the group.
   *
   * @param tagName - The schemaTag name to filter by.
   * @returns Array of subgroups containing the specified tag.
   */
  private _filterSubgroupsByTagName(tagName: string): ParsedHedGroup[] {
    return Array.from(this.topLevelGroupIterator()).filter((subgroup) =>
      subgroup.topTags.some((tag) => tag.schemaTag.name === tagName),
    )
  }

  /**
   * Nicely format this tag group.
   *
   * @param long - Whether the tags should be in long form.
   * @returns The formatted tag group.
   */
  public format(long: boolean = true): string {
    return '(' + this.tags.map((substring) => substring.format(long)).join(', ') + ')'
  }

  /**
   * Determine if this group is equivalent to another.
   *
   * @param other - The other group.
   * @returns Whether the two groups are equivalent.
   */
  public equivalent(other: unknown): boolean {
    if (!(other instanceof ParsedHedGroup)) {
      return false
    }
    const equivalence = (ours: ParsedHedGroup, theirs: ParsedHedGroup) => ours.equivalent(theirs)
    return (
      differenceWith(this.tags, other.tags, equivalence).length === 0 &&
      differenceWith(other.tags, this.tags, equivalence).length === 0
    )
  }

  /**
   * Return a normalized string representation.
   *
   * @returns The normalized string representation of this group.
   */
  public get normalized(): string {
    if (this.#normalized) {
      return this.#normalized
    }
    // Recursively normalize each item in the group
    const normalizedItems = this.tags.map((item) => item.normalized)

    // Sort normalized items to ensure order independence
    const sortedNormalizedItems = normalizedItems.toSorted((a, b) => a.localeCompare(b))

    const duplicates = getDuplicates(sortedNormalizedItems)
    if (duplicates.length > 0) {
      IssueError.generateAndThrow('duplicateTag', {
        tags: '[' + duplicates.join('],[') + ']',
        string: this.originalTag,
      })
    }
    this.#normalized = '(' + sortedNormalizedItems.join(',') + ')'
    return this.#normalized
  }

  /**
   * Override of {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString | Object.prototype.toString}.
   *
   * @returns The original string for this group.
   */
  public override toString(): string {
    return this.originalTag
  }

  /**
   * Iterator over the ParsedHedGroup objects in this HED tag group.
   *
   * @param tagName - The name of the tag whose groups are to be iterated over or null if all tags.
   * @yields This object and the ParsedHedGroup objects belonging to this tag group.
   */
  public *subParsedGroupIterator(tagName: string | null = null): Generator<ParsedHedGroup> {
    if (!tagName || filterByTagName(this.topTags, tagName).length > 0) {
      yield this
    }
    for (const innerTag of this.tags) {
      if (innerTag instanceof ParsedHedGroup) {
        yield* innerTag.subParsedGroupIterator(tagName)
      }
    }
  }

  /**
   * Iterator over the parsed HED tags in this HED tag group.
   *
   * @yields This tag group's HED tags.
   */
  public *tagIterator(): Generator<ParsedHedTag> {
    for (const innerTag of this.tags) {
      if (innerTag instanceof ParsedHedTag) {
        yield innerTag
      } else if (innerTag instanceof ParsedHedGroup) {
        yield* innerTag.tagIterator()
      }
    }
  }

  /**
   * Iterator over the parsed HED column splices in this HED tag group.
   *
   * @yields This tag group's HED column splices.
   */
  public *columnSpliceIterator(): Generator<ParsedHedColumnSplice> {
    for (const innerTag of this.tags) {
      if (innerTag instanceof ParsedHedColumnSplice) {
        yield innerTag
      } else if (innerTag instanceof ParsedHedGroup) {
        yield* innerTag.columnSpliceIterator()
      }
    }
  }

  /**
   * Iterator over the top-level parsed HED groups in this HED tag group.
   *
   * @yields This tag group's top-level HED groups.
   */
  public *topLevelGroupIterator(): Generator<ParsedHedGroup> {
    for (const innerTag of this.tags) {
      if (innerTag instanceof ParsedHedGroup) {
        yield innerTag
      }
    }
  }
}
