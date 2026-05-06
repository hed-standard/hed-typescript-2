/**
 * This module holds the classes for converting a tag specification into a schema-based tag object.
 * @module parser/tagConverter
 */

import { ReservedChecker } from './reservedChecker'
import { type TagSpec } from './tokenizer'
import { IssueError } from '../issues/issues'
import { type HedSchemas } from '../schema/containers'
import { type SchemaEntryManager, type SchemaTag } from '../schema/entries'
import { getTagSlashIndices } from '../utils/hedStrings'

/**
 * Converter from a tag specification to a schema-based tag object.
 */
export default class TagConverter {
  /**
   * A parsed tag token.
   */
  private readonly tagSpec: TagSpec

  /**
   * The tag string to convert.
   */
  private readonly tagString: string

  /**
   * The tag string split by slashes.
   */
  private readonly tagLevels: string[]

  /**
   * The indices of the tag string's slashes.
   */
  readonly tagSlashes: number[]

  /**
   * A HED schema collection.
   */
  private readonly hedSchemas: HedSchemas

  /**
   * The entry manager for the tags in the active schema.
   */
  private readonly tagMapping: SchemaEntryManager<SchemaTag> | undefined

  /**
   * The converted tag in the schema.
   */
  private schemaTag: SchemaTag

  /**
   * The remainder (e.g. value, extension) of the tag string.
   */
  private remainder: string

  /**
   * The special tag checker.
   */
  private readonly special: ReservedChecker

  /**
   * Constructor.
   *
   * @param tagSpec - The tag specification to convert.
   * @param hedSchemas - The HED schema collection.
   */
  public constructor(tagSpec: TagSpec, hedSchemas: HedSchemas) {
    this.hedSchemas = hedSchemas
    this.tagMapping = hedSchemas.getSchema(tagSpec.library)?.entries.tags
    this.tagSpec = tagSpec
    this.tagString = tagSpec.tag
    this.tagLevels = this.tagString.split('/')
    this.tagSlashes = getTagSlashIndices(this.tagString)
    this.remainder = ''
    this.special = ReservedChecker.getInstance()
  }

  /**
   * Retrieve the {@link SchemaTag} object for a tag specification.
   *
   * @returns The schema's corresponding tag object and the remainder of the tag string.
   * @throws {IssueError} If tag conversion fails.
   */
  public convert(): [SchemaTag, string] {
    let parentTag = undefined
    for (let tagLevelIndex = 0; tagLevelIndex < this.tagLevels.length; tagLevelIndex++) {
      if (parentTag?.valueTag) {
        // It is a value tag
        this._setSchemaTag(parentTag.valueTag, tagLevelIndex)
        return [this.schemaTag, this.remainder]
      }
      const childTag = this._validateChildTag(parentTag, tagLevelIndex)
      if (childTag === undefined) {
        // It is an extended tag and the rest is undefined
        this._setSchemaTag(parentTag, tagLevelIndex)
      }
      parentTag = childTag
    }
    this._setSchemaTag(parentTag, this.tagLevels.length + 1) // Fix the ending
    return [this.schemaTag, this.remainder]
  }

  private _validateChildTag(parentTag: SchemaTag | undefined, tagLevelIndex: number): SchemaTag | undefined {
    const childTag = this._getSchemaTag(tagLevelIndex)
    if (childTag === undefined) {
      // This is an extended tag
      if (tagLevelIndex === 0) {
        // Top level tags can't be extensions
        IssueError.generateAndThrow('invalidTag', {
          tag: this.tagString,
          msg: 'Tag extensions must have a parent in the HED schema.',
        })
      }
      if (
        parentTag !== undefined &&
        (!parentTag.hasAttribute('extensionAllowed') || this.special.noExtensionTags.has(parentTag.name))
      ) {
        IssueError.generateAndThrow('invalidExtension', {
          tag: this.tagLevels[tagLevelIndex],
          parentTag: this.tagLevels.slice(0, tagLevelIndex).join('/'),
          msg: `The tag "${this.tagLevels[tagLevelIndex]}" is an extension, but the parent tag "${parentTag.name}" does not allow extensions.`,
        })
      }
      this._checkExtensions(tagLevelIndex)
      return childTag
    }

    if (tagLevelIndex > 0 && (childTag.parent === undefined || childTag.parent !== parentTag)) {
      IssueError.generateAndThrow('invalidParentNode', {
        tag: this.tagLevels[tagLevelIndex],
        parentTag: this.tagLevels.slice(0, tagLevelIndex).join('/'),
        msg: `The parent tag "${parentTag?.name}" does not match the expected parent "${childTag.parent?.name}" in the schema.`,
      })
    }

    return childTag
  }

  private _checkExtensions(tagLevelIndex: number): void {
    // A non-tag has been detected --- from here on must be non-tags.
    this._checkNameClass(tagLevelIndex) // This is an extension
    for (let index = tagLevelIndex + 1; index < this.tagLevels.length; index++) {
      const child = this._getSchemaTag(index)
      if (child !== undefined) {
        // A schema tag showed up after a non-schema tag
        IssueError.generateAndThrow('invalidParentNode', {
          tag: child.name,
          parentTag: this.tagLevels.slice(0, index).join('/'),
          msg: `The tag "${child.name}" is a schema tag, but it appears after an extension tag "${this.tagLevels[tagLevelIndex]}".`,
        })
      }
      this._checkNameClass(index)
    }
  }

  private _getSchemaTag(tagLevelIndex: number): SchemaTag | undefined {
    const tagLevel = this.tagLevels[tagLevelIndex].toLowerCase()
    return this.tagMapping?.getEntry(tagLevel)
  }

  private _setSchemaTag(schemaTag: SchemaTag | undefined, remainderStartLevelIndex: number): void {
    if (this.schemaTag !== undefined || schemaTag === undefined) {
      return
    }
    this.schemaTag = schemaTag
    this.remainder = this.tagLevels.slice(remainderStartLevelIndex).join('/')
    if (this.schemaTag?.hasAttribute('requireChild') && !this.remainder) {
      IssueError.generateAndThrow('childRequired', {
        tag: this.tagString,
        msg: `The tag "${this.schemaTag?.name}" requires a child tag, but none was provided.`,
      })
    }
  }

  private _checkNameClass(index: number): void {
    // Check whether the tagLevel is a valid name class
    const valueClasses = this.hedSchemas.getSchema(this.tagSpec.library)?.entries.valueClasses
    if (!valueClasses?.definitions?.get('nameClass')?.validateValue(this.tagLevels[index])) {
      IssueError.generateAndThrow('invalidExtension', {
        tag: this.tagLevels[index],
        parentTag: this.tagLevels.slice(0, index).join('/'),
        msg: `The tag extension "${this.tagLevels[index]}" is not in the HED name class, so it cannot be used as a tag extension.`,
      })
    }
  }
}
