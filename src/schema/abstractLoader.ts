/**
 * This module holds the abstract superclass for a schema loader.
 * @module schema/abstractLoader
 */

import zip from 'lodash/zip'

import { HedSchema, PrimarySchema, HedSchemas } from './containers'
import SchemaParser from './parser'
import PartneredSchemaMerger from './schemaMerger'
import { type SchemaSpec, SchemasSpec } from './specs'
import { type HedSchemaXMLObject } from './xmlType'
import { IssueError, type IssueParameters } from '../issues/issues'
import * as files from '../utils/files'
import { splitStringTrimAndRemoveBlanks } from '../utils/string'
import parseSchemaXML from '../utils/xml'

export default abstract class AbstractHedSchemaLoader {
  /**
   * Build a schema collection object from a schema specification.
   *
   * @param schemaSpecs - The description of which schemas to use.
   * @returns The schema container object and any issues found.
   * @throws {IssueError} If the schema specification is invalid or schemas cannot be built.
   */
  public async buildSchemas(schemaSpecs: SchemasSpec): Promise<HedSchemas> {
    const schemaPrefixes = Array.from(schemaSpecs.data.keys())
    /* Data format example:
     * [[xmlData, ...], [xmlData, xmlData, ...], ...] */
    const schemaXmlData = await Promise.all(
      schemaPrefixes.map((prefix) => {
        const specs = schemaSpecs.data.get(prefix) ?? []
        return Promise.all(specs.map((spec) => this.loadSchema(spec)))
      }),
    )
    const schemaObjects = schemaXmlData.map((schemaXmls) => this.buildSchemaObjects(schemaXmls))
    const schemas = new Map<string, HedSchema>(zip(schemaPrefixes, schemaObjects) as [string, HedSchema][])
    return new HedSchemas(schemas)
  }

  /**
   * Build HED schemas from a version specification string.
   *
   * @param hedVersionString - The HED version specification string (can contain comma-separated versions).
   * @returns A Promise that resolves to the built schemas.
   * @throws {IssueError} If the schema specification is invalid or schemas cannot be built.
   */
  public async buildSchemasFromVersion(hedVersionString?: string): Promise<HedSchemas> {
    hedVersionString ??= ''
    const hedVersionSpecStrings = splitStringTrimAndRemoveBlanks(hedVersionString, ',')
    const hedVersionSpecs = SchemasSpec.parseVersionSpecs(hedVersionSpecStrings)
    return this.buildSchemas(hedVersionSpecs)
  }

  /**
   * Build a single merged schema container object from one or more XML files.
   *
   * @param xmlData - The schemas' XML data.
   * @returns The HED schema object.
   */
  private buildSchemaObjects(xmlData: HedSchemaXMLObject[]): HedSchema {
    const schemas = xmlData.map((data) => this.buildSchemaObject(data))
    if (schemas.length === 1) {
      return schemas[0]
    }
    const partneredSchemaMerger = new PartneredSchemaMerger(schemas)
    return partneredSchemaMerger.mergeSchemas()
  }

  /**
   * Build a single schema container object from an XML file.
   *
   * @param xmlData - The schema's XML data.
   * @returns The HED schema object.
   */
  private buildSchemaObject(xmlData: HedSchemaXMLObject): PrimarySchema {
    const schemaEntries = new SchemaParser(xmlData.HED).parse()
    return new PrimarySchema(xmlData, schemaEntries)
  }

  /**
   * Load schema XML data from a schema version or path description.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns The schema XML data.
   * @throws {IssueError} If the schema could not be loaded.
   * @internal
   */
  public async loadSchema(schemaDef: SchemaSpec): Promise<HedSchemaXMLObject> {
    const xmlData = await this.loadPromise(schemaDef)
    if (xmlData === null) {
      IssueError.generateAndThrow('invalidSchemaSpecification', { spec: JSON.stringify(schemaDef) })
    }
    return xmlData
  }

  /**
   * Choose the schema Promise from a schema version or path description.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns The schema XML data.
   * @throws {IssueError} If the schema could not be loaded.
   */
  private async loadPromise(schemaDef: SchemaSpec): Promise<HedSchemaXMLObject> {
    if (schemaDef.localPath) {
      return this.loadLocalSchema(schemaDef.localPath)
    } else if (this.hasBundledSchema(schemaDef)) {
      return this.loadBundledSchema(schemaDef)
    } else {
      return this.loadRemoteSchema(schemaDef)
    }
  }

  /**
   * Load schema XML data from a bundled file.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns The schema XML data.
   * @throws {IssueError} If the schema could not be loaded.
   */
  private async loadBundledSchema(schemaDef: SchemaSpec): Promise<HedSchemaXMLObject> {
    try {
      const bundledSchemaData = await this.getBundledSchema(schemaDef)
      return parseSchemaXML(bundledSchemaData)
    } catch (error) {
      IssueError.generateAndRethrow(
        error,
        (error) => ['bundledSchemaLoadFailed', { spec: JSON.stringify(schemaDef), error: error.message }],
        'Illegal error type when loading bundled schema',
      )
    }
  }

  /**
   * Determine whether this validator bundles a particular schema.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns Whether this validator bundles a particular schema.
   * @throws {IssueError} If the schema could not be loaded.
   */
  protected abstract hasBundledSchema(schemaDef: SchemaSpec): boolean

  /**
   * Retrieve the contents of a bundled schema.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns The raw schema XML data.
   * @throws {IssueError} If the schema could not be loaded.
   */
  protected abstract getBundledSchema(schemaDef: SchemaSpec): Promise<string>

  /**
   * Load schema XML data from the HED GitHub repository.
   *
   * @param schemaDef - The standard schema version to load.
   * @returns The schema XML data.
   * @throws {IssueError} If the schema could not be loaded.
   */
  private async loadRemoteSchema(schemaDef: SchemaSpec): Promise<HedSchemaXMLObject> {
    let url: string
    if (schemaDef.library) {
      url = `https://raw.githubusercontent.com/hed-standard/hed-schemas/refs/heads/main/library_schemas/${schemaDef.library}/hedxml/HED_${schemaDef.library}_${schemaDef.version}.xml`
    } else {
      url = `https://raw.githubusercontent.com/hed-standard/hed-schemas/refs/heads/main/standard_schema/hedxml/HED${schemaDef.version}.xml`
    }
    return this.loadSchemaFile(files.readHTTPSFile(url), 'remoteSchemaLoadFailed', { spec: JSON.stringify(schemaDef) })
  }
  /**
   * Load schema XML data from a local file.
   *
   * @param path - The path to the schema XML data.
   * @returns The schema XML data.
   * @throws {IssueError} If the schema could not be loaded.
   */
  protected abstract loadLocalSchema(path: string): Promise<HedSchemaXMLObject>

  /**
   * Actually load the schema XML file.
   *
   * @param xmlDataPromise - The Promise containing the unparsed XML data.
   * @param issueCode - The issue code.
   * @param issueArgs - The issue arguments passed from the calling function.
   * @returns The parsed schema XML data.
   * @throws {IssueError} If the schema could not be loaded.
   */
  protected async loadSchemaFile(
    xmlDataPromise: Promise<string>,
    issueCode: string,
    issueArgs: IssueParameters,
  ): Promise<HedSchemaXMLObject> {
    try {
      const data = await xmlDataPromise
      return parseSchemaXML(data)
    } catch (error) {
      IssueError.generateAndRethrow(
        error,
        (error) => [issueCode, { ...issueArgs, error: error.message }],
        'Illegal error type when loading schema file',
      )
    }
  }
}
