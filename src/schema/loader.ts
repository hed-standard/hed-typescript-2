/**
 * This module holds the implementation for a non-browser schema loader.
 * @module schema/loader
 */

import AbstractHedSchemaLoader from './abstractLoader'
import { localSchemaMap } from './config'
import type { SchemaSpec } from './specs'
import type { HedSchemaXMLObject } from './xmlType'
import { IssueError } from '../issues/issues'
import * as files from '../utils/files'

export default class HedSchemaLoader extends AbstractHedSchemaLoader {
  /**
   * Load schema XML data from a local file.
   *
   * @param path - The path to the schema XML data.
   * @returns The schema XML data.
   * @throws {IssueError} If the schema could not be loaded.
   */
  protected override async loadLocalSchema(path: string): Promise<HedSchemaXMLObject> {
    return this.loadSchemaFile(files.readFile(path), 'localSchemaLoadFailed', { path })
  }

  /**
   * Determine whether this validator bundles a particular schema.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns Whether this validator bundles a particular schema.
   */
  protected override hasBundledSchema(schemaDef: SchemaSpec): boolean {
    return localSchemaMap.has(schemaDef.localName)
  }

  /**
   * Retrieve the contents of a bundled schema.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns The raw schema XML data.
   */
  protected override async getBundledSchema(schemaDef: SchemaSpec): Promise<string> {
    const schemaXml = localSchemaMap.get(schemaDef.localName)
    if (!schemaXml) {
      IssueError.generateAndThrowInternalError('Bundled schema could not be found')
    }
    return schemaXml
  }
}
