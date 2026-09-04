import { isEqualWith } from 'lodash'

import SchemaTag from './tag'
import SchemaUnitClass from './unitClass'
import SchemaValueClass from './valueClass'
import SchemaEntryWithAttributes from './schemaEntryWithAttributes'
import SchemaEntry from './schemaEntry'
import type SchemaAttribute from './attribute'

import { IssueError } from '../../issues/issues'

/**
 * A value-taking tag in a HED schema.
 */
export default class SchemaValueTag extends SchemaTag {
  /**
   * Constructor.
   *
   * @param name - The name of this tag.
   * @param parentTag - This tag's parent tag.
   * @param booleanAttributes - The boolean attributes for this tag.
   * @param valueAttributes - The value attributes for this tag.
   * @param unitClasses - The unit classes for this tag.
   * @param valueClasses - The value classes for this tag.
   */
  constructor(
    name: string,
    parentTag: SchemaTag | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
    unitClasses: SchemaUnitClass[],
    valueClasses: SchemaValueClass[],
  ) {
    super(name, parentTag, booleanAttributes, valueAttributes, unitClasses, valueClasses)
    if (parentTag === undefined) {
      IssueError.generateAndThrowInternalError('Value tag must have parent')
    }
    parentTag.valueTag = this
  }

  /**
   * This tag's long name.
   */
  public override get longName(): string {
    const nameParts = this.ancestors.map((parentTag) => parentTag.name)
    nameParts.reverse()
    nameParts.push('#')
    return nameParts.join('/')
  }

  /**
   * Extend this tag's short name.
   *
   * @param extension - The extension.
   * @returns The extended short string.
   */
  public override extend(extension: string): string {
    return this.parent.extend(extension)
  }

  /**
   * Extend this tag's long name.
   *
   * @param extension - The extension.
   * @returns The extended long string.
   */
  public override longExtend(extension: string): string {
    return this.parent.longExtend(extension)
  }

  /**
   * This tag's parent tag.
   */
  public override get parent(): SchemaTag {
    return this._parent as SchemaTag
  }

  /**
   * Determine if this schema value tag is equivalent to another schema value tag.
   *
   * @remarks
   *
   * Schema value tags are deemed equivalent if they have the same name and equivalent attributes, equivalent unit and
   * value classes, and parent tags equivalent based on their names and attributes *only*.
   *
   * @param other - A schema value tag to compare with this one.
   * @returns Whether the other value tag is equivalent to this schema value tag.
   */
  public override equivalent(other: unknown): boolean {
    if (!(other instanceof SchemaValueTag)) {
      return false
    }
    if (!SchemaEntryWithAttributes.prototype.equivalent.call(this, other)) {
      return false
    }
    if (!SchemaEntryWithAttributes.prototype.equivalent.call(this.parent, other.parent)) {
      return false
    }
    if (
      !isEqualWith(
        this.unitClasses.toSorted(SchemaEntry.sortByName),
        other.unitClasses.toSorted(SchemaEntry.sortByName),
        (a, b) => (a instanceof SchemaUnitClass ? a.equivalent(b) : undefined),
      )
    ) {
      return false
    }
    return isEqualWith(
      this.valueClasses.toSorted(SchemaEntry.sortByName),
      other.valueClasses.toSorted(SchemaEntry.sortByName),
      (a, b) => (a instanceof SchemaValueClass ? a.equivalent(b) : undefined),
    )
  }
}
